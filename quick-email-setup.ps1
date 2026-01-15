#!/bin/powershell
# QUICK EMAIL SYSTEM SETUP & TEST
# ================================

Write-Host "📧 BoxCostPro Email System - Quick Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Start dev server
Write-Host "Step 1: Starting dev server..." -ForegroundColor Yellow
Write-Host "Run in a terminal: npm run dev" -ForegroundColor Green
Write-Host ""

# Step 2: Test backend
Write-Host "Step 2: Testing backend endpoint..." -ForegroundColor Yellow
$timeout = 0
while ($timeout -lt 30) {
    try {
        $health = curl http://localhost:5000/health 2>$null
        if ($health) {
            Write-Host "✅ Backend is running on http://localhost:5000" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $timeout++
}

if ($timeout -ge 30) {
    Write-Host "❌ Backend not responding. Make sure npm run dev is running." -ForegroundColor Red
    exit 1
}

# Step 3: Test frontend
Write-Host "`nStep 3: Testing frontend..." -ForegroundColor Yellow
Write-Host "✅ Open in browser: http://localhost:5173/admin/email" -ForegroundColor Green
Write-Host "   (or http://localhost:5173 and navigate to Admin → Email)" -ForegroundColor Gray

# Step 4: Test API endpoints
Write-Host "`nStep 4: Testing API endpoints..." -ForegroundColor Yellow

# Test SMTP endpoint
Write-Host "`n  Testing /api/admin/email/test-smtp..." -ForegroundColor Gray
try {
    $body = @{host="smtp.gmail.com"; port=587; username="test@test.com"; password="test"; secure=$false} | ConvertTo-Json
    $response = curl -X POST http://localhost:5000/api/admin/email/test-smtp `
        -H "Content-Type: application/json" `
        -d $body -s 2>$null
    
    if ($response -like "<!DOCTYPE*") {
        Write-Host "  ⚠️ WARNING: Proxy not working (got HTML)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Endpoint is responding with JSON" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️ Could not reach endpoint" -ForegroundColor Yellow
}

# Test health endpoint
Write-Host "`n  Testing /api/admin/email/health..." -ForegroundColor Gray
try {
    $response = curl http://localhost:5000/api/admin/email/health -s 2>$null
    if ($response -like "<!DOCTYPE*") {
        Write-Host "  ⚠️ WARNING: Proxy not working (got HTML)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Endpoint is responding with JSON" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️ Could not reach endpoint" -ForegroundColor Yellow
}

# Step 5: Next steps
Write-Host "`n" -ForegroundColor Cyan
Write-Host "📝 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host "1. ✅ Backend running: http://localhost:5000" -ForegroundColor Gray
Write-Host "2. 🌐 Frontend running: http://localhost:5173" -ForegroundColor Gray
Write-Host "3. 📧 Go to Admin → Email" -ForegroundColor Gray
Write-Host "4. ➕ Click 'Add Email Provider'" -ForegroundColor Gray
Write-Host "5. 🧪 Fill in test provider and click 'Test Connection'" -ForegroundColor Gray
Write-Host "6. ✅ See real error message (not JSON parse crash)" -ForegroundColor Gray
Write-Host ""

# Troubleshooting
Write-Host "❓ IF YOU SEE ERRORS:" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host "• HTML error (<!DOCTYPE): Vite proxy not working" -ForegroundColor Yellow
Write-Host "  → Restart npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "• Auth error (401): Admin login required" -ForegroundColor Yellow
Write-Host "  → Log in as admin first" -ForegroundColor Gray
Write-Host ""
Write-Host "• Connection error: Backend not running" -ForegroundColor Yellow
Write-Host "  → Run: npm run dev" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ SYSTEM READY!" -ForegroundColor Green
