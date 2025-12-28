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

  // Serve specific static HTML pages for Google OAuth compliance
  app.get("/privacy-policy", (_req, res) => {
    res.sendFile(path.resolve(distPath, "privacy-policy.html"));
  });

  app.get("/terms", (_req, res) => {
    res.sendFile(path.resolve(distPath, "terms.html"));
  });

  // Serve static assets and React app
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
