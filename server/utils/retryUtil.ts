/**
 * Retry Utility with Exponential Backoff
 * 
 * RULES:
 * 1. Max 3 retries
 * 2. Exponential backoff (1s, 2s, 4s)
 * 3. Log all failures
 * 4. Return clear error to UI
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    onRetry,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    attempts = attempt + 1;
    
    try {
      const result = await fn();
      return {
        success: true,
        data: result,
        attempts,
      };
    } catch (error: any) {
      lastError = error;
      
      console.error(`[Retry] Attempt ${attempts}/${maxRetries} failed:`, error.message);
      
      // Check if we should retry
      if (!shouldRetry(error)) {
        console.log('[Retry] Error is not retryable, stopping');
        break;
      }
      
      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      // Wait before next attempt (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.log(`[Retry] Waiting ${delay}ms before next attempt...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  console.error(`[Retry] All ${maxRetries} attempts failed. Final error:`, lastError?.message);
  
  return {
    success: false,
    error: lastError?.message || 'Operation failed after all retries',
    attempts,
  };
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry-safe wrapper for PDF generation
 */
export async function retryPdfGeneration<T>(
  generateFn: () => Promise<T>,
  documentType: string,
  documentId: string
): Promise<RetryResult<T>> {
  return withRetry(generateFn, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      console.log(`[PDF] Retry ${attempt + 1} for ${documentType} ${documentId}: ${error.message}`);
    },
    shouldRetry: (error) => {
      // Don't retry validation errors
      if (error.message.includes('validation') || error.message.includes('required')) {
        return false;
      }
      return true;
    },
  });
}

/**
 * Retry-safe wrapper for email sending
 */
export async function retryEmailSend<T>(
  sendFn: () => Promise<T>,
  recipient: string,
  templateType: string
): Promise<RetryResult<T>> {
  return withRetry(sendFn, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      console.log(`[Email] Retry ${attempt + 1} for ${templateType} to ${recipient}: ${error.message}`);
    },
    shouldRetry: (error) => {
      // Don't retry invalid email addresses
      if (error.message.includes('invalid email') || error.message.includes('not found')) {
        return false;
      }
      return true;
    },
  });
}

/**
 * Retry-safe wrapper for template save
 */
export async function retryTemplateSave<T>(
  saveFn: () => Promise<T>,
  templateName: string
): Promise<RetryResult<T>> {
  return withRetry(saveFn, {
    maxRetries: 3,
    baseDelayMs: 500,
    onRetry: (attempt, error) => {
      console.log(`[Template] Retry ${attempt + 1} for ${templateName}: ${error.message}`);
    },
    shouldRetry: (error) => {
      // Don't retry validation errors
      if (error.message.includes('validation') || error.message.includes('unique')) {
        return false;
      }
      return true;
    },
  });
}

/**
 * Retry-safe wrapper for database operations
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<RetryResult<T>> {
  return withRetry(operation, {
    maxRetries: 3,
    baseDelayMs: 500,
    onRetry: (attempt, error) => {
      console.log(`[DB] Retry ${attempt + 1} for ${operationName}: ${error.message}`);
    },
    shouldRetry: (error) => {
      // Retry on connection errors
      if (error.message.includes('connection') || 
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET')) {
        return true;
      }
      // Don't retry on constraint violations
      if (error.message.includes('violates') || error.message.includes('duplicate')) {
        return false;
      }
      return true;
    },
  });
}
