# Security Best Practices for BoxCostPro

## 🚨 CRITICAL: Secrets Management

### What Was Exposed
Your `.env` files containing sensitive credentials were accidentally committed to GitHub. This is a **critical security vulnerability**.

### Immediate Actions Required

#### 1. Rotate ALL Exposed Credentials (Do This NOW!)

All secrets that were in the committed `.env` file are now considered compromised and MUST be rotated:

- **Clerk Keys**
  - Go to https://dashboard.clerk.com
  - Delete current API keys
  - Generate new `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
  - Update your local `.env` file with new keys

- **Database Credentials**
  - Change your PostgreSQL password
  - Update `DATABASE_URL` with new password
  - If using Neon: Regenerate connection string

- **Email Provider Keys**
  - SMTP passwords
  - SendGrid API keys
  - Resend API keys
  - Regenerate all of them

- **Payment Gateway Credentials**
  - Razorpay: Generate new API keys
  - PhonePe: Rotate merchant credentials

- **Encryption Keys**
  - Generate new `ENCRYPTION_KEY` or `SESSION_SECRET`
  - Re-encrypt existing data if necessary

#### 2. Remove Secrets from Git History

The `.env` files are now removed from future commits, but they still exist in Git history. You have two options:

**Option A: Use BFG Repo-Cleaner (Recommended)**
```bash
# Install BFG
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Backup your repo first
git clone --mirror https://github.com/AiBunty/BoxCostPro.git BoxCostPro-backup.git

# Remove .env files from history
java -jar bfg.jar --delete-files ".env" BoxCostPro.git
java -jar bfg.jar --delete-files "client/.env" BoxCostPro.git

cd BoxCostPro.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history)
git push --force
```

**Option B: Use git filter-branch**
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env client/.env" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

⚠️ **WARNING**: Both options rewrite Git history. Coordinate with all team members before doing this.

#### 3. Check GitHub for Exposed Secrets

GitHub may have already detected exposed secrets:
1. Go to your repository: https://github.com/AiBunty/BoxCostPro
2. Click "Security" tab
3. Check "Secret scanning alerts"
4. Follow remediation steps for each alert

### What's Protected Now

The updated `.gitignore` now prevents committing:

✅ All `.env` files (root, client/, server/)
✅ Credential files (*.pem, *.key, credentials.json)
✅ API keys and secrets
✅ Database files
✅ Log files (may contain sensitive data)
✅ Migration backups
✅ Test output files
✅ IDE-specific settings

## Environment Variables Management

### Use .env.example as Template

**Root `.env.example`** (already in repo):
```bash
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_your_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/boxcostpro

# Encryption
ENCRYPTION_KEY=your-32-character-minimum-secret-key-here
SESSION_SECRET=your-session-secret-here

# Email Providers (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Payment Gateway (Optional)
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_secret

# Sentry (Optional)
SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io

# Server
PORT=5000
NODE_ENV=development
```

### Creating Your Local .env

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual secrets
nano .env  # or use your preferred editor

# NEVER commit the .env file!
```

## CI/CD and Deployment

### GitHub Actions Secrets

For GitHub Actions, add secrets via:
1. Repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret individually

### Environment Variables in Production

**Replit**:
- Go to "Secrets" tab
- Add each environment variable
- Never hardcode in code

**Vercel**:
```bash
vercel env add CLERK_SECRET_KEY production
vercel env add DATABASE_URL production
# ... add all required vars
```

**Railway**:
- Project → Variables tab
- Add environment variables
- Variables are encrypted at rest

**Docker**:
```bash
# Use docker-compose.yml with env_file
services:
  app:
    env_file:
      - .env  # Make sure .env is in .dockerignore!
```

## Code Review Checklist

Before committing, ALWAYS check:

- [ ] No hardcoded API keys
- [ ] No database credentials in code
- [ ] No passwords or secrets
- [ ] `.env` files not staged (`git status`)
- [ ] Using environment variables via `process.env.XXX`
- [ ] No console.log with sensitive data
- [ ] No comments with credentials

## Pre-commit Hook (Recommended)

Install a pre-commit hook to detect secrets:

```bash
# Install git-secrets
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install

# Configure for your repo
cd /path/to/BoxCostPro
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'CLERK_SECRET_KEY.*'
git secrets --add 'DATABASE_URL.*'
git secrets --add 'RAZORPAY.*'
git secrets --add 'ENCRYPTION_KEY.*'
```

Alternative: Use **Gitleaks**
```bash
# Install gitleaks
brew install gitleaks  # macOS
# or download from: https://github.com/gitleaks/gitleaks

# Scan your repo
gitleaks detect --source . --verbose

# Add pre-commit hook
gitleaks protect --staged
```

## What If Secrets Are Already Public?

### If Your Repo is Public and Secrets Were Exposed:

1. **Assume compromise**: All exposed keys are compromised
2. **Rotate immediately**: Change ALL credentials
3. **Monitor accounts**: Check for unauthorized access
4. **Review logs**: Look for suspicious activity
5. **Update code**: Remove any hardcoded secrets
6. **Clean history**: Use BFG or filter-branch
7. **Notify team**: Inform all developers
8. **Update docs**: Document the incident

### Security Monitoring

Enable these on GitHub:
- Secret scanning (Settings → Security → Code security)
- Dependabot alerts (for vulnerable dependencies)
- Code scanning (for security vulnerabilities)

## Best Practices Going Forward

### ✅ DO

- Use environment variables for all secrets
- Keep `.env` in `.gitignore`
- Rotate credentials regularly
- Use different keys for dev/staging/production
- Enable 2FA on all service accounts
- Review commits before pushing
- Use secret management tools (AWS Secrets Manager, HashiCorp Vault)

### ❌ DON'T

- Commit `.env` files
- Hardcode credentials in code
- Share secrets via email/chat
- Use production keys in development
- Commit API keys, passwords, tokens
- Log sensitive information
- Share `.env` files in version control

## Tools to Help

1. **git-secrets**: Prevents committing secrets
2. **Gitleaks**: Detects secrets in code
3. **TruffleHog**: Finds secrets in Git history
4. **dotenv-vault**: Encrypted .env management
5. **GitHub Secret Scanning**: Automatic detection
6. **Pre-commit hooks**: Automated checks

## Additional Resources

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12 Factor App - Config](https://12factor.net/config)
- [git-secrets on GitHub](https://github.com/awslabs/git-secrets)

## Emergency Contacts

If you discover a security vulnerability:
1. DO NOT create a public GitHub issue
2. Email: security@yourcompany.com (set this up!)
3. Follow responsible disclosure

---

**Remember**: It's better to be paranoid about secrets than to deal with a security breach!
