# DEBUGGING_RUNBOOK — React Native 0.79.x Hermes precompile failure

## Symptom
Build fails at `:app:createBundleReleaseJsAndAssets` with:
```
index.bundle:NNN:CC: error: Invalid expression encountered
> Process 'command '.../react-native/sdks/hermesc/<host>-bin/hermesc'' finished with non-zero exit value 2
```
`BUILD FAILED` follows a successful Metro bundle and a clean Gradle config phase.

## Triage checklist
1. Run `./gradlew :app:createBundleReleaseJsAndAssets --stacktrace --info` to read the real bundle path & offset (GitHub Actions log may redact `***`/`***` for privacy).
2. Run a **local** bundle: `npx expo export:embed --platform android --dev false --minify true -o bundle-test.bundle --assets-dest /tmp/assets --reset-cache`.
3. Run `node_modules/react-native/sdks/hermesc/linux64-bin/hermesc -emit-binary -Obundle-test.hbc bundle-test.bundle`. Match CI offset to confirm reproduction.
4. Open the bundle at the offset:
   ```bash
   sed -n 'NNN±2p' bundle-test.bundle
   ```
5. Look for an `import(/* webpackIgnore */…)` line near the error.

## Likely root causes (in order)
1. A dependency with `import(…webpackIgnore…turbopackIgnore…@vite-ignore…)`-formatted dynamic imports (Hermes rejects).
2. A dependency using `assert { type: 'json' }` or syntax that postdates Hermes's grammar (RN 0.79 Hermes).
3. A source-side regex / template literal that escaped Babel as malformed.

## How to fix
### Option A (preferred for 0.79.x): force CommonJS resolution in Metro
`mobile/metro.config.js`:
```js
const supabaseCjsPath = path.join(
  projectRoot,
  "node_modules",
  "@supabase",
  "supabase-js",
  "dist",
  "index.cjs"
);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@supabase/supabase-js" || moduleName === "@supabase/supabase-js/") {
    return { filePath: supabaseCjsPath, type: "sourceFile" };
  }
  // ... existing logic
};
```
This bypasses the offending ESM entry. Confirmed; documented in commit `fcf9d2e` of Invoice-studio.

### Option B: patch the offending .mjs file (less durable)
Add `postinstall` script:
```js
// scripts/patch-supabase-otel.cjs
const fs = require("fs");
const path = require("path");
const target = path.join(__dirname, "..", "node_modules", "@supabase", "supabase-js", "dist", "index.mjs");
let s = fs.readFileSync(target, "utf8");
const bad = 'import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */OTEL_PKG)';
const good = 'require(OTEL_PKG)';
if (s.includes(bad)) { fs.writeFileSync(target, s.replace(bad, good)); console.log("patched"); }
```
Run via `postinstall` hook. Fragile across versions.

### Option C: precompile with hermesc-cli offline + ignore error (NOT recommended)
Hermes will not run with that bundle; no release will succeed.

## Verification (mandatory)
```sh
cd mobile
npx expo export:embed --platform android --dev false --minify true \
  --bundle-output /tmp/bundle-test.bundle --assets-dest /tmp/a --reset-cache
./node_modules/react-native/sdks/hermesc/linux64-bin/hermesc \
  -emit-binary -O -out=/tmp/bundle-test.hbc /tmp/bundle-test.bundle
echo "EXIT=$?"          # expect 0
grep "Invalid expression" /dev/null  # expect empty
```

## Prevention
- Lock `@supabase/supabase-js` to a Hermes-safe release (track upstream once pinned).
- Add CI pre-check: hermesc dry-compile of dev bundle before invoking `./gradlew bundleRelease`.
- Audit weekly: `mobile/node_modules/@*/*/dist/**/*.mjs` for `turbopackIgnore|webpackIgnore|@vite-ignore`.
