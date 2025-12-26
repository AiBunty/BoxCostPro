# Complete Onboarding Flow Fix - PaperBox ERP

## 🚨 Problems Identified

### 1. **Infinite Settings Redirect Loop**
- User completes profile → auto-redirect to "/"
- App.tsx guard checks business profile
- No phone/email in default company profile
- Infinite redirect to `/settings`
- User can't escape!

### 2. **Fragmented Onboarding**
- Phase 1: `/complete-profile` (personal)
- Phase 2: `/settings` (business) ← NOT an onboarding page!
- Phase 3: `/masters?tab=flute` (machine)
- Phase 4: `/masters?tab=paper` (pricing)
- Confusing! Settings ≠ Onboarding

### 3. **Auto-Created Incomplete Profile**
```typescript
// tenantContext.ts creates profile with ONLY companyName
await storage.createCompanyProfile({
  tenantId,
  userId,
  companyName: 'My Business',  // ← Only this!
  isDefault: true,
});

// But App.tsx guard requires:
const isBusinessProfileComplete = !!(defaultCompany &&
  defaultCompany.companyName &&
  (defaultCompany.phone || defaultCompany.email));  // ← Missing!
```

### 4. **Duplicate Profile Systems**
- `user_profiles` - onboarding progress
- `company_profiles` - business data
- Confusing overlap

---

## ✅ Solution: Single Unified Onboarding Flow

### New Flow Structure:
```
Login → /onboarding (ALL steps in one place)
```

**Onboarding Steps (Progressive Form)**:
1. **Personal Info** (firstName, lastName, mobile)
2. **Business Info** (companyName, phone, email, GST)
3. **Machine Settings** (Flute types configuration)
4. **Paper Pricing** (Basic setup or skip)
5. **Done** → Dashboard

### Implementation Plan:

#### **Step 1: Create Unified Onboarding Page**

File: `client/src/pages/onboarding.tsx` (NEW)

```typescript
// Multi-step wizard with progress indicator
Steps:
1. Personal Profile
2. Business Profile
3. Machine Settings (Flute)
4. Paper Setup (Optional - can skip)

// Save progress at each step
// Navigate: /onboarding?step=1, /onboarding?step=2, etc.
// Can resume from any step
```

#### **Step 2: Simplify App.tsx Guards**

```typescript
// OLD (Complex):
if (!user.firstName) redirect /complete-profile
if (!isBusinessProfileComplete) redirect /settings
if (!isMachineConfigured) redirect /masters?tab=flute
if (!isPaperSetupComplete) redirect /masters?tab=paper

// NEW (Simple):
if (!onboardingCompleted) redirect /onboarding
```

#### **Step 3: Fix Auto-Created Profile**

```typescript
// tenantContext.ts - Create complete profile
await storage.createCompanyProfile({
  tenantId,
  userId,
  companyName: user.fullName || 'My Company',
  ownerName: user.fullName,
  email: user.email,  // ← Use user's email!
  phone: user.mobileNo || null,  // ← Use mobile if available
  isDefault: true,
});
```

#### **Step 4: Add Onboarding Status Tracking**

```typescript
// user_profiles table - simplified
{
  userId,
  onboardingCompleted: boolean,  // ← Single flag
  currentOnboardingStep: 1-5,    // ← Current step
  onboardingCompletedAt: timestamp
}
```

---

## 📋 Detailed Implementation

### File 1: Create `/client/src/pages/onboarding-wizard.tsx`

```typescript
/**
 * Unified Onboarding Wizard
 * Replaces: complete-profile.tsx + settings business form + masters redirects
 */

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    { id: 1, title: "Personal Info", icon: User },
    { id: 2, title: "Business Details", icon: Building2 },
    { id: 3, title: "Machine Settings", icon: Settings },
    { id: 4, title: "Pricing Setup", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Progress Bar */}
      <OnboardingProgress steps={steps} currentStep={currentStep} />

      {/* Step Content */}
      {currentStep === 1 && <PersonalInfoStep onNext={() => setCurrentStep(2)} />}
      {currentStep === 2 && <BusinessDetailsStep onNext={() => setCurrentStep(3)} />}
      {currentStep === 3 && <MachineSettingsStep onNext={() => setCurrentStep(4)} />}
      {currentStep === 4 && <PricingSetupStep onComplete={() => navigate('/')} />}
    </div>
  );
}
```

### File 2: Update `/server/tenantContext.ts`

```typescript
// Fix auto-created company profile
async function createTenantForUser(userId: string): Promise<TenantContext> {
  const user = await storage.getUser(userId);

  // Create tenant
  const tenant = await storage.createTenant({ ownerId: userId });

  // Create complete company profile (no missing fields!)
  await storage.createCompanyProfile({
    tenantId: tenant.id,
    userId: user.id,
    companyName: user.fullName || 'My Company',
    ownerName: user.fullName,
    email: user.email,           // ← REQUIRED
    phone: user.mobileNo || '',  // ← Set to empty string if missing
    isDefault: true,
  });

  return { tenantId: tenant.id, tenant };
}
```

### File 3: Simplify `/client/src/App.tsx` Guards

```typescript
// BEFORE (Complex):
const isBusinessProfileComplete = !!(defaultCompany && defaultCompany.companyName &&
  (defaultCompany.phone || defaultCompany.email));

const isMachineConfigured = fluteStatus?.configured ?? false;
const isPaperSetupComplete = paperSetupStatus?.completed ?? false;

if (!isBusinessProfileComplete && location !== "/settings" && ...) {
  return <Redirect to="/settings" />;
}
if (!isMachineConfigured && !isOnMasters && ...) {
  return <Redirect to="/masters?tab=flute" />;
}
if (!isPaperSetupComplete && !isOnMasters && ...) {
  return <Redirect to="/masters?tab=paper" />;
}

// AFTER (Simple):
const onboardingComplete = userProfile?.onboardingCompleted ?? false;

if (!onboardingComplete && location !== "/onboarding") {
  return <Redirect to="/onboarding" />;
}
```

### File 4: Add Onboarding API Routes

```typescript
// server/routes.ts - NEW endpoints

// Get onboarding status
app.get("/api/onboarding/status", combinedAuth, async (req: any, res) => {
  const userId = req.userId;
  const profile = await storage.getUserProfile(userId);
  const company = await storage.getDefaultCompanyProfile(userId);
  const fluteStatus = await storage.getFlutingStatus(userId);

  res.json({
    currentStep: profile?.currentOnboardingStep || 1,
    completed: profile?.onboardingCompleted || false,
    steps: {
      personal: !!(user.firstName && user.mobileNo),
      business: !!(company?.companyName && company?.email),
      machine: fluteStatus?.configured,
      pricing: profile?.paperSetupDone,
    }
  });
});

// Save onboarding step progress
app.post("/api/onboarding/step/:stepNumber", combinedAuth, async (req: any, res) => {
  const userId = req.userId;
  const step = parseInt(req.params.stepNumber);
  const data = req.body;

  // Save step data based on step number
  // Update currentOnboardingStep
  // Mark completed if step === 4
});
```

---

## 🔄 Migration Path

### For Existing Users (Already Stuck):

1. **Check their status**:
   ```sql
   SELECT * FROM company_profiles WHERE user_id = 'xxx';
   ```

2. **Fix incomplete profiles**:
   ```sql
   UPDATE company_profiles
   SET email = (SELECT email FROM users WHERE id = user_id),
       phone = COALESCE(phone, '')
   WHERE email IS NULL OR email = '';
   ```

3. **Mark onboarding complete for existing users**:
   ```sql
   UPDATE user_profiles
   SET onboarding_completed = true,
       current_onboarding_step = 5
   WHERE user_id IN (SELECT id FROM users WHERE created_at < NOW() - INTERVAL '1 day');
   ```

### For New Users (Going Forward):

1. Login → Auto-redirect to `/onboarding`
2. Complete 4-step wizard
3. All data saved progressively
4. Mark `onboardingCompleted = true`
5. Redirect to dashboard → Full access

---

## 🎯 Benefits

| Before | After |
|--------|-------|
| 4 separate pages | 1 unified wizard ✅ |
| Confusing redirects | Single redirect ✅ |
| Settings ≠ onboarding | Clear onboarding flow ✅ |
| Incomplete auto-profile | Complete profile with defaults ✅ |
| Can get stuck | Always can proceed ✅ |
| No progress indicator | Visual progress bar ✅ |
| No way to skip optional steps | Can skip paper setup ✅ |

---

## 📝 Implementation Checklist

### Phase 1: Fix Critical Bug (TODAY)
- [ ] Update `tenantContext.ts` to create profile with email
- [ ] Add migration SQL to fix existing incomplete profiles
- [ ] Test: New user signup → Should not get stuck at settings

### Phase 2: Create Unified Onboarding (THIS WEEK)
- [ ] Create `onboarding-wizard.tsx` with 4-step flow
- [ ] Move personal info form from `complete-profile.tsx`
- [ ] Move business form from `settings.tsx` (duplicate, don't remove)
- [ ] Integrate flute settings component
- [ ] Add skip option for paper setup
- [ ] Add progress tracking

### Phase 3: Simplify Guards (THIS WEEK)
- [ ] Update `App.tsx` redirect logic
- [ ] Add `/api/onboarding/status` endpoint
- [ ] Add `/api/onboarding/step/:id` endpoints
- [ ] Update `user_profiles` schema
- [ ] Test complete flow end-to-end

### Phase 4: Polish (NEXT WEEK)
- [ ] Add onboarding progress UI
- [ ] Add "Skip" and "Back" buttons
- [ ] Add tooltips and help text
- [ ] Mobile responsive design
- [ ] Animations and transitions

---

## 🚀 Quick Fix (IMMEDIATE)

To unblock users stuck at settings RIGHT NOW:

**Option A: Remove strict guard (Temporary)**
```typescript
// App.tsx - Comment out business profile guard
/*
if (!isBusinessProfileComplete && location !== "/settings" && ...) {
  return <Redirect to="/settings" />;
}
*/
```

**Option B: Auto-fill missing fields**
```typescript
// tenantContext.ts - Use user email as fallback
await storage.createCompanyProfile({
  tenantId: tenant.id,
  userId: user.id,
  companyName: user.fullName || 'My Company',
  ownerName: user.fullName,
  email: user.email,  // ← ALWAYS set this
  phone: user.mobileNo || user.email,  // ← Fallback to email if no phone
  isDefault: true,
});
```

**Option C: SQL Migration for Existing Users**
```sql
-- Fix all company profiles missing email/phone
UPDATE company_profiles cp
SET
  email = COALESCE(cp.email, u.email),
  phone = COALESCE(cp.phone, u.mobile_no, '')
FROM users u
WHERE cp.user_id = u.id
  AND (cp.email IS NULL OR cp.email = '' OR cp.phone IS NULL);
```

---

**Status**: 🔴 CRITICAL - Users cannot access app after signup
**Priority**: Fix tenantContext.ts immediately, then build proper onboarding
**Estimated Time**:
- Quick fix: 5 minutes
- Full onboarding wizard: 1-2 days

---

Which approach would you like me to implement first?
1. Quick fix to unblock users (5 min)
2. Full unified onboarding wizard (proper solution)
3. Both (fix now, refactor later)
