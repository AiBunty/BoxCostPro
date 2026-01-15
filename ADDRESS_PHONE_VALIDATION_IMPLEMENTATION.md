# Address & Phone Validation Implementation

## Summary
Implemented structured address fields and phone validation for business profiles as requested.

## Changes Made

### 1. Database Schema Updates
**File:** `shared/schema.ts`
- Added `address_1` (TEXT) - Required address line 1
- Added `address_2` (TEXT) - Optional address line 2  
- Added `pincode` (VARCHAR(6)) - Required 6-digit postal code
- Added `country_code` (VARCHAR(5), DEFAULT '+91') - Phone country code

### 2. Migration Script
**File:** `scripts/migrate-add-address-fields.js`
- Adds new columns to `company_profiles` table
- Backfills `address_1` from legacy `address` field
- Successfully executed ✅

### 3. Client Form Updates
**Files:** 
- `client/src/app/pages/account.tsx`
- `client/src/pages/account.tsx`

#### State Variables Added:
- `address1` - Required street address
- `address2` - Optional additional address
- `pincode` - Required 6-digit code
- `countryCode` - Phone country code (default: "+91")
- `phoneError` - Phone validation error message
- `pincodeError` - Pincode validation error message

#### Form UI Changes:

**Phone Field:**
- Added country code dropdown with options:
  - India (+91) - Default
  - US (+1)
  - UK (+44)
  - UAE (+971)
- Phone input limited to 10 digits
- Real-time validation with visual feedback (red border on error)
- Auto-strips non-numeric characters

**Address Fields:**
Replaced single textarea with three structured inputs:
1. **Address Line 1** (Required)
   - Street address, building name
   - Required field validation
   
2. **Address Line 2** (Optional)
   - Apartment, suite, unit number
   
3. **Pincode** (Required)
   - 6 digits required
   - Real-time validation
   - Auto-strips non-numeric characters
   - Red border on invalid input

#### Validation Rules:
- **Phone:** Must be exactly 10 digits
- **Address1:** Required, cannot be empty
- **Pincode:** Required, must be exactly 6 digits
- All validation errors show toast notifications
- Visual feedback with red borders on invalid inputs

### 4. Server-Side Handling
**File:** `server/routes.ts`
- No changes required
- Routes already use `insertCompanyProfileSchema` which automatically handles new fields
- POST `/api/company-profiles` - Accepts new fields
- PATCH `/api/company-profiles/:id` - Accepts new fields

**File:** `server/storage.ts`
- No changes required  
- Uses typed schema definitions, automatically supports new fields

## Testing Checklist

✅ Migration executed successfully  
✅ Dev server starts without errors  
✅ Client forms updated with new fields  
⏳ Test user workflow:
   1. Navigate to Business Profile page
   2. Verify country code dropdown appears with +91 default
   3. Test phone validation (must be 10 digits)
   4. Test address1 required validation
   5. Test address2 optional (can be empty)
   6. Test pincode validation (must be 6 digits)
   7. Save profile with valid data
   8. Verify data persists correctly

## API Request/Response

### Request Body (PATCH `/api/company-profiles/:id`):
```json
{
  "ownerName": "John Doe",
  "companyName": "ABC Corp",
  "phone": "9876543210",
  "countryCode": "+91",
  "email": "john@example.com",
  "website": "https://example.com",
  "gstNo": "27AAACV3467G1ZH",
  "address1": "123 Main Street, Building A",
  "address2": "Floor 2, Unit 201",
  "pincode": "400001"
}
```

### Response (200 OK):
```json
{
  "id": "uuid",
  "userId": "uuid",
  "companyName": "ABC Corp",
  "ownerName": "John Doe",
  "phone": "9876543210",
  "countryCode": "+91",
  "email": "john@example.com",
  "website": "https://example.com",
  "gstNo": "27AAACV3467G1ZH",
  "panNo": "AAACV3467G",
  "stateCode": "27",
  "stateName": "Maharashtra",
  "address1": "123 Main Street, Building A",
  "address2": "Floor 2, Unit 201",
  "pincode": "400001",
  "isDefault": true,
  "hasFinancialDocs": false
}
```

## Features Implemented

✅ Structured address fields (address1, address2, pincode)  
✅ Country code selector for phone numbers  
✅ Real-time validation with visual feedback  
✅ Auto-formatting (strips non-numeric characters)  
✅ Toast notifications for validation errors  
✅ Red borders on invalid inputs  
✅ Respects locked fields for financial documents  
✅ Maintains edit permissions logic  
✅ Backward compatible (backfills address1 from legacy address)

## Next Steps

1. **Test Complete Flow:**
   - Create new business profile with structured address
   - Update existing profile
   - Verify validation works correctly
   - Test edge cases (empty pincode, invalid phone, etc.)

2. **Update Admin Panel** (if needed):
   - Verify admin can view new fields
   - Update admin forms if they edit business profiles

3. **Update Templates/Invoices** (if needed):
   - Check if invoice templates need to use new address structure
   - Update formatting to use address1, address2, pincode instead of single address

## Files Modified

1. `shared/schema.ts` - Added address/phone fields to schema
2. `scripts/migrate-add-address-fields.js` - New migration script
3. `client/src/app/pages/account.tsx` - Updated form with new fields
4. `client/src/pages/account.tsx` - Updated form with new fields

## Database Migration Details

```sql
ALTER TABLE company_profiles 
  ADD COLUMN IF NOT EXISTS address_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_2 TEXT,
  ADD COLUMN IF NOT EXISTS pincode VARCHAR(6),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+91';

UPDATE company_profiles 
SET address_1 = address 
WHERE address_1 IS NULL AND address IS NOT NULL;
```

Migration executed successfully: ✅
