# Ventura Packagers Corrugated Box Costing System

## Overview
This web application provides Ventura Packagers Private Limited with a comprehensive system for calculating corrugated box costs, managing quotes, and generating pricing for RSC boxes and sheets. It streamlines the costing and quotation workflow, enabling accurate material cost estimations, efficient quote generation, and detailed management of company and customer profiles. The system supports bulk import of quote items, advanced fluting factor configurations, negotiated pricing, and robust administrative controls.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX
The frontend is built with React and TypeScript using Vite, featuring a modern UI with Shadcn/ui components (Radix UI and Tailwind CSS). It supports light/dark modes, responsive layouts, tab-based navigation, modal dialogs for profile management, and dynamic tables.

### Technical Implementations
*   **Frontend**: React with TypeScript, TanStack React Query for server state, react-hook-form with Zod for form management, and Wouter for routing. Key features include real-time calculation of dimensions, weight, and costs; a "rate memory system"; profile management; quote management with copy-to-clipboard and CSV/Excel download; drag-and-drop Excel bulk upload with validation; and configurable fluting settings. Negotiated pricing functionality allows per-item price adjustments (percentage or fixed) with visual indicators and updated message generation. A paper price setup page enforces initial paper pricing configuration and includes GSM rules, shade premiums, and market adjustments. Enhanced version history UI with current version indicator, price change indicators, scrollable list, and snapshot viewing. Manufacturing costs section with grouped categories ("Surface Treatments" and "Tooling & Finishing"), icons, and total cost badge.
*   **Backend**: Node.js with Express and an ESM module format. It provides a RESTful API for company/party profiles, quotes, and admin functionalities. Data validation uses Zod schemas integrated with Drizzle ORM. A storage abstraction (`IStorage`) allows for swappable storage implementations. An owner-only admin control panel manages Subscriptions, Pricing Plans, Coupons, Trial Invites, and Settings (e.g., Razorpay configuration).

### Feature Specifications
*   **Costing & Quoting**: Comprehensive RSC box and sheet material cost calculation, detailed paper specifications (GSM, BF, Fluting Factor, RCT, Shade, Rate), and robust quote generation/management. Includes quote duplicate prevention (Party+BoxName+BoxSize with 1mm tolerance creates new versions instead of duplicates), manual board thickness override with source tracking ('calculated' or 'manual'), and dimension unit consistency with "mm" labels across displays. Quote save properly updates `totalValue` in the database for accurate reporting across all version-creating routes.
*   **PDF Generation**: Branded quote PDF generation via `GET /api/quotes/:id/pdf` using PDFKit. Includes company header with logo/address/GST, quote details, items table, totals breakdown (subtotal, GST, transport), and payment/delivery terms.
*   **Version History**: `QuoteVersionHistory.tsx` component displays all quote versions with Active badge, price change indicators (trending up/down), version comparison modal, and ability to view version snapshots including flute factors and terms.
*   **Profile Management**: Detailed company and customer information management.
*   **Cost Breakdown**: Detailed per-layer weight and cost analysis, total sheet weight, total KGs for order, and grouped paper combination costs, including burst strength (BS) calculation.
*   **Admin & Settings**: Subscription, pricing, coupon, trial, payment history, and general owner settings management. User-configurable machine-specific fluting factors, fluting combination selector, and a first-time user onboarding for fluting setup.
*   **Reporting**: Comprehensive reports section with 8 report types: Quote Register, Party Summary, Item Prices, Date-wise Sales, Cost Breakdown, Paper Consumption, GST & Tax, and Saved Reports. Reports read from active quote versions via `/api/quotes?include=items` endpoint.
*   **Paper Pricing System**: Customizable BF-based paper pricing, GSM adjustment rules, shade premiums, and global market adjustment, integrated into the calculator. Paper Price Settings serve as the single source of truth for layer pricing, with optional manual override capability per layer. When editing a layer, users see a detailed price breakdown (BF base price, GSM adjustment, shade premium, market adjustment) and can toggle to enter a manual rate. Manual overrides are preserved in quote snapshots for immutability. Visual indicators (*) show which layers use manual rates.
*   **Authentication**: Supabase Auth with Email OTP (6-digit code, 10-minute expiry) as the primary login method and Google OAuth as secondary. The authentication flow uses JWT tokens verified server-side via `supabaseAuthMiddleware`. Local user records are auto-created/linked via `supabaseUserId`. Legacy session-based auth is maintained for backward compatibility via `combinedAuth` middleware that accepts both Supabase JWT and session auth. First-login setup enforcement (paper setup → terms setup → dashboard) tracks progress via `user_profiles` table.
*   **Unified Settings Page**: A centralized settings page at /settings with three tabs: Personal Details (read-only user info), Business Details (company profile management), and Branding (logo upload with base64 storage, max 500KB).

### System Design Choices
*   **Modularity**: Clear separation of concerns between frontend and backend, with distinct modules for routing, storage, and business logic.
*   **Type Safety**: Extensive use of TypeScript and Zod for robust type checking and validation.
*   **Scalability**: Designed with a swappable storage layer and PostgreSQL for future growth.
*   **User Experience**: Focus on intuitive interfaces, real-time feedback, and features that minimize manual data entry.

## External Dependencies
*   **Database**: PostgreSQL (via Neon serverless driver).
*   **ORM**: Drizzle ORM.
*   **UI/Styling**: Radix UI, Shadcn/ui, Tailwind CSS, `class-variance-authority`, `clsx`, `tailwind-merge`.
*   **Form Management**: `react-hook-form`, `@hookform/resolvers` (for Zod).
*   **Validation**: Zod.
*   **Date Handling**: `date-fns`.
*   **Development Tools**: `tsx`, `esbuild`, Vite.
*   **Session Management**: `connect-pg-simple`.
*   **Authentication**: `@supabase/supabase-js` for Supabase Auth with Email OTP and Google OAuth.
*   **Font Integration**: Google Fonts CDN (Inter typeface).
*   **Payment Gateway**: Razorpay (configuration managed via admin settings).
*   **Excel Handling**: `xlsx` library for Excel import/export.
*   **PDF Generation**: PDFKit for server-side PDF creation with branded quote documents.