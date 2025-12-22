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
*   **Reporting**: Comprehensive reports section with 5 actionable report types: Quote Register, Party Summary, Item Prices, Paper Consumption, and Saved Reports. Reports read from active quote versions via `/api/quotes?include=items` endpoint. All report rows are clickable with drill-down navigation to source modules. The Party Summary supports multi-level drill-down (Party → Party Detail → Edit Quote). URL-driven state management preserves filters, search terms, and pagination across navigation. Calculator supports edit mode via `/create-quote?quoteId=xxx&from=reports&state=encoded` with "Back to Reports" button that restores filter context on return.
*   **Paper Pricing System**: Customizable BF-based paper pricing, GSM adjustment rules, shade premiums, and global market adjustment, integrated into the calculator. Paper Price Settings serve as the single source of truth for layer pricing, with optional manual override capability per layer. When editing a layer, users see a detailed price breakdown (BF base price, GSM adjustment, shade premium, market adjustment) and can toggle to enter a manual rate. Manual overrides are preserved in quote snapshots for immutability. Visual indicators (*) show which layers use manual rates.
*   **Authentication**: Enterprise-grade multi-method authentication system with:
    - **Login Methods**: Email+Password, Email OTP (6-digit code, 10-minute expiry), Magic Link, and Google OAuth
    - **Login UI**: Tabbed interface at `/auth` with Password, OTP, and Magic Link tabs, plus Google OAuth button
    - **Password Requirements**: Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    - **Password Recovery**: Forgot password flow with secure reset links at `/auth/reset-password`
    - **Profile Completion**: Mandatory mobile number collection after signup at `/complete-profile` before accessing dashboard
    - **Account States**: new_user, email_verified, mobile_verified, fully_verified, suspended, deleted
    - **Security Features**: Account lockout after 5 failed login attempts (15-minute lockout), audit logging of all auth events
    - **Audit Logging**: All auth events (LOGIN, SIGNUP, PASSWORD_RESET, VERIFY_EMAIL) logged with IP address and user agent to `auth_audit_logs` table
    - **Admin Notifications**: Automatic emails to saas@aibunty.com on new signups, suspicious activities (never configurable from UI)
    - **Welcome Emails**: Branded welcome email from noreply@paperboxerp.com on successful signup
    - **Auth Service**: `server/services/authService.ts` handles audit logging, admin notifications, welcome emails using fire-and-forget pattern
    - **JWT Verification**: Server-side via `supabaseAuthMiddleware` with auto-creation of local user records linked via `supabaseUserId`
    - **Legacy Support**: `combinedAuth` middleware accepts both Supabase JWT and session auth for backward compatibility
*   **Unified Settings Page**: A centralized settings page at /settings with four tabs: Personal Details (read-only user info), Business Details (company profile management), Branding (logo upload with base64 storage, max 500KB), and Templates (WhatsApp/Email quote template management).
*   **WhatsApp/Email Quote Template System**: A comprehensive quote sharing system with:
    - **Show Columns Configuration**: Single source of truth for which data columns appear in quote outputs (boxSize, board, flute, paper, printing, lamination, varnish, weight toggles)
    - **Template Types**: System templates (read-only, can be duplicated) and custom user templates. System includes 4 WhatsApp templates (Formal Emoji, Formal No Emoji, Alternate Pattern, Short & Sweet) and 2 Email templates
    - **Template Placeholders**: {{BusinessName}}, {{OwnerName}}, {{PartyName}}, {{QuoteNo}}, {{QuoteDate}}, {{ItemsList}}, {{TotalAmount}}, {{GstAmount}}, {{GrandTotal}}, etc.
    - **Dynamic Column Rendering**: Item data filtered based on Show Columns config before rendering in templates
    - **SendQuoteDialog Component**: Template selection, real-time preview, recipient input, and channel-specific sending (WhatsApp generates wa.me URL, Email generates mailto link)
    - **Audit Logging**: quote_send_logs table captures template used, channel, recipient, rendered content, and timestamp for compliance
    - **Pre-Send Validation**: Ensures Business Profile is complete (companyName, phone, email, gstNo) and quote has items before allowing sends

### Multi-Tenant Architecture
This application implements enterprise-grade multi-tenancy with strict data isolation:

*   **Tenant Model**: Each organization is a "tenant" with its own isolated data. A `tenants` table stores organization info (name, subdomain), and `tenant_users` maps users to tenants with roles (owner, admin, member).
*   **Data Isolation Strategy**: 
    - All business tables have a `tenant_id` foreign key column
    - RLS (Row Level Security) policies enforce tenant isolation at the database level
    - Backend middleware resolves tenant context from authenticated user's membership
    - API routes NEVER accept tenant_id from frontend - it's always resolved server-side
*   **Table Classification**:
    - **System Tables (NO tenant_id)**: `users`, `user_profiles`, `user_email_settings`, `auth_audit_logs`, `subscription_plans`, `sessions`
    - **Business Tables (WITH tenant_id)**: `quotes`, `quote_items`, `parties`, `company_profiles`, `flute_settings`, `paper_bf_prices`, `box_specifications`, `support_tickets`, `email_logs`, `rate_memory`, `app_settings`, `quote_templates`, `business_defaults`, `saved_reports`, `calculations`, and more
*   **Tenant Provisioning**: A database trigger `create_tenant_for_new_user` automatically creates a personal tenant and owner membership when a new user signs up
*   **Key Files**:
    - `server/tenantContext.ts`: Resolves tenant_id from authenticated user's active tenant membership
    - `server/supabaseAuth.ts`: `combinedAuth` middleware injects `req.tenantId` and `req.tenantContext` on every authenticated request
    - `server/storage.ts`: All storage methods accept optional `tenantId` parameter and include it in queries/inserts
    - `shared/schema.ts`: Defines `tenants` and `tenant_users` tables with all tenant_id foreign keys
*   **Security Guarantees**:
    - RLS policies use `user_has_tenant_access(tenant_id, auth.uid())` function to verify access
    - Backend validates tenant membership before every data operation
    - Cross-tenant data access is impossible at both application and database levels

### System Design Choices
*   **Modularity**: Clear separation of concerns between frontend and backend, with distinct modules for routing, storage, and business logic.
*   **Type Safety**: Extensive use of TypeScript and Zod for robust type checking and validation.
*   **Scalability**: Designed with a swappable storage layer and PostgreSQL for future growth.
*   **Multi-Tenancy**: True data isolation using tenant_id filtering + RLS policies for enterprise-grade security.
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