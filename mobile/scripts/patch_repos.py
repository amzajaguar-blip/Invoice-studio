#!/usr/bin/env python3
"""Patch Android Gradle files to remove Sonatype snapshots and stabilize repositories."""
import re
import sys

SONATYPE = 'oss.sonatype.org/content/repositories/snapshots'


def read(path):
    with open(path) as f:
        return f.read()


def write(path, content):
    with open(path, 'w') as f:
        f.write(content)


def remove_sonatype_repos(content):
    """Remove maven blocks that reference Sonatype snapshots (single- or multi-line)."""
    content = re.sub(
        r"maven\s*\{\s*url\s*=?\s*['\"]https?://oss\.sonatype\.org/content/repositories/snapshots/?['\"]\s*\}\n?",
        '',
        content,
        flags=re.IGNORECASE,
    )
    content = re.sub(
        r"maven\s*\{\s*\n\s*url\s*=?\s*['\"]https?://oss\.sonatype\.org/content/repositories/snapshots/?['\"]\s*\n\s*\}\n?",
        '',
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return content


def patch_build_gradle(path):
    content = read(path)
    content = remove_sonatype_repos(content)
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
        flags=re.DOTALL,
    )
    write(path, content)
    print(f'✅ Patched allprojects repositories in {path}')


def patch_settings_gradle(path):
    content = read(path)
    content = remove_sonatype_repos(content)

    if 'dependencyResolutionManagement' not in content:
        content = '''dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri('https://www.jitpack.io') }
    }
}

''' + content
        write(path, content)
        print(f'✅ Added dependencyResolutionManagement to {path}')
    else:
        print(f'�️  dependencyResolutionManagement already present in {path}')


def main():
    build_gradle = sys.argv[1] if len(sys.argv) > 1 else 'android/build.gradle'
    settings_gradle = sys.argv[2] if len(sys.argv) > 2 else 'android/settings.gradle'

    patch_build_gradle(build_gradle)
    patch_settings_gradle(settings_gradle)


if __name__ == '__main__':
    main()
