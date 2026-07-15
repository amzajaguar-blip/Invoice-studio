# 🔧 02 — TECHNICAL SPECIFICATION

> Version: v35
> Scope: Tutta la codebase (frontend, mobile, backend, CI/CD)

---

## 1. STACK TECNICO

### Frontend (Web)
| Componente | Versione | Scopo | Stato |
|------------|----------|-------|-------|
| Next.js | 16.2.6 | App Router, SSR | ✅ Build PASS |
| TypeScript | 5.9.3 | Type safety | ✅ tsc --noEmit PASS |
| Tailwind CSS | 4.3.0 | Styling | ✅ |
| Supabase SSR | 0.10.3 | Auth server-side | ✅ |
| react-hook-form | 7.76.0 | Forms | ✅ |
| Zod | 4.4.3 | Validation | ✅ |
| @react-pdf/renderer | 4.5.1 | PDF export | ⚠️ Installato, NON usato |
| tesseract.js | 5.1.1 | OCR client-side | ✅ Funzionante |
| Stripe | 22.1.1 | Pagamenti | 🔴 Link fake |
| Resend | 6.12.3 | Email | ⚠️ Non configurato SMTP custom |
| Sentry | 8.20.0 | Monitoring | ⚠️ DSN hardcoded |
| Playwright | 1.60.0 | E2E tests | ⚠️ Coverage minima |

### Mobile (Expo)
| Componente | Versione | Scopo | Stato |
|------------|----------|-------|-------|
| Expo | ~52.0.0 | Framework RN | ✅ |
| expo-router | ~4.0.0 | Navigation | ✅ |
| @supabase/supabase-js | ^2.105.4 | Auth/DB | ✅ |
| react-native-purchases | ^10.1.2 | RevenueCat IAP | 🔴 MAI inizializzato |
| react-native-google-mobile-ads | ^14.11.0 | AdMob | ⚠️ App ID hardcoded |
| expo-camera | ~16.0.0 | OCR scanning | ✅ |
| expo-sharing | ~13.0.1 | PDF share | ✅ |
| expo-notifications | ~0.29.0 | Push | ✅ |
| expo-secure-store | ~14.0.0 | Token storage | ✅ |

### Backend (Supabase)
| Componente | Scopo | Stato |
|------------|-------|-------|
| PostgreSQL | Database | ✅ |
| GoTrue | Auth | ✅ |
| Storage | File (logos, PDFs) | ✅ |
| RLS | Row Level Security | ⚠️ Non verificato su tutte le tabelle |

### CI/CD (GitHub Actions)
| Workflow | Scopo | Stato |
|----------|-------|-------|
| build-apk.yml | APK debug (CI) | ✅ Usa Secrets |
| build-aab.yml | AAB release (Play Store) | ✅ Usa Secrets |
| build-twa.yml | TWA build | ✅ ELIMINATO (era keystore hardcoded) |

---

## 2. ARCHITETTURA

### Pattern Frontend
Component → useXxxState Hook → Repository → Supabase Client

- Client Supabase: src/lib/supabase/client.ts (browser)
- Server Supabase: src/lib/supabase/server.ts (SSR)
- Auth helper: src/lib/supabase/auth-helper.ts
- Middleware: src/middleware.ts (route protection)
- Theme: src/contexts/ThemeContext

### Pattern Mobile
Screen → Hook → lib/* → Supabase Client

- Auth: hooks/useAuth.tsx
- Plan/Limits: hooks/usePlanLimits.ts, context/PlanContext.tsx
- Supabase: lib/supabase.ts
- RevenueCat: MANCANTE — creare lib/revenuecat.ts

### API Routes (Next.js)
| Route | Metodo | Scopo | Stato |
|-------|--------|-------|-------|
| /api/invoices | GET, POST | CRUD fatture | ✅ |
| /api/invoices/[id] | GET, PATCH | Singola fattura | ✅ |
| /api/invoices/[id]/pdf | GET | Download PDF | ⚠️ Verificare |
| /api/invoices/[id]/send-email | POST | Invio email | ⚠️ No preview |
| /api/invoices/[id]/generate-payment-link | POST | Stripe link | 🔴 Ritenuta bug |
| /api/invoices/export-csv | GET | Export CSV | ✅ |
| /api/clients | GET, POST | CRUD clienti | ✅ |
| /api/ocr/receipt | POST | OCR processing | ✅ |
| /api/pay/[token] | GET, POST | Pagamento pubblico | 🔴 Ritenuta bug |
| /api/webhooks/stripe | POST | Stripe webhooks | ⚠️ Verificare |
| /api/webhooks/revenuecat | POST | RC webhooks | ⚠️ Verificare |
| /api/profile | GET, PATCH | Profilo utente | ✅ |
| /api/rewards/* | GET, POST | Rewarded ads | 🔴 Bypass server |
| /api/ai/suggest | POST | AI suggestions | ✅ |
| /api/ai/voice-transcribe | POST | Voice input | ✅ |
| /api/cron/* | GET | Cron jobs | 🔴 Nessun auth |
| /api/stripe/checkout | POST | Stripe Checkout | 🔴 DA CREARE |
| /api/stripe/portal | POST | Customer Portal | 🔴 DA CREARE |

---

## 3. DATABASE SCHEMA

### Tabelle Esistenti
| Tabella | Scopo | RLS | Migrazione |
|---------|-------|-----|------------|
| profiles | Profilo utente | ✅ | backend/migration.sql |
| invoices | Fatture | ✅ | backend/migration.sql |
| clients | Clienti | ✅ | backend/migration.sql |
| user_plans | Piano abbonamento | ✅ | ..._v34_user_plan.sql |
| analytics_events | Eventi analytics | ✅ | ..._v34_analytics_events.sql |
| user_engagement | Engagement | ✅ | ..._v34_user_engagement.sql |
| notification_log | Log notifiche | ✅ | ..._v34_notification_log.sql |
| invoice_events | Audit log fatture | ✅ | (in payment link route) |
| rewarded_ads | Crediti rewarded | ⚠️ | backend/migration-rewarded-ads.sql |

### Tabelle Mancanti (da creare)
| Tabella | Scopo | Priorità |
|---------|-------|----------|
| fattura_pa_queue | Coda invio SDI | P1 (post-launch) |
| email_templates | Template email custom | P1 |
| feature_flags | Feature flags | P2 |
| user_onboarding | Stato onboarding | P0 |

### Migration Necessaria: user_onboardingsql
-- backend/migration_onboarding.sql
ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN onboarding_skipped BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN onboarding_step INT DEFAULT 0;