import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";

import { registerRoutes } from "./routes";
import { initializeSentry, Sentry } from "./sentry";
import { scheduleConsistencyJob } from "./jobs/consistencyJob";

// ========== AUTH STARTUP GUARDS ==========
// Prevent server startup if forbidden auth env vars are present
const FORBIDDEN_AUTH_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'NEON_AUTH_JWKS_URL',
  'NEON_AUTH_URL',
  'VITE_NEON_AUTH_URL',
];

const detectedForbiddenVars = FORBIDDEN_AUTH_ENV_VARS.filter(v => process.env[v]);
if (detectedForbiddenVars.length > 0) {
  console.error('🚫 AUTH STARTUP GUARD FAILED');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('Forbidden authentication environment variables detected:');
  detectedForbiddenVars.forEach(v => console.error(`  ❌ ${v}`));
  console.error('');
  console.error('Clerk is the ONLY allowed authentication provider.');
  console.error('Remove these legacy auth variables from your .env file.');
  console.error('See docs/auth-contract.md for the authentication policy.');
  console.error('═══════════════════════════════════════════════════════════════');
  process.exit(1);
}

// Verify Clerk is configured
if (!process.env.CLERK_SECRET_KEY) {
  console.error('🚫 AUTH STARTUP GUARD FAILED');
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('CLERK_SECRET_KEY is not configured.');
  console.error('Clerk is REQUIRED for authentication.');
  console.error('Get your keys from: https://dashboard.clerk.com');
  console.error('═══════════════════════════════════════════════════════════════');
  process.exit(1);
}

if (!process.env.VITE_CLERK_PUBLISHABLE_KEY && !process.env.CLERK_PUBLISHABLE_KEY) {
  console.warn('⚠️  WARNING: VITE_CLERK_PUBLISHABLE_KEY not set. Frontend auth may not work.');
}

// Initialize Sentry BEFORE any other imports
initializeSentry();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Sentry request handler MUST be the first middleware (only if Sentry is initialized)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // Required for cookie parsing

// Clerk middleware - MUST be after express.json() and cookieParser()
// Use either server-side or Vite-prefixed publishable key to avoid missing env issues in dev
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;

app.use(clerkMiddleware({
  publishableKey: clerkPublishableKey,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

if (!clerkPublishableKey) {
  console.warn('[Clerk] Missing publishable key; set CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY');
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Fail-fast validation: Email encryption key MUST exist before server starts
function validateEmailEncryption(): void {
  // Import safe logging
  import('./utils/emailLogger').then(({ logEncryptionKeyStatus }) => {
    logEncryptionKeyStatus();
  }).catch(err => {
    console.error('[Startup] Failed to load email logger:', err);
  });
  
  const encryptionKey = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  
  if (!encryptionKey) {
    console.error('\n' + '='.repeat(80));
    console.error('FATAL: EMAIL_SECRET_KEY missing or invalid.');
    console.error('Email system cannot start.');
    console.error('');
    console.error('Required: ENCRYPTION_KEY or SESSION_SECRET environment variable');
    console.error('Minimum length: 32 characters');
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  }

  if (encryptionKey.length < 32) {
    console.error('\n' + '='.repeat(80));
    console.error('FATAL: EMAIL_SECRET_KEY too short.');
    console.error(`Current length: ${encryptionKey.length} characters`);
    console.error('Minimum required: 32 characters');
    console.error('Email system cannot start.');
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  }

  console.log(`[Startup] Email encryption validated (key length: ${encryptionKey.length} chars)`);
}

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
): Promise<Server> {
  // CRITICAL: Validate encryption before starting server
  validateEmailEncryption();
  
  const server = await registerRoutes(app);

  // Sentry error handler MUST be before other error handlers (only if Sentry is initialized)
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Server error:", err);
  });

  // Schedule nightly consistency job (default 02:00 AM)
  const consistencyJobTime = process.env.CONSISTENCY_JOB_TIME || '02:00';
  scheduleConsistencyJob(consistencyJobTime);
  console.log(`[Startup] Consistency job scheduled for ${consistencyJobTime} daily`);

  await setup(app, server);

  const port = parseInt(process.env.PORT || '5000', 10);
  
  return new Promise((resolve, reject) => {
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      } else {
        console.error('Server error:', error);
      }
      reject(error);
    });

    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server listening on 0.0.0.0:${port}`);
      resolve(server);
    });
  });
}
