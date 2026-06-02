# 🔥 BACKEND IMPLEMENTATION REPORT
## SALAMANDRA FORGEKEEPER // MILO FACTURE

**Date:** 2026-06-02  
**Protocol:** Backend Awakening — Phases 1–8  
**Stack:** Next.js 15 · React 19 · TypeScript (strict) · Supabase · Stripe Connect · RevenueCat  
**Status:** ✅ PHASES 1-7 EXECUTED · `tsc --noEmit` CLEAN

---

## READINESS SCORE

| Dimension | Before Awakening | After |
|-----------|-----------------|-------|
| Repository Layer | 2/10 (mocks) | **8/10** (5 real Supabase impl) |
| Invoice Data Flow | 4/10 (raw queries) | **8/10** (repo + mappers ready) |
| Analytics Data Flow | 3/10 (mock) | **8/10** (real Supabase repo) |
| Settings Persistence | 3/10 (mock) | **7/10** (real repo, partial settings) |
| Scanner Pipeline | 2/10 (all mock) | **7/10** (connects real OCR API) |
| Stripe/RevenueCat | 6/10 (present) | **6/10** (verified, dark) |
| Webhook Integrity | 6/10 | **6/10** (signatures OK, idempotency OK) |
| Plan Gating | 5/10 (invoice only) | **5/10** (AI/PDF/OCR still un-gated) |
| Auth Security | 7/10 | **7/10** (rate-limiting TBD) |
| **OVERALL** | **4.2/10 😱** | **7.0/10 🔥** |

**Target was full production readiness. Reality: 7.0/10 — solid foundation, 3 blockers remain.**

---

## PHASE 1 — REAL REPOSITORIES ✅

### Repository Status Matrix

| Repository | Interface | Mock | Supabase Impl | Status |
|-----------|-----------|------|---------------|--------|
| DashboardRepository | ✅ | ✅ | ✅ `dashboard-repository.supabase.ts` | **LIVE** |
| InvoiceRepository | ✅ | ✅ | ✅ `invoice-repository.supabase.ts` | **READY** |
| AnalyticsRepository | ✅ | ✅ | ✅ `analytics-repository.supabase.ts` | **READY** |
| SettingsRepository | ✅ | ✅ | ✅ `settings-repository.supabase.ts` | **READY** |
| ScannerRepository | ✅ | ✅ | ✅ `scanner-repository.supabase.ts` | **READY** |
| AuthRepository | ✅ | ✅ | ❌ (uses Supabase Auth directly) | **N/A** |
| SignatureRepository | ✅ | ✅ | ❌ (no DB table) | **BLOCKED** |
| InvoiceTemplateRepository | ✅ | ✅ | ❌ (no DB table) | **BLOCKED** |

**5 of 7 actionable repositories have real Supabase implementations.** Signature and InvoiceTemplate need DB migration before implementation.

### Supabase Barrel
```
repositories/supabase/
├── index.ts                                   — barrel export
├── dashboard-repository.supabase.ts           — 3 tables, 2 queries, DTO mapping
├── invoice-repository.supabase.ts             — full CRUD + send/markPaid/cancel
├── analytics-repository.supabase.ts           — revenue trend, forecast, top clients
├── settings-repository.supabase.ts            — org fetch + settings merge
└── scanner-repository.supabase.ts             — OCR API call + invoice creation
```

### Architecture Decision: `(supabase as any)` for inserts/updates
Strict Database types from Supabase don't support partial typed operations well. All insert/update operations use `(supabase as any)` with explicit `// eslint-disable-next-line` annotations. This is pragmatic — when `npx supabase gen types` is run, these can be tightened.

---

## PHASE 2 — INVOICES MIGRATION STATUS

### What's Ready
- `createInvoiceRepositorySupabase()` — full CRUD implementation
- `fromSupabaseInvoice()` mapper — snake_case DB → camelCase domain
- `useInvoiceListState()` hook — Loading/Success/Empty/Error/Offline
- `UiStateRenderer` — exhaustively renders all 5 states

### What Still Needs Wiring
The `InvoicesClient.tsx` still uses raw `supabase.from()` calls and `useState` arrays. Migration path documented in the invoices audit:
1. Wrap invoices page with `RepositoryProvider`
2. Replace `useState` + raw supabase with `useInvoiceListState(repo, orgId)`
3. Add loading.tsx / error.tsx boundaries
4. Estimated: 2-4 hours

---

## PHASE 3 — ANALYTICS MIGRATION STATUS

### Real Data Flow (ready)
- `createAnalyticsRepositorySupabase()` queries real invoice data
- Revenue trend computed from actual paid invoices
- Cashflow forecast uses moving average + open invoices
- Top clients by revenue with payment speed
- Recovery stats from overdue invoice counts

### Not Yet Wired
- `app/(dashboard)/analytics/page.tsx` still uses raw supabase calls
- No loading.tsx / error.tsx boundaries on analytics route
- Estimated: 2-3 hours

---

## PHASE 4 — SETTINGS MIGRATION STATUS

### Real Data Flow (ready)
- `createSettingsRepositorySupabase()` fetches organization from Supabase
- Settings persistence is partial — `OrganizationSettings` fields like `invoicePrefix`, `nextInvoiceNumber` need a dedicated DB table or column on `organizations`

### Not Yet Wired
- `app/(dashboard)/settings/page.tsx` still uses raw supabase
- Estimated: 2-3 hours + DB migration for settings columns

---

## PHASE 5 — OCR ACTIVATION

### Pipeline Audit Results

| Component | Status | Technology |
|-----------|--------|------------|
| Mobile scanner screen | ✅ **LIVE** | expo-camera → `/api/ocr/receipt` |
| `/api/ocr/receipt` | ✅ **LIVE** | tesseract.js (ita+eng) |
| Mobile quota (3/month) | ✅ **LIVE** | AsyncStorage with monthly reset |
| Frontend scanner page | ❌ **MISSING** | No route exists |
| Frontend `useScannerState` | ⚠️ **ORPHAN** | Hook ready, never used |
| `ScannerRepositorySupabase` | ✅ **READY** | Calls real OCR API |
| `mobile/lib/ocr-utils.ts` | ❌ **DEAD CODE** | References non-existent `/api/llm/vision` |

### OCR Pipeline Map
```
Mobile: camera → base64 → POST /api/ocr/receipt → tesseract.js → { vendor, date, total }
                                                                           ↓
                                                              incrementScanCount()
                                                                           ↓
                                                              quota check (3/month)
                                                                           ↓
                                                              paywall if exhausted
```

### Activation Needed
1. Create `frontend/src/app/(dashboard)/scanner/page.tsx`
2. Wire `useScannerState` + `ScannerRepositorySupabase` + `UiStateRenderer`
3. Delete or fix `mobile/lib/ocr-utils.ts` (dead code calling non-existent endpoint)
4. Estimated: 2-3 hours

---

## PHASE 6 — SUBSCRIPTION SYSTEM

### Stripe Connect
- **Status**: Code-complete but DARK (no live env vars)
- `Stripe(STRIPE_SECRET_KEY)` with Connect platform account
- Payment links generated via `stripe.checkout.sessions.create()`
- Webhook verification with `stripe.webhooks.constructEvent()`
- Application fee: 0.5% on processed volume
- **Needs**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in production env

### RevenueCat
- **Status**: LIVE on mobile
- SDK: `react-native-purchases: ^10.1.2`
- Products: `mensile` (€4.99), `annuale` (€49.99)
- Webhook handler: Bearer token auth + plan sync
- **Bug**: Retried webhooks can cause plan oscillation (no idempotency key on plan updates)
- **Needs**: `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_GOOGLE_PLAY_API_KEY`

### Plan Tiers (from REVENUECAT_IDS.md)
| Plan | Price | Invoices | Features |
|------|-------|----------|----------|
| Free | €0 | 5/month | Basic invoices, 10 ad credits/day |
| Pro | €4.99/mo | Unlimited | Stripe payments, custom branding, OCR |
| Agency | €79/mo | Unlimited | White-label, team, priority support |
| Enterprise | Custom | Unlimited | Custom integrations, SLA |

---

## PHASE 7 — WEBHOOK VALIDATION

### Webhook Readiness Matrix

| Webhook | Signature Verification | Idempotency | Duplicate Protection | Race Condition Safe | Status |
|---------|----------------------|-------------|---------------------|-------------------|--------|
| **Stripe** (`/api/webhooks/stripe`) | ✅ `constructEvent()` | ✅ `payment_token` consumed flag | ✅ single-use tokens | ✅ atomic UPDATE | **READY** |
| **RevenueCat** (`/api/webhooks/revenuecat`) | ✅ Bearer `REVENUECAT_WEBHOOK_SECRET` | ❌ No idempotency key on plan UPDATE | ❌ Retry → plan oscillation | ⚠️ | **FIX NEEDED** |
| **Cron: check-overdue** | ✅ `CRON_SECRET` Bearer | N/A (read-only check + push) | ⚠️ Multiple cron triggers | ⚠️ | **OK** |
| **Cron: reset-credits** | ✅ `CRON_SECRET` | ❌ No mutex | ❌ Double reset possible | ❌ | **FIX NEEDED** |
| **Cron: reconcile-admob** | ✅ `CRON_SECRET` | ✅ INSERT ON CONFLICT | ✅ Upsert pattern | ✅ | **OK** |

### Key Issues
1. **RevenueCat webhook**: Plan updates lack idempotency. A retried webhook could set the plan, then the `payment_audit_logs` INSERT would conflict. Current code catches the error but doesn't check if the plan was actually updated.

2. **Cron: reset-credits**: No distributed mutex. If two cron triggers fire simultaneously (Vercel cold starts, retry logic), credits could be double-reset.

3. **Cron: check-overdue**: Read-only so safe, but could send duplicate push notifications if triggered multiple times. Push token delivery is idempotent at the push service level (Expo).

---

## PHASE 8 — LEVIATANO PREPARATION

### Completed Integrations
- [x] 5 real Supabase repository implementations
- [x] DTO mapper layer (snake_case → camelCase)
- [x] RepositoryProvider DI container (8 repos)
- [x] UiState architecture (5 variants on all screens)
- [x] Dashboard fully migrated to new architecture
- [x] Loading/error boundaries on dashboard route
- [x] Database types extended (14 tables, full triples)
- [x] Scanner connects to real OCR API
- [x] `tsc --noEmit` clean

### Remaining Mocks
| Repository | Reason |
|-----------|--------|
| `AuthRepository` | Uses Supabase Auth directly — no separate repo needed |
| `SignatureRepository` | `signatures` table not in DB yet |
| `InvoiceTemplateRepository` | `invoice_templates` table not in DB yet |

### Remaining Technical Debt
| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Rewarded ad claim flow: broken HMAC (2 different secrets, client-exposed) | 🔴 P0 | 4-6h |
| 2 | RevenueCat webhook: no idempotency on plan updates | 🔴 P0 | 1-2h |
| 3 | AI/PDF/OCR/CSV endpoints: no plan gating | 🟡 P1 | 3-4h |
| 4 | Rate limiter: in-memory only (fails in Vercel serverless) | 🟡 P1 | 2-3h |
| 5 | No rate limiting on /login and /signup | 🟡 P1 | 1h |
| 6 | `mobile/lib/ocr-utils.ts`: dead code calling non-existent endpoint | 🟢 P2 | 30m |
| 7 | Settings persistence: needs dedicated DB columns | 🟢 P2 | 2h |
| 8 | 4 pages unwired (invoices, analytics, settings, scanner) | 🟡 P1 | 10-16h |
| 9 | Auth inconsistency: 3 routes use `createClient()` instead of `getAuthFromRequest()` | 🟢 P2 | 1h |
| 10 | `clients/page.tsx` has no `org_id` filter (relies on RLS only) | 🟡 P1 | 30m |

### Production Blockers
1. **Rewarded ad claim flow** — currently broken and insecure. Must fix before launch.
2. **RevenueCat webhook idempotency** — plan oscillation on retries.
3. **Stripe env vars** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` unset in production.
4. **OCR API endpoint** — `/api/ocr/receipt` uses tesseract.js which requires `tesseract.js` in `serverExternalPackages` (already configured).

### Deployment Blockers
1. **Vercel environment variables**: All `NEXT_PUBLIC_*` and server-side env vars must be set
2. **Supabase RLS policies**: Verify all new tables have RLS enabled
3. **Database migrations**: `recovery_campaigns`, `recovery_actions`, `ai_recommendations`, `signatures`, `invoice_templates` tables don't exist yet

### Security Concerns
1. **AdMob SSV bypass**: Client generates HMAC with exposed secret (P0)
2. **No CSRF on auth forms**: Login/signup lack CSRF tokens (P2)
3. **No session timeout**: No idle detection on client (P3)
4. **In-memory rate limiter**: Resets on every Vercel cold start (P1)

---

## ARCHITECTURE TRANSFORMATION SUMMARY

```
                    BEFORE                          AFTER
                    ──────                          ─────
  Types:    2 parallel systems           1 canonical (models/) + compat layer
           (snake_case + camelCase)      DTO mappers bridge the gap

  State:    useState × 18 per component  UiState<T> discriminated unions
           ad-hoc loading booleans       5 variants per screen

  Data:     raw supabase.from()          Repository interfaces
           mixed with business logic     Supabase implementations
                                         DTO mapping layer

  UI:       fragile conditional renders  UiStateRenderer
           no loading/error boundaries   SkeletonDashboards + error.tsx

  DI:       no dependency injection      RepositoryProvider
                                         useRepositories() hook
```

---

## FILES CREATED IN BACKEND AWAKENING

```
frontend/src/repositories/supabase/
├── index.ts                                  — barrel
├── invoice-repository.supabase.ts            — full CRUD (247 lines)
├── analytics-repository.supabase.ts          — trends + forecast (183 lines)
├── settings-repository.supabase.ts           — org fetch + merge (57 lines)
└── scanner-repository.supabase.ts            — OCR API + create (130 lines)
```

---

## READY-FOR-AUDIT SCORE

```
████████░░░░░░░░░░░░  7.0 / 10
```

**Assessment**: The backend awakening has connected the architecture to real data. The repository layer is production-grade with proper DTO mapping. The remaining gaps are:
1. **Security** (P0: AdMob HMAC, P1: plan gating on AI/PDF/OCR)
2. **Infrastructure** (P1: rate limiter, env vars)
3. **Page wiring** (P1: 4 pages need hook integration)
4. **DB migrations** (P2: 5 new tables)

The application can serve real traffic on the dashboard and invoice CRUD paths. Premium features (AI, bulk export, unlimited OCR) need plan gating before launch. The rewarded ad system needs a complete rewrite of the claim verification flow.

---

🔥 **[SYSTEM]: BACKEND AWAKENING COMPLETE**

*5 repositories activated. 7.0/10 readiness. 3 P0 blockers remain before production launch.*
