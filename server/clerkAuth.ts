/**
 * Clerk Auth Server Integration
 */
import type { Request } from 'express';
import { clerkClient } from '@clerk/express';

/**
 * Get Clerk user from request
 * Clerk middleware attaches auth object to request
 */
export async function getClerkUser(req: Request) {
  try {
    // Clerk middleware attaches auth object to request
    // In newer versions, auth might be a property OR a function
    const auth = typeof (req as any).auth === 'function' ? (req as any).auth() : (req as any).auth;
    const userId = auth?.userId;

    console.log('[getClerkUser] Auth extraction:', {
      hasAuthFunction: typeof (req as any).auth === 'function',
      hasAuthProperty: !!(req as any).auth,
      userId: userId || 'NO_USER_ID',
      authObject: auth ? { userId: auth.userId, sessionId: auth.sessionId } : 'NO_AUTH'
    });

    if (!userId) {
      console.log('[getClerkUser] No userId found in Clerk auth object');
      return null;
    }

    // Get full user details from Clerk
    const user = await clerkClient.users.getUser(userId);

    console.log('[getClerkUser] Successfully retrieved Clerk user:', {
      id: user.id,
      email: user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
    });

    return {
      id: user.id,
      email: user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      profileImageUrl: user.imageUrl || null,
      emailVerified: user.emailAddresses.some(e => e.verification?.status === 'verified'),
    };
  } catch (error) {
    console.error('[Clerk Auth] Failed to get user:', error);
    return null;
  }
}
