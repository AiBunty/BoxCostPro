#!/bin/bash
#
# AUTH CONTAMINATION CI GUARD
# 
# This script MUST run in CI/CD pipeline to prevent auth regression.
# Clerk is the ONLY allowed authentication provider.
#
# Exit codes:
#   0 = No contamination detected
#   1 = Auth contamination detected (FAIL BUILD)
#
# Usage: bash scripts/auth-guard.sh
#

set -e

echo "🔒 AUTH CONTAMINATION CI GUARD"
echo "═══════════════════════════════════════════════════════════"
echo ""

CONTAMINATION_FOUND=0
SCAN_DIRS="client/src server shared"

# Forbidden patterns for source code (case-insensitive grep)
FORBIDDEN_PATTERNS=(
    "from.*@supabase/auth"
    "from.*@supabase/supabase-js"
    "from.*@neondatabase/auth"
    "from.*@neondatabase/auth-ui"
    "from.*passport"
    "from.*next-auth"
    "supabase\.auth\."
    "neonAuthClient"
    "/auth/google/callback"
    "setupAuth.*passport"
)

# Allowed exceptions (false positives)
ALLOWED_FILES=(
    "scripts/auth-guard"
    "docs/auth-contract"
    "AUTH_DECONTAMINATION"
    "package-lock.json"
    ".env.example"
)

check_pattern() {
    local pattern="$1"
    local results
    
    results=$(grep -ril "$pattern" $SCAN_DIRS 2>/dev/null || true)
    
    for file in $results; do
        # Skip allowed files
        skip=false
        for allowed in "${ALLOWED_FILES[@]}"; do
            if [[ "$file" == *"$allowed"* ]]; then
                skip=true
                break
            fi
        done
        
        if [ "$skip" = false ]; then
            echo "❌ CONTAMINATION: Pattern '$pattern' found in: $file"
            CONTAMINATION_FOUND=1
        fi
    done
}

echo "📂 Scanning directories: $SCAN_DIRS"
echo ""

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    check_pattern "$pattern"
done

# Check package.json for forbidden dependencies
echo ""
echo "📦 Checking package.json for forbidden dependencies..."

FORBIDDEN_DEPS=(
    "@supabase/supabase-js"
    "@supabase/auth-ui"
    "@neondatabase/auth"
    "@neondatabase/auth-ui"
    "passport"
    "passport-local"
    "passport-google"
    "next-auth"
    "@auth0"
)

for dep in "${FORBIDDEN_DEPS[@]}"; do
    if grep -q "\"$dep\"" package.json 2>/dev/null; then
        echo "❌ FORBIDDEN DEPENDENCY: $dep in package.json"
        CONTAMINATION_FOUND=1
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════"

if [ $CONTAMINATION_FOUND -eq 0 ]; then
    echo "✅ NO AUTH CONTAMINATION DETECTED"
    echo "   Clerk is the ONLY authentication system."
    exit 0
else
    echo "❌ AUTH CONTAMINATION DETECTED"
    echo "   Build MUST fail. Remove all non-Clerk auth code."
    echo "   See docs/auth-contract.md for the authentication policy."
    exit 1
fi
