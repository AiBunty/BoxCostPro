/**
 * Onboarding Reminder Service
 * Sends reminder emails to users who haven't completed onboarding after 24 hours
 */

import type { Storage } from '../storage';
import { sendSystemEmailAsync } from './adminEmailService';
import { getUserOnboardingReminderEmailHTML, getUserOnboardingReminderEmailText } from './emailTemplates/verificationEmails';

const REMINDER_THRESHOLD_HOURS = 24;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

/**
 * Calculate onboarding progress (percentage)
 */
function calculateOnboardingProgress(status: any): number {
  const steps = [
    status.businessProfileDone,
    status.paperSetupDone,
    status.fluteSetupDone,
    status.taxSetupDone,
    status.termsSetupDone,
  ];

  const completedSteps = steps.filter(Boolean).length;
  return Math.round((completedSteps / steps.length) * 100);
}

/**
 * Get list of incomplete steps
 */
function getIncompleteSteps(status: any): string[] {
  const steps = [];

  if (!status.businessProfileDone) steps.push('Business Profile');
  if (!status.paperSetupDone) steps.push('Paper Master Settings');
  if (!status.fluteSetupDone) steps.push('Flute Settings');
  if (!status.taxSetupDone) steps.push('Tax & GST Settings');
  if (!status.termsSetupDone) steps.push('Terms & Conditions');

  return steps;
}

/**
 * Find users who need onboarding reminders
 * Criteria:
 * - Account created more than REMINDER_THRESHOLD_HOURS ago
 * - Onboarding not completed (verification_status !== 'approved')
 * - Not yet submitted for verification
 * - No reminder sent in last 24 hours
 */
export async function findUsersNeedingReminders(storage: Storage): Promise<any[]> {
  try {
    // Get all users with incomplete onboarding
    const allUsers = await storage.getAllUsers();
    const usersNeedingReminders = [];

    for (const user of allUsers) {
      const onboardingStatus = await storage.getOnboardingStatus(user.id);

      if (!onboardingStatus) continue;

      // Skip if already verified or submitted
      if (onboardingStatus.verificationStatus === 'approved' || onboardingStatus.submittedForVerification) {
        continue;
      }

      // Check if account is older than threshold
      const accountAge = Date.now() - new Date(user.createdAt).getTime();
      const ageInHours = accountAge / (1000 * 60 * 60);

      if (ageInHours < REMINDER_THRESHOLD_HOURS) {
        continue;
      }

      // Check if reminder was already sent recently
      if (onboardingStatus.lastReminderSentAt) {
        const timeSinceLastReminder = Date.now() - new Date(onboardingStatus.lastReminderSentAt).getTime();
        const hoursSinceReminder = timeSinceLastReminder / (1000 * 60 * 60);

        // Only send reminder if last one was more than 24 hours ago
        if (hoursSinceReminder < 24) {
          continue;
        }
      }

      // Calculate progress
      const progress = calculateOnboardingProgress(onboardingStatus);
      const incompleteSteps = getIncompleteSteps(onboardingStatus);

      usersNeedingReminders.push({
        user,
        onboardingStatus,
        progress,
        incompleteSteps,
      });
    }

    return usersNeedingReminders;
  } catch (error) {
    console.error('[Onboarding Reminder] Failed to find users needing reminders:', error);
    return [];
  }
}

/**
 * Send onboarding reminder email to a user
 */
export async function sendOnboardingReminder(
  storage: Storage,
  user: any,
  progress: number,
  incompleteSteps: string[]
): Promise<boolean> {
  try {
    const onboardingUrl = `${FRONTEND_URL}/onboarding`;

    // Send reminder email
    await sendSystemEmailAsync(storage, {
      to: user.email,
      subject: '📊 Complete Your BoxCostPro Setup',
      html: getUserOnboardingReminderEmailHTML({
        firstName: user.firstName,
        progress,
        incompleteSteps,
        onboardingUrl,
      }),
      text: getUserOnboardingReminderEmailText({
        firstName: user.firstName,
        progress,
        incompleteSteps,
        onboardingUrl,
      }),
      emailType: 'onboarding_reminder',
      relatedEntityId: user.id,
    });

    // Update last reminder sent timestamp
    await storage.updateOnboardingReminderSent(user.id);

    console.log(`[Onboarding Reminder] Sent to ${user.email} (${progress}% complete)`);
    return true;
  } catch (error) {
    console.error(`[Onboarding Reminder] Failed to send to ${user.email}:`, error);
    return false;
  }
}

/**
 * Process all users needing onboarding reminders
 * This function should be called by a cron job
 */
export async function processOnboardingReminders(storage: Storage): Promise<{
  found: number;
  sent: number;
  failed: number;
}> {
  console.log('[Onboarding Reminder] Starting reminder job...');

  const users = await findUsersNeedingReminders(storage);
  console.log(`[Onboarding Reminder] Found ${users.length} users needing reminders`);

  let sent = 0;
  let failed = 0;

  for (const { user, progress, incompleteSteps } of users) {
    const success = await sendOnboardingReminder(storage, user, progress, incompleteSteps);
    if (success) {
      sent++;
    } else {
      failed++;
    }

    // Add small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[Onboarding Reminder] Job complete. Sent: ${sent}, Failed: ${failed}`);

  return {
    found: users.length,
    sent,
    failed,
  };
}
