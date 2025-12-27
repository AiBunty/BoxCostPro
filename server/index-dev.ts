import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";

import { nanoid } from "nanoid";
import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";

import viteConfig from "../vite.config";
import runApp from "./app";

// Guard against EPIPE errors when stdout/stderr are closed
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

export async function setupVite(app: Express, server: Server) {
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Serve specific static HTML pages in dev mode
  const publicPath = path.resolve(import.meta.dirname, "..", "client", "public");

  app.get("/privacy-policy", async (_req, res) => {
    const privacyPath = path.resolve(publicPath, "privacy-policy.html");
    if (fs.existsSync(privacyPath)) {
      const content = await fs.promises.readFile(privacyPath, "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(content);
    } else {
      res.status(404).send("Privacy Policy not found");
    }
  });

  app.get("/terms", async (_req, res) => {
    const termsPath = path.resolve(publicPath, "terms.html");
    if (fs.existsSync(termsPath)) {
      const content = await fs.promises.readFile(termsPath, "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(content);
    } else {
      res.status(404).send("Terms of Service not found");
    }
  });

  // Serve homepage for root route (unauthenticated landing page)
  app.get("/", async (req: any, res, next) => {
    // If user is authenticated (has session or Supabase token), serve the React app
    if (req.isAuthenticated && req.isAuthenticated() || req.supabaseUser || req.user) {
      return next(); // Continue to React app rendering below
    }

    // Otherwise, serve the public homepage
    const homepagePath = path.resolve(publicPath, "homepage.html");
    if (fs.existsSync(homepagePath)) {
      try {
        const content = await fs.promises.readFile(homepagePath, "utf-8");
        return res.status(200).set({ "Content-Type": "text/html" }).end(content);
      } catch (e) {
        console.error("Error serving homepage:", e);
      }
    }

    // Fallback to React app
    next();
  });

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

(async () => {
  await runApp(setupVite);
})();
