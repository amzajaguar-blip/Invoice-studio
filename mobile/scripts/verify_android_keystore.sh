#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA1="${EXPECTED_UPLOAD_SHA1:-90:F1:18:35:82:7F:1C:5E:C5:5C:07:B8:D3:1B:27:D1:30:7C:75:24}"
KEYSTORE_PATH="${ANDROID_KEYSTORE_PATH:-android/app/release.keystore}"
KEYSTORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$KEYSTORE_PASSWORD}"

if [ -z "$KEYSTORE_PASSWORD" ]; then
  echo "ANDROID_KEYSTORE_PASSWORD mancante." >&2
  exit 1
fi

if [ -z "$KEY_ALIAS" ]; then
  echo "ANDROID_KEY_ALIAS mancante." >&2
  exit 1
fi

if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "Keystore non trovata: $KEYSTORE_PATH" >&2
  exit 1
fi

ACTUAL_SHA1="$(
  keytool -list -v \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" 2>/dev/null \
    | awk -F'SHA1: ' '/SHA1:/ {print $2; exit}'
)"

if [ -z "$ACTUAL_SHA1" ]; then
  echo "Impossibile leggere SHA1 dalla keystore." >&2
  exit 1
fi

if [ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]; then
  echo "SHA1 keystore errato." >&2
  echo "Atteso: $EXPECTED_SHA1" >&2
  echo "Trovato: $ACTUAL_SHA1" >&2
  exit 1
fi

echo "Keystore verificata: $ACTUAL_SHA1"
