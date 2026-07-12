#!/bin/bash
set -e

echo "============================================"
echo "  🚀 VELA - Build Release AAB"
echo "============================================"
echo ""

MOBILE_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYSTORE_DIR="$MOBILE_DIR/android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/release.keystore"
KS_PASSWORD="InvoiceStudio2026!"
KS_ALIAS="release"

# ── Step 1: Genera il keystore di release (se non esiste) ─────────────
if [ -f "$KEYSTORE_FILE" ]; then
  echo "✅ Keystore di release già presente: $KEYSTORE_FILE"
else
  echo "🔑 Creo il keystore di release..."
  keytool -genkey -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KS_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KS_PASSWORD" \
    -keypass "$KS_PASSWORD" \
    -dname "CN=Invoice Studio, OU=Mobile, O=Invoice Studio, L=Rome, ST=Lazio, C=IT"
  echo "✅ Keystore creato!"
fi

# ── Step 2: Installa dipendenze npm (se mancano) ─────────────────────
if [ ! -d "$MOBILE_DIR/node_modules" ]; then
  echo "📦 Installo dipendenze npm..."
  cd "$MOBILE_DIR"
  npm install
fi

# ── Step 3: Esporta variabili d'ambiente per la firma ─────────────────
export ANDROID_KEYSTORE_PATH="release.keystore"
export ANDROID_KEYSTORE_PASSWORD="$KS_PASSWORD"
export ANDROID_KEY_ALIAS="$KS_ALIAS"
export ANDROID_KEY_PASSWORD="$KS_PASSWORD"

# ── Step 4: Pulisci e compila il bundle release (.aab) ────────────────
echo ""
echo "🏗️  Avvio build Android release (AAB)..."
echo "   Potrebbe impiegare 5-15 minuti..."
echo ""

cd "$MOBILE_DIR/android"
./gradlew clean
./gradlew bundleRelease

# ── Step 5: Verifica output ───────────────────────────────────────────
AAB_FILE="$MOBILE_DIR/android/app/build/outputs/bundle/release/app-release.aab"

echo ""
echo "============================================"
if [ -f "$AAB_FILE" ]; then
  SIZE=$(du -h "$AAB_FILE" | cut -f1)
  echo "  ✅ BUILD RIUSCITA!"
  echo ""
  echo "  📦 File AAB pronto per il Play Store:"
  echo "     $AAB_FILE"
  echo "     Dimensione: $SIZE"
  echo ""
  echo "  📋 Prossimi passi:"
  echo "     1. Vai su https://play.google.com/console"
  echo "     2. Seleziona VELA"
  echo "     3. Produzione → Crea nuova release"
  echo "     4. Carica il file .aab"
  echo ""
  echo "  🔑 IMPORTANTE: Conserva il keystore!"
  echo "     $KEYSTORE_FILE"
  echo "     Password: $KS_PASSWORD"
  echo "     Alias: $KS_ALIAS"
  echo "     ⚠️  Se perdi il keystore non potrai più"
  echo "        aggiornare l'app sul Play Store!"
else
  echo "  ❌ BUILD FALLITA"
  echo "  Controlla gli errori sopra."
fi
echo "============================================"
