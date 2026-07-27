# POST_MORTEM — v43 CI Hermes precompile failure

## Blameless summary
Two CI runs (29646921463, 29644823132) failed at `:app:createBundleReleaseJsAndAssets` because the bundle emitted by Metro contained a dynamic `import()` whose argument was preceded by three bundler-hint comments. Hermes 0.79.5's precompiler rejects this with `Invalid expression encountered`. The pattern originated inside `@supabase/supabase-js@2.106.1`'s ESM build (`dist/index.mjs:71`), which Metro selected over the package's CommonJS build via the package's own `exports` map.

## Detection & impact
- Detected by GitHub Actions CI directly (no production code shipped).
- 0 builds pushed to Play Store; 0 customer impact.
- Detection time: same moment as breakage (synchronous, in-job).
- Time to remediation: ~3 CI iterations for previous layer's bugs + this 1 fix.

## Systemic analysis
- This is **not** a unique failure — it is **a class**: any dependency that emits dynamic `import()` with comment hints will trip Hermes 0.79 in the same way. Likely future offenders: tracing/OTEL SDKs, lazy-loaders, Sentry bundles, anything using rollup-friendly `turbopackIgnore` markers.
- `metro.config.js` was the only place we could intercept post-package-resolution. We should add a generic guard.

## Library concern
OTEL_PKG machinery in `@supabase/supabase-js` 2.106.1 is now widely deployed. Hermes-pinned React Native apps will trip on this. Tracked as community issue; pinned behaviour is intentional at the moment.

## Action items
| # | Owner | Item | Deadline |
|---|---|---|---|
| 1 | CI maintainer | Verify v44 build green after `fcf9d2e` lands; ensure `node_modules/@supabase/supabase-js` resolves `dist/index.cjs` in Metro | immediate |
| 2 | Mobile lead | Investigate upstreaming a Hermes-safe pin in `@supabase/supabase-js` (single-issue TBD) | next sprint |
| 3 | CI maintainer | Add a pre-check in `build-aab.yml` that runs `hermesc` on the dev bundle locally if `RN 0.79.x` — fail fast, mask path redaction by adding `--warning-mode all` or redirecting to `$GITHUB_STEP_SUMMARY` | next 1 PR |
| 4 | Mobile lead | Document `mobile/metro.config.js` `resolveRequest` allowlist as a system invariant; add ESLint rule to forbid dynamic `import(` in `mobile/` | before v45 |

## Prevention
- **List-repo compliance**: every new dep entering `mobile/` must be validated against Metro+hermes target matrix.
- **CI guardrail**: before `./gradlew bundleRelease`, run a hermesc dry-compile on `expo export:embed` output in dev mode. If it fails, fail the job with a clear actionable line.
- **Audit**: grep `mobile/node_modules/@*/dist/**/*.mjs` for `import(.*webpackIgnore.*turbopackIgnore.*vite-ignore` and pin offending versions.

## Knowledge entry
Stored in bug database: symptom=hermes precompile fail, cause=esm dist of supabase emits `import(/* webpackIgnore */…)`, fix=force CJS via Metro resolver.
