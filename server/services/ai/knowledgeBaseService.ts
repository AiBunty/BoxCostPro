/**
 * AI Knowledge Base Service
 * 
 * Manages the AI knowledge base with:
 * - CRUD operations with version control
 * - Audit logging for all changes
 * - Publish/unpublish workflow
 * - Intent matching
 */

import type { 
  AiKnowledgeBase, 
  InsertAiKnowledgeBase,
  AiKnowledgeAudit,
  InsertAiKnowledgeAudit 
} from '../../../shared/schema';

export interface KnowledgeEntryInput {
  module: string;
  feature: string;
  intent: string;
  title: string;
  content: string;
  keywords?: string[];
  tenantId?: string;
}

export interface KnowledgeSearchResult {
  entries: AiKnowledgeBase[];
  totalCount: number;
}

export interface KnowledgeSearchParams {
  query?: string;
  module?: string;
  feature?: string;
  intent?: string;
  isPublished?: boolean;
  limit?: number;
  offset?: number;
}

export class KnowledgeBaseService {
  constructor(private db: any) {}
  
  /**
   * Create a new knowledge entry
   */
  async createEntry(
    input: KnowledgeEntryInput,
    createdBy: string
  ): Promise<AiKnowledgeBase> {
    const result = await this.db.insert(this.db.schema.aiKnowledgeBase).values({
      tenantId: input.tenantId,
      module: input.module,
      feature: input.feature,
      intent: input.intent,
      title: input.title,
      content: input.content,
      keywords: input.keywords || [],
      isActive: true,
      isPublished: false,
      version: 1,
      createdBy,
    }).returning();
    
    const entry = result[0];
    
    // Log creation
    await this.logAudit({
      knowledgeEntryId: entry.id,
      action: 'CREATED',
      afterContent: input.content,
      changeDetails: { title: input.title, module: input.module, feature: input.feature },
      actorId: createdBy,
    });
    
    return entry;
  }
  
  /**
   * Update an existing knowledge entry (creates new version)
   */
  async updateEntry(
    entryId: string,
    updates: Partial<KnowledgeEntryInput>,
    updatedBy: string
  ): Promise<AiKnowledgeBase> {
    // Get current entry
    const current = await this.getEntry(entryId);
    if (!current) {
      throw new Error('Knowledge entry not found');
    }
    
    const beforeContent = current.content;
    
    // Update with new version
    const result = await this.db.update(this.db.schema.aiKnowledgeBase)
      .set({
        ...updates,
        version: current.version + 1,
        previousVersionId: current.id,
        updatedAt: new Date(),
      })
      .where(this.db.eq(this.db.schema.aiKnowledgeBase.id, entryId))
      .returning();
    
    const updated = result[0];
    
    // Log update
    await this.logAudit({
      knowledgeEntryId: entryId,
      action: 'UPDATED',
      beforeContent,
      afterContent: updates.content || current.content,
      changeDetails: updates,
      actorId: updatedBy,
    });
    
    return updated;
  }
  
  /**
   * Publish a knowledge entry
   */
  async publishEntry(entryId: string, publishedBy: string): Promise<void> {
    const entry = await this.getEntry(entryId);
    if (!entry) {
      throw new Error('Knowledge entry not found');
    }
    
    await this.db.update(this.db.schema.aiKnowledgeBase)
      .set({
        isPublished: true,
        publishedAt: new Date(),
        publishedBy,
        updatedAt: new Date(),
      })
      .where(this.db.eq(this.db.schema.aiKnowledgeBase.id, entryId));
    
    await this.logAudit({
      knowledgeEntryId: entryId,
      action: 'PUBLISHED',
      actorId: publishedBy,
    });
  }
  
  /**
   * Unpublish a knowledge entry
   */
  async unpublishEntry(entryId: string, unpublishedBy: string): Promise<void> {
    await this.db.update(this.db.schema.aiKnowledgeBase)
      .set({
        isPublished: false,
        updatedAt: new Date(),
      })
      .where(this.db.eq(this.db.schema.aiKnowledgeBase.id, entryId));
    
    await this.logAudit({
      knowledgeEntryId: entryId,
      action: 'UNPUBLISHED',
      actorId: unpublishedBy,
    });
  }
  
  /**
   * Soft delete a knowledge entry
   */
  async deleteEntry(entryId: string, deletedBy: string): Promise<void> {
    const entry = await this.getEntry(entryId);
    if (!entry) {
      throw new Error('Knowledge entry not found');
    }
    
    await this.db.update(this.db.schema.aiKnowledgeBase)
      .set({
        isActive: false,
        isPublished: false,
        updatedAt: new Date(),
      })
      .where(this.db.eq(this.db.schema.aiKnowledgeBase.id, entryId));
    
    await this.logAudit({
      knowledgeEntryId: entryId,
      action: 'DELETED',
      beforeContent: entry.content,
      actorId: deletedBy,
    });
  }
  
  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(
    entryId: string,
    targetVersion: number,
    rolledBackBy: string
  ): Promise<AiKnowledgeBase> {
    // Get version history
    const history = await this.getVersionHistory(entryId);
    const targetEntry = history.find(h => h.version === targetVersion);
    
    if (!targetEntry) {
      throw new Error(`Version ${targetVersion} not found`);
    }
    
    // Create new version with old content
    const current = await this.getEntry(entryId);
    if (!current) {
      throw new Error('Knowledge entry not found');
    }
    
    const result = await this.db.update(this.db.schema.aiKnowledgeBase)
      .set({
        content: targetEntry.content,
        title: targetEntry.title,
        keywords: targetEntry.keywords,
        version: current.version + 1,
        isPublished: false, // Unpublish on rollback
        updatedAt: new Date(),
      })
      .where(this.db.eq(this.db.schema.aiKnowledgeBase.id, entryId))
      .returning();
    
    await this.logAudit({
      knowledgeEntryId: entryId,
      action: 'ROLLBACK',
      beforeContent: current.content,
      afterContent: targetEntry.content,
      changeDetails: { rolledBackToVersion: targetVersion },
      actorId: rolledBackBy,
    });
    
    return result[0];
  }
  
  /**
   * Get a single entry by ID
   */
  async getEntry(entryId: string): Promise<AiKnowledgeBase | null> {
    return this.db.query.aiKnowledgeBase.findFirst({
      where: (kb: any, { eq }: any) => eq(kb.id, entryId),
    });
  }
  
  /**
   * Search knowledge base
   */
  async searchEntries(params: KnowledgeSearchParams): Promise<KnowledgeSearchResult> {
    const conditions: any[] = [];
    
    // Always filter active entries
    conditions.push((kb: any, { eq }: any) => eq(kb.isActive, true));
    
    if (params.isPublished !== undefined) {
      conditions.push((kb: any, { eq }: any) => eq(kb.isPublished, params.isPublished));
    }
    
    if (params.module) {
      conditions.push((kb: any, { eq }: any) => eq(kb.module, params.module));
    }
    
    if (params.feature) {
      conditions.push((kb: any, { eq }: any) => eq(kb.feature, params.feature));
    }
    
    if (params.intent) {
      conditions.push((kb: any, { eq }: any) => eq(kb.intent, params.intent));
    }
    
    // For text search, we'd ideally use full-text search or vector similarity
    // This is a simple ILIKE search for now
    const entries = await this.db.query.aiKnowledgeBase.findMany({
      where: (kb: any, ops: any) => {
        if (conditions.length === 0) return undefined;
        return ops.and(...conditions.map((c: any) => c(kb, ops)));
      },
      limit: params.limit || 20,
      offset: params.offset || 0,
      orderBy: (kb: any, { desc }: any) => desc(kb.updatedAt),
    });
    
    // Filter by query if provided (simple text search)
    let filteredEntries = entries;
    if (params.query) {
      const queryLower = params.query.toLowerCase();
      filteredEntries = entries.filter((e: any) =>
        e.title.toLowerCase().includes(queryLower) ||
        e.content.toLowerCase().includes(queryLower) ||
        e.keywords?.some((k: string) => k.toLowerCase().includes(queryLower))
      );
    }
    
    return {
      entries: filteredEntries,
      totalCount: filteredEntries.length,
    };
  }
  
  /**
   * Get entries relevant to a user query (for AI context)
   */
  async getRelevantEntries(
    query: string,
    limit: number = 5
  ): Promise<AiKnowledgeBase[]> {
    // Simple keyword matching for now
    // Can be enhanced with vector embeddings for semantic search
    const allPublished = await this.db.query.aiKnowledgeBase.findMany({
      where: (kb: any, { eq, and }: any) => and(
        eq(kb.isActive, true),
        eq(kb.isPublished, true)
      ),
    });
    
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Score each entry by keyword match
    const scored = allPublished.map((entry: any) => {
      let score = 0;
      const entryText = `${entry.title} ${entry.content} ${entry.intent}`.toLowerCase();
      const entryKeywords = (entry.keywords || []).map((k: string) => k.toLowerCase());
      
      for (const word of queryWords) {
        if (entryText.includes(word)) score += 1;
        if (entryKeywords.includes(word)) score += 2;
        if (entry.intent.toLowerCase().includes(word)) score += 3;
      }
      
      return { entry, score };
    });
    
    // Sort by score and return top entries
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }
  
  /**
   * Get version history for an entry
   */
  async getVersionHistory(entryId: string): Promise<AiKnowledgeBase[]> {
    // For now, get audit logs to reconstruct history
    // In a more complex system, we'd store full snapshots
    const audits = await this.db.query.aiKnowledgeAudit.findMany({
      where: (a: any, { eq }: any) => eq(a.knowledgeEntryId, entryId),
      orderBy: (a: any, { desc }: any) => desc(a.createdAt),
    });
    
    // Return current entry as the history for now
    const current = await this.getEntry(entryId);
    return current ? [current] : [];
  }
  
  /**
   * Get all unique modules
   */
  async getModules(): Promise<string[]> {
    const entries = await this.db.query.aiKnowledgeBase.findMany({
      where: (kb: any, { eq }: any) => eq(kb.isActive, true),
    });
    
    const modules = new Set(entries.map((e: any) => e.module));
    return Array.from(modules).sort();
  }
  
  /**
   * Get features for a module
   */
  async getFeatures(module: string): Promise<string[]> {
    const entries = await this.db.query.aiKnowledgeBase.findMany({
      where: (kb: any, { eq, and }: any) => and(
        eq(kb.isActive, true),
        eq(kb.module, module)
      ),
    });
    
    const features = new Set(entries.map((e: any) => e.feature));
    return Array.from(features).sort();
  }
  
  /**
   * Record usage of a knowledge entry
   */
  async recordUsage(entryId: string): Promise<void> {
    const entry = await this.getEntry(entryId);
    if (!entry) return;
    
    await this.db.update(this.db.schema.aiKnowledgeBase)
      .set({
        useCount: (entry.useCount || 0) + 1,
        lastUsedAt: new Date(),
      })
      .where(this.db.eq(this.db.schema.aiKnowledgeBase.id, entryId));
  }
  
  /**
   * Log audit entry
   */
  private async logAudit(data: {
    knowledgeEntryId: string;
    action: string;
    beforeContent?: string;
    afterContent?: string;
    changeDetails?: any;
    actorId?: string;
    actorEmail?: string;
  }): Promise<void> {
    await this.db.insert(this.db.schema.aiKnowledgeAudit).values({
      knowledgeEntryId: data.knowledgeEntryId,
      action: data.action,
      beforeContent: data.beforeContent,
      afterContent: data.afterContent,
      changeDetails: data.changeDetails,
      actorId: data.actorId,
      actorEmail: data.actorEmail,
    });
  }
}

export function createKnowledgeBaseService(db: any): KnowledgeBaseService {
  return new KnowledgeBaseService(db);
}
