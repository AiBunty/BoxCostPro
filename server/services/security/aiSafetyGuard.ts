/**
 * AI Safety Guard - Prompt injection detection, PII filtering, output validation
 * 
 * Provides:
 * 1. Prompt injection detection
 * 2. Jailbreak attempt detection
 * 3. PII detection and redaction
 * 4. Output content validation
 * 5. Rate abuse detection
 */

import { db } from '../../db';
import { aiSecurityLogs, InsertAiSecurityLog } from '../../../shared/schema-finops-security';
import { logIntegrationAudit } from '../../integrations/helpers/auditLogger';
import crypto from 'crypto';

// Detection result
export interface SafetyCheckResult {
  safe: boolean;
  issues: SafetyIssue[];
  sanitizedInput?: string;
  action: 'ALLOW' | 'BLOCK' | 'SANITIZE' | 'FLAG' | 'ESCALATE';
}

export interface SafetyIssue {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  matchedPattern?: string;
  confidence: number;
}

// Prompt injection patterns
const INJECTION_PATTERNS = [
  // Role/persona manipulation
  { pattern: /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i, severity: 'HIGH' as const, description: 'Role manipulation attempt' },
  { pattern: /you\s+are\s+(now|no\s+longer)/i, severity: 'HIGH' as const, description: 'Persona change attempt' },
  { pattern: /disregard\s+(your|all|the)\s+(rules?|guidelines?|instructions?)/i, severity: 'HIGH' as const, description: 'Rule bypass attempt' },
  { pattern: /pretend\s+(you're|you\s+are|to\s+be)/i, severity: 'MEDIUM' as const, description: 'Pretend prompt' },
  { pattern: /act\s+as\s+(if|though|an?)\s/i, severity: 'MEDIUM' as const, description: 'Role play prompt' },
  { pattern: /new\s+(persona|role|identity|character)/i, severity: 'MEDIUM' as const, description: 'Identity change attempt' },
  
  // System prompt extraction
  { pattern: /what\s+(are|is)\s+your\s+(system\s+)?prompt/i, severity: 'HIGH' as const, description: 'System prompt extraction attempt' },
  { pattern: /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i, severity: 'HIGH' as const, description: 'System prompt extraction attempt' },
  { pattern: /reveal\s+(your|the)\s+(original|initial|system)/i, severity: 'HIGH' as const, description: 'System prompt extraction attempt' },
  { pattern: /repeat\s+(your|the)\s+(instructions?|system)/i, severity: 'HIGH' as const, description: 'System prompt extraction attempt' },
  
  // Delimiter injection
  { pattern: /<\/?system>/i, severity: 'HIGH' as const, description: 'System tag injection' },
  { pattern: /\[SYSTEM\]/i, severity: 'HIGH' as const, description: 'System marker injection' },
  { pattern: /###\s*(SYSTEM|INSTRUCTION|PROMPT)/i, severity: 'HIGH' as const, description: 'Markdown delimiter injection' },
  { pattern: /```\s*(system|instruction)/i, severity: 'MEDIUM' as const, description: 'Code block injection' },
  
  // Encoding/obfuscation
  { pattern: /base64[:\s]/i, severity: 'MEDIUM' as const, description: 'Encoding attempt' },
  { pattern: /decode\s+(this|the\s+following)/i, severity: 'MEDIUM' as const, description: 'Decode command' },
  { pattern: /rot13|caesar\s+cipher/i, severity: 'MEDIUM' as const, description: 'Cipher reference' },
];

// Jailbreak patterns
const JAILBREAK_PATTERNS = [
  { pattern: /DAN\s*(mode|prompt)?/i, severity: 'CRITICAL' as const, description: 'DAN jailbreak attempt' },
  { pattern: /developer\s+mode/i, severity: 'HIGH' as const, description: 'Developer mode jailbreak' },
  { pattern: /jailbreak/i, severity: 'HIGH' as const, description: 'Explicit jailbreak mention' },
  { pattern: /bypass\s+(safety|filters?|restrictions?)/i, severity: 'HIGH' as const, description: 'Safety bypass attempt' },
  { pattern: /evil\s+mode/i, severity: 'HIGH' as const, description: 'Evil mode attempt' },
  { pattern: /no\s+(restrictions?|limits?|boundaries)/i, severity: 'MEDIUM' as const, description: 'Restriction removal attempt' },
  { pattern: /unfiltered\s+(mode|response)/i, severity: 'MEDIUM' as const, description: 'Unfiltered mode attempt' },
];

// PII patterns
const PII_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, type: 'SSN', description: 'Social Security Number' },
  { pattern: /\b\d{16}\b/, type: 'CREDIT_CARD', description: 'Credit card number' },
  { pattern: /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, type: 'CREDIT_CARD', description: 'Visa card number' },
  { pattern: /\b5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, type: 'CREDIT_CARD', description: 'Mastercard number' },
  { pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/i, type: 'IBAN', description: 'IBAN number' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, type: 'EMAIL', description: 'Email address' },
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, type: 'PHONE', description: 'Phone number' },
  { pattern: /\bpassword\s*[=:]\s*\S+/i, type: 'PASSWORD', description: 'Password in text' },
  { pattern: /\bapi[_-]?key\s*[=:]\s*\S+/i, type: 'API_KEY', description: 'API key in text' },
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/, type: 'API_KEY', description: 'OpenAI API key' },
];

// Harmful content patterns
const HARMFUL_PATTERNS = [
  { pattern: /\b(how\s+to\s+)?(make|create|build)\s+(a\s+)?(bomb|explosive|weapon)/i, severity: 'CRITICAL' as const, description: 'Weapons/explosives content' },
  { pattern: /\b(hack|exploit|crack)\s+(into|password|system)/i, severity: 'HIGH' as const, description: 'Hacking content' },
  { pattern: /\b(illegal|illicit)\s+drugs?/i, severity: 'HIGH' as const, description: 'Illegal substances content' },
  { pattern: /\bself[- ]?harm/i, severity: 'CRITICAL' as const, description: 'Self-harm content' },
  { pattern: /\bsuicid/i, severity: 'CRITICAL' as const, description: 'Suicide-related content' },
];

class AISafetyGuardService {
  // Hash cache to detect repeated patterns
  private patternHashCache = new Map<string, { count: number; lastSeen: number }>();
  private readonly HASH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Check input for safety issues before sending to AI
   */
  async checkInput(
    input: string,
    context: { tenantId?: string; userId?: string; source?: string }
  ): Promise<SafetyCheckResult> {
    const issues: SafetyIssue[] = [];
    let sanitizedInput = input;
    
    // Check for prompt injection
    const injectionIssues = this.detectPatterns(input, INJECTION_PATTERNS, 'PROMPT_INJECTION');
    issues.push(...injectionIssues);
    
    // Check for jailbreak attempts
    const jailbreakIssues = this.detectPatterns(input, JAILBREAK_PATTERNS, 'JAILBREAK_ATTEMPT');
    issues.push(...jailbreakIssues);
    
    // Check for PII (and optionally redact)
    const { piiIssues, redactedText } = this.detectAndRedactPII(input);
    issues.push(...piiIssues);
    if (piiIssues.length > 0) {
      sanitizedInput = redactedText;
    }
    
    // Check for harmful content
    const harmfulIssues = this.detectPatterns(input, HARMFUL_PATTERNS, 'HARMFUL_CONTENT');
    issues.push(...harmfulIssues);
    
    // Check for repeated abuse patterns
    const abuseIssue = this.checkRepeatedPatterns(input, context.userId);
    if (abuseIssue) {
      issues.push(abuseIssue);
    }
    
    // Determine action based on issues
    const action = this.determineAction(issues);
    const safe = action === 'ALLOW' || action === 'SANITIZE';
    
    // Log if any issues found
    if (issues.length > 0) {
      await this.logSecurityIncident(input, issues, action, context);
    }
    
    return {
      safe,
      issues,
      sanitizedInput: action === 'SANITIZE' ? sanitizedInput : undefined,
      action,
    };
  }

  /**
   * Check AI output for safety issues before returning to user
   */
  async checkOutput(
    output: string,
    context: { tenantId?: string; userId?: string; source?: string }
  ): Promise<SafetyCheckResult> {
    const issues: SafetyIssue[] = [];
    
    // Check for PII leakage in output
    const { piiIssues, redactedText } = this.detectAndRedactPII(output);
    issues.push(...piiIssues);
    
    // Check for harmful content in output
    const harmfulIssues = this.detectPatterns(output, HARMFUL_PATTERNS, 'HARMFUL_CONTENT');
    issues.push(...harmfulIssues);
    
    // Check for system prompt leakage patterns
    const leakagePatterns = [
      { pattern: /\[SYSTEM\].*?\[\/SYSTEM\]/is, severity: 'CRITICAL' as const, description: 'System prompt leaked' },
      { pattern: /my\s+(instructions?|prompt)\s+(are|is|say)/i, severity: 'HIGH' as const, description: 'Instruction leak detected' },
    ];
    const leakageIssues = this.detectPatterns(output, leakagePatterns, 'CONTEXT_LIMIT_EXCEEDED');
    issues.push(...leakageIssues);
    
    const action = this.determineAction(issues);
    const safe = action === 'ALLOW';
    
    if (issues.length > 0) {
      await this.logSecurityIncident(output, issues, action, context, true);
    }
    
    return {
      safe,
      issues,
      sanitizedInput: piiIssues.length > 0 ? redactedText : undefined,
      action,
    };
  }

  /**
   * Validate AI completion before use
   */
  async validateCompletion(
    completion: string,
    context: { tenantId?: string; userId?: string; source?: string }
  ): Promise<{ valid: boolean; reason?: string; sanitized?: string }> {
    const result = await this.checkOutput(completion, context);
    
    if (!result.safe) {
      const criticalIssue = result.issues.find(i => i.severity === 'CRITICAL');
      return {
        valid: false,
        reason: criticalIssue?.description || 'Output failed safety validation',
      };
    }
    
    return {
      valid: true,
      sanitized: result.sanitizedInput,
    };
  }

  /**
   * Get security incident stats
   */
  async getSecurityStats(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<{
    totalIncidents: number;
    byType: Record<string, number>;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    topPatterns: { pattern: string; count: number }[];
  }> {
    let query = db.select().from(aiSecurityLogs);
    // Note: Would add date filtering in actual implementation
    const logs = await query;
    
    const filteredLogs = tenantId 
      ? logs.filter(l => l.tenantId === tenantId)
      : logs;
    
    const byType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const patternCounts = new Map<string, number>();
    
    for (const log of filteredLogs) {
      byType[log.incidentType] = (byType[log.incidentType] || 0) + 1;
      byAction[log.actionTaken] = (byAction[log.actionTaken] || 0) + 1;
      
      // Count patterns
      if (log.matchedPatterns) {
        const patterns = log.matchedPatterns as string[];
        for (const pattern of patterns) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }
      }
    }
    
    const topPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalIncidents: filteredLogs.length,
      byType,
      byAction,
      bySeverity,
      topPatterns,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private detectPatterns(
    text: string,
    patterns: { pattern: RegExp; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; description: string }[],
    issueType: string
  ): SafetyIssue[] {
    const issues: SafetyIssue[] = [];
    
    for (const { pattern, severity, description } of patterns) {
      const match = text.match(pattern);
      if (match) {
        issues.push({
          type: issueType,
          severity,
          description,
          matchedPattern: match[0].substring(0, 100), // Truncate
          confidence: 0.9, // Pattern matching has high confidence
        });
      }
    }
    
    return issues;
  }

  private detectAndRedactPII(text: string): { piiIssues: SafetyIssue[]; redactedText: string } {
    const piiIssues: SafetyIssue[] = [];
    let redactedText = text;
    
    for (const { pattern, type, description } of PII_PATTERNS) {
      const matches = text.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        piiIssues.push({
          type: 'PII_DETECTED',
          severity: 'HIGH',
          description: `${description} detected`,
          matchedPattern: type,
          confidence: 0.95,
        });
        
        // Redact PII
        redactedText = redactedText.replace(pattern, `[REDACTED_${type}]`);
      }
    }
    
    return { piiIssues, redactedText };
  }

  private checkRepeatedPatterns(text: string, userId?: string): SafetyIssue | null {
    // Create a hash of the input to detect repeated patterns
    const hash = crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
    const key = userId ? `${userId}:${hash}` : hash;
    
    const now = Date.now();
    const existing = this.patternHashCache.get(key);
    
    // Clean old entries
    if (Math.random() < 0.1) { // 10% chance to clean
      for (const [k, v] of this.patternHashCache.entries()) {
        if (now - v.lastSeen > this.HASH_CACHE_TTL_MS) {
          this.patternHashCache.delete(k);
        }
      }
    }
    
    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      
      if (existing.count >= 5) {
        return {
          type: 'RATE_ABUSE',
          severity: 'MEDIUM',
          description: `Repeated pattern detected (${existing.count} times)`,
          confidence: 0.8,
        };
      }
    } else {
      this.patternHashCache.set(key, { count: 1, lastSeen: now });
    }
    
    return null;
  }

  private determineAction(issues: SafetyIssue[]): 'ALLOW' | 'BLOCK' | 'SANITIZE' | 'FLAG' | 'ESCALATE' {
    if (issues.length === 0) return 'ALLOW';
    
    const hasCritical = issues.some(i => i.severity === 'CRITICAL');
    const hasHigh = issues.some(i => i.severity === 'HIGH');
    const hasJailbreak = issues.some(i => i.type === 'JAILBREAK_ATTEMPT');
    const hasPII = issues.some(i => i.type === 'PII_DETECTED');
    
    if (hasCritical || hasJailbreak) return 'BLOCK';
    if (hasHigh && !hasPII) return 'ESCALATE';
    if (hasPII) return 'SANITIZE';
    
    return 'FLAG';
  }

  private async logSecurityIncident(
    input: string,
    issues: SafetyIssue[],
    action: string,
    context: { tenantId?: string; userId?: string; source?: string },
    isOutput: boolean = false
  ): Promise<void> {
    try {
      // Get primary incident type
      const primaryIssue = issues.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })[0];
      
      // Create truncated/sanitized excerpt
      const excerpt = input.length > 500 
        ? input.substring(0, 500) + '...' 
        : input;
      
      // Create input hash for deduplication
      const inputHash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
      
      await db.insert(aiSecurityLogs).values({
        tenantId: context.tenantId,
        userId: context.userId,
        incidentType: primaryIssue.type,
        inputExcerpt: excerpt,
        inputHash,
        detectionMethod: 'PATTERN_MATCH',
        confidenceScore: primaryIssue.confidence.toString(),
        matchedPatterns: issues.map(i => i.matchedPattern).filter(Boolean) as any,
        actionTaken: action,
        actionDetails: `${issues.length} issues detected (${issues.map(i => i.severity).join(', ')})`,
      });
      
      // For high/critical, also audit log
      if (primaryIssue.severity === 'HIGH' || primaryIssue.severity === 'CRITICAL') {
        logIntegrationAudit({
          integrationCode: 'AI_SAFETY',
          action: `${isOutput ? 'OUTPUT' : 'INPUT'}_${action}`,
          tenantId: context.tenantId,
          details: {
            incidentType: primaryIssue.type,
            severity: primaryIssue.severity,
            issueCount: issues.length,
          },
        }).catch(() => {});
      }
    } catch (error) {
      console.error('[AISafetyGuard] Failed to log incident:', error);
    }
  }
}

// Export singleton
export const aiSafetyGuard = new AISafetyGuardService();
