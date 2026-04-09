Write-Host "🚀 Setting up SilloBite Connection Code System..." -ForegroundColor Cyan

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
  Write-Host "❌ DATABASE_URL environment variable is not set" -ForegroundColor Red
  Write-Host "Please set it in your .env file or as an environment variable" -ForegroundColor Yellow
  exit 1
}

Write-Host "📊 Running database migration..." -ForegroundColor Yellow

# Run migration using Node.js (works without psql)
node run-migration.js

if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Database migration completed successfully" -ForegroundColor Green
} else {
  Write-Host "❌ Database migration failed" -ForegroundColor Red
  exit 1
}

Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart the server if it's running"
Write-Host "2. Navigate to Profile page in the app"
Write-Host "3. Look for 'Connect to CareBite' section"
Write-Host "4. Generate a connection code"
Write-Host ""
Write-Host "📖 For API documentation, see CONNECTION_CODE_README.md" -ForegroundColor Cyan
