/**
 * Template Management API Routes
 * CRUD operations for invoice, quotation, WhatsApp, and email templates
 * With versioning and audit logging
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { createAuditLog } from '../services/auditLogger';
import { validateTemplateHtml, extractPlaceholders } from '../services/templateRenderer';

const router = Router();

// ============================================
// Invoice Templates
// ============================================

/**
 * List all invoice templates
 */
router.get('/invoice-templates', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    
    const result = await db.query(`
      SELECT id, name, description, preview_image_url, 
             is_default, is_active, version, created_at, updated_at
      FROM invoice_templates
      WHERE tenant_id = $1 OR tenant_id IS NULL
      ORDER BY is_default DESC, name ASC
    `, [tenantId]);
    
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error listing invoice templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * Get single invoice template with HTML content
 */
router.get('/invoice-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT * FROM invoice_templates
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Extract placeholders for editor
    const placeholders = extractPlaceholders(result.rows[0].html_content);
    
    res.json({ 
      template: result.rows[0],
      placeholders
    });
  } catch (error) {
    console.error('Error getting invoice template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * Create new invoice template
 */
router.post('/invoice-templates', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId } = req as any;
    const { name, description, html_content, css_styles, is_default } = req.body;
    
    if (!name || !html_content) {
      return res.status(400).json({ error: 'Name and HTML content are required' });
    }
    
    // Validate required placeholders
    const requiredPlaceholders = ['invoice_no', 'invoice_date', 'buyer_name', 'grand_total'];
    const validation = validateTemplateHtml(html_content, requiredPlaceholders);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Missing required placeholders',
        missing: validation.missing
      });
    }
    
    const id = randomUUID();
    const now = new Date();
    
    // If setting as default, unset other defaults
    if (is_default) {
      await db.query(`
        UPDATE invoice_templates SET is_default = false
        WHERE tenant_id = $1
      `, [tenantId]);
    }
    
    await db.query(`
      INSERT INTO invoice_templates (
        id, tenant_id, name, description, html_content, css_styles,
        is_default, is_active, version, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, true, 1, $8, $8
      )
    `, [id, tenantId, name, description, html_content, css_styles, is_default || false, now]);
    
    // Audit log
    await createAuditLog({
      action_type: 'template_created',
      entity_type: 'template',
      entity_id: id,
      tenant_id: tenantId,
      user_id: userId,
      new_values: { name, description, type: 'invoice' }
    }, db);
    
    res.status(201).json({ id, message: 'Template created successfully' });
  } catch (error) {
    console.error('Error creating invoice template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * Update invoice template (creates new version)
 */
router.put('/invoice-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId } = req as any;
    const { id } = req.params;
    const { name, description, html_content, css_styles, is_default, is_active } = req.body;
    
    // Get current template
    const currentResult = await db.query(`
      SELECT * FROM invoice_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or not editable' });
    }
    
    const current = currentResult.rows[0];
    
    // Validate if HTML changed
    if (html_content && html_content !== current.html_content) {
      const requiredPlaceholders = ['invoice_no', 'invoice_date', 'buyer_name', 'grand_total'];
      const validation = validateTemplateHtml(html_content, requiredPlaceholders);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Missing required placeholders',
          missing: validation.missing
        });
      }
    }
    
    const now = new Date();
    const newVersion = current.version + 1;
    
    // Log to audit before update
    await db.query(`
      INSERT INTO template_audit_logs (
        id, template_type, template_id, action, old_content, new_content,
        changed_by, version_from, version_to, created_at
      ) VALUES (
        $1, 'invoice', $2, 'update', $3, $4, $5, $6, $7, $8
      )
    `, [
      randomUUID(), id, current.html_content, html_content || current.html_content,
      userId, current.version, newVersion, now
    ]);
    
    // If setting as default, unset other defaults
    if (is_default && !current.is_default) {
      await db.query(`
        UPDATE invoice_templates SET is_default = false
        WHERE tenant_id = $1 AND id != $2
      `, [tenantId, id]);
    }
    
    // Update template
    await db.query(`
      UPDATE invoice_templates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        html_content = COALESCE($3, html_content),
        css_styles = COALESCE($4, css_styles),
        is_default = COALESCE($5, is_default),
        is_active = COALESCE($6, is_active),
        version = $7,
        updated_at = $8
      WHERE id = $9
    `, [name, description, html_content, css_styles, is_default, is_active, newVersion, now, id]);
    
    // Audit log
    await createAuditLog({
      action_type: 'template_updated',
      entity_type: 'template',
      entity_id: id,
      tenant_id: tenantId,
      user_id: userId,
      old_values: { name: current.name, version: current.version },
      new_values: { name: name || current.name, version: newVersion }
    }, db);
    
    res.json({ message: 'Template updated successfully', version: newVersion });
  } catch (error) {
    console.error('Error updating invoice template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * Delete invoice template
 */
router.delete('/invoice-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId } = req as any;
    const { id } = req.params;
    
    // Check if template exists and belongs to tenant
    const result = await db.query(`
      SELECT * FROM invoice_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }
    
    const template = result.rows[0];
    
    if (template.is_default) {
      return res.status(400).json({ error: 'Cannot delete default template' });
    }
    
    // Soft delete by setting is_active = false
    await db.query(`
      UPDATE invoice_templates SET is_active = false, updated_at = $1
      WHERE id = $2
    `, [new Date(), id]);
    
    // Audit log
    await createAuditLog({
      action_type: 'template_deleted',
      entity_type: 'template',
      entity_id: id,
      tenant_id: tenantId,
      user_id: userId,
      old_values: { name: template.name, type: 'invoice' }
    }, db);
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * Get template version history
 */
router.get('/invoice-templates/:id/history', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT tal.*, u.email as changed_by_email
      FROM template_audit_logs tal
      LEFT JOIN users u ON tal.changed_by = u.id
      WHERE tal.template_id = $1 AND tal.template_type = 'invoice'
      ORDER BY tal.created_at DESC
    `, [id]);
    
    res.json({ history: result.rows });
  } catch (error) {
    console.error('Error getting template history:', error);
    res.status(500).json({ error: 'Failed to get template history' });
  }
});

/**
 * Restore template to previous version
 */
router.post('/invoice-templates/:id/restore/:version', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId } = req as any;
    const { id, version } = req.params;
    
    // Get the version to restore
    const historyResult = await db.query(`
      SELECT * FROM template_audit_logs
      WHERE template_id = $1 AND version_to = $2 AND template_type = 'invoice'
    `, [id, parseInt(version)]);
    
    if (historyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const historyEntry = historyResult.rows[0];
    
    // Get current template
    const currentResult = await db.query(`
      SELECT * FROM invoice_templates WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const current = currentResult.rows[0];
    const newVersion = current.version + 1;
    const now = new Date();
    
    // Log the restore
    await db.query(`
      INSERT INTO template_audit_logs (
        id, template_type, template_id, action, old_content, new_content,
        changed_by, version_from, version_to, created_at
      ) VALUES (
        $1, 'invoice', $2, 'restore', $3, $4, $5, $6, $7, $8
      )
    `, [
      randomUUID(), id, current.html_content, historyEntry.new_content,
      userId, current.version, newVersion, now
    ]);
    
    // Update template with restored content
    await db.query(`
      UPDATE invoice_templates SET
        html_content = $1,
        version = $2,
        updated_at = $3
      WHERE id = $4
    `, [historyEntry.new_content, newVersion, now, id]);
    
    res.json({ message: 'Template restored successfully', version: newVersion });
  } catch (error) {
    console.error('Error restoring template:', error);
    res.status(500).json({ error: 'Failed to restore template' });
  }
});

// ============================================
// Email Templates
// ============================================

/**
 * List all email templates
 */
router.get('/email-templates', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    
    const result = await db.query(`
      SELECT id, template_type, name, subject_template, 
             is_active, version, created_at, updated_at
      FROM email_templates
      WHERE tenant_id = $1 OR tenant_id IS NULL
      ORDER BY template_type ASC
    `, [tenantId]);
    
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error listing email templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * Get single email template
 */
router.get('/email-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT * FROM email_templates
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const placeholders = extractPlaceholders(
      result.rows[0].html_content + result.rows[0].subject_template
    );
    
    res.json({ 
      template: result.rows[0],
      placeholders
    });
  } catch (error) {
    console.error('Error getting email template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * Update email template
 */
router.put('/email-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId } = req as any;
    const { id } = req.params;
    const { name, subject_template, html_content, text_content, is_active } = req.body;
    
    // Get current template
    const currentResult = await db.query(`
      SELECT * FROM email_templates
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `, [id, tenantId]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const current = currentResult.rows[0];
    const now = new Date();
    const newVersion = current.version + 1;
    
    // If system template, create tenant-specific override
    if (current.tenant_id === null) {
      const overrideId = randomUUID();
      await db.query(`
        INSERT INTO email_templates (
          id, tenant_id, template_type, name, subject_template,
          html_content, text_content, is_active, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $9
        )
      `, [
        overrideId, tenantId, current.template_type,
        name || current.name,
        subject_template || current.subject_template,
        html_content || current.html_content,
        text_content || current.text_content,
        is_active !== undefined ? is_active : current.is_active,
        now
      ]);
      
      return res.json({ 
        message: 'Custom template created', 
        id: overrideId,
        version: 1 
      });
    }
    
    // Update existing tenant template
    await db.query(`
      UPDATE email_templates SET
        name = COALESCE($1, name),
        subject_template = COALESCE($2, subject_template),
        html_content = COALESCE($3, html_content),
        text_content = COALESCE($4, text_content),
        is_active = COALESCE($5, is_active),
        version = $6,
        updated_at = $7
      WHERE id = $8
    `, [name, subject_template, html_content, text_content, is_active, newVersion, now, id]);
    
    res.json({ message: 'Template updated successfully', version: newVersion });
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================
// WhatsApp Templates
// ============================================

/**
 * List WhatsApp templates
 */
router.get('/whatsapp-templates', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    
    const result = await db.query(`
      SELECT id, template_type, name, template_content, 
             is_active, version, created_at, updated_at
      FROM whatsapp_templates
      WHERE tenant_id = $1 OR tenant_id IS NULL
      ORDER BY template_type ASC
    `, [tenantId]);
    
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error listing WhatsApp templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * Get single WhatsApp template
 */
router.get('/whatsapp-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId } = req as any;
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT * FROM whatsapp_templates
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error getting WhatsApp template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * Update WhatsApp template
 */
router.put('/whatsapp-templates/:id', async (req: Request, res: Response) => {
  try {
    const { db, tenantId, userId } = req as any;
    const { id } = req.params;
    const { name, template_content, variables, is_active } = req.body;
    
    const currentResult = await db.query(`
      SELECT * FROM whatsapp_templates
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `, [id, tenantId]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const current = currentResult.rows[0];
    const now = new Date();
    const newVersion = current.version + 1;
    
    // If system template, create tenant override
    if (current.tenant_id === null) {
      const overrideId = randomUUID();
      await db.query(`
        INSERT INTO whatsapp_templates (
          id, tenant_id, template_type, name, template_content,
          variables, is_active, version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 1, $8, $8
        )
      `, [
        overrideId, tenantId, current.template_type,
        name || current.name,
        template_content || current.template_content,
        variables || current.variables,
        is_active !== undefined ? is_active : current.is_active,
        now
      ]);
      
      return res.json({ message: 'Custom template created', id: overrideId, version: 1 });
    }
    
    await db.query(`
      UPDATE whatsapp_templates SET
        name = COALESCE($1, name),
        template_content = COALESCE($2, template_content),
        variables = COALESCE($3, variables),
        is_active = COALESCE($4, is_active),
        version = $5,
        updated_at = $6
      WHERE id = $7
    `, [name, template_content, variables, is_active, newVersion, now, id]);
    
    res.json({ message: 'Template updated successfully', version: newVersion });
  } catch (error) {
    console.error('Error updating WhatsApp template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ============================================
// Template Preview
// ============================================

/**
 * Preview template with sample data
 */
router.post('/templates/preview', async (req: Request, res: Response) => {
  try {
    const { template_type, html_content, sample_data } = req.body;
    
    if (!html_content) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    // Import renderer
    const { renderTemplate } = await import('../services/templateRenderer');
    
    // Default sample data
    const defaultSampleData: Record<string, any> = {
      invoice_no: 'INV-2024-0001',
      invoice_date: new Date().toLocaleDateString('en-IN'),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'),
      seller_company_name: 'Sample Company Pvt Ltd',
      seller_address: '123 Business Park, Industrial Area',
      seller_city: 'Mumbai',
      seller_state: 'Maharashtra',
      seller_pincode: '400001',
      seller_gstin: '27AAACP1234Q1ZV',
      seller_phone: '+91 98765 43210',
      seller_email: 'info@samplecompany.com',
      buyer_name: 'Test Customer Ltd',
      buyer_address: '456 Commerce Street',
      buyer_city: 'Pune',
      buyer_state: 'Maharashtra',
      buyer_pincode: '411001',
      buyer_gstin: '27BBBCS5678R2ZW',
      buyer_phone: '+91 87654 32109',
      items: [
        { sno: 1, name: 'Corrugated Box 12x10x8', description: '3-ply, brown kraft', hsn_code: '4819', quantity: 1000, unit: 'Pcs', rate: '25.00', amount: '25,000.00' },
        { sno: 2, name: 'Corrugated Box 18x14x12', description: '5-ply, virgin kraft', hsn_code: '4819', quantity: 500, unit: 'Pcs', rate: '45.00', amount: '22,500.00' }
      ],
      subtotal: '47,500.00',
      cgst_rate: 9,
      cgst_amount: '4,275.00',
      sgst_rate: 9,
      sgst_amount: '4,275.00',
      grand_total: '56,050.00',
      amount_in_words: 'Fifty Six Thousand Fifty',
      bank_name: 'HDFC Bank',
      bank_account_no: '50200012345678',
      bank_ifsc: 'HDFC0001234',
      bank_branch: 'Mumbai Main Branch',
      terms: [
        'Payment due within 30 days of invoice date.',
        'Goods once sold will not be taken back.',
        'Interest @ 18% p.a. will be charged for delayed payments.'
      ]
    };
    
    const data = { ...defaultSampleData, ...sample_data };
    
    const rendered = await renderTemplate(html_content, data, {
      template_type: template_type || 'invoice'
    });
    
    res.json({ preview_html: rendered });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

/**
 * Register template routes with Express app
 */
export function registerTemplateRoutes(
  app: any, 
  combinedAuth: any, 
  requireAdminAuth: any
) {
  // Apply authentication middleware to all routes
  app.use('/api/templates', combinedAuth, router);
  
  console.log('[Routes] Template routes registered at /api/templates');
}

export default router;
