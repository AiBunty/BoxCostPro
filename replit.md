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