#!/usr/bin/env python3
import re
import sys

gradle_path = 'mobile/android/app/build.gradle'
with open(gradle_path, 'r') as f:
    content = f.read()

# Pattern to find signingConfigs block
# We'll replace the signingConfigs block with a new one that includes release
# Simpler: insert release block after the closing brace of debug but before the closing brace of signingConfigs
# Use regex to capture the content inside signingConfigs
pattern = r'(signingConfigs\s*\{\s*[^}]*?debug\s*\{[^}]*?\}[^}]*?)\}'
# We'll do a more straightforward approach: find the line after debug's closing brace and before the closing brace of signingConfigs
# Let's just replace the whole signingConfigs block with a new one.
new_signing_configs = '''signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def ksPath = System.getenv("ANDROID_KEYSTORE_PATH") ?: "debug.keystore"
            def ksPass = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "android"
            def kAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "invoicestudio"
            def kPass  = System.getenv("ANDROID_KEY_PASSWORD") ?: "android"
            storeFile file(ksPath)
            storePassword ksPass
            keyAlias kAlias
            keyPassword kPass
        }
    }'''

# Replace the existing signingConfigs block
# Use regex that matches from 'signingConfigs {' to the next '}' that is at same indentation level (i.e., before a newline with less indentation)
# We'll do a simple approach: replace using a known pattern.
# Since we know the exact existing content, we can do string replace.
old_signing_configs = '''signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }'''
if old_signing_configs in content:
    content = content.replace(old_signing_configs, new_signing_configs)
else:
    # Fallback to regex
    # Match signingConfigs { ... } non-greedy until we see a line that starts with whitespace less than the opening?
    # We'll just do a regex that captures everything between signingConfigs { and the next } that is on its own line with same indent.
    # For simplicity, assume the file is as we saw.
    pass

# Now change release buildType to use signingConfigs.release
# Find the line: signingConfig signingConfigs.debug inside release {
# Replace with signingConfig signingConfigs.release
content = re.sub(r'(release\s*\{[^}]*?signingConfig\s+)signingConfigs\.debug', r'\1signingConfigs.release', content, flags=re.DOTALL)

with open(gradle_path, 'w') as f:
    f.write(content)

print('Updated build.gradle with release signing config and updated release buildType')