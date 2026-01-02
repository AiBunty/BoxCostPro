import { User } from "@shared/schema";

/**
 * Express type extensions for Clerk authentication
 * 
 * This extends the Express Request interface to include
 * Clerk-specific auth properties.
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Clerk user ID (the internal app user ID, not Clerk's ID)
       * Set by combinedAuth middleware after user lookup
       */
      userId?: string;
      
      /**
       * The authenticated user object from Clerk
       * Contains claims.sub (Clerk user ID) and other user info
       */
      user?: {
        id?: string;
        userId?: string;
        email?: string;
        role?: string;
        claims?: {
          sub: string;
          email?: string;
          [key: string]: any;
        };
        [key: string]: any;
      };
    }
  }
}

export {};
