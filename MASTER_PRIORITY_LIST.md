# InvoiceStudio — Master Priority List

## Document Purpose
Ranked list of all issues by Revenue Impact, Trust Impact, and User Retention Impact.

---

## PRIORITY DEFINITIONS

- **P0 (Blocker)**: Prevents any commercial viability. Fix immediately.
- **P1 (Major Weakness)**: Significantly reduces conversions, trust, or retention. Fix within 2-4 weeks.
- **P2 (Improvement)**: Causes friction or competitive disadvantage. Fix within 1-2 months.
- **P3 (Nice-to-have)**: Polish and delight. Fix when P0-P2 are complete.

---

## P0 — BLOCKERS (Fix Immediately)

These issues make it impossible to charge money or retain users.

| # | Issue | Evidence | Revenue | Trust | Retention |
|---|-------|--------|---------|-------|-----------|
| P0-1 | **No PDF export** | No export button, no PDF generation code in invoice UI | Critical | High | Critical |
| P0-2 | **Fake Stripe payment links** | `https://buy.stripe.com/your_link` placeholder | Critical | Critical | Critical |
| P0-3 | **No password reset** | Zero UI or API for password recovery | High | Critical | Critical |
| P0-4 | **No fatturaPA/SDI compliance** | Italian B2B invoices legally require XML via SDI | Critical | High | Critical |
| P0-5 | **Notification toggles don't persist** | SettingsClient.tsx sets local state only, no API call | Low | Critical | Medium |
| P0-6 | **No email resend for confirmation** | Users who miss email have no recourse | Medium | High | Critical |
| P0-7 | **Plan limit reached with no upgrade path** | 402 error dispatched but no upgrade modal handler | Critical | Medium | Critical |

### P0 Impact Analysis
**If ALL P0 items were fixed**: Product could potentially charge €5/month.

---

## P1 — MAJOR WEAKNESSES (Fix in 2-4 Weeks)

These issues severely damage trust and conversion rates.

| # | Issue | Evidence | Revenue | Trust | Retention |
|---|-------|--------|---------|-------|-----------|
| P1-1 | **Emoji icons everywhere** | Sidebar: 📊📄👥📈⚙️; KPIs: 💰📄⏳⚠️👥; Landing features use emojis | Medium | Critical | Low |
| P1-2 | **Fake social proof on landing** | "2.000 freelancer italiani" with zero evidence | High | Critical | Low |
| P1-3 | **No onboarding after signup** | Empty dashboard, no guided tour, no checklist | Medium | High | Critical |
| P1-4 | **Placeholder Stripe portal link** | `https://billing.stripe.com/p/login/your_portal` | High | Critical | Medium |
| P1-5 | **No invoice preview before send** | InvoiceForm has no preview mode | Medium | Medium | High |
| P1-6 | **No email preview before send** | InvoicesView sends email without showing user what client receives | High | Critical | High |
| P1-7 | **Settings tabs "coming soon"** | Workspace, Billing, Security tabs show "Sezione in arrivo" | Low | High | Medium |
| P1-8 | **No search/filter/sort on lists** | Invoices and clients have no search, no pagination | Medium | Low | High |
| P1-9 | **Auto-generated org name bug** | `handle_new_user()` uses `full_name || 's Studio` — can be NULL | Low | Medium | High |
| P1-10 | **No support channel** | No email, no chat, no help center, no docs | High | Critical | Medium |
| P1-11 | **Landing page features don't exist** | 8 features advertised, ~3 implemented | High | Critical | Low |
| P1-12 | **No SMTP configuration** | Uses Supabase default (spam risk) | Medium | High | Medium |

### P1 Impact Analysis
**If ALL P1 items were fixed**: Product could potentially charge €10-€15/month.

---

## P2 — IMPROVEMENTS (Fix in 1-2 Months)

These issues create friction and competitive disadvantage.

| # | Issue | Evidence | Revenue | Trust | Retention |
|---|-------|--------|---------|-------|-----------|
| P2-1 | **No recurring invoices** | No UI or schema for recurring | Medium | Low | High |
| P2-2 | **No client portal** | Advertised on landing, not implemented | High | Medium | High |
| P2-3 | **No API documentation** | Advertised but no docs, no OpenAPI | Medium | Medium | Low |
| P2-4 | **No webhooks** | Advertised but no configuration UI | Medium | Low | Low |
| P2-5 | **No QuickBooks/Xero sync** | Advertised but no integration code | Medium | Medium | Medium |
| P2-6 | **No time tracking** | Missing feature competitors have | Low | Low | Medium |
| P2-7 | **No expense tracking** | Missing feature competitors have | Low | Low | Medium |
| P2-8 | **No print-optimized layout** | No print stylesheet | Low | Low | Medium |
| P2-9 | **No invoice templates** | No template selection in form | Low | Medium | Medium |
| P2-10 | **No custom branding (logo)** | Schema has logo_url but no upload UI | Low | Medium | Medium |
| P2-11 | **No team member management** | Schema has roles but no UI | Medium | Low | High |
| P2-12 | **No rate limiting on auth** | Login/signup API routes have no rate limiting | Low | Medium | Low |
| P2-13 | **Inconsistent styling** | Three approaches: Tailwind, inline styles, CSS vars | Low | Low | Low |
| P2-14 | **No toast notification system** | Uses alert() in some places | Low | Low | Medium |
| P2-15 | **No drag-and-drop file upload** | OCR upload zone may not have DnD | Low | Low | Low |
| P2-16 | **No bulk operations** | Invoices/clients have no bulk actions | Low | Low | Medium |
| P2-17 | **No keyboard shortcuts** | Only Escape key in modal | Low | Low | Low |
| P2-18 | **No password strength indicator** | Signup shows min length but no strength meter | Low | Medium | Low |
| P2-19 | **No terms acceptance during signup** | Legal risk | Low | High | Low |
| P2-20 | **No plan selection during signup** | User doesn't choose plan | Low | Medium | Low |

### P2 Impact Analysis
**If ALL P2 items were fixed**: Product could potentially charge €15-€20/month.

---

## P3 — NICE-TO-HAVE (Fix When P0-P2 Complete)

| # | Issue | Evidence | Revenue | Trust | Retention |
|---|-------|--------|---------|-------|-----------|
| P3-1 | **Georgia serif font** | Used for headings; feels dated for SaaS | Low | Low | Low |
| P3-2 | **No dark/light toggle** | Always dark mode; no user preference | Low | Low | Low |
| P3-3 | **No referral program UI** | ReferralBanner component exists but not fully integrated | Low | Low | Low |
| P3-4 | **No live chat widget** | No Intercom, Crisp, or similar | Low | Low | Medium |
| P3-5 | **No blog/content marketing** | No /blog route | Low | Low | Low |
| P3-6 | **No status page** | No uptime monitoring transparency | Low | Low | Low |
| P3-7 | **No mobile app polish** | Mobile app is basic React Native | Low | Low | Medium |
| P3-8 | **Rewarded ads system** | Complete ad-tech infra more complete than core invoicing | Low | Low | Low |
| P3-9 | **No Zapier integration** | Workflow automation missing | Low | Low | Medium |
| P3-10 | **No accountant-specific login** | No read-only accountant access | Low | Low | Medium |

---

## TOP 10 ACTIONS BY COMBINED IMPACT

Ranking by combined score (Revenue + Trust + Retention, max 9):

| Rank | Action | Priority | Combined Score |
|------|--------|----------|----------------|
| 1 | **Implement PDF export** | P0 | 9/9 |
| 2 | **Fix Stripe integration (real links, real checkout)** | P0 | 9/9 |
| 3 | **Add password reset flow** | P0 | 8/9 |
| 4 | **Implement fatturaPA XML + SDI** | P0 | 8/9 |
| 5 | **Replace all emoji icons with Lucide SVG** | P1 | 7/9 |
| 6 | **Add guided onboarding after signup** | P1 | 7/9 |
| 7 | **Add email preview before send** | P1 | 7/9 |
| 8 | **Remove fake social proof or make it real** | P1 | 7/9 |
| 9 | **Add support channel (email minimum)** | P1 | 7/9 |
| 10 | **Fix notification toggle persistence** | P0 | 6/9 |

---

## IMPLEMENTATION ROADMAP

### Week 1-2: P0 Blockers
- [ ] Implement PDF generation and export button
- [ ] Create real Stripe checkout links and customer portal
- [ ] Build password reset flow (request + email + reset page)
- [ ] Add email resend functionality
- [ ] Fix notification toggle persistence (add API endpoint + DB field)

### Week 3-4: P0 Blockers + P1 Trust
- [ ] Implement fatturaPA XML generation
- [ ] Replace all emoji icons with Lucide icons
- [ ] Add email preview before send
- [ ] Build guided onboarding (3-step wizard)
- [ ] Add support email/HelpScout widget

### Week 5-8: P1 Major Weaknesses
- [ ] Add invoice preview before save
- [ ] Add search/filter/sort to all lists
- [ ] Remove or implement "coming soon" settings tabs
- [ ] Fix auto-generated org name bug
- [ ] Remove fake landing features or implement them
- [ ] Configure SMTP (Resend/Postmark)

### Month 2-3: P2 Improvements
- [ ] Recurring invoices
- [ ] Client portal
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Webhook configuration UI
- [ ] Invoice templates
- [ ] Logo upload and custom branding
- [ ] Team member management UI

### Month 3-6: P2 + P3
- [ ] QuickBooks/Xero integration
- [ ] Time tracking
- [ ] Expense tracking
- [ ] Toast notification system
- [ ] Print stylesheets
- [ ] Zapier integration
- [ ] Mobile app polish

---

*Document generated by SALAMANDRA-CTO forensic audit*
*Date: 2026-06-02*
