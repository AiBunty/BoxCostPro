# Setup Git Hooks for Secret Detection (PowerShell version)
# Run this script: .\scripts\setup-git-hooks.ps1

Write-Host "🔐 Setting up Git hooks to prevent secret leaks..." -ForegroundColor Cyan

# Create pre-commit hook directory if it doesn't exist
$hookPath = ".git\hooks"
if (!(Test-Path $hookPath)) {
    New-Item -ItemType Directory -Path $hookPath -Force | Out-Null
}

# Create pre-commit hook
$preCommitHook = @'
#!/bin/bash

# Pre-commit hook to detect secrets and sensitive files

echo "🔍 Checking for secrets and sensitive files..."

# Check if .env files are being committed
if git diff --cached --name-only | grep -E "^\.env$|^client/\.env$|^server/\.env$"; then
  echo "❌ ERROR: Attempting to commit .env files!"
  echo "   .env files contain secrets and should NEVER be committed."
  echo "   "
  echo "   Found:"
  git diff --cached --name-only | grep -E "^\.env"
  echo "   "
  echo "   To fix:"
  echo "   1. Remove from staging: git reset HEAD .env"
  echo "   2. Ensure .env is in .gitignore"
  echo "   3. Commit again"
  exit 1
fi

# Check for common secret patterns in staged files
SECRETS_FOUND=false

# Patterns to detect
PATTERNS=(
  "CLERK_SECRET_KEY.*sk_live"
  "CLERK_SECRET_KEY.*sk_test"
  "DATABASE_URL.*postgresql://.*:.*@"
  "RAZORPAY_KEY_SECRET"
  "SMTP_PASS.*[a-zA-Z0-9]{16,}"
  "ENCRYPTION_KEY.*[a-zA-Z0-9]{32,}"
  "private_key"
  "-----BEGIN.*PRIVATE KEY-----"
  "sk_live_[a-zA-Z0-9]+"
  "sk_test_[a-zA-Z0-9]+"
  "rzp_live_[a-zA-Z0-9]+"
  "rzp_test_[a-zA-Z0-9]+"
)

# Check staged files for patterns
for pattern in "${PATTERNS[@]}"; do
  if git diff --cached | grep -E "$pattern" > /dev/null; then
    echo "⚠️  WARNING: Possible secret detected: $pattern"
    SECRETS_FOUND=true
  fi
done

if [ "$SECRETS_FOUND" = true ]; then
  echo ""
  echo "❌ ERROR: Potential secrets detected in staged files!"
  echo "   Review your changes and remove any hardcoded secrets."
  echo "   Use environment variables instead."
  echo ""
  echo "   To bypass this check (NOT RECOMMENDED):"
  echo "   git commit --no-verify"
  exit 1
fi

# Check for sensitive file patterns
SENSITIVE_FILES=(
  "credentials.json"
  "service-account.json"
  "secrets.json"
  "*.pem"
  "*.key"
  "*.cert"
)

for pattern in "${SENSITIVE_FILES[@]}"; do
  if git diff --cached --name-only | grep -E "$pattern" > /dev/null; then
    echo "❌ ERROR: Attempting to commit sensitive file: $pattern"
    echo "   This file type should not be committed to version control."
    exit 1
  fi
done

echo "✅ No secrets detected. Proceeding with commit..."
exit 0
'@

# Write the hook
$preCommitPath = Join-Path $hookPath "pre-commit"
$preCommitHook | Out-File -FilePath $preCommitPath -Encoding ASCII -NoNewline

Write-Host "✅ Pre-commit hook installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 The hook will:" -ForegroundColor Yellow
Write-Host "   1. Block commits of .env files"
Write-Host "   2. Detect common secret patterns"
Write-Host "   3. Prevent sensitive file commits"
Write-Host ""
Write-Host "🔒 Your repository is now safer!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Note: Hooks only work locally. Share this script with your team:" -ForegroundColor Yellow
Write-Host "   .\scripts\setup-git-hooks.ps1"
