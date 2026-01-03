/**
 * Ticket Auto-Assignment Engine
 * 
 * Intelligently assigns tickets to support agents based on:
 * - Agent expertise/skills matching
 * - Current workload (weighted round-robin)
 * - Agent availability (online status)
 * - Category/priority matching
 * - Tenant-specific agent pools
 * 
 * Assignment strategies:
 * - ROUND_ROBIN: Distribute evenly among available agents
 * - LEAST_BUSY: Assign to agent with lowest open ticket count
 * - EXPERTISE_MATCH: Prioritize agents with matching skills
 * - HYBRID: Combine expertise + workload (default)
 */

import { db } from '../db';
import { eq, and, desc, asc, sql, inArray, isNull, not } from 'drizzle-orm';
import { publishEvent } from '../integrations/automation';

// Assignment strategies
export type AssignmentStrategy = 
  | 'ROUND_ROBIN' 
  | 'LEAST_BUSY' 
  | 'EXPERTISE_MATCH' 
  | 'HYBRID';

// Agent status
export type AgentStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

interface SupportAgent {
  id: number;
  userId: number;
  displayName: string;
  email: string;
  status: AgentStatus;
  expertise: string[]; // Categories the agent specializes in
  maxConcurrentTickets: number;
  currentOpenTickets: number;
  averageResponseTimeMinutes: number;
  averageResolutionTimeMinutes: number;
  satisfactionScore: number; // 0-5
  isActive: boolean;
  tenantId?: number; // null = global agent
}

interface TicketForAssignment {
  id: number;
  category: string;
  priority: string;
  tenantId: number;
  language?: string;
  subject: string;
  assignedAgentId: number | null;
}

interface AssignmentResult {
  success: boolean;
  agentId?: number;
  agentName?: string;
  reason: string;
  score?: number;
  alternatives?: Array<{ agentId: number; score: number }>;
}

interface AssignmentConfig {
  strategy: AssignmentStrategy;
  maxWorkloadPercent: number; // Don't assign if agent is above this % of max
  preferSameTenant: boolean;
  expertiseWeight: number; // 0-1
  workloadWeight: number; // 0-1
  performanceWeight: number; // 0-1
}

const DEFAULT_CONFIG: AssignmentConfig = {
  strategy: 'HYBRID',
  maxWorkloadPercent: 90,
  preferSameTenant: true,
  expertiseWeight: 0.4,
  workloadWeight: 0.35,
  performanceWeight: 0.25,
};

// Round-robin state (in production, use Redis)
const roundRobinState: Map<number, number> = new Map(); // tenantId -> lastAssignedAgentIndex

/**
 * Load available agents from database
 */
async function loadAvailableAgents(
  tenantId?: number,
  category?: string
): Promise<SupportAgent[]> {
  try {
    // In production, query support_agents table
    // Example query:
    // SELECT * FROM support_agents
    // WHERE is_active = true
    // AND status IN ('ONLINE', 'AWAY')
    // AND current_open_tickets < max_concurrent_tickets
    // AND (tenant_id IS NULL OR tenant_id = ?)
    // ORDER BY current_open_tickets ASC
    
    // For now, return empty array (will be wired to database)
    return [];
    
  } catch (error) {
    console.error('[AutoAssign] Failed to load agents:', error);
    return [];
  }
}

/**
 * Calculate agent score for assignment
 */
function calculateAgentScore(
  agent: SupportAgent,
  ticket: TicketForAssignment,
  config: AssignmentConfig
): number {
  let score = 0;
  
  // Expertise match score (0-100)
  const hasExpertise = agent.expertise.includes(ticket.category);
  const expertiseScore = hasExpertise ? 100 : 50;
  score += expertiseScore * config.expertiseWeight;
  
  // Workload score (0-100, higher = less busy)
  const workloadPercent = (agent.currentOpenTickets / agent.maxConcurrentTickets) * 100;
  const workloadScore = Math.max(0, 100 - workloadPercent);
  score += workloadScore * config.workloadWeight;
  
  // Performance score (0-100, based on satisfaction and response time)
  const satisfactionScore = (agent.satisfactionScore / 5) * 100;
  const responseScore = agent.averageResponseTimeMinutes > 0
    ? Math.max(0, 100 - (agent.averageResponseTimeMinutes / 60) * 10) // Penalize slow response
    : 50;
  const performanceScore = (satisfactionScore + responseScore) / 2;
  score += performanceScore * config.performanceWeight;
  
  // Bonus for same tenant
  if (config.preferSameTenant && agent.tenantId === ticket.tenantId) {
    score += 10;
  }
  
  // Bonus for ONLINE status
  if (agent.status === 'ONLINE') {
    score += 5;
  }
  
  // Penalty for HIGH/URGENT priority if agent is busy
  if (['HIGH', 'URGENT'].includes(ticket.priority) && workloadPercent > 70) {
    score -= 15;
  }
  
  return Math.round(score * 100) / 100;
}

/**
 * Round-robin assignment
 */
function assignRoundRobin(
  agents: SupportAgent[],
  tenantId: number
): SupportAgent | null {
  if (agents.length === 0) return null;
  
  const lastIndex = roundRobinState.get(tenantId) || 0;
  const nextIndex = (lastIndex + 1) % agents.length;
  
  roundRobinState.set(tenantId, nextIndex);
  return agents[nextIndex];
}

/**
 * Least-busy assignment
 */
function assignLeastBusy(agents: SupportAgent[]): SupportAgent | null {
  if (agents.length === 0) return null;
  
  return agents.reduce((least, current) => {
    const leastLoad = least.currentOpenTickets / least.maxConcurrentTickets;
    const currentLoad = current.currentOpenTickets / current.maxConcurrentTickets;
    return currentLoad < leastLoad ? current : least;
  });
}

/**
 * Expertise-based assignment
 */
function assignByExpertise(
  agents: SupportAgent[],
  category: string
): SupportAgent | null {
  if (agents.length === 0) return null;
  
  // Find agents with matching expertise
  const experts = agents.filter(a => a.expertise.includes(category));
  
  if (experts.length > 0) {
    // Among experts, pick least busy
    return assignLeastBusy(experts);
  }
  
  // No experts, fall back to least busy
  return assignLeastBusy(agents);
}

/**
 * Hybrid assignment (default)
 */
function assignHybrid(
  agents: SupportAgent[],
  ticket: TicketForAssignment,
  config: AssignmentConfig
): { agent: SupportAgent | null; scores: Array<{ agentId: number; score: number }> } {
  if (agents.length === 0) {
    return { agent: null, scores: [] };
  }
  
  // Calculate scores for all agents
  const scoredAgents = agents.map(agent => ({
    agent,
    score: calculateAgentScore(agent, ticket, config),
  }));
  
  // Sort by score descending
  scoredAgents.sort((a, b) => b.score - a.score);
  
  const scores = scoredAgents.map(s => ({ agentId: s.agent.id, score: s.score }));
  
  return {
    agent: scoredAgents[0]?.agent || null,
    scores,
  };
}

/**
 * Assign a ticket to the best available agent
 */
export async function assignTicket(
  ticket: TicketForAssignment,
  config: Partial<AssignmentConfig> = {}
): Promise<AssignmentResult> {
  const effectiveConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // Skip if already assigned
    if (ticket.assignedAgentId) {
      return {
        success: true,
        agentId: ticket.assignedAgentId,
        reason: 'Already assigned',
      };
    }
    
    // Load available agents
    const agents = await loadAvailableAgents(ticket.tenantId, ticket.category);
    
    // Filter by max workload
    const availableAgents = agents.filter(agent => {
      const workloadPercent = (agent.currentOpenTickets / agent.maxConcurrentTickets) * 100;
      return workloadPercent < effectiveConfig.maxWorkloadPercent;
    });
    
    if (availableAgents.length === 0) {
      return {
        success: false,
        reason: 'No available agents',
      };
    }
    
    let selectedAgent: SupportAgent | null = null;
    let alternatives: Array<{ agentId: number; score: number }> = [];
    let score: number | undefined;
    
    // Apply assignment strategy
    switch (effectiveConfig.strategy) {
      case 'ROUND_ROBIN':
        selectedAgent = assignRoundRobin(availableAgents, ticket.tenantId);
        break;
      
      case 'LEAST_BUSY':
        selectedAgent = assignLeastBusy(availableAgents);
        break;
      
      case 'EXPERTISE_MATCH':
        selectedAgent = assignByExpertise(availableAgents, ticket.category);
        break;
      
      case 'HYBRID':
      default:
        const result = assignHybrid(availableAgents, ticket, effectiveConfig);
        selectedAgent = result.agent;
        alternatives = result.scores.slice(1, 4); // Top 3 alternatives
        score = result.scores[0]?.score;
        break;
    }
    
    if (!selectedAgent) {
      return {
        success: false,
        reason: 'No suitable agent found',
      };
    }
    
    // Update ticket assignment in database
    // In production: UPDATE support_tickets_extended SET assigned_agent_id = ?, assigned_at = NOW()
    console.log(`[AutoAssign] Assigning ticket #${ticket.id} to agent ${selectedAgent.displayName} (ID: ${selectedAgent.id})`);
    
    // Publish assignment event
    publishEvent('ticket.updated', {
      ticketId: ticket.id,
      subject: ticket.subject,
      action: 'assigned',
      assignedAgentId: selectedAgent.id,
      assignedAgentName: selectedAgent.displayName,
      strategy: effectiveConfig.strategy,
      score,
    }, {
      tenantId: ticket.tenantId,
    });
    
    return {
      success: true,
      agentId: selectedAgent.id,
      agentName: selectedAgent.displayName,
      reason: `Assigned via ${effectiveConfig.strategy}`,
      score,
      alternatives,
    };
    
  } catch (error) {
    console.error(`[AutoAssign] Failed to assign ticket #${ticket.id}:`, error);
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reassign a ticket (e.g., after escalation)
 */
export async function reassignTicket(
  ticketId: number,
  reason: string,
  preferManager: boolean = false
): Promise<AssignmentResult> {
  try {
    // In production, fetch ticket and reassign
    // Exclude current agent from pool
    // If preferManager, only consider manager-level agents
    
    console.log(`[AutoAssign] Reassigning ticket #${ticketId}: ${reason}`);
    
    return {
      success: false,
      reason: 'Not implemented - wire to database',
    };
    
  } catch (error) {
    console.error(`[AutoAssign] Failed to reassign ticket #${ticketId}:`, error);
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Unassign a ticket
 */
export async function unassignTicket(
  ticketId: number,
  reason: string
): Promise<boolean> {
  try {
    // In production: UPDATE support_tickets_extended SET assigned_agent_id = NULL
    console.log(`[AutoAssign] Unassigning ticket #${ticketId}: ${reason}`);
    
    return true;
    
  } catch (error) {
    console.error(`[AutoAssign] Failed to unassign ticket #${ticketId}:`, error);
    return false;
  }
}

/**
 * Get assignment recommendations without actually assigning
 */
export async function getAssignmentRecommendations(
  ticket: TicketForAssignment,
  count: number = 5
): Promise<Array<{ agent: SupportAgent; score: number; reasons: string[] }>> {
  try {
    const agents = await loadAvailableAgents(ticket.tenantId, ticket.category);
    const config = DEFAULT_CONFIG;
    
    const recommendations = agents.map(agent => {
      const score = calculateAgentScore(agent, ticket, config);
      const reasons: string[] = [];
      
      if (agent.expertise.includes(ticket.category)) {
        reasons.push(`Expertise in ${ticket.category}`);
      }
      
      const workloadPercent = (agent.currentOpenTickets / agent.maxConcurrentTickets) * 100;
      if (workloadPercent < 50) {
        reasons.push('Low current workload');
      }
      
      if (agent.satisfactionScore >= 4.5) {
        reasons.push('High satisfaction rating');
      }
      
      if (agent.averageResponseTimeMinutes < 30) {
        reasons.push('Fast response time');
      }
      
      if (agent.tenantId === ticket.tenantId) {
        reasons.push('Same tenant');
      }
      
      return { agent, score, reasons };
    });
    
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
    
  } catch (error) {
    console.error('[AutoAssign] Failed to get recommendations:', error);
    return [];
  }
}

/**
 * Get agent workload statistics
 */
export async function getAgentWorkloadStats(): Promise<Array<{
  agentId: number;
  name: string;
  status: AgentStatus;
  openTickets: number;
  maxTickets: number;
  utilizationPercent: number;
}>> {
  try {
    const agents = await loadAvailableAgents();
    
    return agents.map(agent => ({
      agentId: agent.id,
      name: agent.displayName,
      status: agent.status,
      openTickets: agent.currentOpenTickets,
      maxTickets: agent.maxConcurrentTickets,
      utilizationPercent: Math.round((agent.currentOpenTickets / agent.maxConcurrentTickets) * 100),
    }));
    
  } catch (error) {
    console.error('[AutoAssign] Failed to get workload stats:', error);
    return [];
  }
}

/**
 * Update agent status
 */
export async function updateAgentStatus(
  agentId: number,
  status: AgentStatus
): Promise<boolean> {
  try {
    // In production: UPDATE support_agents SET status = ?
    console.log(`[AutoAssign] Agent ${agentId} status changed to ${status}`);
    return true;
    
  } catch (error) {
    console.error(`[AutoAssign] Failed to update agent ${agentId} status:`, error);
    return false;
  }
}
