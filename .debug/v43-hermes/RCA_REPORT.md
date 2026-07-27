# RCA_REPORT — Build 29646921463 (and 29644823132)

## Summary
Hermes precompiler rejected the production JS bundle at byte offset 118528:57. The rejected expression is `@supabase/supabase-js@2.106.1`'s ESM-only OTEL shim, which uses verbatim comments inside a dynamic `import()` argument. Hermes's argument-expr parser cannot recover after the comments and emits `error: Invalid expression encountered`.

## 5 Whys
1. **Why did the build fail?** Hermes precompile exited with code 2.
2. **Why did Hermes fail?** Parser rejected an `import(...)` expression at byte `118528:57` with `Invalid expression encountered`.
3. **Why is that expression unparseable?** It carries three comment annotations (`/* webpackIgnore */ /* turbopackIgnore */ /* @vite-ignore */`) directly in front of the argument identifier `OTEL_PKG`. Hermes's precompiled-grammar dynamic-import parsing requires the argument to be a single CallExpression-ready expression and does not skip whitespace/comments preceding the inner value.
4. **Why is supabase-js producing that expression in our bundle?** `@supabase/supabase-js@2.106.1`'s ESM entrypoint (`dist/index.mjs`, line 71) contains a vendored OTEL shim that conditionally dynamically imports `@opentelemetry/api`. Metro selects the ESM entry (`exports["."].import.default`) per the package's `exports` map.
5. **Why is Hermes on this version so strict compared to the upstream?** Hermes implements an embedded JSVM that intentionally trails the JS spec for bundle size. RN 0.79.5 ships its bundled `hermesc@…` with this limitation. The library authors assume bundle-side strips (e.g., Babel removing webpack-only hints) — but Hermes receives the bundle **after** Metro/Babel has rewritten the pre-call form; only the call-site comments remain to confuse Hermes.

## Causal Chain
```
@supabase/supabase-js 2.106.1 published
   └─ dist/index.mjs:71 "import(/* webpackIgnore */ /* turbopackIgnore */ /* @vite-ignore */ OTEL_PKG)"
        ↓
Metro selects ESM entry via package.exports (resolved at 79.9% of mobile bundle, line 118528)
        ↓
Hermes precompiler parses → Cannot parse dynamic-import's argument expression
        ↓
error: Invalid expression encountered
        ↓
:app:createBundleReleaseJsAndAssets FAILED
        ↓
gradle bundleRelease exits 1
```

## Timeline
- 13:52:24 — gradle daemon forks
- 13:53:27–13:54:18 — expo plugin chain compiled (clean, no warnings of interest)
- 13:55:33 — `> Task :app:createBundleReleaseJsAndAssets` started
- 13:55:52 — Metro completes: `Writing bundle output to: …/index.***.bundle`
- 13:55:56 — hermesc fails on the OTEL line (4s compile window)
- 13:55:56 — gradle reports `BUILD FAILED in 3m 34s`

## Validation of Fix
Locally reproduced the same failure on `linux64-bin/hermesc 0.79.5`:

| Bundle | hermesc exit | Notes |
|---|---|---|
| Original unminified bundle (8.7 MB) | **2** | `118528:57 error: Invalid expression encountered` |
| Same bundle with the single import line replaced by `Promise.resolve(OTEL_PKG).then((s)=>require(s))` | **0** | success; warnings only (`localStorage`, `setTimeout`, …) |

The fix changes the bundler entrypoint for `@supabase/supabase-js` from the ESM build to the CommonJS build, which has a Hermes-safe equivalent (`Promise.resolve(OTEL_PKG).then(s => require(s))` → `Promise.resolve("@opentelemetry/api").then(s => tslib_1.__importStar(require(s)))`).

## Affected Code & Documents
- `mobile/metro.config.js` — patched to force CJS resolution for `@supabase/supabase-js`.
- Previously committed patches (`aa71fc9`, `38c5929`) to Gradle DRM, Sonatype init, signing: **all correct**; not implicated in the failure.

## Commit
- `fcf9d2e` — `fix(v43): force @supabase/supabase-js to CJS entry to bypass Hermes-incompatible dynamic import (loadOtel ESM shim)`.
