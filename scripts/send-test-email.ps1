# Test Admin Email Script
# This script sends a test email to parin11@gmail.com using the admin email service

Write-Host "🔍 Testing Admin Email Configuration..." -ForegroundColor Cyan
Write-Host ""

# First, check if server is running
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:5000/health" -Method GET -UseBasicParsing
    Write-Host "✅ Server is running on port 5000" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running. Please start the server first with 'npm run dev'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📧 Sending test email to parin11@gmail.com..." -ForegroundColor Cyan
Write-Host ""

# Note: This endpoint requires admin authentication
# For now, we'll try to call it directly. If it fails due to auth, 
# the user will need to log in as admin and test from the UI

$body = @{
    to = "parin11@gmail.com"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/admin/test-email" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing
    
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   $($result.message)" -ForegroundColor Green
    Write-Host "   Timestamp: $($result.timestamp)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📬 Please check parin11@gmail.com inbox (or spam folder)" -ForegroundColor Yellow
    
} catch {
    $errorResponse = $_.Exception.Response
    
    if ($errorResponse.StatusCode -eq 401 -or $errorResponse.StatusCode -eq 403) {
        Write-Host "WARNING: Authentication Required" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "This endpoint requires admin authentication." -ForegroundColor Yellow
        Write-Host "Please follow these steps:" -ForegroundColor Cyan
        Write-Host "  1. Open http://localhost:5173 in your browser" -ForegroundColor White
        Write-Host "  2. Log in as an admin user" -ForegroundColor White
        Write-Host "  3. Navigate to Admin Panel > Email Settings" -ForegroundColor White
        Write-Host "  4. Click 'Test Email' button" -ForegroundColor White
        Write-Host ""
    } elseif ($errorResponse) {
        Write-Host "ERROR: HTTP $($errorResponse.StatusCode)" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    } else {
        Write-Host "ERROR:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host ""
