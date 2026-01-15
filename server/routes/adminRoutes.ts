import type { Express, Response } from "express";
import { storage } from "../storage";
import { verifyAdminAuth, enforcePermission, requireRole, hasPermission, getCouponLimits, validateCouponLimits } from "../middleware/adminRbac";
import { adminAuth } from "../middleware/adminAuth";
import { 
  logStaffCreated, 
  logStaffDisabled, 
  logTicketCreated,
  logCouponCreated,
  logCouponAssigned,
  logInvoiceCreated,
  logAuditError,
} from "../services/adminAuditService";
import { 
  assignTicket, 
  resolveTicket, 
  closeTicket, 
  addTicketNote, 
  getTicketDetails,
  getOpenTicketsForStaff,
} from "../services/ticketService";
import {
  getStaffAnalytics,
  getStaffDetailedAnalytics,
  getTicketDashboardAnalytics,
  getCouponDashboardAnalytics,
  getRevenueAnalytics,
  getDashboardSummary,
  exportStaffAnalyticsAsCSV,
  exportTicketAnalyticsAsCSV,
  exportCouponAnalyticsAsCSV,
} from "../services/analyticsService";
import { z } from "zod";

// ===== INPUT VALIDATION SCHEMAS =====

const CreateStaffSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['SUPER_ADMIN', 'SUPPORT_STAFF', 'MARKETING_STAFF', 'FINANCE_ADMIN']),
});

const CreateTicketSchema = z.object({
  businessId: z.string(),
  subject: z.string().min(5).max(200),
  description: z.string().min(10),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
});

const AssignTicketSchema = z.object({
  staffId: z.string().uuid(),
});

const ResolveTicketSchema = z.object({
  resolutionNote: z.string().min(10),
});

const AddTicketNoteSchema = z.object({
  content: z.string().min(5),
});

const CreateCouponSchema = z.object({
  code: z.string().max(20),
  discountPercent: z.number().min(1).max(100),
  usageLimit: z.number().min(1),
  expiryDate: z.string().datetime(),
  description: z.string().optional(),
});

const AssignCouponSchema = z.object({
  userId: z.string().uuid(),
});

// ===== ADMIN ROUTES =====

export function registerAdminRoutes(app: Express, combinedAuth?: any): void {
  // ========== STAFF MANAGEMENT ==========

  /**
   * POST /admin/staff
   * Create a new admin staff member
   * SUPER_ADMIN only
   */
  app.post("/api/admin/staff", verifyAdminAuth, enforcePermission("create_staff"), async (req: any, res: Response) => {
    try {
      const validatedInput = CreateStaffSchema.parse(req.body);

      // Get the user being promoted
      const user = await storage.getUser(validatedInput.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if already staff
      const existingStaff = await storage.getStaffByUserId(validatedInput.userId);
      if (existingStaff) {
        return res.status(400).json({ message: "User is already an admin staff member" });
      }

      // Create staff record
      const newStaff = await storage.createStaff({
        userId: validatedInput.userId,
        role: validatedInput.role as any,
        status: 'active' as any,
      } as any);

      // Create initial metrics
      await storage.createStaffMetrics({
        staffId: newStaff.id,
        ticketsAssigned: 0,
        ticketsResolved: 0,
        avgResolutionTime: 0,
        totalActionCount: 0,
        couponsCreated: 0,
        couponRedemptionRate: 0,
      });

      // Log to audit
      await logStaffCreated(
        req.staffId,
        req.staffRole,
        newStaff.id,
        newStaff,
        req.ip,
        req.get('user-agent')
      );

      res.status(201).json({
        success: true,
        data: newStaff,
        message: `Staff member ${user.email} created with role ${validatedInput.role}`,
      });
    } catch (error) {
      console.error("[admin routes] POST /admin/staff error:", error);
      await logAuditError(req.staffId, req.staffRole, 'create_staff', 'staff', null, String(error), req.ip);
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  /**
   * GET /admin/staff
   * List all admin staff members
   * SUPER_ADMIN only
   */
  app.get("/api/admin/staff", verifyAdminAuth, enforcePermission("list_staff"), async (req: any, res: Response) => {
    try {
      const allStaff = await storage.getAllStaff();

      // Enrich with user data and metrics
      const enrichedStaff = await Promise.all(
        allStaff.map(async (staffMember) => {
          const user = await storage.getUser(staffMember.userId);
          const metrics = await storage.getStaffMetrics(staffMember.id);
          return {
            ...staffMember,
            user: {
              id: user?.id,
              email: user?.email,
              name: `${user?.firstName} ${user?.lastName}`,
            },
            metrics,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedStaff,
        total: enrichedStaff.length,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/staff error:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  /**
   * PATCH /admin/staff/{id}/disable
   * Disable a staff member
   * SUPER_ADMIN only
   */
  app.patch("/api/admin/staff/:id/disable", verifyAdminAuth, enforcePermission("disable_staff"), async (req: any, res: Response) => {
    try {
      const staffId = req.params.id;

      const staffMember = await storage.getStaff(staffId);
      if (!staffMember) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      const beforeState = { ...staffMember };

      const updated = await storage.disableStaff(staffId, req.staffId);

      await logStaffDisabled(
        req.staffId,
        req.staffRole,
        staffId,
        beforeState,
        updated,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        data: updated,
        message: "Staff member disabled",
      });
    } catch (error) {
      console.error("[admin routes] PATCH /admin/staff/:id/disable error:", error);
      await logAuditError(req.staffId, req.staffRole, 'disable_staff', 'staff', req.params.id, String(error), req.ip);
      res.status(500).json({ message: "Failed to disable staff member" });
    }
  });

  // ========== SUPPORT TICKETS ==========

  /**
   * POST /admin/tickets
   * Create a new support ticket
   */
  app.post("/api/admin/tickets", verifyAdminAuth, enforcePermission("create_ticket"), async (req: any, res: Response) => {
    try {
      const validatedInput = CreateTicketSchema.parse(req.body);

      const newTicket = await storage.createSupportTicket({
        userId: req.userId, // Current user
        subject: validatedInput.subject,
        description: validatedInput.description,
        priority: validatedInput.priority,
        status: 'OPEN' as any,
      } as any);

      await logTicketCreated(
        req.staffId,
        req.staffRole,
        newTicket.id,
        newTicket,
        req.ip,
        req.get('user-agent')
      );

      res.status(201).json({
        success: true,
        data: newTicket,
        message: `Ticket ${newTicket.ticketNo} created`,
      });
    } catch (error) {
      console.error("[admin routes] POST /admin/tickets error:", error);
      await logAuditError(req.staffId, req.staffRole, 'create_ticket', 'ticket', null, String(error), req.ip);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  /**
   * GET /admin/tickets
   * List support tickets
   */
  app.get("/api/admin/tickets", verifyAdminAuth, enforcePermission("list_tickets"), async (req: any, res: Response) => {
    try {
      const tickets = await storage.getSupportTickets();

      const enrichedTickets = await Promise.all(
        tickets.map(async (ticket) => {
          const sla = require("../services/ticketService").calculateSLAStatus(
            (ticket.priority as any) || 'MEDIUM',
            ticket.createdAt || new Date(),
            ticket.closedAt || undefined
          );
          return {
            ...ticket,
            slaStatus: sla,
          };
        })
      );

      res.json({
        success: true,
        data: enrichedTickets,
        total: enrichedTickets.length,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/tickets error:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  /**
   * GET /admin/tickets/{id}
   * Get ticket details with notes
   */
  app.get("/api/admin/tickets/:id", verifyAdminAuth, enforcePermission("view_all_tickets"), async (req: any, res: Response) => {
    try {
      const ticket = await getTicketDetails(req.params.id);
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/tickets/:id error:", error);
      res.status(404).json({ message: "Ticket not found" });
    }
  });

  /**
   * PATCH /admin/tickets/{id}/assign
   * Assign ticket to staff
   */
  app.patch("/api/admin/tickets/:id/assign", verifyAdminAuth, enforcePermission("assign_ticket"), async (req: any, res: Response) => {
    try {
      const validatedInput = AssignTicketSchema.parse(req.body);

      const updatedTicket = await assignTicket(
        req.params.id,
        validatedInput.staffId,
        req.staffId,
        req.staffRole,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        data: updatedTicket,
        message: "Ticket assigned",
      });
    } catch (error) {
      console.error("[admin routes] PATCH /admin/tickets/:id/assign error:", error);
      await logAuditError(req.staffId, req.staffRole, 'assign_ticket', 'ticket', req.params.id, String(error), req.ip);
      res.status(500).json({ message: "Failed to assign ticket" });
    }
  });

  /**
   * PATCH /admin/tickets/{id}/resolve
   * Resolve a ticket
   */
  app.patch("/api/admin/tickets/:id/resolve", verifyAdminAuth, enforcePermission("resolve_ticket"), async (req: any, res: Response) => {
    try {
      const validatedInput = ResolveTicketSchema.parse(req.body);

      const updatedTicket = await resolveTicket(
        req.params.id,
        validatedInput.resolutionNote,
        req.staffId,
        req.staffRole,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        data: updatedTicket,
        message: "Ticket resolved",
      });
    } catch (error) {
      console.error("[admin routes] PATCH /admin/tickets/:id/resolve error:", error);
      await logAuditError(req.staffId, req.staffRole, 'resolve_ticket', 'ticket', req.params.id, String(error), req.ip);
      res.status(500).json({ message: "Failed to resolve ticket" });
    }
  });

  /**
   * POST /admin/tickets/{id}/notes
   * Add internal note to ticket
   */
  app.post("/api/admin/tickets/:id/notes", verifyAdminAuth, enforcePermission("add_ticket_note"), async (req: any, res: Response) => {
    try {
      const validatedInput = AddTicketNoteSchema.parse(req.body);

      const newNote = await addTicketNote(
        req.params.id,
        req.staffId,
        validatedInput.content
      );

      res.status(201).json({
        success: true,
        data: newNote,
        message: "Note added",
      });
    } catch (error) {
      console.error("[admin routes] POST /admin/tickets/:id/notes error:", error);
      res.status(500).json({ message: "Failed to add note" });
    }
  });

  // ========== COUPONS ==========

  /**
   * POST /admin/coupons
   * Create a coupon
   */
  app.post("/api/admin/coupons", verifyAdminAuth, enforcePermission("create_coupon"), async (req: any, res: Response) => {
    try {
      const validatedInput = CreateCouponSchema.parse(req.body);

      // Validate coupon limits for MARKETING_STAFF
      const limits = validateCouponLimits(
        req.staffRole,
        validatedInput.discountPercent,
        validatedInput.usageLimit,
        Math.ceil((new Date(validatedInput.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );

      if (!limits.valid) {
        return res.status(400).json({ message: limits.error });
      }

      const newCoupon = await storage.createCoupon({
        code: validatedInput.code.toUpperCase(),
        discountValue: validatedInput.discountPercent,
        discountType: 'percentage',
        maxUses: validatedInput.usageLimit,
        validUntil: new Date(validatedInput.expiryDate),
      } as any);

      await logCouponCreated(
        req.staffId,
        req.staffRole,
        newCoupon.id,
        newCoupon,
        req.ip,
        req.get('user-agent')
      );

      res.status(201).json({
        success: true,
        data: newCoupon,
        message: `Coupon ${validatedInput.code} created`,
      });
    } catch (error) {
      console.error("[admin routes] POST /admin/coupons error:", error);
      await logAuditError(req.staffId, req.staffRole, 'create_coupon', 'coupon', null, String(error), req.ip);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  /**
   * GET /admin/coupons
   * List coupons
   */
  app.get("/api/admin/coupons", verifyAdminAuth, enforcePermission("list_coupons"), async (req: any, res: Response) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json({
        success: true,
        data: coupons,
        total: coupons.length,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/coupons error:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  /**
   * POST /admin/coupons/{id}/assign
   * Assign coupon to user
   */
  app.post("/api/admin/coupons/:id/assign", verifyAdminAuth, enforcePermission("assign_coupon_to_user"), async (req: any, res: Response) => {
    try {
      const validatedInput = AssignCouponSchema.parse(req.body);

      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }

      // Log assignment
      await logCouponAssigned(
        req.staffId,
        req.staffRole,
        req.params.id,
        validatedInput.userId,
        req.ip,
        req.get('user-agent')
      );

      res.json({
        success: true,
        message: `Coupon assigned to user`,
        data: {
          couponId: req.params.id,
          userId: validatedInput.userId,
        },
      });
    } catch (error) {
      console.error("[admin routes] POST /admin/coupons/:id/assign error:", error);
      await logAuditError(req.staffId, req.staffRole, 'assign_coupon', 'coupon', req.params.id, String(error), req.ip);
      res.status(500).json({ message: "Failed to assign coupon" });
    }
  });

  // ========== ANALYTICS ==========

  /**
   * GET /admin/analytics/dashboard
   * Get dashboard summary
   */
  app.get("/api/admin/analytics/dashboard", verifyAdminAuth, enforcePermission("view_staff_analytics"), async (req: any, res: Response) => {
    try {
      const summary = await getDashboardSummary();
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard analytics" });
    }
  });

  /**
   * GET /admin/analytics/staff
   * Get staff performance analytics
   */
  app.get("/api/admin/analytics/staff", verifyAdminAuth, enforcePermission("view_staff_analytics"), async (req: any, res: Response) => {
    try {
      const analytics = await getStaffAnalytics();
      res.json({
        success: true,
        data: analytics,
        total: analytics.length,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/staff error:", error);
      res.status(500).json({ message: "Failed to fetch staff analytics" });
    }
  });

  /**
   * GET /admin/analytics/staff/{id}
   * Get detailed analytics for a staff member
   */
  app.get("/api/admin/analytics/staff/:id", verifyAdminAuth, async (req: any, res: Response) => {
    try {
      // Permission check: SUPER_ADMIN or own metrics
      if (req.staffRole !== 'SUPER_ADMIN' && req.staffId !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const analytics = await getStaffDetailedAnalytics(req.params.id);
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/staff/:id error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  /**
   * GET /admin/analytics/tickets
   * Get ticket analytics
   */
  app.get("/api/admin/analytics/tickets", verifyAdminAuth, enforcePermission("view_ticket_analytics"), async (req: any, res: Response) => {
    try {
      const analytics = await getTicketDashboardAnalytics();
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/tickets error:", error);
      res.status(500).json({ message: "Failed to fetch ticket analytics" });
    }
  });

  /**
   * GET /admin/analytics/coupons
   * Get coupon analytics
   */
  app.get("/api/admin/analytics/coupons", verifyAdminAuth, async (req: any, res: Response) => {
    try {
      // Only SUPER_ADMIN and MARKETING_STAFF can view
      if (!['SUPER_ADMIN', 'MARKETING_STAFF'].includes(req.staffRole)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const analytics = await getCouponDashboardAnalytics();
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/coupons error:", error);
      res.status(500).json({ message: "Failed to fetch coupon analytics" });
    }
  });

  /**
   * GET /admin/analytics/revenue
   * Get revenue analytics
   */
  app.get("/api/admin/analytics/revenue", verifyAdminAuth, enforcePermission("view_revenue_analytics"), async (req: any, res: Response) => {
    try {
      const analytics = await getRevenueAnalytics();
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/revenue error:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  // ========== AUDIT LOGS ==========

  /**
   * GET /admin/audit-logs
   * Get admin audit logs with filtering
   */
  app.get("/api/admin/audit-logs", verifyAdminAuth, enforcePermission("view_audit_logs"), async (req: any, res: Response) => {
    try {
      const { staffId, role, action, entityType, limit, offset } = req.query;

      const result = await storage.getAdminAuditLogs({
        staffId,
        role,
        action,
        entityType,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });

      res.json({
        success: true,
        data: result.logs,
        total: result.total,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/audit-logs error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  /**
   * GET /admin/audit-logs/export
   * Export audit logs as CSV
   */
  app.get("/api/admin/audit-logs/export", verifyAdminAuth, enforcePermission("export_audit_logs"), async (req: any, res: Response) => {
    try {
      const result = await storage.getAdminAuditLogs({
        limit: 10000,
      });

      const csv = [
        ['ID', 'Staff ID', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Status', 'Created At'].join(','),
        ...result.logs.map(log => [
          log.id,
          log.actorStaffId,
          log.actorRole,
          log.action,
          log.entityType,
          log.entityId || '',
          log.status,
          log.createdAt?.toISOString() || '',
        ].join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.send(csv);
    } catch (error) {
      console.error("[admin routes] GET /admin/audit-logs/export error:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  /**
   * GET /admin/analytics/export/staff
   * Export staff analytics as CSV
   */
  app.get("/api/admin/analytics/export/staff", verifyAdminAuth, enforcePermission("export_analytics"), async (req: any, res: Response) => {
    try {
      const analytics = await getStaffAnalytics();
      const csv = exportStaffAnalyticsAsCSV(analytics);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=staff-analytics.csv');
      res.send(csv);
    } catch (error) {
      console.error("[admin routes] GET /admin/analytics/export/staff error:", error);
      res.status(500).json({ message: "Failed to export analytics" });
    }
  });

  // ========== EMAIL SETTINGS (System-wide SMTP Configuration) ==========

  /**
   * GET /admin/email-settings
   * Get current active email configuration
   * SUPER_ADMIN only
   */
  app.get("/api/admin/email-settings", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const settings = await storage.getActiveAdminEmailSettings();

      if (!settings) {
        return res.json({ configured: false, settings: null });
      }

      // Don't send encrypted password to client
      const { smtpPasswordEncrypted, ...safeSettings } = settings;

      res.json({
        configured: true,
        settings: safeSettings,
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/email-settings error:", error);
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  /**
   * POST /admin/email-settings
   * Create or update email configuration with test
   * SUPER_ADMIN only
   *
   * CRITICAL: Tests email before saving
   */
  app.post("/api/admin/email-settings", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const {
        provider,
        fromName,
        fromEmail,
        smtpUsername,
        smtpPassword,
        testRecipient,
      } = req.body;

      // Validate required fields
      if (!provider || !fromName || !fromEmail || !smtpUsername || !smtpPassword || !testRecipient) {
        return res.status(400).json({
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: provider, fromName, fromEmail, smtpUsername, smtpPassword, testRecipient',
        });
      }

      // Import provider validation
      const { validateProviderConfig, getProviderPreset, isProviderSupported } = await import('../utils/providerValidation');

      // CRITICAL: Validate provider is supported
      if (!isProviderSupported(provider)) {
        return res.status(400).json({
          code: 'UNSUPPORTED_PROVIDER',
          message: `Provider '${provider}' is not supported. Supported providers: gmail, zoho, outlook, yahoo, ses, custom`,
        });
      }

      // Get preset configuration
      const { SMTP_PRESETS, testEmailConfiguration, encryptPassword } = await import('../services/adminEmailService');
      const preset = SMTP_PRESETS[provider as keyof typeof SMTP_PRESETS];

      if (!preset) {
        return res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: 'Invalid email provider selected',
        });
      }

      // CRITICAL: Validate provider-specific settings BEFORE testing
      const validation = validateProviderConfig(
        provider,
        preset.host,
        preset.port,
        preset.encryption
      );

      if (!validation.valid) {
        console.error(`[Email Settings] Provider validation failed for ${provider}:`, validation.errors);
        return res.status(400).json({
          code: 'PROVIDER_VALIDATION_FAILED',
          provider,
          message: validation.errors[0], // Return first error as main message
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn(`[Email Settings] Provider warnings for ${provider}:`, validation.warnings);
      }

      // CRITICAL: Test configuration BEFORE saving
      console.log(`[Email Settings] Testing ${provider} SMTP configuration...`);

      const testResult = await testEmailConfiguration({
        provider,
        smtpHost: preset.host,
        smtpPort: preset.port,
        encryption: preset.encryption,
        smtpUsername,
        smtpPassword,
        fromEmail,
        fromName,
        testRecipient,
      });

      if (!testResult.success) {
        // Return detailed error to client
        console.error(`[Email Settings] Test failed for ${provider}:`, testResult.error);

        return res.status(400).json({
          code: testResult.code || 'SMTP_TEST_FAILED',
          provider,
          message: testResult.error || 'Failed to send test email',
        });
      }

      console.log(`[Email Settings] Test successful for ${provider}`);

      // Test succeeded - encrypt password and save
      const encryptedPassword = encryptPassword(smtpPassword);

      // Deactivate other email configs
      await storage.deactivateOtherEmailSettings();

      // Create new configuration
      const emailSettings = await storage.createAdminEmailSettings({
        provider,
        fromName,
        fromEmail,
        smtpHost: preset.host,
        smtpPort: preset.port,
        encryption: preset.encryption,
        smtpUsername,
        smtpPasswordEncrypted: encryptedPassword,
        isActive: true,
        lastTestedAt: new Date(),
        testStatus: 'success',
        createdBy: req.staff?.id,
      });

      // Log action
      await logAuditError({
        action: 'configure_email',
        actorStaffId: req.staff?.id,
        actorRole: req.staff?.role,
        entityType: 'email_settings',
        entityId: emailSettings.id,
        status: 'SUCCESS',
        afterState: { provider, fromEmail, testStatus: 'success' },
      });

      console.log(`[Email Settings] Configuration saved successfully:`, emailSettings.id);

      res.json({
        success: true,
        message: 'Email settings configured successfully',
        settings: {
          id: emailSettings.id,
          provider: emailSettings.provider,
          fromName: emailSettings.fromName,
          fromEmail: emailSettings.fromEmail,
        },
      });
    } catch (error: any) {
      console.error("[admin routes] POST /admin/email-settings error:", error);

      // Log failure
      await logAuditError({
        action: 'configure_email',
        actorStaffId: req.staff?.id,
        actorRole: req.staff?.role,
        entityType: 'email_settings',
        entityId: null,
        status: 'FAILED',
        errorDetails: error.message,
      }).catch(console.error);

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to save email settings',
        details: error.message,
      });
    }
  });

  /**
   * POST /admin/email-settings/test
   * Test email configuration without saving
   * SUPER_ADMIN only
   */
  app.post("/api/admin/email-settings/test", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const {
        provider,
        fromName,
        fromEmail,
        smtpUsername,
        smtpPassword,
        testRecipient,
      } = req.body;

      if (!provider || !fromName || !fromEmail || !smtpUsername || !smtpPassword || !testRecipient) {
        return res.status(400).json({
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields for test',
        });
      }

      const { SMTP_PRESETS, testEmailConfiguration } = await import('../services/adminEmailService');
      const preset = SMTP_PRESETS[provider as keyof typeof SMTP_PRESETS];

      if (!preset) {
        return res.status(400).json({
          code: 'INVALID_PROVIDER',
          message: 'Invalid email provider selected',
        });
      }

      const testResult = await testEmailConfiguration({
        provider,
        smtpHost: preset.host,
        smtpPort: preset.port,
        encryption: preset.encryption,
        smtpUsername,
        smtpPassword,
        fromEmail,
        fromName,
        testRecipient,
      });

      if (!testResult.success) {
        return res.status(400).json({
          code: testResult.code,
          provider,
          message: testResult.error,
        });
      }

      res.json({
        success: true,
        message: 'Test email sent successfully! Check your inbox.',
      });
    } catch (error: any) {
      console.error("[admin routes] POST /admin/email-settings/test error:", error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to test email configuration',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/admin/email/test-smtp
   * Test SMTP connection without saving (for modal preview)
   * Tests host, port, username, password credentials
   * Admin only - simple Clerk auth check
   */
  app.post("/api/admin/email/test-smtp", adminAuth, async (req: any, res: Response) => {
    try {
      const { host, port, username, password, secure } = req.body;

      // Validate required fields
      if (!host || !port || !username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: host, port, username, password',
        });
      }

      const nodemailer = await import('nodemailer');

      // Create transporter with provided credentials
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: secure === true || secure === 'true',
        auth: {
          user: username,
          pass: password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Test the connection
      await transporter.verify();

      res.json({
        success: true,
        message: 'SMTP connection successful',
      });
    } catch (error: any) {
      console.error('[admin routes] SMTP test error:', error);
      const errorMessage = error.message || error.toString();

      // Handle specific SMTP errors
      let userFriendlyMessage = errorMessage;

      if (errorMessage.includes('Invalid login') || errorMessage.includes('535')) {
        userFriendlyMessage = 'Invalid credentials. Check username and password.';
      } else if (errorMessage.includes('ENOTFOUND')) {
        userFriendlyMessage = 'SMTP host not found. Check the hostname.';
      } else if (errorMessage.includes('ECONNREFUSED')) {
        userFriendlyMessage = 'Connection refused. Check host and port.';
      } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        userFriendlyMessage = 'Connection timeout. Host may be unreachable.';
      } else if (errorMessage.includes('requires STARTTLS')) {
        userFriendlyMessage = 'Server requires TLS. Try toggling secure mode.';
      }

      res.status(400).json({
        success: false,
        error: userFriendlyMessage,
      });
    }
  });

  /**
   * GET /admin/email-logs
   * Get email send history (system-wide)
   * SUPER_ADMIN only
   */
  app.get("/api/admin/email-logs", verifyAdminAuth, enforcePermission("view_logs"), async (req: any, res: Response) => {
    try {
      // This would need a new storage method to get ALL email logs, not just per-user
      // For now, return empty array as placeholder
      res.json({
        logs: [],
        message: 'Email logs feature coming soon',
      });
    } catch (error) {
      console.error("[admin routes] GET /admin/email-logs error:", error);
      res.status(500).json({ message: "Failed to fetch email logs" });
    }
  });

  // ========== MULTI-PROVIDER EMAIL SYSTEM ==========

  /**
   * GET /admin/email-providers (and aliases /admin/email/config, /admin/email/providers)
   * List all email providers
   */
  app.get("/api/admin/email-providers", adminAuth, async (req: any, res: Response) => {
    try {
      const providers = await storage.getAllEmailProviders();
      
      // Don't expose encrypted credentials
      const safeProviders = providers.map(p => ({
        ...p,
        smtpPasswordEncrypted: p.smtpPasswordEncrypted ? '***ENCRYPTED***' : null,
        apiKeyEncrypted: p.apiKeyEncrypted ? '***ENCRYPTED***' : null,
        apiSecretEncrypted: p.apiSecretEncrypted ? '***ENCRYPTED***' : null,
      }));

      res.json({ providers: safeProviders });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email-providers error:", error);
      res.status(500).json({ message: "Failed to fetch email providers" });
    }
  });

  // Frontend uses these paths
  app.get("/api/admin/email/config", adminAuth, async (req: any, res: Response) => {
    try {
      const providers = await storage.getAllEmailProviders();
      const safeProviders = providers.map(p => ({
        ...p,
        smtpPasswordEncrypted: p.smtpPasswordEncrypted ? '***ENCRYPTED***' : null,
        apiKeyEncrypted: p.apiKeyEncrypted ? '***ENCRYPTED***' : null,
        apiSecretEncrypted: p.apiSecretEncrypted ? '***ENCRYPTED***' : null,
      }));
      res.json({ providers: safeProviders });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email/config error:", error);
      res.status(500).json({ message: "Failed to fetch email providers" });
    }
  });

  app.get("/api/admin/email/providers", adminAuth, async (req: any, res: Response) => {
    try {
      const providers = await storage.getAllEmailProviders();
      const safeProviders = providers.map(p => ({
        ...p,
        smtpPasswordEncrypted: p.smtpPasswordEncrypted ? '***ENCRYPTED***' : null,
        apiKeyEncrypted: p.apiKeyEncrypted ? '***ENCRYPTED***' : null,
        apiSecretEncrypted: p.apiSecretEncrypted ? '***ENCRYPTED***' : null,
      }));
      res.json({ providers: safeProviders });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email/providers error:", error);
      res.status(500).json({ message: "Failed to fetch email providers" });
    }
  });

  /**
   * POST /api/admin/email/test
   * Alias for admin test email sending using primary provider
   */
  app.post("/api/admin/email/test", adminAuth, async (req: any, res: Response) => {
    try {
      const to: string = req.body?.email || req.body?.to;
      if (!to) {
        return res.status(400).json({ error: "Recipient email is required" });
      }

      const nodemailer = await import('nodemailer');
      const { decrypt } = await import('../utils/encryption');

      const providers = await storage.getAllEmailProviders();
      const primary = providers.find(p => p.isActive) || providers[0];
      if (!primary) {
        return res.status(400).json({ error: 'No email provider configured' });
      }

      const password = primary.smtpPasswordEncrypted ? decrypt(primary.smtpPasswordEncrypted) : undefined;
      if (!password) {
        return res.status(400).json({ error: 'SMTP password missing or could not be decrypted' });
      }

      const transporter = nodemailer.createTransport({
        host: primary.smtpHost,
        port: primary.smtpPort || 587,
        secure: primary.smtpEncryption === 'SSL',
        auth: {
          user: primary.smtpUsername,
          pass: password,
        },
      });

      await transporter.sendMail({
        from: `"${primary.fromName || 'BoxCostPro'}" <${primary.fromEmail}>`,
        to,
        subject: 'BoxCostPro Email Test',
        html: `<p>This is a test email from BoxCostPro Admin Panel.</p>`,
        text: `This is a test email from BoxCostPro Admin Panel.`,
      });

      res.json({ success: true, message: `Test email sent to ${to}` });
    } catch (error: any) {
      console.error('[admin routes] POST /api/admin/email/test error:', error);
      const msg = error?.message || String(error);
      let hint: string | undefined;
      if (msg.includes('Invalid login') || msg.includes('535')) hint = 'Invalid credentials - check SMTP username/password';
      else if (msg.includes('ENOTFOUND')) hint = 'SMTP host not found - check hostname';
      else if (msg.includes('requires STARTTLS')) hint = 'Server requires TLS/STARTTLS - adjust encryption settings';
      res.status(500).json({ error: 'Failed to send test email', details: msg, hint });
    }
  });

  /**
   * GET /admin/email-providers/:id
   * Get single provider details
   */
  app.get("/api/admin/email-providers/:id", adminAuth, async (req: any, res: Response) => {
    try {
      const provider = await storage.getEmailProvider(req.params.id);
      
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      // Don't expose encrypted credentials
      const safeProvider = {
        ...provider,
        smtpPasswordEncrypted: provider.smtpPasswordEncrypted ? '***ENCRYPTED***' : null,
        apiKeyEncrypted: provider.apiKeyEncrypted ? '***ENCRYPTED***' : null,
        apiSecretEncrypted: provider.apiSecretEncrypted ? '***ENCRYPTED***' : null,
      };

      res.json({ provider: safeProvider });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email-providers/:id error:", error);
      res.status(500).json({ message: "Failed to fetch provider" });
    }
  });

  /**
   * POST /admin/email-providers (and /admin/email/providers alias)
   * Create new email provider
   */
  const createEmailProvider = async (req: any, res: Response) => {
    try {
      const { encrypt } = await import('../utils/encryption.js');
      
      const providerData = req.body;

      // Normalize email for consistent uniqueness (case-insensitive)
      if (providerData.fromEmail && typeof providerData.fromEmail === 'string') {
        providerData.fromEmail = providerData.fromEmail.trim().toLowerCase();
      }

        // Check for duplicate email address
        const existingProviders = await storage.getAllEmailProviders();
        const duplicateProvider = existingProviders.find(
          (p) => p.fromEmail && p.fromEmail.toLowerCase() === providerData.fromEmail?.toLowerCase()
        );
      
        if (duplicateProvider) {
          return res.status(400).json({ 
            message: "Email address already exists", 
            error: `An email provider with the address "${providerData.fromEmail}" already exists. Each email address can only be added once.`
          });
        }

      // Encrypt credentials before storing
      if (providerData.smtpPassword) {
        // Remove spaces (Gmail App Passwords have spaces when copied)
        const cleanedPassword = providerData.smtpPassword.replace(/\s+/g, '');
        providerData.smtpPasswordEncrypted = encrypt(cleanedPassword);
        delete providerData.smtpPassword;
      }
      if (providerData.apiKey) {
        providerData.apiKeyEncrypted = encrypt(providerData.apiKey);
        delete providerData.apiKey;
      }
      if (providerData.apiSecret) {
        providerData.apiSecretEncrypted = encrypt(providerData.apiSecret);
        delete providerData.apiSecret;
      }

      providerData.createdBy = req.admin?.id || req.adminId;

      const provider = await storage.createEmailProvider(providerData);

      // Send confirmation email automatically using nodemailer directly
      let confirmationSent = false;
      let confirmationError = null;
      
      try {
        console.log(`[admin routes] Sending confirmation email to ${provider.fromEmail}...`);
        
        const nodemailer = await import('nodemailer');
        const { decrypt } = await import('../utils/encryption');

        if (!provider.smtpPasswordEncrypted) {
          throw new Error('No SMTP password configured');
        }

        const password = decrypt(provider.smtpPasswordEncrypted);
        
        const transporter = nodemailer.createTransport({
          host: provider.smtpHost,
          port: provider.smtpPort || 587,
          secure: provider.smtpEncryption === 'SSL',
          auth: {
            user: provider.smtpUsername,
            pass: password,
          },
          tls: {
            rejectUnauthorized: false, // Allow self-signed certs for testing
          },
        });

        await transporter.sendMail({
          from: `"${provider.fromName || 'BoxCostPro'}" <${provider.fromEmail}>`,
          to: provider.fromEmail,
          subject: '✅ Email Provider Added to BoxCostPro',
          html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Email Provider Configured Successfully!</h1>
    </div>
    <div class="content">
      <div class="success">
        <p><strong>Great news!</strong> Your email provider has been added to BoxCostPro.</p>
      </div>
      <p>The following email address is now active for sending:</p>
      <p><strong>${provider.fromEmail}</strong></p>
      <p><strong>Provider:</strong> ${provider.providerName}</p>
      <p><strong>Type:</strong> ${provider.providerType.toUpperCase()}</p>
      <p>You can now send emails through the BoxCostPro platform using this provider.</p>
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        This is a confirmation email from BoxCostPro Admin Panel.
      </p>
    </div>
  </div>
</body>
</html>
          `,
          text: `Email Provider Added to BoxCostPro\n\nYour email provider has been successfully configured.\n\nEmail: ${provider.fromEmail}\nProvider: ${provider.providerName}\nType: ${provider.providerType.toUpperCase()}\n\nYou can now send emails through BoxCostPro using this provider.`,
        });
        
        // Update verification status
        await storage.updateEmailProvider(provider.id, {
          isVerified: true,
          lastTestAt: new Date(),
          consecutiveFailures: 0,
        });
        
        confirmationSent = true;
        console.log(`[admin routes] ✅ Confirmation email sent successfully to ${provider.fromEmail}`);
      } catch (err: any) {
        confirmationError = err.message;
        console.error('[admin routes] ❌ Failed to send confirmation email:', err.message);
        console.error('[admin routes] Error details:', {
          host: provider.smtpHost,
          port: provider.smtpPort,
          user: provider.smtpUsername,
          error: err.message,
        });
      }

      res.status(201).json({
        message: "Email provider created successfully",
        provider: {
          ...provider,
          smtpPasswordEncrypted: provider.smtpPasswordEncrypted ? '***ENCRYPTED***' : null,
          apiKeyEncrypted: provider.apiKeyEncrypted ? '***ENCRYPTED***' : null,
          apiSecretEncrypted: provider.apiSecretEncrypted ? '***ENCRYPTED***' : null,
        },
        confirmationEmail: {
          sent: confirmationSent,
          error: confirmationError,
        },
      });
    } catch (error: any) {
      console.error("[admin routes] POST /admin/email-providers error:", error);
      res.status(500).json({ message: "Failed to create email provider", error: error.message });
    }
  };

  app.post("/api/admin/email-providers", adminAuth, createEmailProvider);
  app.post("/api/admin/email/providers", adminAuth, createEmailProvider); // Frontend uses this path

  /**
   * PATCH /admin/email-providers/:id (and /admin/email/providers/:id alias)
   * Update email provider
   */
  const updateEmailProvider = async (req: any, res: Response) => {
    try {
      const { encrypt } = await import('../utils/encryption.js');
      
      const updates = req.body;

      // Encrypt credentials if provided
      if (updates.smtpPassword) {
        updates.smtpPasswordEncrypted = encrypt(updates.smtpPassword);
        delete updates.smtpPassword;
      }
      if (updates.apiKey) {
        updates.apiKeyEncrypted = encrypt(updates.apiKey);
        delete updates.apiKey;
      }
      if (updates.apiSecret) {
        updates.apiSecretEncrypted = encrypt(updates.apiSecret);
        delete updates.apiSecret;
      }

      updates.updatedBy = req.admin?.id || req.adminId;

      const provider = await storage.updateEmailProvider(req.params.id, updates);

      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      res.json({
        message: "Email provider updated successfully",
        provider: {
          ...provider,
          smtpPasswordEncrypted: provider.smtpPasswordEncrypted ? '***ENCRYPTED***' : null,
          apiKeyEncrypted: provider.apiKeyEncrypted ? '***ENCRYPTED***' : null,
          apiSecretEncrypted: provider.apiSecretEncrypted ? '***ENCRYPTED***' : null,
        },
      });
    } catch (error: any) {
      console.error("[admin routes] PATCH /admin/email-providers/:id error:", error);
      res.status(500).json({ message: "Failed to update email provider", error: error.message });
    }
  };

  app.patch("/api/admin/email-providers/:id", adminAuth, updateEmailProvider);
  app.patch("/api/admin/email/providers/:id", adminAuth, updateEmailProvider); // Frontend uses this

  /**
   * POST /api/admin/email-providers/:id/primary (and alias /api/admin/email/providers/:id/primary)
   * Promote provider to primary (priority 1) and reindex others
   */
  const setPrimaryEmailProvider = async (req: any, res: Response) => {
    try {
      const ok = await storage.setPrimaryEmailProvider(req.params.id);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Provider not found' });
      }
      const providers = await storage.getAllEmailProviders();
      res.json({ success: true, providers });
    } catch (error: any) {
      console.error('[admin routes] POST /admin/email-providers/:id/primary error:', error);
      res.status(500).json({ success: false, message: 'Failed to set primary provider', error: error.message });
    }
  };

  app.post("/api/admin/email-providers/:id/primary", adminAuth, setPrimaryEmailProvider);
  app.post("/api/admin/email/providers/:id/primary", adminAuth, setPrimaryEmailProvider); // Frontend uses this

  /**
   * DELETE /admin/email-providers/:id (and /admin/email/providers/:id alias)
   * Delete email provider
   */
  const deleteEmailProvider = async (req: any, res: Response) => {
    try {
      const deleted = await storage.deleteEmailProvider(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: "Provider not found" });
      }

      res.json({ message: "Email provider deleted successfully" });
    } catch (error: any) {
      console.error("[admin routes] DELETE /admin/email-providers/:id error:", error);
      res.status(500).json({ message: "Failed to delete email provider", error: error.message });
    }
  };

  app.delete("/api/admin/email-providers/:id", adminAuth, deleteEmailProvider);
  app.delete("/api/admin/email/providers/:id", adminAuth, deleteEmailProvider); // Frontend uses this

  /**
   * POST /admin/email-providers/:id/test (and /admin/email/providers/:id/test alias)
   * Test email provider connection
   */
  const testEmailProvider = async (req: any, res: Response) => {
    try {
      const provider = await storage.getEmailProvider(req.params.id);
      
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }

      // Import routing engine and adapter factory
      const { ProviderAdapterFactory } = await import('../email/providerAdapters.js');
      
      // Create adapter for provider
      const adapter = ProviderAdapterFactory.createAdapter(provider);
      
      // Test connection
      const testResult = await adapter.test();

      // Update provider verification status
      if (testResult.success) {
        await storage.updateEmailProvider(provider.id, {
          isVerified: true,
          lastTestAt: new Date(),
          consecutiveFailures: 0,
        });
      } else {
        await storage.updateEmailProvider(provider.id, {
          isVerified: false,
          lastTestAt: new Date(),
          lastErrorMessage: testResult.error || 'Test failed',
        });
      }

      res.json({
        success: testResult.success,
        message: testResult.success ? 'Provider connection successful' : 'Provider connection failed',
        error: testResult.error,
      });
    } catch (error: any) {
      console.error("[admin routes] POST /admin/email-providers/:id/test error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to test provider", 
        error: error.message 
      });
    }
  };

  app.post("/api/admin/email-providers/:id/test", adminAuth, testEmailProvider);
  app.post("/api/admin/email/providers/:id/test", adminAuth, testEmailProvider); // Frontend uses this

  /**
   * GET /api/admin/email/health
   * Get email provider health status and metrics
   * Returns health for all configured providers
   */
  app.get("/api/admin/email/health", async (req: any, res: Response) => {
    try {
      const providers = await storage.getAllEmailProviders();

      if (!providers || providers.length === 0) {
        return res.json({
          providers: [],
          message: 'No email providers configured',
        });
      }

      // Get health for each provider
      const health = providers.map(provider => {
        // Determine health status based on:
        // - isVerified
        // - consecutiveFailures
        // - lastTestAt
        
        let status = 'healthy';
        if (!provider.isVerified) {
          status = 'error';
        } else if (provider.consecutiveFailures && provider.consecutiveFailures > 3) {
          status = 'critical';
        } else if (provider.consecutiveFailures && provider.consecutiveFailures > 0) {
          status = 'warning';
        }

        return {
          id: provider.id,
          name: provider.name,
          provider: provider.provider,
          status,
          isVerified: provider.isVerified,
          lastTestAt: provider.lastTestAt,
          lastErrorMessage: provider.lastErrorMessage,
          consecutiveFailures: provider.consecutiveFailures || 0,
          createdAt: provider.createdAt,
        };
      });

      res.json({
        providers: health,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[admin routes] GET /admin/email/health error:', error);
      res.status(500).json({
        message: 'Failed to fetch email health',
        error: error.message,
      });
    }
  });

  /**
   * GET /api/admin/email/logs
   * Get recent email logs
   */
  app.get("/api/admin/email/logs", adminAuth, async (req: any, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // For now, return empty array since we don't have email logs table yet
      // TODO: Implement email logging table
      res.json({ 
        logs: [],
        total: 0,
        message: 'Email logging not yet implemented'
      });
    } catch (error: any) {
      console.error('[admin routes] GET /admin/email/logs error:', error);
      res.status(500).json({
        message: 'Failed to fetch email logs',
        error: error.message,
      });
    }
  });

  // ========== EMAIL TASK ROUTING ==========

  /**
   * GET /admin/email-routing
   * List all task routing rules
   */
  app.get("/api/admin/email-routing", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const routing = await storage.getAllTaskRouting();
      res.json({ routing });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email-routing error:", error);
      res.status(500).json({ message: "Failed to fetch routing rules" });
    }
  });

  /**
   * GET /admin/email-routing/:taskType
   * Get routing rule for specific task type
   */
  app.get("/api/admin/email-routing/:taskType", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const routing = await storage.getTaskRouting(req.params.taskType);
      
      if (!routing) {
        return res.status(404).json({ message: "Routing rule not found" });
      }

      res.json({ routing });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email-routing/:taskType error:", error);
      res.status(500).json({ message: "Failed to fetch routing rule" });
    }
  });

  /**
   * POST /admin/email-routing
   * Create new task routing rule
   */
  app.post("/api/admin/email-routing", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const routingData = req.body;
      routingData.updatedBy = req.user?.id || req.adminStaff?.userId;

      const routing = await storage.createTaskRouting(routingData);

      res.status(201).json({
        message: "Task routing created successfully",
        routing,
      });
    } catch (error: any) {
      console.error("[admin routes] POST /admin/email-routing error:", error);
      res.status(500).json({ message: "Failed to create routing rule", error: error.message });
    }
  });

  /**
   * PATCH /admin/email-routing/:id
   * Update task routing rule
   */
  app.patch("/api/admin/email-routing/:id", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const updates = req.body;
      updates.updatedBy = req.user?.id || req.adminStaff?.userId;

      const routing = await storage.updateTaskRouting(req.params.id, updates);

      if (!routing) {
        return res.status(404).json({ message: "Routing rule not found" });
      }

      res.json({
        message: "Task routing updated successfully",
        routing,
      });
    } catch (error: any) {
      console.error("[admin routes] PATCH /admin/email-routing/:id error:", error);
      res.status(500).json({ message: "Failed to update routing rule", error: error.message });
    }
  });

  /**
   * DELETE /admin/email-routing/:id
   * Delete task routing rule
   */
  app.delete("/api/admin/email-routing/:id", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const deleted = await storage.deleteTaskRouting(req.params.id);

      if (!deleted) {
        return res.status(404).json({ message: "Routing rule not found" });
      }

      res.json({ message: "Task routing deleted successfully" });
    } catch (error: any) {
      console.error("[admin routes] DELETE /admin/email-routing/:id error:", error);
      res.status(500).json({ message: "Failed to delete routing rule", error: error.message });
    }
  });

  /**
   * GET /admin/email-send-logs
   * Get comprehensive email send logs with filtering
   */
  app.get("/api/admin/email-send-logs", verifyAdminAuth, enforcePermission("view_logs"), async (req: any, res: Response) => {
    try {
      const { taskType, status, userId, limit } = req.query;

      const logs = await storage.getEmailSendLogs({
        taskType: taskType as string | undefined,
        status: status as string | undefined,
        userId: userId as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      res.json({ logs });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/email-send-logs error:", error);
      res.status(500).json({ message: "Failed to fetch email logs" });
    }
  });

  // ========== INVOICE TEMPLATE MANAGEMENT ==========

  /**
   * GET /admin/invoice-templates
   * Get all invoice templates (including inactive)
   */
  app.get("/api/admin/invoice-templates", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const templates = await storage.getInvoiceTemplates();
      res.json({ success: true, templates });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/invoice-templates error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch invoice templates" });
    }
  });

  /**
   * GET /admin/invoice-templates/:id
   * Get single invoice template by ID
   */
  app.get("/api/admin/invoice-templates/:id", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const template = await storage.getInvoiceTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }
      res.json({ success: true, template });
    } catch (error: any) {
      console.error("[admin routes] GET /admin/invoice-templates/:id error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch invoice template" });
    }
  });

  /**
   * POST /admin/invoice-templates
   * Create a new invoice template
   */
  app.post("/api/admin/invoice-templates", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const templateData = req.body;
      
      // Validate required fields
      if (!templateData.name || !templateData.htmlTemplate) {
        return res.status(400).json({ 
          success: false, 
          message: "Name and htmlTemplate are required" 
        });
      }

      const template = await storage.createInvoiceTemplate(templateData);
      
      res.status(201).json({ 
        success: true, 
        message: "Invoice template created successfully",
        template 
      });
    } catch (error: any) {
      console.error("[admin routes] POST /admin/invoice-templates error:", error);
      res.status(500).json({ success: false, message: "Failed to create invoice template", error: error.message });
    }
  });

  /**
   * PUT /admin/invoice-templates/:id
   * Update an invoice template
   */
  app.put("/api/admin/invoice-templates/:id", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const template = await storage.updateInvoiceTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }
      
      res.json({ 
        success: true, 
        message: "Invoice template updated successfully",
        template 
      });
    } catch (error: any) {
      console.error("[admin routes] PUT /admin/invoice-templates/:id error:", error);
      res.status(500).json({ success: false, message: "Failed to update invoice template", error: error.message });
    }
  });

  /**
   * PUT /admin/invoice-templates/:id/set-default
   * Set an invoice template as the default
   */
  app.put("/api/admin/invoice-templates/:id/set-default", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      // First, unset all other defaults
      const allTemplates = await storage.getInvoiceTemplates();
      for (const t of allTemplates) {
        if (t.isDefault) {
          await storage.updateInvoiceTemplate(t.id, { isDefault: false });
        }
      }
      
      // Set this one as default
      const template = await storage.updateInvoiceTemplate(req.params.id, { isDefault: true });
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }
      
      res.json({ 
        success: true, 
        message: `"${template.name}" is now the default invoice template`,
        template 
      });
    } catch (error: any) {
      console.error("[admin routes] PUT /admin/invoice-templates/:id/set-default error:", error);
      res.status(500).json({ success: false, message: "Failed to set default template", error: error.message });
    }
  });

  /**
   * PUT /admin/invoice-templates/:id/status
   * Toggle template active/inactive status
   */
  app.put("/api/admin/invoice-templates/:id/status", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: "isActive must be a boolean" });
      }

      const template = await storage.updateInvoiceTemplate(req.params.id, { isActive });
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }
      
      res.json({ 
        success: true, 
        message: `Template ${isActive ? 'activated' : 'deactivated'} successfully`,
        template 
      });
    } catch (error: any) {
      console.error("[admin routes] PUT /admin/invoice-templates/:id/status error:", error);
      res.status(500).json({ success: false, message: "Failed to update template status", error: error.message });
    }
  });

  /**
   * DELETE /admin/invoice-templates/:id
   * Delete an invoice template (soft delete by setting isActive = false)
   */
  app.delete("/api/admin/invoice-templates/:id", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      // Check if template is default
      const template = await storage.getInvoiceTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }
      
      if (template.isDefault) {
        return res.status(400).json({ 
          success: false, 
          message: "Cannot delete the default template. Set another template as default first." 
        });
      }

      // Soft delete by marking inactive
      await storage.updateInvoiceTemplate(req.params.id, { isActive: false });
      
      res.json({ success: true, message: "Invoice template deleted successfully" });
    } catch (error: any) {
      console.error("[admin routes] DELETE /admin/invoice-templates/:id error:", error);
      res.status(500).json({ success: false, message: "Failed to delete invoice template", error: error.message });
    }
  });

  /**
   * GET /admin/invoice-templates/:id/preview
   * Preview an invoice template with sample data
   */
  app.get("/api/admin/invoice-templates/:id/preview", verifyAdminAuth, enforcePermission("manage_settings"), async (req: any, res: Response) => {
    try {
      const template = await storage.getInvoiceTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found" });
      }

      // Import sample data generator
      const { generateSampleInvoiceData } = await import('../utils/sampleInvoiceData');
      const sampleData = generateSampleInvoiceData();

      // Render template with Handlebars
      const Handlebars = await import('handlebars');
      const compiledTemplate = Handlebars.compile(template.htmlTemplate);
      const renderedHtml = compiledTemplate(sampleData);

      res.setHeader('Content-Type', 'text/html');
      res.send(renderedHtml);
    } catch (error: any) {
      console.error("[admin routes] GET /admin/invoice-templates/:id/preview error:", error);
      res.status(500).json({ success: false, message: "Failed to preview template", error: error.message });
    }
  });
}
