# ZIZ — RevenueCat / Google Play Block Unblock Plan

> **Classification:** ACTION PLAN (analysis + delegation only — no code changes made by ZIZ)
> **Author:** ZIZ — Sky Architect, Build Factory Pantheon
> **Date:** 2026-07-14
> **Scope:** `/home/locoomo/Scrivania/building factory/saas_app/Invoice-studio` (VELA — Fatture & Preventivi)
> **Status of evidence:** All `file:line` claims below were re-verified by ZIZ directly against the working tree and `git` history on 2026-07-14. Web re-verification of the RevenueCat npm→Android SDK mapping returned 404 (RevenueCat moved the changelog) — that one claim is routed to `forensic-debugger` for definitive confirmation against the actual AAB.

---

## 1. Blocker summary

- **What Play rejected:** Google Play Console refused submission of **versionCode 39** ("VELA — Fatture & Preventivi") with the message:
  > *"La tua app utilizza una versione dell'SDK con una nota critica di RevenueCat — com.revenuecat.purchases:purchases version 10.6.0. This version makes unnecessary API calls. Please update to a more recent version (10.6.2 or newer)."*
- **The bad artifact:** Android native SDK `com.revenuecat.purchases:purchases:10.6.0` (the version with the critical note).
- **90-day clock:** After the submission-for-review, there is a 90-day window to ship a compliant build (Android SDK ≥ 10.6.2) or Play blocks *future* publishes. The clock is already running.
- **Severity:** CRITICAL / release-blocking. This is the only thing currently preventing the app from reaching users.

---

## 2. Root cause (verified by ZIZ)

The npm wrapper version and the Android native SDK version are **decoupled**, and CI makes the npm version deterministic.

| Layer | Evidence (verified) | Value |
|---|---|---|
| npm dependency declared | `mobile/package.json:46` | `"react-native-purchases": "^10.1.2"` |
| npm version resolved in lock | `mobile/package-lock.json:15873-15875` | `node_modules/react-native-purchases` → `react-native-purchases-10.1.2.tgz` |
| CI installs from lock (no float) | `.github/workflows/build-aab.yml:35` | `run: npm ci` |
| CI regenerates native project | `.github/workflows/build-aab.yml:57` | `npx expo prebuild --platform android --no-install --clean` |
| npm 10.1.2 → Android SDK pulled | (transitive) `react-native-purchases@10.1.2/android/build.gradle` depends on `purchases-hybrid-common:18.7.0`, which pulls `com.revenuecat.purchases:purchases:10.6.0` | **THE bad 10.6.0** |

**Why this happened:** `npm ci` (not `npm install`) installs *exactly* what the lockfile pins → the AAB was built with `react-native-purchases` **10.1.2**, whose transitive native dependency is Android SDK **10.6.0** (the flagged version). The Play note is about the *Android native* SDK, not the npm package.

**Why `versionCode` logic matters for the fix (see §6):** `expo prebuild --clean` regenerates the entire `android/` folder from `app.json` on every CI run, so `app.json` `android.versionCode` / `android.package` are the **source of truth** for CI. Anything hand-edited in `mobile/android/app/build.gradle` is overwritten at build time.

**npm → Android SDK mapping (asserted verified in provided evidence; web re-fetch 404'd):**
- `react-native-purchases` 10.2.0 → Android 10.6.1 (**still bad**)
- 10.2.1 → Android 10.7.0 (**good, ≥10.6.2**)
- 10.4.2 (latest in changelog) → Android 10.12.0 (**good**)
- Methods the app calls — `Purchases.configure`, `getCustomerInfo`, `addCustomerInfoUpdateListener`/`removeCustomerInfoUpdateListener`, `getOfferings`, `purchasePackage`, `restorePurchases` — have **no breaking changes across 10.x** (the only 10.x breaking changes, `PRORATION_MODE` enum deprecation @10.1.0 and Billing Library changes @10.0.0, are *below* the current 10.1.2).

---

## 3. Immediate fix path (executor: `@salamandra-forgekeeper`)

> ZIZ writes this; salamandra executes. **Do not float the version** — pin it.

**Step A — Pin the npm version** (`mobile/package.json:46`):
```diff
-    "react-native-purchases": "^10.1.2",
+    "react-native-purchases": "10.2.1",
```
(Use `10.2.1` minimum; `10.4.2` latest is also safe. Do NOT use `^10.1.2` or `^10.2.1` — the caret would re-float and could resolve back to a bad transitive set.)

**Step B — Regenerate the lockfile** (must reflect the pin, since CI uses `npm ci`):
```bash
cd mobile
npm install            # regenerates package-lock.json, pins react-native-purchases 10.2.1
git diff --stat package-lock.json   # confirm the resolved version is now 10.2.1
grep -n '"react-native-purchases"' -A2 package-lock.json | head
```

**Step C — Bump version to 40, aligned in BOTH files** (per memory `android-versioncode-sync`; CI uses `app.json`, but align `build.gradle` for local-build sanity and to kill the existing drift):
- `mobile/app.json:27` → `"versionCode": 40` and bump top-level `"version"` to `"1.0.40"` (drives `versionName`).
- `mobile/android/app/build.gradle:94` → `versionCode 40` and `:95` → `versionName "1.0.40"`.
- ⚠️ Currently `app.json`=39, working-tree `build.gradle`=38, HEAD `build.gradle`=26 — three different numbers. Set all to **40**.

**Step D — Commit both `package.json` and the regenerated `package-lock.json`:**
```bash
cd mobile
git add package.json package-lock.json app.json android/app/build.gradle
git commit -m "fix(revenuecat): bump react-native-purchases to 10.2.1 (Android SDK >=10.7.0) + versionCode 40"
```

**Step E — Rebuild AAB via CI** (triggers `npm ci` + `expo prebuild --clean` + `bundleRelease`):
- Run the `Build AAB Release` workflow (currently named "Build AAB Release v39" in `.github/workflows/build-aab.yml:1`). Rename the workflow + artifact to `v40` while here.

**Step F — Resubmit to Play Console.** Once a compliant AAB (Android SDK ≥10.6.2) is uploaded, the 90-day-clock concern is moot. **Before resubmitting, complete the §6 pre-flight check** — the package name must match the existing Play app.

---

## 4. Agent roster & roles

| Agent | Role | What to investigate |
|---|---|---|
| **@sky-architect (ZIZ)** | Top-down oversight | Repo observation; ELIMINATE/KEEP/SINGLE-SUCCESS verdict (§5); root-cause validation (this doc). |
| **@leviatano-gatekeeper** | Production-readiness gate | Review the RevenueCat fix end-to-end + AAB signing/keystore flow (`build-aab.yml:74-90`, `scripts/patch_build_gradle.py`) + Play policy compliance. Hunt release-only risks (ProGuard/R8, deep links, permissions). |
| **@salamandra-forgekeeper** | **Executor** | Perform §3 literally: edit `package.json`, regenerate lock, bump versionCode to 40 in `app.json` + `build.gradle`, verify build compiles. **ZIZ does NOT execute this.** |
| **@security-architect-reviewer** | Secret/exposure audit | Review the Service Account JSON flow (`invoice-studio-497410-167812ac4487.json`) + RevenueCat API key handling. Note: `app.json:extra.revenueCatApiKey` is a *public* SDK key (expected in-app) — low risk. The Service Account JSON + `ANDROID_KEYSTORE_*` GitHub secrets are the real exposure surface. Flag any plaintext key in repo. |
| **@forensic-debugger** | Map + clock proof | **Definitively confirm** the npm 10.1.2 → Android 10.6.0 mapping against the actual built AAB (unzip `app-release.aab` → `classes.dex`/libs, grep `purchases:10.6.0`). Prove the 90-day-clock path. Rule out ANY other bad transitive SDK in the AAB (e.g., outdated OkHttp, Play Services, AdMob leftovers). Web re-fetch of the changelog 404'd — confirm from the artifact, not docs. |
| **@context-morph** | Paywall UX audit | Audit `mobile/app/(app)/ProUpgrade.tsx` (currently well-built: gates trial on `introPrice.price === 0`, uses `offerings.current`, product IDs `vela-premium-monthly/-yearly`). Verify the trial/introPrice display does not over-promise vs what RevenueCat/Play actually return. Check the "Service Account financial-data permission" dependency (memory `subscription-plans`). |
| **@code-quality-architect** | Repo hygiene | Audit the **65 root-level planning/forensic `.md` files** (ACTIVATION_REPORT, AGENTS_HANDBOOK, AUTH_FORENSICS, BACKEND_IMPLEMENTATION_REPORT, FINAL_VERDICT, POST_MORTEM, PLAY_STORE_UNBLOCK_PLAN, ROADMAP_*, etc.). Decide delete-vs-archive. Recommend: keep ONE `STATUS.md`; move the rest to `docs/archive/`. (Recursive `.md` count is 2076 incl. `node_modules` — the root 65 are pure agent chatter.) |
| **@bug-hunter-omega** | Holistic Play-reject sweep | Sweep for OTHER Play-rejecting issues: dead/placeholder SDKs, "Coming Soon" tabs, emoji icons (memory: Ionicons-only rule), untranslated strings, broken deep links, missing privacy-policy link. |
| **@billing-engineer** + **@billing-engineer-architect-reviewer** | Revenue config | Validate RevenueCat product/entitlement config: products `vela-premium-monthly` / `vela-premium-yearly`, entitlement `premium`. Confirm Google Play Billing linkage + the product IDs match `ProUpgrade.tsx:18-21`. |
| **@landing-page-conversion-architect** + **@seo-audit-architect** | External presence | Assess whether any web/landing presence supports the Play listing; conversion honesty (no promises the app doesn't keep). |
| **@senior-fullstack-auditor** | Web/mobile consistency | Audit Next.js frontend vs mobile for consistent paywall/subscription claims and pricing. |
| **@playstore-app-growth-master** | Growth plan | Define retention/onboarding/ASO so the app is a *growth product*, not just "shippable" (ties to §5 SINGLE SUCCESS factor). |

---

## 5. ZIZ top-down verdict — ELIMINATE / KEEP / SINGLE SUCCESS

### 🔴 ELIMINATE
1. **The 65 root-level planning/forensic `.md` report files.** `ACTIVATION_REPORT.md`, `AGENTS_HANDBOOK.md`, `AUTH_FORENSICS.md`, `BACKEND_IMPLEMENTATION_REPORT.md`, `FINAL_VERDICT.md`, `POST_MORTEM.md`, `PLAY_STORE_UNBLOCK_PLAN.md`, `ROADMAP_*.md`, `V23_MASTER_PLAN.md`, etc. (full list at repo root). These are agent chatter, not product. They bloat git, confuse reviewers, and obscure the actual source. → Keep ONE `STATUS.md`; archive the rest to `docs/archive/`. (Owner: `@code-quality-architect`.)
2. **The manual `build.gradle` versionCode drift.** Someone hand-edited `mobile/android/app/build.gradle` to `38` while `app.json` says `39` and HEAD says `26`. Because CI runs `expo prebuild --clean` (`build-aab.yml:57`), `build.gradle` is *regenerated* from `app.json` anyway — the hand-edit is dead and dangerous. → Stop editing `build.gradle` for version; let `app.json` own it. Align once to 40 and never touch again.
3. **Any "Coming Soon" / placeholder tabs or dead SDKs** (if `@bug-hunter-omega` confirms). Placeholder UI is an instant Play quality reject and destroys trust with the Italian freelancer/PMR audience.
4. **Emoji as UI icons** anywhere in the app (per memory: Ionicons-only). Replace with `@expo/vector-icons` Ionicons.

### 🟢 KEEP
1. **The actual product surface:** invoices + quotes + PDF generation + the RevenueCat paywall. `ProUpgrade.tsx` is genuinely well-built — correct `introPrice` gating (`ProUpgrade.tsx:31-49`), `offerings.current` usage, proper timeout/error states. **This is the asset; protect it.**
2. **The CI pipeline** (`build-aab.yml`): solid — `npm ci`, `expo prebuild --clean`, keystore injected from secrets, Gradle snapshot-repo patches. KEEP; just rename v39→v40.
3. **RLS-protected Supabase backend + `quotes`/`quote_items` tables.** Real, shipping functionality.
4. **The i18n system** (7 locales, `useLocale()` + `t()`). Italian-first is the differentiator for the 50% freelancer / 40% PMI Italian target (memory `target-audience`). KEEP and maintain.
5. **The VELA display rebrand** (user-visible text). KEEP — but see §6 for the package-name trap.

### ⭐ THE SINGLE THING THAT MAKES THIS A SUCCESSFUL PRODUCT
> **Ship a compliant AAB to the *correct* Play app and make the first 7 days of free→paid a real product, not an afterthought.**

The app already has the features. The only thing standing between it and users is (a) the RevenueCat SDK version + (b) the package-name/keystore drift in §6. Clear those, and the *single* durable success factor becomes **retention**: an onboarding→paywall→value loop that converts Italian freelancers/PMIs and keeps them (owner: `@playstore-app-growth-master`). Features don't win; *shipped, compliant, retained* wins. Everything else in this repo is noise until those two are true.

---

## 6. Secondary risk — package-name / version drift (CRITICAL, UNVERIFIED)

**Observed (verified by ZIZ):**
- `mobile/app.json:26` → `"package": "com.Invoice_Studio.myapp"`
- `mobile/android/app/build.gradle:91` → `applicationId 'com.Invoice_Studio.myapp'`
- Git history shows the package was deliberately changed: `92a4dd7 fix: ripristina package com.Invoice_Studio.myapp per Play Console — versionCode 27` and `cb71cb4 feat: VELA Play Store submission prep`.
- BUT chat history (2026-07-05) shows `app.json` previously declared `"package": "com.vela.mobile"` — the value the *published* Play app may use.

**The trap:** Play Console matches an upload by **(package name + upload keystore)**. If the existing published app is `com.vela.mobile` but the v40 AAB is built as `com.Invoice_Studio.myapp` (current code), Play will either **reject it (package/keystore mismatch)** or **create a brand-new app listing** — and the 90-day clock spent fixing the SDK would be wasted on the wrong app.

**ZIZ verdict:** This is **UNVERIFIED but HIGH-severity**. The commit message `92a4dd7 "...per Play Console"` *suggests* the live app is `com.Invoice_Studio.myapp`, but the 2026-07-05 `com.vela.mobile` snapshot contradicts it. **Do not guess.**

**Action (mandatory pre-flight, owner: `@leviatano-gatekeeper` + you):**
1. Open **Google Play Console → the app that received the v39 rejection**.
2. Read its **Package name / Application ID** exactly.
3. If it is **`com.Invoice_Studio.myapp`** → proceed with §3 as written.
4. If it is **`com.vela.mobile`** → STOP. The fix is NOT a version bump; you must change `app.json:26` + `build.gradle:91` back to `com.vela.mobile` AND confirm the upload keystore secret (`ANDROID_KEYSTORE_BASE64`) matches that app. Building `com.Invoice_Studio.myapp` would be a fatal mistake.

**Version drift (lower severity, must still be fixed):** `app.json`=39, working-tree `build.gradle`=38, HEAD `build.gradle`=26. Set all to **40** per §3-C. CI will regenerate `build.gradle` from `app.json` anyway, but local builds and reviewer sanity require the alignment.

---

*ZIZ — "I do not look at what exists. I look at what will happen."*
