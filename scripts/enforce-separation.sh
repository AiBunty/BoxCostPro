#!/bin/bash
# enforce-separation.sh - Enforce STRICT UI separation between User App and Admin Panel
# This script must pass before merging any code changes

set -e

echo "🔍 Enforcing UI Separation Rules..."
echo ""

ERRORS=0

# Rule 1: No admin imports in User App (App.tsx)
echo "✓ Checking Rule 1: No admin imports in User App..."
if grep -q "from.*@/pages/admin" client/src/App.tsx 2>/dev/null; then
  echo "❌ FAIL: App.tsx contains admin page imports"
  grep -n "from.*@/pages/admin" client/src/App.tsx
  ERRORS=$((ERRORS+1))
else
  echo "  ✓ PASS: No admin imports found in App.tsx"
fi

# Rule 2: No admin routes in User App (App.tsx)
echo ""
echo "✓ Checking Rule 2: No admin routes in User App..."
if grep -q "<Route.*path=\"/admin" client/src/App.tsx 2>/dev/null; then
  echo "❌ FAIL: App.tsx contains admin routes"
  grep -n "<Route.*path=\"/admin" client/src/App.tsx
  ERRORS=$((ERRORS+1))
else
  echo "  ✓ PASS: No admin routes found in App.tsx"
fi

# Rule 3: No admin navigation in User App (AppShell.tsx)
echo ""
echo "✓ Checking Rule 3: No admin navigation in User App shell..."
if grep -q "label.*Admin" client/src/components/layout/AppShell.tsx 2>/dev/null || \
   grep -q "path.*\/admin" client/src/components/layout/AppShell.tsx 2>/dev/null; then
  echo "❌ FAIL: AppShell.tsx contains admin navigation"
  grep -n "label.*Admin\|path.*\/admin" client/src/components/layout/AppShell.tsx
  ERRORS=$((ERRORS+1))
else
  echo "  ✓ PASS: No admin navigation in AppShell.tsx"
fi

# Rule 4: No user app imports in Admin Panel files
echo ""
echo "✓ Checking Rule 4: No user app imports in Admin Panel..."
ADMIN_VIOLATIONS=$(grep -r "from.*@/pages/\(dashboard\|calculator\|quotes\|reports\|masters\|account\)" client/src/admin/ 2>/dev/null || true)
if [ -n "$ADMIN_VIOLATIONS" ]; then
  echo "❌ FAIL: Admin panel contains user app page imports"
  echo "$ADMIN_VIOLATIONS"
  ERRORS=$((ERRORS+1))
else
  echo "  ✓ PASS: No user app imports in admin files"
fi

# Rule 5: Verify AdminRouter has access control
echo ""
echo "✓ Checking Rule 5: Admin Router has access control..."
if ! grep -q "hasAdminAccess\|adminRoles.includes" client/src/admin/AdminRouter.tsx 2>/dev/null; then
  echo "❌ FAIL: AdminRouter.tsx missing access control check"
  ERRORS=$((ERRORS+1))
else
  echo "  ✓ PASS: Access control present in AdminRouter.tsx"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo "✅ All UI Separation Rules Passed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ $ERRORS Violation(s) Found"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Fix these violations before merging!"
  exit 1
fi
