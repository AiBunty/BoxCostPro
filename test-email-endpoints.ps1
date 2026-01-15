# Test Email API Endpoints

Write-Host "🧪 Testing Email System Endpoints" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if server is running
Write-Host "`n📡 Checking backend server..." -ForegroundColor Yellow
$serverCheck = curl http://localhost:5000/health 2>$null
if ($serverCheck) {
    Write-Host "✅ Backend server is running on http://localhost:5000" -ForegroundColor Green
} else {
    Write-Host "❌ Backend server is NOT running on port 5000" -ForegroundColor Red
    Write-Host "   Run: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 1: SMTP Test Endpoint
Write-Host "`n🧪 Test 1: SMTP Connection Test Endpoint" -ForegroundColor Yellow
Write-Host "Endpoint: POST /api/admin/email/test-smtp" -ForegroundColor Gray

$smtpTestBody = @{
    host = "smtp.gmail.com"
    port = 587
    username = "test@gmail.com"
    password = "test-password"
    secure = $false
} | ConvertTo-Json

Write-Host "Request body:" -ForegroundColor Gray
Write-Host $smtpTestBody -ForegroundColor DarkGray

try {
    $response = curl -X POST http://localhost:5000/api/admin/email/test-smtp `
        -H "Content-Type: application/json" `
        -d $smtpTestBody `
        -s
    
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host $response -ForegroundColor DarkGray
    
    # Check if response is JSON (not HTML)
    if ($response -like "<!DOCTYPE*" -or $response -like "<html*") {
        Write-Host "❌ SMTP Test returned HTML (proxy/routing issue)" -ForegroundColor Red
    } else {
        try {
            $json = $response | ConvertFrom-Json
            Write-Host "✅ SMTP Test endpoint returned valid JSON" -ForegroundColor Green
            if ($json.success -eq $false) {
                Write-Host "   → Error message: $($json.error)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Response is not valid JSON" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Health Endpoint
Write-Host "`n🧪 Test 2: Email Health Status Endpoint" -ForegroundColor Yellow
Write-Host "Endpoint: GET /api/admin/email/health" -ForegroundColor Gray

try {
    $response = curl http://localhost:5000/api/admin/email/health -s
    
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host $response -ForegroundColor DarkGray
    
    # Check if response is JSON
    if ($response -like "<!DOCTYPE*" -or $response -like "<html*") {
        Write-Host "❌ Health endpoint returned HTML (proxy/routing issue)" -ForegroundColor Red
    } else {
        try {
            $json = $response | ConvertFrom-Json
            Write-Host "✅ Health endpoint returned valid JSON" -ForegroundColor Green
            Write-Host "   → Providers found: $($json.providers.Count)" -ForegroundColor Yellow
        } catch {
            Write-Host "❌ Response is not valid JSON" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Add Provider Endpoint
Write-Host "`n🧪 Test 3: Add Email Provider Endpoint (Will fail with auth error, that's OK)" -ForegroundColor Yellow
Write-Host "Endpoint: POST /api/admin/email/providers" -ForegroundColor Gray

$providerBody = @{
    name = "Test Provider"
    type = "smtp"
    host = "smtp.gmail.com"
    port = 587
    username = "test@gmail.com"
    fromEmail = "test@gmail.com"
    fromName = "Test"
} | ConvertTo-Json

try {
    $response = curl -X POST http://localhost:5000/api/admin/email/providers `
        -H "Content-Type: application/json" `
        -d $providerBody `
        -s
    
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host $response -ForegroundColor DarkGray
    
    # Check if response is JSON
    if ($response -like "<!DOCTYPE*" -or $response -like "<html*") {
        Write-Host "❌ Add Provider endpoint returned HTML (proxy/routing issue)" -ForegroundColor Red
    } else {
        try {
            $json = $response | ConvertFrom-Json
            if ($json.error) {
                Write-Host "✅ Add Provider endpoint returned JSON (error is expected without auth)" -ForegroundColor Green
                Write-Host "   → Error: $($json.error)" -ForegroundColor Yellow
            } else {
                Write-Host "✅ Add Provider endpoint returned valid JSON" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️ Response could not be parsed as JSON" -ForegroundColor Yellow
            Write-Host $response
        }
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✅ Testing complete!" -ForegroundColor Cyan
Write-Host "If you saw HTML responses, check the Vite dev server proxy configuration" -ForegroundColor Yellow
