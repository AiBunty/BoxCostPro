/**
 * n8n Automation Adapter
 * 
 * Implements IAutomationProvider for n8n workflow automation platform
 * Supports both self-hosted and cloud n8n instances
 * Docs: https://docs.n8n.io/api/
 */

import crypto from 'crypto';
import {
  BaseAutomationProvider,
  AutomationProviderConfig,
  WorkflowTrigger,
  AutomationHealthCheckResult,
  AutomationProviderCode,
} from '../IAutomationProvider';

export class N8nAdapter extends BaseAutomationProvider {
  readonly providerCode: AutomationProviderCode = 'n8n';
  readonly providerName = 'n8n Workflow Automation';
  
  private baseUrl: string = '';
  private apiKey: string = '';
  
  // Local trigger registry (in production, store in database)
  private triggers: Map<string, WorkflowTrigger> = new Map();
  
  async initialize(config: AutomationProviderConfig): Promise<void> {
    if (!config.baseUrl) {
      throw new Error('n8n base URL is required');
    }
    if (!config.apiKey) {
      throw new Error('n8n API key is required');
    }
    
    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    
    // Validate connection
    const health = await this.testConnection();
    if (!health.isHealthy) {
      throw new Error(`n8n initialization failed: ${health.message}`);
    }
  }
  
  /**
   * Register a webhook trigger in n8n
   * Note: In n8n, webhooks are typically created within workflows, not via API.
   * This method registers the trigger locally for outbound webhook delivery.
   */
  async registerTrigger(
    trigger: Omit<WorkflowTrigger, 'id' | 'createdAt'>
  ): Promise<WorkflowTrigger> {
    const id = crypto.randomUUID();
    
    const fullTrigger: WorkflowTrigger = {
      ...trigger,
      id,
      createdAt: new Date(),
    };
    
    this.triggers.set(id, fullTrigger);
    
    // In production, persist to database
    console.log(`[N8nAdapter] Registered trigger: ${trigger.name} for event ${trigger.event}`);
    
    return fullTrigger;
  }
  
  /**
   * Deactivate a trigger
   */
  async deactivateTrigger(triggerId: string): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      return false;
    }
    
    trigger.isActive = false;
    this.triggers.set(triggerId, trigger);
    
    console.log(`[N8nAdapter] Deactivated trigger: ${triggerId}`);
    return true;
  }
  
  /**
   * Get all registered triggers for an event
   */
  getTriggersForEvent(event: string): WorkflowTrigger[] {
    return Array.from(this.triggers.values())
      .filter(t => t.event === event && t.isActive);
  }
  
  /**
   * List all workflows in n8n
   */
  async listWorkflows(): Promise<any[]> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workflows`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
      
    } catch (error) {
      console.error('[N8nAdapter] Failed to list workflows:', error);
      throw error;
    }
  }
  
  /**
   * Activate a specific workflow
   */
  async activateWorkflow(workflowId: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/activate`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('[N8nAdapter] Failed to activate workflow:', error);
      return false;
    }
  }
  
  /**
   * Deactivate a specific workflow
   */
  async deactivateWorkflow(workflowId: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/deactivate`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('[N8nAdapter] Failed to deactivate workflow:', error);
      return false;
    }
  }
  
  /**
   * Execute a workflow via webhook or manual trigger
   */
  async executeWorkflow(
    workflowId: string,
    data?: Record<string, any>
  ): Promise<{ executionId?: string; success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Provider not initialized' };
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/workflows/${workflowId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': this.apiKey,
        },
        body: JSON.stringify({ data }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || response.statusText,
        };
      }
      
      const result = await response.json();
      
      return {
        success: true,
        executionId: result.data?.executionId,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Get execution history for a workflow
   */
  async getExecutions(
    workflowId?: string,
    limit: number = 20
  ): Promise<any[]> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }
    
    try {
      let url = `${this.baseUrl}/api/v1/executions?limit=${limit}`;
      if (workflowId) {
        url += `&workflowId=${workflowId}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
      
    } catch (error) {
      console.error('[N8nAdapter] Failed to get executions:', error);
      return [];
    }
  }
  
  async testConnection(): Promise<AutomationHealthCheckResult> {
    if (!this.config) {
      return {
        isHealthy: false,
        latencyMs: 0,
        message: 'Provider not initialized',
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Get n8n health/version info
      const response = await fetch(`${this.baseUrl}/api/v1/workflows?limit=1`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      
      const latencyMs = Date.now() - startTime;
      
      if (!response.ok) {
        this.markUnhealthy();
        return {
          isHealthy: false,
          latencyMs,
          message: `API returned ${response.status}: ${response.statusText}`,
        };
      }
      
      this.markHealthy();
      
      return {
        isHealthy: true,
        latencyMs,
        message: 'n8n API is reachable',
        details: {
          baseUrl: this.baseUrl,
        },
      };
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.markUnhealthy();
      
      return {
        isHealthy: false,
        latencyMs,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}
