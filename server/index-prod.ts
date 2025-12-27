import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";

// Guard against EPIPE errors when stdout/stderr are closed
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // IMPORTANT: Define specific routes BEFORE static middleware
  // Otherwise express.static will serve index.html for "/" before our custom logic runs

  // Serve specific static HTML pages
  app.get("/privacy-policy", (_req, res) => {
    res.sendFile(path.resolve(distPath, "privacy-policy.html"));
  });

  app.get("/terms", (_req, res) => {
    res.sendFile(path.resolve(distPath, "terms.html"));
  });

  // Serve homepage for root route (unauthenticated landing page)
  app.get("/", (req: any, res, next) => {
    console.log('[Homepage Route] Handling / route');
    console.log('[Homepage Route] isAuthenticated:', typeof req.isAuthenticated === 'function' ? req.isAuthenticated() : 'N/A');
    console.log('[Homepage Route] supabaseUser:', !!req.supabaseUser);
    console.log('[Homepage Route] user:', !!req.user);

    // If user is authenticated (has session or Supabase token), serve the React app
    if (req.isAuthenticated && req.isAuthenticated() || req.supabaseUser || req.user) {
      console.log('[Homepage Route] User authenticated, serving React app');
      return res.sendFile(path.resolve(distPath, "index.html"));
    }

    // Otherwise, serve the public homepage
    const homepagePath = path.resolve(distPath, "homepage.html");
    if (fs.existsSync(homepagePath)) {
      console.log('[Homepage Route] Serving homepage.html');
      return res.sendFile(homepagePath);
    }

    // Fallback to React app if homepage.html doesn't exist
    console.log('[Homepage Route] homepage.html not found, serving React app');
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // Serve static assets (JS, CSS, images, etc.) - after specific routes
  app.use(express.static(distPath));

  // All other routes serve the React app (for authenticated app routes)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  try {
    console.log("Starting production server...");
    const server = await runApp(serveStatic);
    
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
