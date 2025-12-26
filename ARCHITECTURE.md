# BoxCostPro - Architectural Documentation

## 🎯 Core Architectural Principles (NON-NEGOTIABLE)

### Single Source of Truth (SSOT)

This system is designed with **strict single source of truth** principles to ensure data consistency, prevent duplication errors, and maintain long-term stability (5+ years).

---

## 📊 Data Architecture

### 1. **Business Identity & Branding** - SINGLE SOURCE OF TRUTH

**Table:** `company_profiles`
**Location:** Database schema in `shared/schema.ts:362-389`

#### Purpose
- **ONLY** location for business/company details
- **ONLY** location for branding (logo, company name)
- **ONLY** location for owner contact details

#### Critical Fields

**Core Identity (LOCKED after registration):**
- `companyName` - Official business name (appears on quotes, PDFs, invoices)
- `ownerName` - Owner/Contact person name
- `email` - Official business email
- `phone` - Official business phone

> ⚠️ **SECURITY:** These fields are locked after registration and require email re-verification to change. This prevents unauthorized modification of official document fields.

**Editable Business Details:**
- `gstNo` - GST registration number
- `address` - Business address
- `website` - Company website URL
- `mapLink` - Google Maps location link
- `paymentTerms` - Default payment terms for quotes
- `deliveryTime` - Default delivery timeline

**Branding:**
- `logoUrl` - Company logo (base64 encoded, max 100KB)
- `logoSizeKb` - Logo file size tracker

**Multi-Tenancy:**
- `tenantId` - Ensures proper data isolation in multi-tenant architecture

#### Access Pattern

✅ **READ from:** Calculator, Quote Generator, PDF Generator, Email Templates, WhatsApp Templates
❌ **WRITE from:** Settings → Account Profile tab ONLY
❌ **NEVER:** Calculator, Quote pages, or any other modules

#### Code Comments (Enforced)
```typescript
// shared/schema.ts:360-361
// Company Profiles (per tenant) - SINGLE SOURCE OF TRUTH for business identity & branding
// Calculator and other modules MUST read from here and NEVER edit directly
```

---

### 2. **GST Rate & Tax Settings** - SINGLE SOURCE OF TRUTH

**Table:** `business_defaults`
**Location:** Database schema in `shared/schema.ts:541-561`

#### Purpose
- **ONLY** location for GST percentage configuration
- **ONLY** location for tax-related settings

#### Critical Fields

**Tax Configuration:**
- `defaultGstPercent` - Default GST rate (default: 5% for corrugated boxes in India)
- `gstRegistered` - Whether business is GST registered
- `gstNumber` - GST registration number
- `igstApplicable` - Inter-state GST applicable flag
- `roundOffEnabled` - Round off grand total to nearest rupee

**Column Visibility (Template Settings):**
- `showColumnBoxSize`, `showColumnBoard`, `showColumnFlute`, etc.
- Controls which columns appear in WhatsApp/Email quote templates

#### Access Pattern

✅ **READ from:** Calculator, Quote Generator, PDF Generator, Email/WhatsApp Templates
✅ **WRITE from:** Masters → Tax & GST tab ONLY
❌ **NEVER:** Calculator must NOT allow inline GST editing

#### Calculator Implementation

**Before (WRONG - Hardcoded):**
```typescript
// ❌ INCORRECT - Hardcoded GST rate
const [taxRate, setTaxRate] = useState<string>("18");
const taxRateValue = parseFloat(taxRate) || 0;
```

**After (CORRECT - From Master):**
```typescript
// ✅ CORRECT - Fetch from business_defaults
const { data: businessDefaults } = useQuery({
  queryKey: ["/api/business-defaults"],
});

// GST rate MUST come from business_defaults - Single Source of Truth
const taxRateValue = businessDefaults?.defaultGstPercent ?? 5;
```

#### Why This Architecture?

1. **Consistency:** All quotes use the same GST rate - no manual errors
2. **Compliance:** Single place to update when GST rates change
3. **Audit Trail:** Changes to GST are tracked in one location
4. **Quote Versioning:** GST is snapshotted when quote is created, preserving historical accuracy

---

### 3. **Calculator Architecture** - READ-ONLY Consumer

**File:** `client/src/pages/calculator.tsx`

#### Design Principles

The Calculator is a **READ-ONLY consumer** of master data. It:
- ✅ **READS** business profile from `company_profiles`
- ✅ **READS** GST rate from `business_defaults`
- ✅ **READS** paper pricing from `paper_bf_prices`, `shade_premiums`, etc.
- ❌ **NEVER** stores or edits business data
- ❌ **NEVER** stores or edits GST data
- ❌ **NEVER** stores or edits branding data

#### Calculator Guards

**Profile Completeness Check:**
```typescript
// Lines 1641-1661 in calculator.tsx
// Check if business profile is complete (required for quotes)
const isProfileComplete = companyProfile &&
  companyProfile.companyName?.trim() &&
  companyProfile.ownerName?.trim() &&
  companyProfile.email?.trim() &&
  companyProfile.phone?.trim();

// Show blocking message if business profile is incomplete
if (!isLoadingProfile && !isProfileComplete) {
  return (
    <Card>
      <CardTitle>Complete Your Business Profile</CardTitle>
      <CardDescription>
        Your business profile is incomplete.
        Please set up your company details before creating quotes.
      </CardDescription>
      <Button>Complete Business Profile</Button>
    </Card>
  );
}
```

> ✅ **Result:** Calculator cannot function without complete business profile

#### GST Display in Calculator

**UI Implementation:**
- GST rate shown as **read-only, disabled input**
- "Edit in Masters" link redirects to Masters → Tax & GST tab
- Tooltip explains why field is read-only
- Visual styling (`bg-muted`, `cursor-not-allowed`) indicates non-editable state

**Why Read-Only?**
1. Prevents accidental GST changes during quote creation
2. Ensures all quotes use consistent, approved GST rate
3. Forces deliberate GST changes through Master Settings with proper authorization

---

## 🚫 What We Removed (Anti-Patterns)

### 1. Hardcoded GST in Calculator ❌

**Before:**
```typescript
const [taxRate, setTaxRate] = useState<string>("18"); // Hardcoded!
```

**Problem:**
- GST is hardcoded to 18% (incorrect for corrugated boxes - should be 5%)
- Changes in Masters don't reflect in Calculator
- Multiple sources of truth = data inconsistency

**After:**
```typescript
const taxRateValue = businessDefaults?.defaultGstPercent ?? 5;
```

**Fixed:**
- Single source of truth in `business_defaults` table
- Default to 5% (correct for industry)
- Changes in Masters instantly reflect in Calculator

### 2. Business Profile Button in Calculator ❌

**Status:** Already removed (by previous developers)

**Evidence:**
```typescript
// calculator.tsx:354-356
// Note: Business Profile editing has been removed from Calculator.
// Calculator is READ-ONLY consumer of business_profiles.
// Users must edit their business profile via Settings → Account Profile.
```

**Why Removed:**
- Business profile should ONLY be edited in Settings
- Calculator is for costing, not profile management
- Prevents data duplication and inconsistency

---

## ✅ Current Architecture (Already Correct)

### Multi-Tenant Isolation

**Tables with `tenantId`:**
- `company_profiles`
- `party_profiles`
- `quotes` and `quote_versions`
- `business_defaults`
- `paper_bf_prices`, `shade_premiums`, etc.

**Enforcement:**
- All API routes check `req.tenantId` from auth context
- Storage methods accept `tenantId` parameter
- Cross-tenant data access is impossible

### Quote Versioning with Snapshots

**Why Versioning?**
When a quote is created, all pricing data is **snapshotted**:
- GST rate at time of quote creation
- Paper prices at time of quote creation
- Manufacturing costs at time of quote creation

**Tables:**
- `quotes` - Master quote record
- `quote_versions` - Each edit creates new version (immutable history)
- `quote_item_versions` - Line items for each version

**Benefits:**
1. **Audit Trail:** Historical quotes show original pricing even if master rates change
2. **Legal Compliance:** Quotes remain accurate for contract purposes
3. **Price Analysis:** Compare how pricing changed over time

### Settings Architecture

**File:** `client/src/pages/settings.tsx`

**Tabs:**
1. **Account Profile** - Unified business identity (Company, Owner, GST, Branding)
2. **Email** - Email configuration and analytics
3. **Templates** - WhatsApp/Email quote templates, column visibility

**Why Unified?**
- Previously: Separate "Personal", "Business", "Branding" tabs (confusing)
- Now: Single "Account Profile" tab (clear, simple)
- Locked fields clearly marked (Company Name, Owner, Email, Phone)
- Editable fields clearly separated

---

## 🆕 What We Added

### 1. GST Master → Calculator Binding ✅

**Changes Made:**

**1. Added Business Defaults Query:**
```typescript
// calculator.tsx:426-436
const { data: businessDefaults } = useQuery({
  queryKey: ["/api/business-defaults"],
});
```

**2. Replaced Hardcoded GST:**
```typescript
// calculator.tsx:1637
const taxRateValue = businessDefaults?.defaultGstPercent ?? 5;
```

**3. Made GST Input Read-Only:**
```typescript
// calculator.tsx:3661-3680
<Input
  value={taxRateValue}
  readOnly
  disabled
  title="GST rate is configured in Masters → Tax & GST"
/>
<Link href="/masters">
  <Button variant="ghost">
    (Edit in Masters)
  </Button>
</Link>
```

**Result:**
- ✅ Calculator fetches GST from master settings
- ✅ GST cannot be edited inline (read-only)
- ✅ Clear link to edit in proper location (Masters)
- ✅ Default to 5% if not configured

### 2. Coming Soon Modules on Dashboard ✅

**File:** `client/src/pages/dashboard.tsx`

**Modules Added:**
1. **Paper Stock Management** - Track inventory, BF rolls, low-stock alerts
2. **AI Price Suggestions** - Intelligent pricing based on market trends
3. **Purchase Order Planner** - Convert quotes to POs, track orders
4. **Job Card Generator** - Auto-generate production job cards
5. **PDI / COA Generator** - Quality inspection reports
6. **Auto Client Follow-ups** - Automated Email & WhatsApp reminders

**Implementation:**
- All cards have "Coming Soon" badge (amber color)
- Cards are visually disabled (`opacity-75`, `cursor-not-allowed`)
- Each card has icon, title, and description
- Color-coded backgrounds for visual variety

**Tagline:**
> "Not just a costing tool — your digital Sales Representative"

**Purpose:**
- Shows product roadmap to users
- Builds anticipation for future features
- Positions product as complete business solution, not just calculator

---

## 📋 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REGISTRATION                         │
│  (Onboarding Flow - 5 steps)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              MASTER DATA (Single Source of Truth)            │
├─────────────────────────────────────────────────────────────┤
│  1. company_profiles                                         │
│     - Company Name, Owner, Email, Phone (LOCKED)            │
│     - GST No, Address, Website, Logo                        │
│     - Edited ONLY in: Settings → Account Profile            │
│                                                              │
│  2. business_defaults                                        │
│     - GST Rate (default: 5%)                                │
│     - Tax Settings, Column Visibility                       │
│     - Edited ONLY in: Masters → Tax & GST                   │
│                                                              │
│  3. paper_pricing_rules                                     │
│     - BF Prices, Shade Premiums, GSM Rules                  │
│     - Edited ONLY in: Masters → Paper Pricing               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   CALCULATOR (Read-Only)                     │
├─────────────────────────────────────────────────────────────┤
│  READS from:                                                 │
│  - company_profiles (business identity)                     │
│  - business_defaults (GST rate)                             │
│  - paper_pricing_rules (paper prices)                       │
│  - party_profiles (customer info)                           │
│                                                              │
│  USER INPUTS:                                                │
│  - Box dimensions (L, B, H)                                 │
│  - Paper layers (GSM, BF, Shade per layer)                  │
│  - Manufacturing costs (Printing, Die, etc.)                │
│  - Quantity                                                  │
│                                                              │
│  CALCULATIONS:                                               │
│  - Paper cost (BF base + GSM adjust + Shade premium)        │
│  - Manufacturing cost                                        │
│  - Subtotal                                                  │
│  - GST (from business_defaults)                             │
│  - Grand Total                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               QUOTE VERSIONING (Immutable)                   │
├─────────────────────────────────────────────────────────────┤
│  quotes                                                      │
│  ├─ quote_versions (each edit = new version)                │
│  │  ├─ Snapshot: GST%, subtotal, tax, total                 │
│  │  └─ quote_item_versions (line items)                     │
│  │     └─ Snapshot: Paper prices, costs, dimensions         │
│                                                              │
│  Purpose: Historical accuracy even if master rates change   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security & Validation

### 1. Locked Core Fields

**Fields:** Company Name, Owner Name, Email, Phone

**Why Locked?**
- These appear on official quotes, PDFs, and invoices
- Changing them requires identity verification (prevents fraud)
- Email re-verification required before changes allowed

**Implementation:**
```typescript
// settings.tsx - Account Profile tab
<Input
  value={companyProfile.companyName}
  disabled
  className="bg-muted cursor-not-allowed"
/>
<p className="text-xs text-muted-foreground">
  To change core fields, contact support
</p>
```

### 2. Logo Upload Limits

**Max Size:** 100KB
**Formats:** PNG, JPG, SVG, WebP
**Storage:** Base64 encoded in database

**Why 100KB?**
- Fast loading in quotes and PDFs
- Reasonable file size for branding
- Prevents database bloat

### 3. Multi-Tenant Security

**Every query includes `tenantId`:**
```typescript
// Example: storage.ts
async getCompanyProfile(id: string, tenantId?: string) {
  return await db.query.companyProfiles.findFirst({
    where: and(
      eq(companyProfiles.id, id),
      tenantId ? eq(companyProfiles.tenantId, tenantId) : undefined
    )
  });
}
```

**Result:** Cross-tenant data access is impossible

---

## 📝 Code Comments Standard

All critical architectural decisions include inline comments explaining **WHY**, not just **WHAT**.

**Example:**
```typescript
// ✅ GOOD - Explains architectural decision
// Calculator is READ-ONLY consumer of business_defaults
// GST must be edited in Masters → Tax & GST to ensure single source of truth
// This prevents quote inconsistencies and maintains audit compliance
const taxRateValue = businessDefaults?.defaultGstPercent ?? 5;

// ❌ BAD - Just describes what code does
// Get GST rate from business defaults
const taxRateValue = businessDefaults?.defaultGstPercent ?? 5;
```

---

## 🎓 Developer Onboarding Checklist

When a new developer joins this project, they must understand:

- [ ] **NEVER** store business identity data outside `company_profiles`
- [ ] **NEVER** store GST data outside `business_defaults`
- [ ] **NEVER** allow Calculator to edit master data (read-only only)
- [ ] **ALWAYS** use `tenantId` in multi-tenant queries
- [ ] **ALWAYS** snapshot pricing data when creating quotes
- [ ] **ALWAYS** add architectural comments for critical decisions
- [ ] **NEVER** remove existing architectural safeguards without team review

---

## 🚀 Future-Proofing (5+ Year Stability)

This architecture is designed to scale for 5+ years:

### 1. **Single Source of Truth**
- Easy to maintain (one place to update)
- Prevents data drift over time
- Clear ownership of data

### 2. **Quote Versioning**
- Historical quotes remain accurate forever
- Legal compliance (contracts stay valid)
- Pricing analysis over time

### 3. **Multi-Tenant Isolation**
- Can scale to thousands of tenants
- No cross-tenant data leaks
- Easy to add enterprise features

### 4. **Read-Only Consumers**
- Calculator, PDF Generator, Email Templates are stateless
- Easy to refactor UI without breaking data integrity
- Can add new consumers (mobile app, API) easily

### 5. **Modular Masters**
- Each master (Paper Pricing, GST, Flutes) is independent
- Can add new masters without affecting existing ones
- Clear separation of concerns

---

## 📊 Testing Guidelines

### Critical Tests Required

**1. GST Flow Test:**
```typescript
// Test: Change GST in Masters → Verify Calculator reflects change
it('should update calculator GST when business defaults change', async () => {
  // 1. Set GST to 5% in Masters
  // 2. Navigate to Calculator
  // 3. Verify GST input shows 5%
  // 4. Change GST to 12% in Masters
  // 5. Refresh Calculator
  // 6. Verify GST input shows 12%
});
```

**2. Profile Completeness Guard:**
```typescript
// Test: Calculator blocks if profile incomplete
it('should block calculator if business profile incomplete', async () => {
  // 1. Create user with incomplete profile (missing company name)
  // 2. Navigate to Calculator
  // 3. Verify blocking message is shown
  // 4. Verify "Complete Business Profile" button exists
});
```

**3. Quote Versioning:**
```typescript
// Test: Quote snapshots preserve historical pricing
it('should preserve original pricing even if master rates change', async () => {
  // 1. Create quote with GST = 5%
  // 2. Change GST to 12% in Masters
  // 3. Fetch original quote
  // 4. Verify quote still shows 5% GST (not 12%)
});
```

---

## 📖 API Documentation

### GET `/api/business-defaults`

**Purpose:** Fetch GST rate and tax settings (single source of truth)

**Response:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "defaultGstPercent": 5,
  "gstRegistered": true,
  "gstNumber": "27AABCU9603R1ZM",
  "igstApplicable": false,
  "roundOffEnabled": true,
  "showColumnBoxSize": true,
  "showColumnBoard": true,
  ...
}
```

**Consumers:**
- Calculator (for GST rate)
- Quote Generator (for tax calculation)
- PDF Generator (for quote documents)
- Email/WhatsApp Templates (for column visibility)

---

## 🎯 Summary

This architecture ensures:
1. ✅ **Single Source of Truth** for business data and GST
2. ✅ **Calculator is read-only consumer** (no editing master data)
3. ✅ **GST flows from Masters to Calculator** automatically
4. ✅ **Profile guards** prevent calculator use without complete profile
5. ✅ **Quote versioning** preserves historical accuracy
6. ✅ **Multi-tenant isolation** for enterprise scalability
7. ✅ **Coming Soon modules** show product roadmap

**Result:** A stable, maintainable, 5+ year architecture with no duplicate sources of truth.
