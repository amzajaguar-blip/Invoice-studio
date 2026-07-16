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

    drm_block = '''

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri('https://www.jitpack.io') }
    }
}
'''
    # Insert the DRM block as a top-level block, just BEFORE the first
    # `rootProject.name = ...` line. Gradle 8.13 requires pluginManagement {}
    # to be the first statement; inserting before rootProject.name keeps it
    # first while placing DRM as a valid sibling (never nested inside
    # pluginManagement). We match the line, not braces, to avoid the
    # [^}]* pitfall where the regex stops at the inner repositories {} close.
    root_project_match = re.search(r'^\s*rootProject\.name\s*=', content, re.MULTILINE)

    if root_project_match and drm_block.strip() not in content:
        insert_pos = root_project_match.start()
        content = content[:insert_pos] + drm_block + content[insert_pos:]
        write(path, content)
        print(f'✅ Added dependencyResolutionManagement before rootProject.name in {path}')
    elif drm_block.strip() in content:
        print(f'ℹ️ dependencyResolutionManagement already present in {path}')
    else:
        # Fallback: prepend if neither is found
        if drm_block.strip() not in content.strip():
            content = drm_block + content
            write(path, content)
            print(f'✅ Prepended dependencyResolutionManagement to {path}')
        else:
            print(f'ℹ️ dependencyResolutionManagement already prepended to {path}')


def main():
    build_gradle = sys.argv[1] if len(sys.argv) > 1 else 'android/build.gradle'
    settings_gradle = sys.argv[2] if len(sys.argv) > 2 else 'android/settings.gradle'

    patch_build_gradle(build_gradle)
    patch_settings_gradle(settings_gradle)


if __name__ == '__main__':
    main()
