# PRICING REPORT — InvoiceStudio

> **Analyst:** LEVIATAN — Principal SaaS Architect
> **Date:** 2026-06-02
> **Question:** What can InvoiceStudio realistically charge at each stage of product maturity?

---

## PRICING REALITY CHECK

### The Market Context

Italian freelancers have these alternatives:

| Alternative | Price | What They Get |
|-------------|-------|---------------|
| **Invoice Ninja Free** | €0/month | Unlimited invoices, 10 clients, basic templates |
| **Stripe Invoicing** | €0/month + 0.4%/tx | Unlimited invoices, Stripe payments, no Italian tax |
| **Zoho Invoice Free** | €0/month | Unlimited invoices, 5 customers, basic features |
| **Excel + PDF** | €0/month | Manual. Slow. Error-prone. But free. |
| **Commercialista** | €50-200/month | Full service. They do everything. |

**The competitor is not other SaaS tools. The competitor is "free."**

---

## PRICE POINT ANALYSIS

### €5/month — "Impulse Buy Territory"

**Verdict: ACHIEVABLE after 30-day roadmap**

**Why someone pays €5:**
- "It's less than a coffee in Milan"
- "I waste 2 hours/month on invoices. €5 saves me €50 of my time"
- "The OCR scanner is cool, I'll try it"
- "My commercialista charges €100/month. This is 20x cheaper"

**What €5 must deliver:**
- ✅ OCR receipt scanning (exists)
- ✅ Invoice creation (needs fix)
- ✅ Stripe payment links (needs fix)
- ✅ Email delivery (exists)
- ✅ Fattura Elettronica (needs build)
- ✅ Basic PDF export (exists)
- ✅ 5 invoices/month free tier → unlimited on paid

**What €5 does NOT need to deliver:**
- Recurring invoices (nice to have)
- Templates (nice to have)
- Reminders (nice to have)
- Client portal (not needed)
- Multi-user (not needed)

**Conversion math:**
- 1,000 free signups × 5% conversion = 50 paying users
- 50 × €5 = €250 MRR
- Annual: €3,000

**Is this a business?** No. It's validation. €250 MRR proves someone will pay. Then you raise prices or add tiers.

---

### €9/month — "Netflix Territory"

**Verdict: ACHIEVABLE after 60 days (V23 complete)**

**Why someone pays €9:**
- "Recurring invoices save me 30 minutes every month"
- "Automated reminders mean I get paid faster"
- "Templates make my invoices look professional"
- "It's still less than Netflix + Spotify combined"

**What €9 must add over €5:**
- ✅ Recurring invoices
- ✅ Email reminder sequences
- ✅ Invoice templates (3+ designs)
- ✅ Org logo/branding
- ✅ Email open tracking
- ✅ Client import (CSV)

**Conversion math:**
- 2,000 free signups × 5% conversion = 100 paying users
- 100 × €9 = €900 MRR
- Annual: €10,800

**Is this a business?** Barely. €900 MRR covers hosting + coffee. But it proves retention.

---

### €19/month — "Professional Tool Territory"

**Verdict: ACHIEVABLE after 6 months (V24 complete)**

**Why someone pays €19:**
- "My clients love the portal. They pay all invoices in one click."
- "The analytics show me exactly how my business is doing."
- "I've been using it for 6 months. Switching would be painful."
- "My commercialista can access everything directly."

**What €19 must add over €9:**
- ✅ Client portal (magic link, bulk pay, invoice history)
- ✅ Advanced analytics (MRR, DSO, client payment behavior)
- ✅ PDF batch export for accountants
- ✅ Invoice duplicate + status management
- ✅ Priority support (24h response)
- ✅ API access (basic)

**Conversion math:**
- 5,000 free signups × 4% conversion = 200 paying users
- 200 × €19 = €3,800 MRR
- Annual: €45,600

**Is this a business?** Yes. €3,800 MRR = ramen profitable for a solo founder in Italy.

---

### €29/month — "Agency Tier"

**Verdict: ACHIEVABLE after 12 months (V25 complete)**

**Why someone pays €29:**
- "My team of 3 all use it"
- "White-label means my clients see MY brand, not InvoiceStudio"
- "The API integrates with our internal tools"
- "We send 200 invoices/month. This is €0.15 per invoice."

**What €29 must add over €19:**
- ✅ Multi-user / team (3-5 seats)
- ✅ Role-based access (admin, member)
- ✅ White-label (custom domain, remove InvoiceStudio branding)
- ✅ Full API + webhooks
- ✅ Zapier/Make integration
- ✅ Custom email templates
- ✅ SLA (99.5% uptime)

**Conversion math:**
- 10,000 free signups × 3% conversion = 300 paying users
- 200 on €9 plan + 80 on €19 plan + 20 on €29 plan
- (200 × €9) + (80 × €19) + (20 × €29) = €1,800 + €1,520 + €580 = €3,900 MRR
- Annual: €46,800

---

### €49/month — "Enterprise"

**Verdict: NOT ACHIEVABLE before 18-24 months**

**Why someone pays €49:**
- "We have 10+ users"
- "We need SSO/SAML"
- "We need SOC2 compliance"
- "We need a dedicated account manager"
- "We need custom contract terms"

**What €49 requires:**
- ❌ SOC2 Type II (6-12 months, €50K+)
- ❌ SSO/SAML (complex)
- ❌ Dedicated support (hiring required)
- ❌ Custom contracts (legal)
- ❌ Data residency guarantees (infrastructure)
- ❌ 99.9% SLA with penalties

**Do not price at €49 until you have enterprise customers asking for it.**

---

## THE OPTIMAL PRICING STRATEGY

### Phase 1: Free Beta (Now → Day 30)
- **Price:** €0
- **Goal:** Fix product. Gather feedback. Build trust.
- **Users:** 50-100 beta testers

### Phase 2: Single Plan Launch (Day 30 → Month 3)
- **Price:** €5/month
- **Free tier:** 3 invoices (not 5 — create urgency to upgrade)
- **Goal:** Prove someone will pay
- **Target:** 50 paying users

### Phase 3: Two-Tier Launch (Month 3 → Month 6)
- **Basic:** €5/month — core invoicing + OCR + Fattura Elettronica
- **Pro:** €9/month — + recurring invoices + reminders + templates
- **Goal:** Upgrade Basic → Pro at 30% rate
- **Target:** 150 paying users (100 Basic, 50 Pro)

### Phase 4: Three-Tier (Month 6 → Month 12)
- **Basic:** €5/month
- **Pro:** €12/month (raised from €9)
- **Agency:** €25/month — + multi-user + client portal + API
- **Goal:** Establish Agency tier as aspirational
- **Target:** 300 paying users

### Phase 5: Enterprise (Month 12+)
- **Enterprise:** €49-79/month — custom everything
- **Goal:** Land 5-10 enterprise accounts
- **Target:** 500+ total paying users

---

## PRICING PSYCHOLOGY

### What NOT to do:

1. **Don't compete on price.** You can't beat free (Invoice Ninja, Stripe). Compete on speed and Italian specificity.

2. **Don't offer too much free.** 5 invoices/month is too generous. 3 invoices forces the upgrade decision faster.

3. **Don't hide pricing.** One plan, one price, clear value. No "contact us for pricing."

4. **Don't discount annually yet.** Monthly proves retention. Annual discounts come after you have churn data.

5. **Don't charge before the product works.** Charging for a broken product creates chargebacks and bad reviews.

### What TO do:

1. **Lead with the free trial.** "3 fatture gratis. Poi €5/mese." Simple. Clear. Honest.

2. **Show value before asking for money.** Let users create 3 invoices. On the 4th, show the paywall. They've already experienced the value.

3. **Make upgrading trivial.** One click. Stripe Checkout. No manual invoicing for the invoicing tool.

4. **Grandfather early users.** First 100 paying users keep €5/month forever. They become your evangelists.

5. **Raise prices by adding value, not by inflation.** €5 → €9 because you added recurring invoices. Not because "the market will bear it."

---

## PRICING SUMMARY

| Price | When | Requires | Realistic? |
|:-----:|------|----------|:----------:|
| **€0** | Now | Nothing (beta) | ✅ Yes |
| **€5** | Day 30 | Fixed core flow + Fattura Elettronica | ✅ Yes |
| **€9** | Month 3 | + Recurring + Reminders + Templates | ✅ Yes |
| **€19** | Month 6 | + Client Portal + Analytics + API | ⚠️ Ambitious |
| **€29** | Month 12 | + Multi-user + White-label + SLA | ⚠️ Very ambitious |
| **€49** | Month 18+ | + SOC2 + SSO + Dedicated support | ❌ Not now |

**Start at €5. Earn the right to charge more by delivering more value.**
