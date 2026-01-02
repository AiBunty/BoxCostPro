/**
 * Admin Panel Entry Point
 * This is the main entry point for the admin panel application.
 * Uses the new clean AdminApp with all providers built-in.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminApp } from "@/admin/app/AdminApp";
import "./index.css";

// Mount the admin application
const rootElement = document.getElementById("root");

if (!rootElement) {
  // VISIBLE ERROR - never blank
  document.body.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fef2f2; padding: 2rem;">
      <div style="text-align: center; max-width: 400px;">
        <h1 style="font-size: 1.5rem; font-weight: 600; color: #991b1b; margin-bottom: 1rem;">
          Admin Panel Error
        </h1>
        <p style="color: #b91c1c;">
          Root element not found. Please check your HTML file.
        </p>
      </div>
    </div>
  `;
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>
  );
}
