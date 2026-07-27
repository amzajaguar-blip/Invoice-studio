# INCIDENT_TRIAGE — v43 build 29646921463

## Severity
**P1** — release CI block; AAB cannot be produced; Play Store submission blocked.

## Symptom
```
> Task :app:createBundleReleaseJsAndAssets FAILED
/home/runner/work/Invoice-studio/.../index.***.bundle:118528:57: error: Invalid expression encountered
> Process 'command '.../react-native/sdks/hermesc/linux64-bin/hermesc'' finished with non-zero exit value 2
BUILD FAILED in 3m 34s
```

Resource murmur: 29 actionable tasks ran, but Gradle config / Maven resolution / Sonatype init / R8 / keystore / DRM — all succeed. Failure happens **only** in the JavaScript bundle precompile step, ~80 seconds after Metro finishes writing `index.bundle`.

## Reproducibility
- **Always** on GitHub-hosted `ubuntu-latest` + JDK 17 + Gradle 8.13 + Hermes precompiler reused in RN 0.79.5.
- **Deterministic** with no environment dependence — also reproduced locally on `linux64-bin/hermesc` (0.79.5).

## Isolation
| Suspect | Evidence | Verdict |
|---|---|---|
| Gradle/DRM/Sonatype | `[9_Patch repositories …]`, `[10_Inject init.d]`, all `:expo-gradle-plugin:*` and `:gradle-plugin:*` tasks completed cleanly. | ruled out |
| `patch_repos.py` / DRM injection | Both fixes `aa71fc9`+`38c5929` in place; gradle assembled dependencies without timeout/failure. | ruled out |
| `patch_build_gradle.py` / signing | Keystore decode + signing config wiring executed after Maven; no error before bundle task. | ruled out |
| `proguard-rules.pro` | R8 runs on a successful AAB assembly → not reached. | ruled out |
| Scope of Hermes precompile | Only one error line, two consecutive failures with identical byte offset (`118528:57`). | **THIS IS THE FAULT** |

## Hypothesis (validated)
The bundle emitted at `118528:57` contains the expression
```js
if (otelModulePromise === null) otelModulePromise = import(
   /* webpackIgnore: true */
   /* turbopackIgnore: true */
   /* @vite-ignore */ OTEL_PKG
).catch(() => null);
```
Hermes (the JSVM hard-built into RN 0.79.5) implements dynamic `import()` using its own non-standard grammar. The tripled comment block preceding the call argument **trips its argument parser**, producing `error: Invalid expression encountered`.

**Origin of the bundle line:** `node_modules/@supabase/supabase-js@2.106.1/dist/index.mjs:71` — a Sentry/OTEL interop shim that the ESM build wires verbatim, with bundler-specific hints (`/* webpackIgnore */`, `/* turbopackIgnore */`, `/* @vite-ignore */`) that Metro/Babel sweeps but Hermes's downstream parser does not tolerate.

The CommonJS build (`dist/index.cjs:624-628`) uses **`Promise.resolve(OTEL_PKG).then(s => require(s))`** — Hermes-safe.

## Initial hypotheses (all ruled out before fix)
1. SDK upgrade (Expo 52→53, RN 0.76→0.79) broke Metro/Hermes config — *no*, default Expo SDK 53 pipelines are healthy; Hermes is RN-version-pinned and predates this build.
2. A regex/JSX quirk in `ProUpgrade.tsx` or context — *no*, the offending line is in a vendored library file, not our source.
3. Stale Metro cache poisoning — *no*, the line appears identically with `--reset-cache`.

## Owner
Forensic-debugger session → shipped fix in commit `fcf9d2e`.

## Evidence
- Local reproduction bundle: `/tmp/bundle-repro/index.dev.bundle` (8.7 MB unminified).
- Hermes precompile on original: `EXIT=2`, error at `118528:57`.
- Hermes precompile on substituted bundle: `EXIT=0`.
