import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(async ({ mode }) => {
  const projectRoot = path.resolve(import.meta.dirname);
  const clientRoot = path.resolve(projectRoot, "client");
  const env = loadEnv(mode, clientRoot, "");

  // Verify Clerk key is loaded (dev-time check only)
  if (mode === "development" && !env.VITE_CLERK_PUBLISHABLE_KEY) {
    console.error(
      "\n🚨 CRITICAL: VITE_CLERK_PUBLISHABLE_KEY not found in client/.env file!\n",
    );
  }

  return {
    // CRITICAL: Load .env from client directory so Vite exposes VITE_ vars
    envDir: clientRoot,

    plugins: [
      react(),
      runtimeErrorOverlay(),
      // Copy static HTML pages for Google OAuth compliance
      viteStaticCopy({
        targets: [
          {
            src: "public/privacy-policy.html",
            dest: ".",
          },
          {
            src: "public/terms.html",
            dest: ".",
          },
        ],
      }),
      ...(mode !== "production" && process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer(),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(clientRoot, "src"),
        "@app": path.resolve(clientRoot, "src/app"),
        "@admin": path.resolve(clientRoot, "src/admin"),
        "@shared": path.resolve(projectRoot, "shared"),
        "@assets": path.resolve(projectRoot, "attached_assets"),
        // Fix warning package CommonJS import issue
        warning: path.resolve(projectRoot, "node_modules/warning/warning.js"),
      },
    },
    optimizeDeps: {
      // Include CommonJS dependencies that need transformation
      include: ["warning"],
    },
    root: clientRoot,
    build: {
      outDir: path.resolve(projectRoot, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          app: path.resolve(clientRoot, "index.html"),
          admin: path.resolve(clientRoot, "admin.html"),
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      hmr: {
        // Disable default overlay to avoid blocking UI while fixing root cause
        overlay: false,
      },
    },
  };
});
