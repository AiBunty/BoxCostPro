# BoxCostPro Authentication Contract

**Version:** 1.0.0  
**Last Updated:** January 1, 2026  
**Status:** AUTHORITATIVE  

---

## 📋 Executive Summary

This document establishes the AUTHORITATIVE authentication contract for BoxCostPro. 
**Clerk is the ONLY authentication provider.** Any code, configuration, or dependency 
that introduces alternative authentication mechanisms is a security defect that MUST 
be rejected.

---

## 🔐 Section 1: Authentication Rules

### 1.1 Single Provider Policy

| Rule | Description |
|------|-------------|
| **AUTH-001** | Clerk is the ONLY authentication provider |
| **AUTH-002** | All user logins MUST occur via Clerk |
| **AUTH-003** | All signup flows MUST occur via Clerk |
| **AUTH-004** | All password resets MUST occur via Clerk |
| **AUTH-005** | All session management is handled by Clerk |
| **AUTH-006** | All OAuth providers (Google, Microsoft, etc.) MUST be configured in Clerk |

### 1.2 Token Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTHORIZED TOKEN FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Browser ──▶ Clerk UI ──▶ Clerk Cloud ──▶ JWT Token                 │
│      │                                        │                      │
│      │                                        ▼                      │
│      │              Authorization: Bearer <clerk-jwt>                │
│      │                                        │                      │
│      ▼                                        ▼                      │
│  Frontend ──────────────▶ Express Server ──────────────▶ Database   │
│             HTTP Request    │                   User Lookup          │
│                             │                                        │
│                             ▼                                        │
│                      @clerk/express                                  │
│                      clerkMiddleware()                               │
│                      validates JWT                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Trust Boundary

The FINAL trust boundary is defined as:

```
Browser → Clerk → Clerk JWT → Backend → DB Role Check
```

**Explicitly FORBIDDEN:**
- ❌ Cookies for authentication
- ❌ Server-side sessions for authentication  
- ❌ OAuth callbacks outside Clerk
- ❌ Non-Clerk tokens (Supabase, Neon, custom JWT)
- ❌ Password storage in application database
- ❌ Custom session tokens

---

## 🛡️ Section 2: Authorization Rules

### 2.1 Role-Based Access Control

| Rule | Description |
|------|-------------|
| **AUTHZ-001** | Database is the source of truth for user roles |
| **AUTHZ-002** | Backend enforces ALL permission checks |
| **AUTHZ-003** | Frontend NEVER decides permissions |
| **AUTHZ-004** | Role changes require backend validation |
| **AUTHZ-005** | Admin endpoints require role verification from database |

### 2.2 Role Hierarchy

```
owner > super_admin > admin > support_manager > support_agent > user
```

### 2.3 Authorization Flow

```typescript
// CORRECT: Backend authorization
app.get('/api/admin/users', combinedAuth, async (req, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.userId)
  });
  
  if (!['admin', 'super_admin', 'owner'].includes(user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Proceed with admin operation
});
```

```typescript
// FORBIDDEN: Frontend authorization
if (user.role === 'admin') {
  // ❌ NEVER trust frontend role checks for security decisions
  showAdminPanel();
}
```

---

## 🚫 Section 3: Forbidden Patterns

### 3.1 Forbidden Authentication Systems

| System | Status | Reason |
|--------|--------|--------|
| Supabase Auth | ❌ FORBIDDEN | Replaced by Clerk |
| Neon Auth | ❌ FORBIDDEN | Replaced by Clerk |
| Custom Google OAuth | ❌ FORBIDDEN | Use Clerk's Google OAuth |
| Passport.js | ❌ FORBIDDEN | Session-based auth removed |
| NextAuth | ❌ FORBIDDEN | Not applicable |
| Firebase Auth | ❌ FORBIDDEN | Not applicable |
| Auth0 | ❌ FORBIDDEN | Not applicable |
| Custom JWT | ❌ FORBIDDEN | Use Clerk JWT only |

### 3.2 Forbidden Code Patterns

```typescript
// ❌ FORBIDDEN: Supabase auth
import { createClient } from '@supabase/supabase-js';
const { data: { session } } = await supabase.auth.getSession();

// ❌ FORBIDDEN: Neon auth
import { neonAuthClient } from '@neondatabase/auth';
await neonAuthClient.signIn();

// ❌ FORBIDDEN: Passport
import passport from 'passport';
app.use(passport.initialize());

// ❌ FORBIDDEN: Custom OAuth callback
app.get('/auth/google/callback', async (req, res) => {});

// ❌ FORBIDDEN: Cookie-based auth
res.cookie('auth_token', token);
const token = req.cookies.auth_token;

// ❌ FORBIDDEN: Session-based auth
req.session.userId = user.id;
```

### 3.3 Forbidden Environment Variables

Any of these environment variables in production is a security defect:

| Variable Pattern | Status |
|-----------------|--------|
| `SUPABASE_*` | ❌ FORBIDDEN |
| `NEON_AUTH_*` | ❌ FORBIDDEN |
| `GOOGLE_OAUTH_CLIENT_*` | ❌ FORBIDDEN (use Clerk) |
| `PASSPORT_*` | ❌ FORBIDDEN |
| `AUTH0_*` | ❌ FORBIDDEN |
| `NEXTAUTH_*` | ❌ FORBIDDEN |

### 3.4 Forbidden Dependencies

These packages MUST NOT appear in package.json:

| Package | Status |
|---------|--------|
| `@supabase/supabase-js` | ❌ FORBIDDEN |
| `@supabase/auth-ui-react` | ❌ FORBIDDEN |
| `@neondatabase/auth` | ❌ FORBIDDEN |
| `@neondatabase/auth-ui` | ❌ FORBIDDEN |
| `passport` | ❌ FORBIDDEN |
| `passport-*` | ❌ FORBIDDEN |
| `next-auth` | ❌ FORBIDDEN |
| `@auth0/*` | ❌ FORBIDDEN |

---

## 🧨 Section 4: Auth Threat Model

### 4.1 Assets

| Asset | Description | Protection |
|-------|-------------|------------|
| User Identity | User's authenticated identity | Clerk JWT verification |
| Admin Privileges | Elevated system access | Database role check |
| Sessions/Tokens | Authentication state | Clerk session management |
| User Data | PII and business data | Tenant isolation + auth |

### 4.2 Threats and Mitigations

#### THREAT-001: Dual Auth States

**Description:** User authenticated via multiple providers simultaneously, causing confusion about identity source.

**Attack Vector:** Legacy Supabase session cookie + Clerk JWT both present.

**Clerk-Only Prevention:**
- ✅ Single authentication provider eliminates dual states
- ✅ No legacy session cookies accepted
- ✅ Only Clerk JWT is validated

#### THREAT-002: Ghost Sessions

**Description:** Orphaned sessions from deprecated auth systems that remain valid.

**Attack Vector:** Old Neon Auth session token reused after migration.

**Clerk-Only Prevention:**
- ✅ All legacy session validation code removed
- ✅ No session tokens accepted from non-Clerk sources
- ✅ Startup guards reject legacy env vars

#### THREAT-003: OAuth Bypass

**Description:** Direct OAuth implementation bypasses Clerk's security controls.

**Attack Vector:** Custom `/auth/google/callback` route with weaker validation.

**Clerk-Only Prevention:**
- ✅ All custom OAuth routes deleted
- ✅ OAuth handled entirely by Clerk Cloud
- ✅ CI guards fail build on OAuth callback patterns

#### THREAT-004: Token Confusion

**Description:** Backend accepts tokens from multiple issuers, enabling token substitution.

**Attack Vector:** Attacker uses Supabase token when Clerk token expected.

**Clerk-Only Prevention:**
- ✅ `@clerk/express` middleware ONLY validates Clerk tokens
- ✅ No fallback token validation
- ✅ Token issuer explicitly verified

#### THREAT-005: Privilege Escalation

**Description:** Frontend role manipulation allows unauthorized access.

**Attack Vector:** Modifying `user.role` in localStorage/memory.

**Clerk-Only Prevention:**
- ✅ Roles stored in DATABASE, not tokens
- ✅ Every privileged operation re-queries database
- ✅ Frontend role is for UI only, never authorization

#### THREAT-006: Admin UI Leakage

**Description:** Admin UI accessible without proper backend validation.

**Attack Vector:** Direct URL access to `/admin/*` routes.

**Clerk-Only Prevention:**
- ✅ All `/api/admin/*` routes require `combinedAuth` + role check
- ✅ Frontend route guards are defense-in-depth only
- ✅ Backend is the ONLY authorization enforcer

### 4.3 Security Invariants

These conditions MUST always be true:

1. **INVARIANT-001:** No endpoint returns data without Clerk authentication
2. **INVARIANT-002:** No admin endpoint operates without database role verification
3. **INVARIANT-003:** No authentication occurs outside Clerk
4. **INVARIANT-004:** No token is trusted without Clerk validation
5. **INVARIANT-005:** Removing Clerk MUST break all authentication

---

## 🛠️ Section 5: Implementation Verification

### 5.1 Auth Health Check Endpoint

```http
GET /api/system/health/auth

Response:
{
  "auth_provider": "clerk",
  "clerk_verified": true,
  "other_auth_detected": false,
  "forbidden_env_vars": []
}
```

### 5.2 Startup Guards

Application MUST fail to start if any forbidden environment variable is detected:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEON_AUTH_*`
- `GOOGLE_OAUTH_CLIENT_ID` (for auth, not email)
- `GOOGLE_OAUTH_CLIENT_SECRET` (for auth, not email)

### 5.3 CI Guards

Build MUST fail if any of these patterns are detected in source code:
- Supabase auth imports
- Neon auth imports
- Passport imports
- OAuth callback routes (except email)
- Legacy session handling

---

## 📜 Section 6: Enforcement Policy

### 6.1 Pull Request Requirements

Every PR MUST:
1. Pass `npm run auth:guard` check
2. Not introduce any forbidden dependencies
3. Not add any forbidden environment variables
4. Not implement any authentication outside Clerk

### 6.2 Code Review Checklist

- [ ] No new auth dependencies added
- [ ] No custom OAuth implementations
- [ ] No session-based authentication
- [ ] All auth uses `@clerk/clerk-react` or `@clerk/express`
- [ ] Role checks query database, not tokens

### 6.3 Violation Response

Any violation of this contract:
1. **MUST** block the PR
2. **MUST** be reported to security team
3. **MUST** be remediated before merge
4. **MAY** require security audit of related code

---

## 📊 Section 7: Compliance Matrix

| Requirement | Status | Evidence |
|------------|--------|----------|
| Single auth provider | ✅ | Only `@clerk/*` in package.json |
| No legacy auth code | ✅ | `npm run auth:guard` passes |
| No forbidden env vars | ✅ | Startup guards active |
| Database role source | ✅ | All admin routes query DB |
| Backend authorization | ✅ | Frontend has no permission logic |
| Auth health endpoint | ✅ | `/api/system/health/auth` available |
| CI guards active | ✅ | Build fails on contamination |

---

## 📝 Document Control

| Field | Value |
|-------|-------|
| Document Owner | Security Team |
| Review Frequency | Quarterly |
| Last Review | January 1, 2026 |
| Next Review | April 1, 2026 |
| Classification | Internal - Security |

---

**This document is AUTHORITATIVE. Any deviation is a security defect.**
