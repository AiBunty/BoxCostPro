# Invoice System API Testing Guide

**Date**: December 31, 2024
**Status**: Ready for testing

---

## Prerequisites

Before testing, make sure you have:

1. ✅ Migration 008 completed (invoice_templates table created)
2. ✅ Dev server running (`npm run dev`)
3. ✅ Valid authentication token/session
4. ✅ At least one quote created in the system
5. ✅ Company profile set up with GSTIN and address

---

## Quick Start: Test All Endpoints

### Step 1: Restart Dev Server (CRITICAL)

```bash
# Stop current dev server (Ctrl+C)
npm run dev
```

**Why?** This loads the ENCRYPTION_KEY from .env file, fixing the SMTP issue.

### Step 2: Test Invoice Templates API

```bash
# List all invoice templates
curl http://localhost:5000/api/invoice-templates \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Expected Response:
[
  {
    "id": "...",
    "name": "Classic GST Invoice",
    "templateKey": "classic-gst",
    "description": "Traditional black & white GST invoice template",
    "isDefault": true,
    "status": "active",
    "createdAt": "...",
    "updatedAt": "..."
  },
  // ... more templates
]
```

### Step 3: Generate Invoice PDF

```bash
# Generate PDF for a quote (replace QUOTE_ID)
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"templateKey": "classic-gst"}'

# Expected Success Response:
{
  "success": true,
  "pdfPath": "invoices/user_123/quote_456.pdf",
  "templateUsed": "Classic GST Invoice",
  "invoiceNumber": "Q-001"
}

# If PDF already generated:
{
  "success": true,
  "message": "PDF already generated",
  "pdfPath": "invoices/user_123/quote_456.pdf",
  "alreadyGenerated": true
}

# If validation fails:
{
  "error": "Invalid quote data for invoice generation",
  "details": [
    "Seller company name is required",
    "Seller GSTIN is required"
  ]
}
```

### Step 4: Download Invoice PDF

```bash
# Download the generated PDF
curl http://localhost:5000/api/quotes/QUOTE_ID/invoice-pdf \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  --output invoice.pdf

# Expected: PDF file downloaded to invoice.pdf
```

---

## Detailed API Testing

### 1. GET `/api/invoice-templates`

**Purpose**: List all active invoice templates

**Test Cases**:

```bash
# Test 1: Get all templates (should return 3 templates)
curl http://localhost:5000/api/invoice-templates \
  -H "Cookie: YOUR_SESSION_COOKIE" | json_pp

# Verify:
# - Returns array of 3 templates
# - One template has isDefault: true
# - All have status: "active"
# - Template keys are: classic-gst, modern-saas, minimal-print
```

**Expected Response Structure**:
```json
[
  {
    "id": "uuid",
    "name": "Classic GST Invoice",
    "templateKey": "classic-gst",
    "description": "Traditional black & white GST invoice template...",
    "isDefault": true,
    "status": "active",
    "createdAt": "2024-12-31T...",
    "updatedAt": "2024-12-31T..."
  }
]
```

---

### 2. GET `/api/invoice-templates/:id`

**Purpose**: Get specific template by ID

**Test Cases**:

```bash
# Test 1: Get valid template
curl http://localhost:5000/api/invoice-templates/TEMPLATE_ID \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Test 2: Get non-existent template
curl http://localhost:5000/api/invoice-templates/invalid-id \
  -H "Cookie: YOUR_SESSION_COOKIE"
# Expected: 404 Not Found
```

---

### 3. POST `/api/quotes/:id/generate-invoice-pdf`

**Purpose**: Generate GST-compliant invoice PDF from quote

**Test Cases**:

#### Test 1: Generate with default template
```bash
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Verify:
# - Returns success: true
# - Returns pdfPath
# - Returns templateUsed
# - Returns invoiceNumber
# - File created at pdfPath
```

#### Test 2: Generate with specific template
```bash
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"templateKey": "modern-saas"}'

# Verify:
# - Uses modern-saas template
# - PDF has modern styling
```

#### Test 3: Try to regenerate existing PDF
```bash
# Generate PDF first
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Try again (should return existing PDF)
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Expected:
{
  "success": true,
  "message": "PDF already generated",
  "alreadyGenerated": true,
  "pdfPath": "..."
}
```

#### Test 4: Invalid quote ID
```bash
curl -X POST http://localhost:5000/api/quotes/invalid-id/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Expected: 404 Not Found
```

#### Test 5: Missing company profile
```bash
# If company profile not set up
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Expected: 400 Bad Request
{
  "error": "Company profile not found",
  "message": "Please set up your company profile in Settings before generating invoices"
}
```

---

### 4. GET `/api/quotes/:id/invoice-pdf`

**Purpose**: Download generated invoice PDF

**Test Cases**:

#### Test 1: Download existing PDF
```bash
# First generate the PDF
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Then download it
curl http://localhost:5000/api/quotes/QUOTE_ID/invoice-pdf \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  --output my-invoice.pdf

# Verify:
# - File downloaded successfully
# - PDF is readable
# - Contains quote data
# - GST-compliant format
```

#### Test 2: Download non-existent PDF
```bash
curl http://localhost:5000/api/quotes/QUOTE_WITHOUT_PDF/invoice-pdf \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Expected: 404 Not Found
{
  "error": "Invoice PDF not generated yet"
}
```

#### Test 3: Download someone else's quote PDF
```bash
curl http://localhost:5000/api/quotes/OTHER_USER_QUOTE_ID/invoice-pdf \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Expected: 403 Forbidden
{
  "error": "Access denied"
}
```

---

## Testing with Frontend UI

### Integration Test:

1. **Open Quote Detail Page**
   - Navigate to any quote in your app
   - Look for the Invoice PDF section

2. **Generate PDF**
   - Click "Generate Invoice PDF" button
   - Select template (or use default)
   - Wait for generation
   - Verify success message

3. **Download PDF**
   - Click "Download PDF" button
   - Verify file downloads
   - Open PDF and verify:
     - Company details correct
     - Buyer details correct
     - Line items match quote
     - GST calculations correct
     - GSTIN format valid
     - Financial year correct

4. **Try Regenerating**
   - Click "Generate Invoice PDF" again
   - Should show message: "PDF already exists"
   - Download button should still work

---

## Common Errors and Solutions

### Error: "ENCRYPTION_KEY not set"

**Solution**: Restart dev server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Error: "Company profile not found"

**Solution**: Set up company profile in Settings
- Go to Settings → Company Profile
- Fill in required fields (company name, GSTIN, address)
- Save changes

### Error: "Quote must have an active version"

**Solution**: Quote needs items
- Edit the quote
- Add at least one line item
- Save quote

### Error: "Invalid quote data for invoice generation"

**Solution**: Check validation errors
- Ensure seller GSTIN is set
- Ensure seller address is set
- Ensure quote has items
- Check error.details array for specific issues

### Error: "Failed to generate PDF"

**Common Causes**:
1. Puppeteer not installed: Run `npm install puppeteer`
2. Handlebars not installed: Run `npm install handlebars`
3. Template file missing: Check `server/templates/invoices/` folder
4. File permission issues: Check write access to `invoices/` folder

**Debug Steps**:
```bash
# Check if dependencies installed
npm list puppeteer handlebars

# Check template files exist
ls server/templates/invoices/

# Check invoices directory
ls -la invoices/
```

---

## Performance Testing

### Test 1: PDF Generation Speed

```bash
# Time the PDF generation
time curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Expected: < 5 seconds for first generation
```

### Test 2: Concurrent PDF Downloads

```bash
# Download same PDF multiple times concurrently
for i in {1..5}; do
  curl http://localhost:5000/api/quotes/QUOTE_ID/invoice-pdf \
    -H "Cookie: YOUR_SESSION_COOKIE" \
    --output invoice_$i.pdf &
done
wait

# Verify all 5 files are identical
md5sum invoice_*.pdf
```

---

## Security Testing

### Test 1: Authentication Required

```bash
# Try without authentication
curl http://localhost:5000/api/invoice-templates

# Expected: 401 Unauthorized
```

### Test 2: Ownership Verification

```bash
# Try to access another user's quote
curl -X POST http://localhost:5000/api/quotes/OTHER_USER_QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{}'

# Expected: 403 Forbidden
```

### Test 3: Template Injection

```bash
# Try to inject malicious template key
curl -X POST http://localhost:5000/api/quotes/QUOTE_ID/generate-invoice-pdf \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"templateKey": "../../../etc/passwd"}'

# Expected: 404 Template not found
```

---

## Validation Testing

### Test 1: Missing Seller Details

```bash
# Remove company profile data
# Then try to generate PDF

# Expected: 400 Bad Request
{
  "error": "Invalid quote data for invoice generation",
  "details": [
    "Seller company name is required",
    "Seller GSTIN is required",
    "Seller address is required"
  ]
}
```

### Test 2: Empty Quote

```bash
# Create quote with no items
# Try to generate PDF

# Expected: 400 Bad Request
{
  "error": "Invalid quote data for invoice generation",
  "details": [
    "At least one line item is required"
  ]
}
```

---

## Test Checklist

### Backend Tests:
- [ ] All 4 API endpoints respond correctly
- [ ] Authentication is enforced
- [ ] Ownership verification works
- [ ] Default template is used when none specified
- [ ] PDF immutability is enforced (can't regenerate)
- [ ] File paths are validated
- [ ] Error messages are helpful

### Data Validation Tests:
- [ ] Company profile validation works
- [ ] Quote validation works
- [ ] GSTIN format validation works
- [ ] State code extraction works
- [ ] Inter-state detection works

### PDF Generation Tests:
- [ ] All 3 templates generate correctly
- [ ] GST calculations are accurate
- [ ] CGST/SGST for intra-state
- [ ] IGST for inter-state
- [ ] Amount in words is correct
- [ ] Financial year is correct
- [ ] Date formatting is correct

### Frontend Tests:
- [ ] Component renders correctly
- [ ] Template selector works
- [ ] Generate button works
- [ ] Download button works
- [ ] Loading states show
- [ ] Error messages display
- [ ] Success toasts appear

---

## Next Steps After Testing

1. **If tests pass**:
   - Deploy to production
   - Monitor PDF generation logs
   - Track error rates

2. **If tests fail**:
   - Check error messages
   - Review server logs
   - Verify database schema
   - Check file permissions

3. **Performance optimization**:
   - Add Redis caching for templates
   - Implement PDF queue for async generation
   - Add CDN for PDF storage

---

*Ready to test! Start with the Quick Start guide above.* 🚀

