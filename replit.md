# Ventura Packagers Corrugated Box Costing System

## Overview

This is a specialized web application for calculating corrugated box costs, managing quotes, and generating pricing for RSC (Regular Slotted Container) boxes and sheets. The system is designed for Ventura Packagers Private Limited to streamline their box costing and quotation workflow. It allows users to input box dimensions, select ply configurations, calculate material costs, manage multiple company and customer profiles, bulk import quote items, and generate/search quotes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**UI Component Library**: Shadcn/ui components built on Radix UI primitives, providing a comprehensive set of accessible UI components including forms, dialogs, tables, tabs, and data input controls. The design system uses Tailwind CSS with a custom configuration featuring the "new-york" style variant.

**Styling Approach**: Tailwind CSS with CSS variables for theming, supporting both light and dark modes. Custom design tokens define spacing primitives (2, 4, 6, 8, 12, 16), border radius values, and color schemes. Typography uses Inter font from Google Fonts CDN with specific weight ranges (400, 500, 600, 700, 800).

**State Management**: TanStack React Query (v5) for server state management and data fetching. Form state handled through react-hook-form with Zod validation resolvers.

**Routing**: Wouter for lightweight client-side routing.

**Key Design Decisions**:
- Tab-based interface for separating RSC box and flat sheet calculator functionality
- Real-time calculation of sheet dimensions, weight, and costs based on user inputs
- Modal dialogs for managing business profiles, party profiles, and viewing quote details
- Responsive grid layouts (3-column desktop, 2-column tablet, single-column mobile)
- Layer-by-layer paper specifications table with dynamic row generation based on ply selection
- Each layer includes: GSM, BF (dropdown), Fluting Factor (manual for Flute layers only), RCT Value, Paper Shade (dropdown), and Rate inputs
- Paper Shade dropdown with 11 predefined options: Kraft/Natural, Golden (Red), Golden (Brown), Duplex LWC, Duplex HWC, White Kraft Liner, Virgin Kraft, Bagass, Semi Chemical, SBS, FBB
- BF field is a dropdown with values: 14, 16, 18, 20, 22, 24, 28, 35, 40, 45
- Rate memory system - saves last rate per BF + Shade combination and auto-fills when that combo is selected again
- Business Profile dialog for managing company details: Phone, Email, Address, GST, Website, Social Media, Location
- Party Profile dialog for managing customer details: Name, Company Name, Mobile, Email, GST, Address
- Quote management with copy-to-clipboard buttons for WhatsApp and Email templates, plus CSV download functionality
- Copy-to-clipboard functionality for WhatsApp and Email messages with formatted company profile details
- CSV download for quote items with all calculations and details
- Multiple Business & Party Profile support with dropdown selectors to switch between saved profiles
- Copy layer specifications buttons in the Paper Specifications table:
  - "Copy from previous" button (↑) to copy current layer from previous layer
  - "Copy to following" button (↓) to copy current layer to all subsequent layers
  - When copying to Liner layers, Fluting Factor is NOT copied (stays at 1.0 since Liner is always 1.0)
- **NEW**: Conversion Cost (INR/Kg) input field for calculating additional manufacturing cost
- Bulk upload dialog for importing multiple quote items via CSV file with support for all layer specifications

### Latest Features (Session Nov 23, 2025 - Final - Updated)

13. **Enhanced CSV Upload Feature**
    - Drag-and-drop file upload support with visual drop zone
    - Detailed CSV format guide built into the upload dialog
    - Sample CSV template download for user reference
    - Supports bulk import of RSC boxes and flat sheets with all layer specifications
    - Real-time validation and error feedback
    - Auto-close dialog on successful upload

### Previous Features (Session Nov 23, 2025 - Final)

12. **Paper Cost & Weight Analysis with Layer-Specific Formula**
    - Per-Layer Weight Formula: Weight = (GSM × Fluting × Reel Size × Sheet Cut Length) / 1,000,000
    - Per-Layer Breakdown showing individual layer weight and cost
    - Total Average Paper Cost (per unit) - sum of all layers
    - Total Sheet Weight (per unit) and Total KGs for full order quantity
    - Grouped Paper Combinations by GSM+BF+Shade with aggregated weights
    - Clubs identical paper combinations to show total quantity needed of each type
    - Displays total cost for each paper combination
    - Liner layers: Fluting factor = 1.0
    - Flute layers: Fluting factor = user-specified value (default 1.5)

7. **Weight Formula Display**
   - Shows calculation breakdown: Σ GSM = L1 + (L2 × FF) + L3 + (L4 × FF) + ...
   - Formula: Weight = (L × W × Σ GSM) / 1,000,000
   - Displays actual calculated values with layer-by-layer breakdown
   - Liner layers add GSM directly; Flute layers multiply by Fluting Factor

8. **Burst Strength (BS) Formula - Per Layer Calculation**
   - Calculates per layer: Liner GSM×BF/1000 + Flute GSM×BF/2000
   - Shows layer-by-layer breakdown (e.g., "L1: (180×14/1000) + L2: (120×14/2000) + ...")
   - Formula: BS = Σ (Liner GSM × BF / 1000 + Flute GSM × BF / 2000)
   - More accurate strength analysis based on layer type

9. **Total GSM Display in Calculated Sheet Blank Size**
   - Shows selected Ply configuration
   - Lists Layer Specifications with all GSM values
   - Displays Total GSM (Σ) with fluting factor calculations
   - Highlighted section for easy visibility
   - Helps users verify GSM calculations before weight/cost calculations

10. **Copy Layer Specifications - Smart Exclusion**
    - Copy buttons now exclude Fluting Factor and Layer Type
    - Only copies: GSM, BF, RCT Value, Shade, Rate
    - Preserves layer-specific constants during copy operations

11. **Layout Reorganization**
    - Moved Conversion Cost and Quantity below RSC Box Dimensions
    - Better form flow and improved UX
    - Shows cost per box calculation inline

### Backend Architecture

**Runtime**: Node.js with Express framework, using ESM module format.

**Development vs Production**: Separate entry points (index-dev.ts and index-prod.ts) with different serving strategies:
- Development: Vite middleware integration with HMR (Hot Module Replacement)
- Production: Serves pre-built static assets from dist/public

**API Structure**: RESTful API with routes organized by resource:
- `/api/company-profiles` - GET all profiles; POST new profile
- `/api/company-profiles/default` - Retrieve default profile
- `/api/company-profiles/:id` - GET/PATCH specific profile
- `/api/company-profiles/:id/set-default` - Set profile as default
- `/api/party-profiles` - GET all profiles; POST new profile
- `/api/party-profiles/:id` - GET/PATCH/DELETE specific profile
- `/api/quotes` - Quote management including search functionality

**Data Validation**: Zod schemas for runtime type checking and validation, integrated with Drizzle ORM schema definitions using drizzle-zod.

**Storage Abstraction**: IStorage interface defining the contract for data operations, currently implemented with an in-memory storage class (MemStorage) but designed to be swappable with database-backed implementations.

**Key Design Decisions**:
- Raw body buffering for request verification
- Request/response logging middleware for debugging
- Separation of concerns between routing, storage, and business logic
- Type-safe API contracts shared between client and server via the `shared` directory
- Support for multiple profiles allows users to switch between different business entities and customer information without clearing form

### Data Storage

**ORM**: Drizzle ORM configured for PostgreSQL with type-safe query building.

**Schema Design**:
- `company_profiles` table: Stores business information including GST details, contact info, and payment terms. Supports a single default profile via `isDefault` flag.
- `party_profiles` table: Stores customer/party information including name, company, mobile, email, GST, and address for quick customer management.
- `quotes` table: Stores customer quotes with embedded items as JSONB, allowing flexible storage of multiple quote items (RSC boxes and sheets) within a single quote record.
- `layer_specs`: Each layer in a quote includes GSM, BF, Fluting Factor, RCT Value, Shade, and Rate parameters.

**Current Implementation**: In-memory storage using JavaScript Maps for development/prototyping, with data structures matching the database schema.

**Migration Strategy**: Drizzle Kit configured for schema migrations with migrations output to `./migrations` directory. Database schema defined in `shared/schema.ts` for sharing between server and client.

**Key Design Decisions**:
- JSONB column for quote items enables flexible storage without separate join tables
- UUID primary keys for all entities
- Default values defined at database level for common fields (payment terms, delivery time)
- Timestamp tracking for quote creation

### External Dependencies

**Database**: PostgreSQL via Neon serverless driver (@neondatabase/serverless) for connection pooling and serverless compatibility.

**UI Component Primitives**: Radix UI for accessible, unstyled components across the full component spectrum (dialogs, dropdowns, tabs, forms, etc.).

**Form Management**: 
- react-hook-form for performant form state management
- @hookform/resolvers for Zod schema integration

**Validation**: Zod for schema definition and runtime validation.

**Styling**: 
- Tailwind CSS for utility-first styling
- class-variance-authority for component variant management
- clsx and tailwind-merge for conditional class composition

**Date Handling**: date-fns for date manipulation and formatting.

**Development Tools**:
- tsx for TypeScript execution in development
- esbuild for production bundling
- Vite plugins for development experience (@replit/vite-plugin-runtime-error-modal, cartographer, dev-banner)

**Session Management**: connect-pg-simple for PostgreSQL-backed session storage (configured but implementation details not visible in provided code).

**Key Integration Points**:
- Google Fonts CDN for Inter typeface
- Environment variable `DATABASE_URL` required for database connection
- Shared TypeScript configuration across client, server, and shared code via path aliases (@/, @shared/, @assets/)

## Recent Changes (Session Nov 23, 2025)

### Features Implemented:

1. **BF Dropdown with Fixed Values**
   - Changed BF from text input to dropdown selector
   - Available values: 14, 16, 18, 20, 22, 24, 28, 35, 40, 45
   - Provides consistent paper types across the application

2. **Rate Memory System by BF + Shade Combination**
   - Automatically saves last rate entered for each BF and Shade combination
   - When user selects a BF and Shade pair that was previously used, the rate auto-fills
   - Reduces data entry time and ensures consistency
   - Memory persists throughout the session

3. **Smart Copy Layer Specifications**
   - Copy buttons (↑ and ↓) in Paper Specifications table
   - "Copy from previous" button - duplicates all values from layer above
   - "Copy to following" button - applies current layer values to all layers below
   - **Smart Feature**: When copying to Liner layers, Fluting Factor is NOT copied (stays at 1.0 since Liner is always 1.0)
   - Copies: GSM, BF, RCT Value, Shade, and Rate
   - Toast notifications confirm successful operations

4. **Multiple Profile Support**
   - Business Profile dropdown selector - switch between saved company profiles
   - Party Profile dropdown selector - switch between customer profiles
   - All profiles load from database automatically
   - Selected profiles sync their data to form fields

5. **Bulk Upload Feature**
   - New "Bulk Upload" button in main toolbar
   - CSV file support with these fields:
     - Box Name, Description, Type (RSC/Sheet)
     - Length, Width, Height (for RSC boxes)
     - Layer specs: L1_GSM, L1_BF, L1_RCT, L1_Shade, L1_Rate (up to 5 layers)
   - Automatically creates quote items from imported data
   - Success toast shows number of items imported

6. **Conversion Cost Feature**
   - New "Conversion Cost (INR/Kg)" input field in Fixed & Manufacturing Costs section
   - Calculation: Box/Sheet Weight (Kg) × Conversion Cost Rate (₹/Kg)
   - Automatically added to total price per box
   - Real-time display of conversion cost per box
   - Shows calculation breakdown with weight and rate

### API Endpoints (Already Existing):
- `GET /api/company-profiles` - Returns all company profiles
- `GET /api/party-profiles` - Returns all party profiles
- Both endpoints support create, read, update operations via POST/PATCH
- Default profile selection supported via `isDefault` flag
