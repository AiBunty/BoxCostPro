# enforce-separation.ps1 - Enforce STRICT UI separation between User App and Admin Panel
# This script must pass before merging any code changes

Write-Host "[*] Enforcing UI Separation Rules..." -ForegroundColor Cyan
Write-Host ""

$ERRORS = 0

# Rule 1: No admin imports in User App (App.tsx)
Write-Host "[1/5] Checking Rule 1: No admin imports in User App..." -ForegroundColor Yellow
$adminImports = Select-String -Path "client\src\App.tsx" -Pattern "from.*@/pages/admin" -ErrorAction SilentlyContinue
if ($adminImports) {
    Write-Host "[X] FAIL: App.tsx contains admin page imports" -ForegroundColor Red
    $adminImports | ForEach-Object { Write-Host "  Line $($_.LineNumber): $($_.Line)" }
    $ERRORS++
} else {
    Write-Host "  [OK] PASS: No admin imports found in App.tsx" -ForegroundColor Green
}

# Rule 2: No admin routes in User App (App.tsx)
Write-Host ""
Write-Host "[2/5] Checking Rule 2: No admin routes in User App..." -ForegroundColor Yellow
$adminRoutes = Select-String -Path "client\src\App.tsx" -Pattern '<Route.*path="/admin' -ErrorAction SilentlyContinue
if ($adminRoutes) {
    Write-Host "[X] FAIL: App.tsx contains admin routes" -ForegroundColor Red
    $adminRoutes | ForEach-Object { Write-Host "  Line $($_.LineNumber): $($_.Line)" }
    $ERRORS++
} else {
    Write-Host "  [OK] PASS: No admin routes found in App.tsx" -ForegroundColor Green
}

# Rule 3: No admin navigation in User App (AppShell.tsx)
Write-Host ""
Write-Host "[3/5] Checking Rule 3: No admin navigation in User App shell..." -ForegroundColor Yellow
$adminNav = Select-String -Path "client\src\components\layout\AppShell.tsx" -Pattern 'label.*Admin|path.*\/admin' -ErrorAction SilentlyContinue
if ($adminNav) {
    Write-Host "[X] FAIL: AppShell.tsx contains admin navigation" -ForegroundColor Red
    $adminNav | ForEach-Object { Write-Host "  Line $($_.LineNumber): $($_.Line)" }
    $ERRORS++
} else {
    Write-Host "  [OK] PASS: No admin navigation in AppShell.tsx" -ForegroundColor Green
}

# Rule 4: No user app imports in Admin Panel files
Write-Host ""
Write-Host "[4/5] Checking Rule 4: No user app imports in Admin Panel..." -ForegroundColor Yellow
$userImportsInAdmin = Get-ChildItem -Path "client\src\admin" -Recurse -Filter "*.tsx" -ErrorAction SilentlyContinue | 
    Select-String -Pattern 'from\s+"@/pages/(dashboard|calculator|quotes|reports|masters|account)"' -ErrorAction SilentlyContinue
if ($userImportsInAdmin) {
    Write-Host "[X] FAIL: Admin panel contains user app page imports" -ForegroundColor Red
    $userImportsInAdmin | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber): $($_.Line)" }
    $ERRORS++
} else {
    Write-Host "  [OK] PASS: No user app imports in admin files" -ForegroundColor Green
}

# Rule 5: Verify AdminRouter has access control
Write-Host ""
Write-Host "[5/5] Checking Rule 5: Admin Router has access control..." -ForegroundColor Yellow
$accessControl = Select-String -Path "client\src\admin\AdminRouter.tsx" -Pattern "hasAdminAccess|adminRoles\.includes" -ErrorAction SilentlyContinue
if (-not $accessControl) {
    Write-Host "[X] FAIL: AdminRouter.tsx missing access control check" -ForegroundColor Red
    $ERRORS++
} else {
    Write-Host "  [OK] PASS: Access control present in AdminRouter.tsx" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($ERRORS -eq 0) {
    Write-Host "[SUCCESS] All UI Separation Rules Passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "[FAIL] $ERRORS Violation(s) Found" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Fix these violations before merging" -ForegroundColor Red
    exit 1
}
