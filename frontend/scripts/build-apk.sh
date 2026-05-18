#!/bin/bash
# ============================================================================
# InvoiceStudio — Local TWA APK Builder
# Builds a Trusted Web Activity APK for local testing on Android devices.
#
# Prerequisites:
#   - Node.js 20+
#   - Java JDK 17+
#   - Android SDK (or just the command line tools)
#
# Usage:
#   chmod +x scripts/build-apk.sh
#   ./scripts/build-apk.sh
#
# Output:
#   twa/app/build/outputs/apk/debug/app-debug.apk
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TWA_DIR="$PROJECT_DIR/twa"

echo "🔨 InvoiceStudio TWA APK Builder"
echo "================================="

# ─── Check prerequisites ─────────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install: https://nodejs.org"; exit 1; }
command -v java >/dev/null 2>&1 || { echo "❌ Java JDK 17+ required. Install: sudo apt install openjdk-17-jdk"; exit 1; }

echo "✅ Node.js $(node -v)"
echo "✅ Java $(java -version 2>&1 | head -1)"

# ─── Install bubblewrap ──────────────────────────────────────────────────────

if ! command -v bubblewrap >/dev/null 2>&1; then
  echo ""
  echo "📦 Installing @bubblewrap/cli..."
  npm install -g @bubblewrap/cli
fi

echo "✅ bubblewrap $(bubblewrap --version 2>/dev/null || echo 'installed')"

# ─── Initialize TWA project ──────────────────────────────────────────────────

echo ""
echo "📁 Setting up TWA project..."

if [ ! -d "$TWA_DIR" ]; then
  mkdir -p "$TWA_DIR"
  cd "$TWA_DIR"

  # Initialize with bubblewrap
  bubblewrap init \
    --manifest "https://invoicestudio.app/manifest.json" \
    --directory . \
    --package-name com.invoicestudio.app \
    --name "InvoiceStudio" \
    --short-name "InvoiceStudio" \
    --display "standalone" \
    --theme-color "#0a0b0f" \
    --background-color "#0a0b0f" \
    --start-url "/dashboard" \
    || echo "⚠️  bubblewrap init had warnings — continuing..."
fi

cd "$TWA_DIR"

# ─── Generate debug keystore (if not exists) ─────────────────────────────────

KEYSTORE="$TWA_DIR/debug.keystore"
KEYSTORE_PASS="android"
KEY_ALIAS="invoicestudio"

if [ ! -f "$KEYSTORE" ]; then
  echo ""
  echo "🔑 Generating debug keystore..."
  keytool -genkey -v \
    -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASS" \
    -keypass "$KEYSTORE_PASS" \
    -dname "CN=InvoiceStudio, OU=Dev, O=InvoiceStudio, L=Milan, ST=Italy, C=IT"
fi

echo "✅ Keystore ready"

# ─── Copy Digital Asset Links ────────────────────────────────────────────────

echo ""
echo "📋 Copying assetlinks.json..."
ASSETS_DIR="$TWA_DIR/app/src/main/assets"
mkdir -p "$ASSETS_DIR"
cmp -s "$PROJECT_DIR/public/.well-known/assetlinks.json" "$ASSETS_DIR/assetlinks.json" 2>/dev/null || \
  cp "$PROJECT_DIR/public/.well-known/assetlinks.json" "$ASSETS_DIR/assetlinks.json"

echo "✅ assetlinks.json in place"

# ─── Build APK ───────────────────────────────────────────────────────────────

echo ""
echo "🏗️  Building APK..."

./gradlew assembleDebug --no-daemon

APK_PATH="$TWA_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "================================================"
  echo " ✅ APK built successfully!"
  echo ""
  echo " 📱 APK path:  twa/app/build/outputs/apk/debug/app-debug.apk"
  echo " 📦 Size:      $APK_SIZE"
  echo ""
  echo " 🚀 To install on your device:"
  echo "    adb install $APK_PATH"
  echo ""
  echo " ⚠️  This is a DEBUG build — for testing only."
  echo "    For Play Store, use AAB with release signing."
  echo "================================================"
else
  echo "❌ APK build failed"
  exit 1
fi
