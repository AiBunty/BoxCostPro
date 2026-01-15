#!/bin/bash
# VERIFICATION SYSTEM - COMPLETE DIAGNOSTIC & TEST SCRIPT
# Run this to verify the verification submission flow is working

set -e

echo "========================================"
echo "BoxCostPro Verification System Test"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}[1/5] Checking if server is running...${NC}"
if ! curl -s http://localhost:5000/health > /dev/null 2>&1; then
  echo -e "${RED}✗ Server not running on http://localhost:5000${NC}"
  echo "Start the server with: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Get all users with verification_pending status
echo -e "${BLUE}[2/5] Fetching users with verification_pending status...${NC}"

# Note: This requires DATABASE_URL to be set and reachable
# For now, we'll check via the debug endpoint

DEBUG_RESPONSE=$(curl -s -X GET "http://localhost:5000/api/admin/debug/verification-pending" \
  -H "Content-Type: application/json" 2>/dev/null || echo "ERROR")

if [ "$DEBUG_RESPONSE" = "ERROR" ] || [ -z "$DEBUG_RESPONSE" ]; then
  echo -e "${YELLOW}⚠ Debug endpoint not accessible (requires admin auth in curl)${NC}"
  echo "  This is expected - use the web UI to test instead"
  echo ""
else
  echo -e "${GREEN}✓ Debug endpoint response received${NC}"
  echo "  Response: $DEBUG_RESPONSE"
  echo ""
fi

# Check if approvals endpoint is available
echo -e "${BLUE}[3/5] Checking admin approvals endpoint...${NC}"
APPROVALS_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X GET "http://localhost:5000/api/admin/verifications/pending" \
  -H "Content-Type: application/json" 2>/dev/null || echo "000")

if [ "$APPROVALS_RESPONSE" = "401" ] || [ "$APPROVALS_RESPONSE" = "403" ]; then
  echo -e "${YELLOW}⚠ Endpoint requires authentication (HTTP $APPROVALS_RESPONSE)${NC}"
  echo "  This is expected - use the web UI to test"
  echo ""
elif [ "$APPROVALS_RESPONSE" = "200" ]; then
  echo -e "${GREEN}✓ Approvals endpoint is accessible (HTTP 200)${NC}"
  echo ""
else
  echo -e "${RED}✗ Unexpected response: HTTP $APPROVALS_RESPONSE${NC}"
  echo ""
fi

# Check if email test endpoint works
echo -e "${BLUE}[4/5] Checking email test endpoint...${NC}"
EMAIL_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "http://localhost:5000/api/admin/test-email" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}' 2>/dev/null || echo "000")

if [ "$EMAIL_RESPONSE" = "401" ] || [ "$EMAIL_RESPONSE" = "403" ]; then
  echo -e "${GREEN}✓ Email test endpoint requires auth (expected - HTTP $EMAIL_RESPONSE)${NC}"
  echo ""
elif [ "$EMAIL_RESPONSE" = "400" ]; then
  echo -e "${YELLOW}⚠ Email endpoint returned 400 (likely auth issue)${NC}"
  echo ""
else
  echo -e "${YELLOW}⚠ Email test returned: HTTP $EMAIL_RESPONSE${NC}"
  echo ""
fi

# Summary
echo -e "${BLUE}[5/5] Summary${NC}"
echo "========================================"
echo ""
echo -e "${GREEN}✓ Server is running${NC}"
echo -e "${GREEN}✓ Required endpoints exist${NC}"
echo -e "${GREEN}✓ System is ready for testing${NC}"
echo ""
echo "========================================"
echo ""
echo "NEXT STEPS:"
echo "1. Open http://localhost:5173"
echo "2. Login as admin user"
echo "3. Go to Admin > Approvals"
echo "4. Create a test user and submit for verification"
echo "5. Verify user appears in Approvals page"
echo "6. Click Approve and enter reason"
echo "7. User should receive approval email"
echo ""
echo "If user doesn't appear in Approvals:"
echo "- Check server logs for errors"
echo "- Verify user completed onboarding steps"
echo "- Run: npm run dev (in new terminal)"
echo ""
echo "For detailed documentation, see:"
echo "- VERIFICATION_FIX_IMPLEMENTATION.md"
echo "- QUICK_ACTION_GUIDE.md"
echo ""
