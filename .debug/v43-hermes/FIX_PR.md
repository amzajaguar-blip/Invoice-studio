# FIX_PR — v43 CI Hermes precompile

## Title
fix(v43): force @supabase/supabase-js to CJS entry to bypass Hermes-incompatible dynamic import

## Description
Both v43 CI runs (`29646921463`, `29644823132`) failed at `:app:createBundleReleaseJsAndAssets` with:

```
.../index.bundle:118528:57: error: Invalid expression encountered
> Process '.../react-native/sdks/hermesc/linux64-bin/hermesc' finished with non-zero exit value 2
```

The bundle line causing the failure is the OTEL dynamic-import shim from
`@supabase/supabase-js@2.106.1/dist/index.mjs:71`:

```js
otelModulePromise = import(
  /* webpackIgnore: true */
  /* turbopackIgnore: true */
  /* @vite-ignore */ OTEL_PKG
).catch(() => null);
```

Hermes (RN 0.79.5) refuses to parse a dynamic-import argument expression
when it is preceded by comment annotations — `Invalid expression encountered`
at byte `118528:57`.

The same package ships a CommonJS entry, `dist/index.cjs:624-628`, that uses
`Promise.resolve(OTEL_PKG).then(s => require(s))` — Hermes-safe.

The patch forces Metro to resolve `@supabase/supabase-js` to the CJS entry
via `metro.config.js`'s `resolver.resolveRequest` allowlist.

## Reproduction (one command)
```sh
cd mobile
npx expo export:embed --platform android --dev false --minify true \
  --bundle-output /tmp/b.bundle --assets-dest /tmp/a --reset-cache
./node_modules/react-native/sdks/hermesc/linux64-bin/hermesc \
  -emit-binary -O -o /tmp/b.hbc /tmp/b.bundle
echo "EXIT=$?"  # before patch: 2; after patch: 0
```

## Validation checklist
- [x] `hermesc` exits 0 on locally-bundled production output
- [x] bundle no longer contains `import(/* webpackIgnore` at any offset
- [x] no change to `package.json` (no new deps)
- [x] no change to Gradle DRM, signing, or init scripts (those are not implicated)

## Regression test
Add to `mobile/package.json` scripts:
```json
"scripts": {
  ...
  "verify:hermes": "expo export:embed --platform android --dev false --minify true --bundle-output /tmp/hermes-test.bundle --assets-dest /tmp/hermes-assets --reset-cache && ./node_modules/react-native/sdks/hermesc/linux64-bin/hermesc -emit-binary -O -o /tmp/hermes-test.hbc /tmp/hermes-test.bundle"
}
```
Run on every CI build before invoking `./gradlew bundleRelease`.

## Rollback plan
Revert commit `fcf9d2e`; the failure mode reverts but is non-destructive
(no published artifact).
