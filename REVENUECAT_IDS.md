# RevenueCat & Google Play — Configuration

> Last synced: 2026-07-25 (commit `0ac8813` on `main`). Keep this file
> consistent with `mobile/app/(app)/ProUpgrade.tsx` (`PRODUCT_IDS`) and the
> Google Play Console subscription product IDs.

## Project

| Item | Value |
|---|---|
| Package name (Android, Play Store) | `com.Invoice_Studio.myapp` |
| App display name | `Milo Office` (was `VELA — Invoice & Quotes`; renamed via commit `0ac8813`) |
| Entitlement identifier | `pro` |
| Offering identifier | `default` |
| RevenueCat public API key (Android) | `goog_jQbcLtPLxDFDpSxwHblTiWwaDhw` |
| RevenueCat public API key (iOS) | `appl_YOUR_IOS_KEY_HERE` (placeholder; not shipped) |

## Subscription product IDs (Google Play ↔ RevenueCat)

Use these IDs **exactly** when creating the subscription on Google Play
Console *and* when mapping them to Products inside the RevenueCat project.

| Product ID (Play + RC) | Type | Price | Notes |
|---|---|---|---|
| `vela.premium.monthly` | Monthly subscription | 4,99 € / month | Identified on the client via `startsWith('vela.premium.monthly')` to allow any qualified base‑plan suffix. |
| `vela_premium_yearly` | Annual subscription | 39,99 € / year (per project plan definition) | On RC the qualified base plan is `vela_premium_yearly:vela-premium-yearly-base`. Matched client‑side with `startsWith('vela_premium_yearly')`. |

### Why `startsWith()` instead of `===`

RevenueCat/Google Play can return qualified base‑plan identifiers of the form
`vela_premium_yearly:vela-premium-yearly-base`. The exact string returned by
`pkg.product.identifier` may or may not include the `:basePlanId` suffix
depending on whether the offering is split into multiple base plans.
`startsWith()` makes the matching robust to either form without inflating
the constants surface area.

### Where these IDs live in code

- `mobile/app/(app)/ProUpgrade.tsx` → constant `PRODUCT_IDS = { monthly: 'vela.premium.monthly', yearly: 'vela_premium_yearly' }`.
- Comparison sites in that file use `p.product.identifier?.startsWith(targetId)`.

## What was fixed and when

- **2026-07-24 — commit `be8f115`:** aligned hardcoded identifiers in
  `ProUpgrade.tsx` with the real Play Console product IDs (`mensile`/`annuale`
  → `vela.premium.monthly`/`vela_premium_yearly`). This is the single most
  important change for the “Acquista Premium” button not opening the
  Google Play Billing sheet.
- **2026-07-25 — commit `dc9660c`:** flipped `expo.useLegacyPackaging` to
  `false` in `mobile/scripts/patch_build_gradle.py` and added
  `android.bundle.enableUncompressedNativeLibs=true` so the AAB is 16 KB
  page aligned (Play Console requirement post‑July 2025).
- **2026-07-25 — commit `4dce193`:** bumped `versionCode` 52 → 53 and
  `versionName` 1.0.52 → 1.0.53.
- **2026-07-25 — commit `0ac8813`:** renamed app to “Milo Office”.

## Known pending items (not blockers for upload)

1. **iOS RevenueCat API key** is still a placeholder (`appl_YOUR_IOS_KEY_HERE`).
   Doesn't affect Android Play Store uploads, but blocks iOS TestFlight.
2. **`mobile/lib/payment-service.ts`** still contains old Stripe SDK code on
   disk (no active imports). Archive it to avoid a future Play Store policy
   rejection similar to the RevenueCat 10.6.0 blocker from v39.
3. **`app.json` `expo.version` field** is still `1.0.52`. Cosmetic only — the
   Play Store reads `android.versionName` (kept in sync via
   `patch_build_gradle.py`).
4. **`app-ads.txt`** now serves `pub-8156953772676654` on
   `https://vela-invoice-frontend.vercel.app/app-ads.txt` (commit `4c33bbe`).
   AdMob re-scan can take up to 24 hours.
