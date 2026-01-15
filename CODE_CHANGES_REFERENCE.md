# 📋 EXACT CODE CHANGES REFERENCE

## File 1: server/routes.ts

### Change 1: Import Addition (Line 9)

```typescript
// BEFORE
import { eq } from "drizzle-orm";

// AFTER
import { eq, desc } from "drizzle-orm";
```

---

### Change 2: Debug Endpoint Addition (After Line 4245)

```typescript
// ADDED NEW ENDPOINT (Lines 4250-4268)

// DEBUG: Check all users with verification_pending status (admin only)
app.get("/api/admin/debug/verification-pending", combinedAuth, requireAdminAuth, async (req: any, res) => {
  try {
    const pendingUsers = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      accountStatus: users.accountStatus,
      submittedForVerificationAt: users.submittedForVerificationAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.accountStatus, 'verification_pending'))
    .orderBy(desc(users.submittedForVerificationAt));

    res.json({
      count: pendingUsers.length,
      users: pendingUsers,
    });
  } catch (error: any) {
    console.error('Error fetching verification_pending users:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## File 2: client/src/admin/pages/Email.tsx

### Change 1: Added SMTP Presets and State (Lines 75-140)

```typescript
// BEFORE (Lines 75-105)
function AddProviderModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<EmailProvider>) => void;
  isSubmitting: boolean;
}) {
  const [providerType, setProviderType] = useState<ProviderType>('smtp');
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '587',
    username: '',
    password: '',
    apiKey: '',
    fromEmail: '',
    fromName: '',
  });

// AFTER (Lines 75-140)
function AddProviderModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<EmailProvider>) => void;
  isSubmitting: boolean;
}) {
  const [providerType, setProviderType] = useState<ProviderType>('smtp');
  const [smtpPreset, setSmtpPreset] = useState('gmail');
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '587',
    username: '',
    password: '',
    apiKey: '',
    fromEmail: '',
    fromName: '',
  });

  // SMTP preset configurations
  const SMTP_PRESETS: Record<string, { host: string; port: number; fromName: string; note?: string }> = {
    gmail: { 
      host: 'smtp.gmail.com', 
      port: 587, 
      fromName: 'Gmail/Google Workspace',
      note: 'Use App Password (not your Gmail login password)'
    },
    outlook: { 
      host: 'smtp.office365.com', 
      port: 587, 
      fromName: 'Outlook/Hotmail/Microsoft 365'
    },
    zoho: { 
      host: 'smtp.zoho.in', 
      port: 587, 
      fromName: 'Zoho Mail'
    },
    titan: { 
      host: 'smtp.titan.email', 
      port: 587, 
      fromName: 'Titan Email'
    },
    yahoo: { 
      host: 'smtp.mail.yahoo.com', 
      port: 587, 
      fromName: 'Yahoo Mail'
    },
    custom: { 
      host: '', 
      port: 587, 
      fromName: 'Custom SMTP'
    },
  };

  const handleSmtpPresetChange = (preset: string) => {
    setSmtpPreset(preset);
    const config = SMTP_PRESETS[preset];
    setFormData({
      ...formData,
      host: config.host,
      port: config.port.toString(),
    });
  };
```

---

### Change 2: SMTP Form Fields (Replace lines ~173-215)

```typescript
// BEFORE
{/* SMTP-specific fields */}
{providerType === 'smtp' && (
  <>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SMTP Host
        </label>
        <input
          type="text"
          value={formData.host}
          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
          placeholder="smtp.example.com"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Port
        </label>
        <input
          type="number"
          value={formData.port}
          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
          placeholder="587"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
    {/* ... rest of form ... */}
  </>
)}

// AFTER
{/* SMTP-specific fields */}
{providerType === 'smtp' && (
  <>
    {/* SMTP Provider Preset */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Provider Preset (Optional)
      </label>
      <select
        value={smtpPreset}
        onChange={(e) => handleSmtpPresetChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="gmail">Gmail / Google Workspace</option>
        <option value="outlook">Outlook / Hotmail / Microsoft 365</option>
        <option value="zoho">Zoho Mail</option>
        <option value="titan">Titan Email</option>
        <option value="yahoo">Yahoo Mail</option>
        <option value="custom">Custom SMTP</option>
      </select>
      {smtpPreset !== 'custom' && (
        <p className="text-xs text-amber-600 mt-1">
          ⚠️ {smtpPreset === 'gmail' ? 'Use App Password, not your Gmail password' : 'Auto-filled based on preset'}
        </p>
      )}
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SMTP Host
        </label>
        <input
          type="text"
          value={formData.host}
          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
          placeholder="smtp.example.com"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Port
        </label>
        <input
          type="number"
          value={formData.port}
          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
          placeholder="587"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Username / Email
      </label>
      <input
        type="text"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
        placeholder="user@example.com"
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Password / App Password
      </label>
      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        placeholder="••••••••"
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {smtpPreset === 'gmail' && (
        <p className="text-xs text-gray-500 mt-1">
          Generate an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">App Password</a>
        </p>
      )}
    </div>
  </>
)}
```

---

## Summary of Changes

| File | Type | Lines | Change |
|------|------|-------|--------|
| server/routes.ts | Import | 9 | Added `desc` |
| server/routes.ts | New Endpoint | 4250-4268 | Added debug endpoint |
| client/.../Email.tsx | State | 95-125 | Added SMTP presets |
| client/.../Email.tsx | Handler | 127-135 | Added preset handler |
| client/.../Email.tsx | Form | 173-215 | Enhanced SMTP form |

**Total Changes**:
- ✅ 2 files modified
- ✅ 3 logical changes (import, endpoint, form)
- ✅ ~100 lines added
- ✅ 0 lines removed
- ✅ 0 breaking changes

---

## Testing the Changes

### Backend Test
```bash
# 1. Start server
npm run dev

# 2. Check debug endpoint works
curl http://localhost:5000/api/admin/debug/verification-pending

# 3. Manually create a user with verification_pending status
# (Via web UI: submit for verification)

# 4. Should see user in response
```

### Frontend Test
```bash
# 1. Navigate to Admin > Settings > Email Configuration
# 2. Click "Add Provider"
# 3. Select "Gmail/Google Workspace" from dropdown
# 4. Notice:
#    - Host field shows "smtp.gmail.com" (auto-filled)
#    - Port field shows "587" (auto-filled)
#    - Warning text shows about App Password
# 5. Other presets work same way
```

---

Generated: 2026-01-05

