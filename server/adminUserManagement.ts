/**
 * Admin User Management API Endpoints
 * Comprehensive user management for admin dashboard
 */

import { Express, Response, NextFunction } from 'express';
import { storage } from './storage';
import { getUserFeatures, canDowngradeToPlan } from './featureFlags';

/**
 * Register admin user management routes
 * @param app Express app instance
 * @param combinedAuth Auth middleware
 * @param requireAdmin Admin-only middleware
 */
export function registerAdminUserManagement(
  app: Express,
  combinedAuth: any,
  requireAdmin: any
) {
  /**
   * GET /api/admin/users/management
   * Enhanced user list with subscription and feature usage
   */
  app.get('/api/admin/users/management', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const users = await storage.getAllUsers();
    
    // Enrich with subscription and feature data
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      const subscription = await storage.getUserActiveSubscription(user.id);
      const featureUsage = await storage.getUserFeatureUsage(user.id);
      const featureOverride = await storage.getUserFeatureOverride(user.id);
      const emailProviderCount = await storage.getUserEmailProviderCount(user.id);
      const onboardingStatus = await storage.getOnboardingStatus(user.id);
      
      return {
        id: user.id,
        email: user.email,
        fullName: user.email || 'Unknown',
        role: user.role,
        planName: 'Basic',
        subscriptionStatus: subscription?.status || 'inactive',
        emailProvidersUsage: `${emailProviderCount}/${featureUsage?.maxEmailProviders || 1}`,
        hasOverride: !!featureOverride,
        verificationStatus: onboardingStatus?.verificationStatus,
        createdAt: user.createdAt,
      };
    }));
    
    res.json(enrichedUsers);
  } catch (error) {
    console.error('[Admin] Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:userId/details
 * Detailed user information with subscription history and feature usage
 */
app.get('/api/admin/users/:userId/details', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get subscription data
    const activeSubscription = await storage.getUserActiveSubscription(userId);
    const subscriptionHistory = await storage.getUserSubscriptions(userId);
    
    // Get feature usage
    const featureUsage = await storage.getUserFeatureUsage(userId);
    const featureOverride = await storage.getUserFeatureOverride(userId);
    const userFeatures = await getUserFeatures(userId);
    
    // Get email providers
    const emailProviders = await storage.getUserEmailProviders(userId);
    
    // Get onboarding status
    const onboardingStatus = await storage.getOnboardingStatus(userId);
    const company = await storage.getDefaultCompanyProfile(userId);
    
    // Get admin actions
    const adminActions = await storage.getAdminActions(userId);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.email || 'Unknown',
        role: user.role,
        createdAt: user.createdAt,
      },
      subscription: {
        active: activeSubscription,
        history: subscriptionHistory,
      },
      features: {
        planFeatures: userFeatures,
        usage: featureUsage,
        override: featureOverride,
      },
      emailProviders: emailProviders.map((p: any) => ({
        id: p.id,
        provider: p.provider,
        status: p.status,
        fromEmail: p.fromEmail,
        isDefault: p.isDefault,
      })),
      onboarding: {
        status: onboardingStatus,
        company,
      },
      adminActions,
    });
  } catch (error) {
    console.error('[Admin] Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * GET /api/admin/users/:userId/activity
 * User activity log (quotes, invoices, emails sent)
 */
app.get('/api/admin/users/:userId/activity', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    // Get recent activity (placeholder - implement as needed)
    const recentQuotes: any[] = []; // TODO: Implement quote fetching
    
    // Get recent email logs
    const emailLogs: any[] = []; // TODO: Implement email log fetching
    const recentEmails = emailLogs.map((log: any) => ({
      type: 'email',
      id: log.id,
      date: log.createdAt,
      description: `Email to ${log.to}: ${log.subject}`,
      status: log.status,
    }));
    
    // Combine and sort by date
    const activity = [...recentQuotes, ...recentEmails]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, Number(limit));
    
    res.json(activity);
  } catch (error) {
    console.error('[Admin] Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

/**
 * PATCH /api/admin/users/:userId/subscription
 * Upgrade/downgrade user subscription with validation
 */
app.patch('/api/admin/users/:userId/subscription', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { planId, reason } = req.body;
    const adminUserId = req.userId;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    // Get the target plan
    const plan = await storage.getSubscriptionPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Check if downgrade is allowed
    if (plan.planTier && ['basic', 'professional'].includes(plan.planTier)) {
      const result = await canDowngradeToPlan(userId, plan.features as any);
      if (!result.canDowngrade) {
        return res.status(400).json({ 
          error: 'Cannot downgrade',
          violations: result.violations,
          message: 'User must reduce usage before downgrading',
        });
      }
    }
    
    // Create new subscription
    const newSubscription = await storage.createUserSubscription({
      userId,
      planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    
    // Log admin action
    await storage.createAdminAction({
      action: 'subscription_change',
      adminUserId,
      targetUserId: userId,
      remarks: reason,
    });
    
    res.json({
      success: true,
      subscription: newSubscription,
      message: `Subscription updated to ${plan.name}`,
    });
  } catch (error) {
    console.error('[Admin] Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * PUT /api/admin/users/:userId/feature-override
 * Create or update feature override for custom limits
 */
app.put('/api/admin/users/:userId/feature-override', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { featureName, customLimit, reason, expiresAt } = req.body;
    const adminUserId = req.userId;
    
    if (!featureName || customLimit === undefined) {
      return res.status(400).json({ error: 'Feature name and custom limit are required' });
    }
    
    // Check if override exists
    const existingOverride = await storage.getUserFeatureOverride(userId);
    
    let result;
    if (existingOverride) {
      // Update existing override
      const updates = {
        overrides: {
          ...existingOverride.overrides,
          [featureName]: customLimit,
        },
        reason: reason || existingOverride.reason,
        expiresAt: expiresAt ? new Date(expiresAt) : existingOverride.expiresAt,
        lastModifiedBy: adminUserId,
      };
      
      result = await storage.updateUserFeatureOverride(userId, updates);
    } else {
      // Create new override
      result = await storage.createUserFeatureOverride({
        userId,
        overrides: { [featureName]: customLimit },
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        createdBy: adminUserId,
        lastModifiedBy: adminUserId,
      });
    }
    
    // Log admin action
    await storage.createAdminAction({
      action: 'feature_override',
      adminUserId,
      targetUserId: userId,
      remarks: `Set ${featureName} limit to ${customLimit}`,
    });
    
    res.json({
      success: true,
      override: result,
      message: `Feature override applied for ${featureName}`,
    });
  } catch (error) {
    console.error('[Admin] Error creating feature override:', error);
    res.status(500).json({ error: 'Failed to create feature override' });
  }
});

/**
 * DELETE /api/admin/users/:userId/feature-override/:featureName
 * Remove specific feature override
 */
app.delete('/api/admin/users/:userId/feature-override/:featureName', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId, featureName } = req.params;
    const adminUserId = req.userId;
    
    const existingOverride = await storage.getUserFeatureOverride(userId);
    if (!existingOverride) {
      return res.status(404).json({ error: 'No feature overrides found for this user' });
    }
    
    // Remove the specific override
    const { [featureName]: removed, ...remainingOverrides } = existingOverride.overrides as any;
    
    if (Object.keys(remainingOverrides).length === 0) {
      // No overrides left, deactivate the record
      await storage.updateUserFeatureOverride(userId, { isActive: false });
    } else {
      // Update with remaining overrides
      await storage.updateUserFeatureOverride(userId, { overrides: remainingOverrides });
    }
    
    // Log admin action
    await storage.createAdminAction({
      action: 'feature_override_removed',
      adminUserId,
      targetUserId: userId,
      remarks: `Removed ${featureName} override`,
    });
    
    res.json({
      success: true,
      message: `Feature override removed for ${featureName}`,
    });
  } catch (error) {
    console.error('[Admin] Error removing feature override:', error);
    res.status(500).json({ error: 'Failed to remove feature override' });
  }
});

/**
 * GET /api/admin/users/stats
 * Overall user statistics
 */
app.get('/api/admin/users/stats', combinedAuth, requireAdmin, async (req: any, res) => {
  try {
    const users = await storage.getAllUsers();
    
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.role !== 'inactive').length,
      pendingVerification: 0,
      byPlan: {} as Record<string, number>,
      recentSignups: 0,
    };
    
    // Count by plan
    for (const user of users) {
      const subscription = await storage.getUserActiveSubscription(user.id);
      const planName = 'Basic'; // TODO: Get plan name from subscription.planId
      stats.byPlan[planName] = (stats.byPlan[planName] || 0) + 1;
    }
    
    // Count pending verifications
    const onboardingStatuses = await Promise.all(
      users.map(u => storage.getOnboardingStatus(u.id))
    );
    stats.pendingVerification = onboardingStatuses.filter(
      s => s?.submittedForVerification && s?.verificationStatus === 'pending'
    ).length;
    
    // Count recent signups (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    stats.recentSignups = users.filter(
      u => u.createdAt && new Date(u.createdAt) > sevenDaysAgo
    ).length;
    
    res.json(stats);
  } catch (error) {
    console.error('[Admin] Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});
}
