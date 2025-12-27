/**
 * Direct Google OAuth Implementation
 *
 * This bypasses Supabase OAuth and uses direct Google OAuth 2.0
 * Benefits:
 * - Full control over OAuth consent screen branding
 * - "PaperBox ERP" shown instead of "Supabase Auth"
 * - Custom logo in OAuth flow
 * - Direct token exchange
 * - No third-party branding visible
 */

import { google } from 'googleapis';
import crypto from 'crypto';

// Safe console helpers to avoid EPIPE crashes when stdout/stderr is closed
function safeConsole(method: 'log' | 'warn' | 'error', ...args: any[]) {
  try {
    // tslint:disable-next-line: no-console
    (console as any)[method](...args);
  } catch (_) {
    // ignore write errors (EPIPE)
  }
}
const safeLog = (...args: any[]) => safeConsole('log', ...args);
const safeWarn = (...args: any[]) => safeConsole('warn', ...args);
const safeError = (...args: any[]) => safeConsole('error', ...args);

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
  token_type: string;
  id_token?: string;
}

class DirectGoogleOAuth {
  private oauth2Client: any;
  private redirectUrl: string;

  constructor() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    this.redirectUrl = process.env.GOOGLE_OAUTH_REDIRECT_URL ||
                       `${process.env.APP_URL || 'http://localhost:5000'}/auth/google/callback`;

    if (!clientId || !clientSecret) {
      safeLog('[DirectGoogleOAuth] Google OAuth credentials not configured. Google sign-in will be disabled.');
      return;
    }

    // Initialize Google OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      this.redirectUrl
    );

    safeLog('[DirectGoogleOAuth] Initialized with redirect URL:', this.redirectUrl);
  }

  /**
   * Check if Google OAuth is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
  }

  /**
   * Generate authorization URL for Google sign-in
   * User will be redirected here to grant permissions
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured');
    }

    // Generate secure random state if not provided
    const stateParam = state || crypto.randomBytes(32).toString('hex');

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      prompt: 'consent',      // Force consent screen (required for refresh token)
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'openid'
      ],
      state: stateParam,
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access tokens
   * Called in the OAuth callback after user grants permissions
   *
   * @param code - Authorization code from Google
   * @returns Access token and refresh token
   */
  async getTokensFromCode(code: string): Promise<GoogleTokens> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      return {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date!,
        token_type: tokens.token_type!,
        id_token: tokens.id_token,
      };
    } catch (error: any) {
      safeError('[DirectGoogleOAuth] Token exchange failed:', error?.message ?? error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Get user information from Google using access token
   *
   * @param accessToken - Google access token
   * @returns User profile information
   */
  async getUserInfo(accessToken: string): Promise<GoogleUser> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured');
    }

    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2'
      });

      const { data } = await oauth2.userinfo.get();

      return {
        id: data.id!,
        email: data.email!,
        verified_email: data.verified_email || false,
        name: data.name || '',
        given_name: data.given_name || '',
        family_name: data.family_name || '',
        picture: data.picture || '',
        locale: data.locale || 'en',
      };
    } catch (error: any) {
      safeError('[DirectGoogleOAuth] Failed to get user info:', error?.message ?? error);
      throw new Error('Failed to retrieve user information from Google');
    }
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - Google refresh token
   * @returns New access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: number }> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured');
    }

    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        access_token: credentials.access_token!,
        expiry_date: credentials.expiry_date!,
      };
    } catch (error: any) {
      safeError('[DirectGoogleOAuth] Token refresh failed:', error?.message ?? error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Verify ID token from Google
   * Used to verify the authenticity of tokens
   *
   * @param idToken - Google ID token
   * @returns Verified token payload
   */
  async verifyIdToken(idToken: string): Promise<any> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured');
    }

    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
      });

      return ticket.getPayload();
    } catch (error: any) {
      safeError('[DirectGoogleOAuth] ID token verification failed:', error?.message ?? error);
      throw new Error('Invalid ID token');
    }
  }

  /**
   * Revoke access token (sign out user from Google)
   *
   * @param accessToken - Access token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth is not configured');
    }

    try {
      await this.oauth2Client.revokeToken(accessToken);
      safeLog('[DirectGoogleOAuth] Token revoked successfully');
    } catch (error: any) {
      safeError('[DirectGoogleOAuth] Token revocation failed:', error?.message ?? error);
      // Don't throw - revocation failure shouldn't block logout
    }
  }

  /**
   * Generate state token for CSRF protection
   * Store this in session before redirecting to Google
   *
   * @returns Cryptographically secure random state
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate state token to prevent CSRF attacks
   *
   * @param receivedState - State received from OAuth callback
   * @param storedState - State stored in session before redirect
   * @returns True if states match
   */
  validateState(receivedState: string, storedState: string): boolean {
    return receivedState === storedState;
  }
}

// Export singleton instance
export const directGoogleOAuth = new DirectGoogleOAuth();

// Export types
export type { GoogleUser, GoogleTokens };
