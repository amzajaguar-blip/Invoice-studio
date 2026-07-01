#!/usr/bin/env python3
"""Patch android/build.gradle to replace allprojects repositories with stable repos only."""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'android/build.gradle'

with open(path, 'r') as f:
    content = f.read()

content = re.sub(
    r'allprojects\s*\{\s*repositories\s*\{[^}]*\}\s*\}',
    '''allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url = uri('https://www.jitpack.io') }
    }
}''',
    content,
    flags=re.DOTALL
)

with open(path, 'w') as f:
    f.write(content)

print('repos patched')
