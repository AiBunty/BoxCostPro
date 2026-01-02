# GST-Compliant Invoice Template System - Implementation Plan

## Objective
Build a complete, production-ready Invoice Template system that is:
- GST-law compliant (India)
- PDF-safe with Puppeteer
- Multi-template support (3 templates)
- Includes full Seller & Buyer details
- Includes Terms & Conditions
- Immutable after generation
- CA/GST audit-ready
- Admin-manageable

## Phase 1: Database Schema & Migration

### Files to Create:
1. `server/migrations/008-invoice-templates.sql`
   - Create `invoice_templates` table
   - Seed with 3 default templates

2. `shared/schema.ts` - Add schema definitions:
   - `invoiceTemplates` table
   - TypeScript types

### Schema Design:
```sql
CREATE TABLE invoice_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  template_key VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Phase 2: HTML Invoice Templates

### Templates to Create:
1. `server/templates/invoices/classic-gst.html`
   - Black & white, table-based, CA-friendly

2. `server/templates/invoices/modern-saas.html`
   - Brand header, logo support, subscription-friendly

3. `server/templates/invoices/minimal-print.html`
   - No colors, printer-optimized

### Template Structure (All 3):
- Header: TAX INVOICE, number, date, FY
- Seller Details: Name, GSTIN, PAN, Address, Phone, Email
- Buyer Details: Name, GSTIN/URP, Address, Phone, Email, Place of Supply
- Line Items: Description, SAC, Qty, Rate, Taxable Value, CGST, SGST, IGST, Total
- Totals: Subtotal, CGST, SGST, IGST, Grand Total, Amount in Words
- Payment Details: Method, Reference, Transaction Date
- Terms & Conditions
- Footer: System-generated notice, Authorized Signatory

### Variable Placeholders:
```
{{invoice.number}}
{{invoice.date}}
{{invoice.financial_year}}
{{seller.company_name}}
{{seller.gstin}}
{{seller.pan}}
{{seller.address}}
{{seller.phone}}
{{seller.email}}
{{buyer.company_name}}
{{buyer.gstin}}
{{buyer.address}}
{{buyer.phone}}
{{buyer.email}}
{{buyer.place_of_supply}}
{{items}}
{{tax.cgst}}
{{tax.sgst}}
{{tax.igst}}
{{total.amount}}
{{total.amount_in_words}}
```

## Phase 3: PDF Generation Service

### File to Create:
`server/services/pdfInvoiceService.ts`

### Functionality:
- Load template by key
- Inject invoice data into HTML
- Generate PDF using Puppeteer
- Store PDF at `invoices/{userId}/{invoiceId}.pdf`
- Prevent regeneration (immutable)
- Link PDF to invoice record

### Dependencies:
- Install puppeteer: `npm install puppeteer`
- Install handlebars for templating: `npm install handlebars @types/handlebars`

### Key Functions:
```typescript
generateInvoicePDF(invoiceId: string, templateKey: string): Promise<string>
renderInvoiceHTML(template: string, data: InvoiceData): string
saveInvoicePDF(invoiceId: string, pdfBuffer: Buffer): string
```

## Phase 4: Backend API Routes

### File to Update:
`server/routes.ts`

### Endpoints to Add:
1. `GET /api/admin/invoice-templates` - List all templates
2. `GET /api/admin/invoice-templates/:id` - Get template details
3. `GET /api/admin/invoice-templates/:id/preview` - Preview with sample data
4. `PUT /api/admin/invoice-templates/:id/set-default` - Set default template
5. `PUT /api/admin/invoice-templates/:id/status` - Enable/disable template
6. `POST /api/invoices/:id/generate-pdf` - Generate PDF for invoice
7. `GET /api/invoices/:id/download` - Download PDF

### Storage Methods to Add:
- `getInvoiceTemplates()`
- `getInvoiceTemplateByKey(key: string)`
- `getDefaultInvoiceTemplate()`
- `updateInvoiceTemplate(id, updates)`

## Phase 5: Admin UI Components

### Files to Create:
1. `client/src/pages/admin-invoice-templates.tsx`
   - List templates
   - Preview templates
   - Set default
   - Enable/disable

2. `client/src/components/InvoiceTemplatePreview.tsx`
   - Render HTML preview with sample data
   - Show exactly as PDF would render

### Admin Panel Integration:
- Add route to admin navigation
- Add permissions check (manage_settings)

## Phase 6: Sample Invoice Data Generator

### File to Create:
`server/utils/sampleInvoiceData.ts`

### Purpose:
Generate realistic sample data for template previews:
- Sample seller details (with GSTIN, PAN)
- Sample buyer details
- Sample line items with GST calculations
- Payment details

## Phase 7: GST Compliance Validation

### Checklist to Implement:
- ✅ GSTIN format validation (15 chars)
- ✅ PAN format validation (10 chars)
- ✅ SAC code validation (998313/998314 for SaaS)
- ✅ Place of Supply validation
- ✅ CGST+SGST vs IGST logic (intra-state vs inter-state)
- ✅ Amount in words conversion
- ✅ Financial year calculation
- ✅ Invoice numbering format

## Phase 8: Invoice Schema Updates

### File to Update:
`shared/schema.ts`

### Add Fields to `quotes` table:
- `invoice_template_id` - FK to invoice_templates
- `pdf_path` - Stored PDF location
- `pdf_generated_at` - Timestamp of PDF generation
- `is_pdf_generated` - Boolean flag

## Critical Files Summary

### New Files (8):
1. `server/migrations/008-invoice-templates.sql`
2. `server/templates/invoices/classic-gst.html`
3. `server/templates/invoices/modern-saas.html`
4. `server/templates/invoices/minimal-print.html`
5. `server/services/pdfInvoiceService.ts`
6. `server/utils/sampleInvoiceData.ts`
7. `client/src/pages/admin-invoice-templates.tsx`
8. `client/src/components/InvoiceTemplatePreview.tsx`

### Files to Modify (3):
1. `shared/schema.ts` - Add invoice_templates table
2. `server/storage.ts` - Add template CRUD methods
3. `server/routes.ts` - Add template & PDF endpoints

## Implementation Order

1. ✅ Database migration (schema + seed data)
2. ✅ HTML templates (all 3)
3. ✅ PDF generation service
4. ✅ Backend API routes
5. ✅ Storage methods
6. ✅ Sample data generator
7. ✅ Admin UI pages
8. ✅ Navigation integration

## Compliance Guarantees

- GST-compliant structure per CBIC guidelines
- ICAI-safe invoice numbering
- Audit-ready PDF format
- Immutable post-generation
- CA export friendly (PDF/A compatible)

## Next Steps

Upon approval:
1. Create all 8 new files
2. Update 3 existing files
3. Install required dependencies (puppeteer, handlebars)
4. Run migration
5. Test PDF generation
6. Test admin preview
7. Verify GST compliance

---

**Status**: Ready for implementation
**Estimated Files**: 11 total (8 new, 3 modified)
**Dependencies**: puppeteer, handlebars
**Complexity**: High (GST compliance + PDF generation)
