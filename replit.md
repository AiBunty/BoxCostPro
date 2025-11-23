# Ventura Packagers Corrugated Box Costing System

## Overview

This is a specialized web application for calculating corrugated box costs, managing quotes, and generating pricing for RSC (Regular Slotted Container) boxes and sheets. The system is designed for Ventura Packagers Private Limited to streamline their box costing and quotation workflow. It allows users to input box dimensions, select ply configurations, calculate material costs, manage company profiles, and generate/search quotes.

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
- Tab-based interface for separating calculator functionality from quote management
- Real-time calculation of sheet dimensions, weight, and costs based on user inputs
- Modal dialogs for managing company profiles and viewing quote details
- Responsive grid layouts (3-column desktop, 2-column tablet, single-column mobile)

### Backend Architecture

**Runtime**: Node.js with Express framework, using ESM module format.

**Development vs Production**: Separate entry points (index-dev.ts and index-prod.ts) with different serving strategies:
- Development: Vite middleware integration with HMR (Hot Module Replacement)
- Production: Serves pre-built static assets from dist/public

**API Structure**: RESTful API with routes organized by resource:
- `/api/company-profiles` - CRUD operations for company information
- `/api/company-profiles/default` - Retrieve default profile
- `/api/quotes` - Quote management including search functionality

**Data Validation**: Zod schemas for runtime type checking and validation, integrated with Drizzle ORM schema definitions using drizzle-zod.

**Storage Abstraction**: IStorage interface defining the contract for data operations, currently implemented with an in-memory storage class (MemStorage) but designed to be swappable with database-backed implementations.

**Key Design Decisions**:
- Raw body buffering for request verification
- Request/response logging middleware for debugging
- Separation of concerns between routing, storage, and business logic
- Type-safe API contracts shared between client and server via the `shared` directory

### Data Storage

**ORM**: Drizzle ORM configured for PostgreSQL with type-safe query building.

**Schema Design**:
- `company_profiles` table: Stores business information including GST details, contact info, and payment terms. Supports a single default profile via `isDefault` flag.
- `quotes` table: Stores customer quotes with embedded items as JSONB, allowing flexible storage of multiple quote items (RSC boxes and sheets) within a single quote record.

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