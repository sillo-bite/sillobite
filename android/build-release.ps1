# Build Release APK - Quick Script
# This script builds a signed release APK with proper configuration

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Canteen Owner Helper - Release Build" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if keystore exists
$keystorePath = ".\app\release-keystore.jks"
if (-Not (Test-Path $keystorePath)) {
    Write-Host "❌ Keystore not found: $keystorePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create a keystore first using one of these methods:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Method 1: Android Studio" -ForegroundColor White
    Write-Host "  Build → Generate Signed Bundle / APK → Create new keystore" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Method 2: Command Line" -ForegroundColor White
    Write-Host '  keytool -genkeypair -v `' -ForegroundColor Gray
    Write-Host '    -keystore app\release-keystore.jks `' -ForegroundColor Gray
    Write-Host '    -alias canteen-owner-helper `' -ForegroundColor Gray
    Write-Host '    -keyalg RSA -keysize 2048 -validity 10000' -ForegroundColor Gray
    Write-Host ""
    Write-Host "See RELEASE_BUILD_GUIDE.md for detailed instructions" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Keystore found: $keystorePath" -ForegroundColor Green
Write-Host ""

# Check if gradle.properties has signing config
$gradlePropsPath = ".\gradle.properties"
$gradleProps = Get-Content $gradlePropsPath -Raw
if (-Not ($gradleProps -match "RELEASE_STORE_FILE")) {
    Write-Host "⚠️  Signing credentials not configured in gradle.properties" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please configure ONE of these options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Edit gradle.properties and uncomment/fill signing config" -ForegroundColor White
    Write-Host "Option 2: Set environment variables:" -ForegroundColor White
    Write-Host '  $env:RELEASE_STORE_FILE="release-keystore.jks"' -ForegroundColor Gray
    Write-Host '  $env:RELEASE_STORE_PASSWORD="your_password"' -ForegroundColor Gray
    Write-Host '  $env:RELEASE_KEY_ALIAS="canteen-owner-helper"' -ForegroundColor Gray
    Write-Host '  $env:RELEASE_KEY_PASSWORD="your_password"' -ForegroundColor Gray
    Write-Host ""
    
    # Check environment variables
    if ($env:RELEASE_STORE_FILE -and $env:RELEASE_STORE_PASSWORD) {
        Write-Host "✅ Environment variables detected, proceeding..." -ForegroundColor Green
    } else {
        Write-Host "❌ No signing credentials found" -ForegroundColor Red
        exit 1
    }
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Starting Release Build..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if gradlew exists
if (-Not (Test-Path ".\gradlew.bat")) {
    Write-Host "❌ gradlew.bat not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please build from Android Studio instead:" -ForegroundColor Yellow
    Write-Host "  Build → Generate Signed Bundle / APK" -ForegroundColor Gray
    exit 1
}

# Clean build
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
.\gradlew.bat clean

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Clean failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Clean successful" -ForegroundColor Green
Write-Host ""

# Build release APK
Write-Host "🔨 Building release APK..." -ForegroundColor Yellow
.\gradlew.bat assembleRelease

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Check signing credentials are correct" -ForegroundColor Gray
    Write-Host "  - Check ProGuard rules if obfuscation errors occur" -ForegroundColor Gray
    Write-Host "  - Try building from Android Studio for better error messages" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  ✅ Build Successful!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Show APK location
$apkPath = ".\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "📦 APK Location:" -ForegroundColor Cyan
    Write-Host "   $apkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 APK Size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    
    # Show mapping file location
    $mappingPath = ".\app\build\outputs\mapping\release\mapping.txt"
    if (Test-Path $mappingPath) {
        Write-Host "🗺️  ProGuard Mapping:" -ForegroundColor Cyan
        Write-Host "   $mappingPath" -ForegroundColor White
        Write-Host "   (Save this for crash report deobfuscation)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "  Next Steps:" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Test the APK on a device:" -ForegroundColor Yellow
    Write-Host "   adb install $apkPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Verify all features work correctly" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3. Distribute or upload to Google Play Store" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "See RELEASE_BUILD_GUIDE.md for detailed testing checklist" -ForegroundColor Cyan
    
} else {
    Write-Host "⚠️  APK not found at expected location" -ForegroundColor Yellow
    Write-Host "   Check: .\app\build\outputs\apk\release\" -ForegroundColor Gray
}

Write-Host ""
