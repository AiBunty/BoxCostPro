/**
 * Email System Safe Logging Utility
 * 
 * Provides logging functions that NEVER expose sensitive data like:
 * - Encryption keys
 * - SMTP passwords
 * - App passwords
 * - Decrypted secrets
 * 
 * Only logs safe metrics:
 * - Boolean presence of keys
 * - String lengths
 * - Provider names
 * - Health status
 */

export interface EmailHealthLog {
  status: 'healthy' | 'unhealthy';
  reason?: string;
  keyPresent: boolean;
  keyLength?: number;
  provider?: string;
  timestamp: string;
}

export interface EmailSendLog {
  success: boolean;
  provider: string;
  recipientCount: number;
  error?: string;
  timestamp: string;
}

export interface EncryptionKeyLog {
  keyPresent: boolean;
  keyLength: number;
  source: 'ENCRYPTION_KEY' | 'SESSION_SECRET' | 'NONE';
  isValid: boolean;
  timestamp: string;
}

/**
 * Log email health check result
 * SAFE: Only logs status, not actual credentials
 */
export function logEmailHealthCheck(status: 'healthy' | 'unhealthy', reason?: string, provider?: string): void {
  const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  
  const log: EmailHealthLog = {
    status,
    reason,
    keyPresent: !!encryptionKey,
    keyLength: encryptionKey?.length || 0,
    provider,
    timestamp: new Date().toISOString(),
  };

  if (status === 'unhealthy') {
    console.error('[Email Health]', JSON.stringify(log, null, 2));
  } else {
    console.log('[Email Health]', JSON.stringify(log, null, 2));
  }
}

/**
 * Log email send attempt
 * SAFE: Only logs success status and provider, never content or credentials
 */
export function logEmailSend(success: boolean, provider: string, recipientCount: number, error?: string): void {
  const log: EmailSendLog = {
    success,
    provider,
    recipientCount,
    error: error ? error.substring(0, 200) : undefined, // Truncate error to avoid leaking sensitive data
    timestamp: new Date().toISOString(),
  };

  if (success) {
    console.log('[Email Send]', JSON.stringify(log, null, 2));
  } else {
    console.error('[Email Send]', JSON.stringify(log, null, 2));
  }
}

/**
 * Log encryption key status at startup
 * SAFE: Only logs presence and length, NEVER the actual key
 */
export function logEncryptionKeyStatus(): void {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const sessionSecret = process.env.SESSION_SECRET;
  
  let source: 'ENCRYPTION_KEY' | 'SESSION_SECRET' | 'NONE' = 'NONE';
  let key: string | undefined;
  
  if (encryptionKey) {
    source = 'ENCRYPTION_KEY';
    key = encryptionKey;
  } else if (sessionSecret) {
    source = 'SESSION_SECRET';
    key = sessionSecret;
  }
  
  const log: EncryptionKeyLog = {
    keyPresent: !!key,
    keyLength: key?.length || 0,
    source,
    isValid: (key?.length || 0) >= 32,
    timestamp: new Date().toISOString(),
  };

  if (log.isValid) {
    console.log('[Encryption Key]', JSON.stringify(log, null, 2));
  } else {
    console.error('[Encryption Key]', JSON.stringify(log, null, 2));
  }
}

/**
 * Sanitize error message to remove potentially sensitive data
 * Removes anything that looks like a password, key, or token
 */
export function sanitizeErrorMessage(error: string): string {
  return error
    .replace(/password[=:]\s*[^\s&]+/gi, 'password=***')
    .replace(/key[=:]\s*[^\s&]+/gi, 'key=***')
    .replace(/token[=:]\s*[^\s&]+/gi, 'token=***')
    .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=***')
    .replace(/auth[=:]\s*[^\s&]+/gi, 'auth=***');
}

/**
 * FORBIDDEN: These functions should NEVER be created
 * 
 * ❌ logEncryptionKey(key: string) - NEVER log actual keys
 * ❌ logDecryptedPassword(password: string) - NEVER log passwords
 * ❌ logSMTPCredentials(user, pass) - NEVER log credentials
 * ❌ logFullConfig(config) - May contain secrets
 */
