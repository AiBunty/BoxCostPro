# Ventura Packagers Corrugated Box Costing System

## Overview
This web application is designed for Ventura Packagers Private Limited to calculate corrugated box costs, manage quotes, and generate pricing for RSC (Regular Slotted Container) boxes and sheets. It streamlines the box costing and quotation workflow by allowing users to input box dimensions, select ply configurations, calculate material costs, manage company and customer profiles, bulk import quote items, and generate/search quotes. The system aims to provide accurate cost estimations and efficient quotation generation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX
The frontend is built with React and TypeScript, utilizing Vite for development. It features a modern UI with Shadcn/ui components (based on Radix UI and Tailwind CSS), supporting light/dark modes and responsive layouts. Key UI elements include tab-based navigation for different calculators, modal dialogs for profile management, and dynamic tables for paper specifications. Typography uses the Inter font.

### Technical Implementations
*   **Frontend**:
    *   **Framework**: React with TypeScript.
    *   **State Management**: TanStack React Query for server state, react-hook-form with Zod for form state.
    *   **Routing**: Wouter for client-side routing.
    *   **Calculations**: Real-time calculation of sheet dimensions, weight, and costs. Includes per-layer weight and cost analysis, burst strength calculation, and total GSM display.
    *   **Data Entry Aids**: "Rate memory system" for auto-filling paper rates, smart copy functionality for layer specifications (excluding Fluting Factor for Liner layers).
    *   **Profile Management**: Supports multiple business and party profiles with dropdown selectors.
    *   **Quote Management**: Features copy-to-clipboard for WhatsApp/Email templates and CSV download for quote items.
    *   **Bulk Upload**: Drag-and-drop CSV upload for multiple quote items, including all layer specifications, with validation and sample template download.
    *   **Conversion Cost**: Input field for manufacturing cost per Kg, integrated into total price calculation.
    *   **Fluting Settings**: User-configurable machine-specific fluting factors with preset flute types (A, B, C, E, F) and a "Flute Combination Selector" that automatically applies factors based on ply selection.
*   **Backend**:
    *   **Runtime**: Node.js with Express, ESM module format.
    *   **API**: RESTful API structure with routes for company profiles, party profiles, quotes, and admin functionalities.
    *   **Data Validation**: Zod schemas integrated with Drizzle ORM.
    *   **Storage Abstraction**: `IStorage` interface for swappable storage implementations (currently in-memory, designed for database).
    *   **Admin Control Panel**: Owner-only `/admin` route with tabs for managing Subscriptions, Pricing Plans, Coupons, Trial Invites, and Settings (Razorpay config, trial period).

### Feature Specifications
*   **RSC Box and Sheet Calculation**: Comprehensive tools for calculating material costs based on dimensions and ply configurations.
*   **Paper Specifications**: Detailed input for each layer including GSM, BF (dropdown), Fluting Factor, RCT Value, Paper Shade (dropdown), and Rate.
*   **Quote Generation**: Create, manage, and search quotes, with options for sharing and exporting.
*   **User Profiles**: Manage detailed company and customer information.
*   **Cost Breakdown**: Detailed per-layer weight and cost analysis, total sheet weight, total KGs for order, and grouped paper combination costs.
*   **Burst Strength (BS) Calculation**: Per-layer calculation for accurate strength analysis.
*   **Admin Features**: Subscription, pricing, coupon, trial, payment history, and general owner settings management.

### System Design Choices
*   **Modularity**: Clear separation of concerns between frontend and backend, and within each layer (e.g., routing, storage, business logic).
*   **Type Safety**: Extensive use of TypeScript and Zod for robust type checking and validation across the stack.
*   **Scalability**: Designed with a swappable storage layer and a PostgreSQL database for future growth.
*   **User Experience**: Focus on intuitive interfaces, real-time feedback, and features that reduce manual data entry.

## External Dependencies
*   **Database**: PostgreSQL via Neon serverless driver.
*   **ORM**: Drizzle ORM.
*   **UI Components**: Radix UI (primitives), Shadcn/ui (components), Tailwind CSS (styling), `class-variance-authority`, `clsx`, `tailwind-merge`.
*   **Form Management**: `react-hook-form`, `@hookform/resolvers` (for Zod).
*   **Validation**: Zod.
*   **Date Handling**: `date-fns`.
*   **Development Tools**: `tsx`, `esbuild`, Vite.
*   **Session Management**: `connect-pg-simple` (for PostgreSQL-backed sessions).
*   **Font Integration**: Google Fonts CDN (Inter typeface).
*   **Payment Gateway**: Razorpay (configuration managed in admin settings).

## Recent Changes (Session Dec 12, 2025)

### Admin Control Panel & Fluting Settings

1. **Owner Admin Control Panel** (`/admin` route)
   - Five-tab interface: Subscriptions, Pricing Plans, Coupons, Trial Invites, Settings
   - Role-based access control (owner only)
   - Create/edit/delete subscription plans with monthly/yearly pricing
   - Create discount coupons (percentage or fixed amount) with usage limits
   - Send trial access invitations with copy-to-clipboard invite links
   - Razorpay configuration settings and payment transaction history

2. **Fluting Settings Component**
   - Machine-specific fluting factor configuration
   - Preset flute types: A, B, C, E, F with default factors and heights
   - User can customize factors per their corrugator machine specifications
   - Settings persist in database per user
   - Accessible via "Fluting Settings" button in calculator header

3. **Flute Combination Selector**
   - Dropdown selector for flute combinations based on ply selection
   - 3-Ply: A, B, C, E, F | 5-Ply: AA, AB, AC, BB, BC, etc. | 7-Ply and 9-Ply combinations
   - Auto-applies fluting factors to flute layers based on combination selection

4. **First-Time User Fluting Onboarding**
   - Guided onboarding modal appears for new users automatically
   - Two-step flow: Introduction explaining fluting factors + Configuration
   - Step 1 explains why machine-specific fluting factors matter
   - Step 2 allows users to enter their machine's specific fluting factors
   - Modal cannot be dismissed without completing the setup
   - Validates all 5 flute types are configured before completing
   - Loads any existing settings (preserves user's previous values)
   - Handles save errors gracefully with per-type error reporting

### New Database Tables
- `subscription_plans`, `user_subscriptions`, `coupons`, `trial_invites`
- `payment_transactions`, `owner_settings`, `chatbot_widgets`, `fluting_settings`

### New API Routes
- Admin routes (owner-only): `/api/admin/subscription-plans`, `/api/admin/subscriptions`, `/api/admin/coupons`, `/api/admin/trial-invites`, `/api/admin/settings`, `/api/admin/transactions`
- User routes: `/api/fluting-settings`, `/api/fluting-settings/status`

### Quote Items & Excel Export Improvements (Latest Session)

1. **Quote Items Table Enhancement**
   - Detailed table format showing individual cost columns: Paper, Printing, Lamination, Varnish, Die, Punching, Total Per Box
   - Checkboxes for selective inclusion of items in WhatsApp/Email templates
   - Improved layout with all cost components visible at a glance

2. **Excel-Based Data Import/Export**
   - Replaced CSV with Excel (.xlsx) format using the `xlsx` library
   - New `downloadGenericExcel` function for flexible Excel exports
   - `parseExcelUpload` function for parsing Excel files during bulk import
   - Sample Excel template download with proper column headers
   - Bulk upload dialog updated to accept .xlsx/.xls files

3. **Layer Naming Convention**
   - Liner layers display as L1, L2, L3
   - Flute layers display as F1, F2, F3
   - Fluting Factor column removed from Paper Specifications table (managed via Fluting Settings)

4. **Reports Page** (`/reports` route)
   - Party-wise quote history with filtering
   - Search by party name, company, or box details
   - Date range filters (start/end date)
   - Party summary cards showing quote counts
   - Detailed box breakdown when a party is selected
   - Excel export for filtered data
   - Accessible via "Reports" button in calculator header

### New Files
- `client/src/pages/reports.tsx` - Reports page component
- `client/src/lib/excelExport.ts` - Excel utility functions (downloadGenericExcel, parseExcelUpload, downloadSampleTemplate, etc.)