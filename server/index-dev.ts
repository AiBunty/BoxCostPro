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
  console.log('[Vite Setup] Starting Vite dev server initialization...');
  
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  try {
    // Resolve viteConfig if it's a promise (from async defineConfig)
    console.log('[Vite Setup] Resolving vite config...');
    const resolvedConfig = typeof viteConfig === 'function' 
      ? await viteConfig({ command: 'serve', mode: 'development' })
      : viteConfig;
    
    console.log('[Vite Setup] Config resolved. Creating Vite server...');

    const vite = await createViteServer({
      ...resolvedConfig,
      configFile: false,
      customLogger: {
        ...viteLogger,
        error: (msg, options) => {
          console.error('[Vite Error]', msg);
          viteLogger.error(msg, options);
        },
      },
      server: serverOptions,
      appType: "custom",
    });
    
    console.log('[Vite Setup] Vite server created successfully!');

  app.use(vite.middlewares);
  
  console.log('[Vite Setup] Vite middlewares attached.');

  // Serve specific static HTML pages for Google OAuth compliance
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

  // Serve React app for all other routes
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // Determine which HTML template to serve based on route
      const isAdminRoute = url.startsWith('/admin');
      const templateName = isAdminRoute ? "admin.html" : "index.html";
      
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        templateName,
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      // Cache-bust the main entry point
      template = template.replace(
        /src="(\/src\/main(?:-admin)?\.tsx)"/,
        `src="$1?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      
      // SECURITY: Set strict cache headers for admin routes
      if (isAdminRoute) {
        res.set({
          "Content-Type": "text/html",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
          "Surrogate-Control": "no-store",
        });
      } else {
        res.set({ "Content-Type": "text/html" });
      }
      
      res.status(200).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
  } catch (error) {
    console.error('[Vite Setup] FATAL ERROR during Vite initialization:');
    console.error(error);
    throw error;
  }
}

(async () => {
  await runApp(setupVite);
})();
