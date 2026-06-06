# VERSION STRATEGY — InvoiceStudio

> **Analyst:** LEVIATAN — Principal SaaS Architect
> **Date:** 2026-06-02
> **Question:** What does each version deliver, and how does it transform the product?

---

## VERSION PHILOSOPHY

Each version has:
- **One objective** — the single thing that must be true for the version to ship
- **One metric** — the number that proves the version succeeded
- **One perception shift** — how users should feel differently after this version

---

## V23: "IT WORKS" — The Unblock Release

### Objective
**A user can sign up, create an invoice, and send it with a payment link.**

This sounds absurdly basic. It is. And it doesn't work today.

### Timeline
**30 days** (see ROADMAP_30_DAYS.md)

### Features

| Category | Features |
|----------|----------|
| **Fixed** | Invoice creation flow, password reset, auth callback, Stripe payment calculation |
| **Added** | Google OAuth, toast notifications, Lucide icons, onboarding checklist |
| **Removed** | Fake landing page claims, emoji icons, PromoCard, "coming soon" tabs, AI components |
| **Built** | Fattura Elettronica (XML), recurring invoices, email reminders, invoice templates |

### Ship Criteria
- [ ] User can create invoice from dashboard (modal) AND invoices page (button)
- [ ] User can reset password
- [ ] Email confirmation works end-to-end
- [ ] Stripe charges correct amount (subtotal + IVA, no ritenuta deduction)
- [ ] Google OAuth works
- [ ] No `alert()` calls remain in the product
- [ ] No emoji icons in navigation
- [ ] Fattura Elettronica XML validates against Agenzia delle Entrate schema
- [ ] Recurring invoice generates automatically on schedule
- [ ] Landing page only claims features that exist

### Expected Value Increase
**From 0 → 50 paying users at €5/month = €250 MRR**

### Expected User Perception Shift

| Before V23 | After V23 |
|------------|-----------|
| "This is broken" | "This works" |
| "Where's the create button?" | "I just created my first invoice" |
| "These features don't exist" | "What I see is what I get" |
| "Is this abandoned?" | "This is actively maintained" |
| "I can't trust this" | "I'll try the free trial" |

### V23 Success Metric
**Activation rate > 40%** (users who sign up AND send their first invoice within 7 days)

---

## V24: "IT'S FAST" — The Speed Release

### Objective
**A user can go from photographing a receipt to a sent invoice in under 60 seconds.**

V23 made it work. V24 makes it fast. Speed is the moat.

### Timeline
**3 months** (Month 3-6)

### Features

| Category | Features |
|----------|----------|
| **OCR Integration** | Camera button on dashboard. One-click OCR → invoice. Auto-fill from OCR results. |
| **Speed Optimizations** | Reduce steps from 5 to 2. Pre-fill client from history. Remember preferences. |
| **Client Experience** | Client portal (magic link). Bulk invoice payment. Invoice history for clients. |
| **Analytics** | Real dashboard with real data. MRR tracking. DSO (days sales outstanding). Client payment behavior. |
| **Exports** | PDF batch export. Excel export. Accountant-friendly formats. |
| **Automation** | Auto-send on schedule. Auto-remind on overdue. Auto-reconcile Stripe payments. |

### Ship Criteria
- [ ] Camera button on dashboard opens device camera (mobile) or file picker (desktop)
- [ ] OCR → invoice → payment link → send is one integrated flow
- [ ] Time from photo to sent invoice < 60 seconds (median)
- [ ] Client portal works with magic link authentication
- [ ] Clients can view and pay all outstanding invoices in one click
- [ ] Dashboard shows real MRR, DSO, and client payment metrics
- [ ] PDF batch export works for selected invoices
- [ ] Stripe payments auto-reconcile (webhook marks invoice as paid)

### Expected Value Increase
**From €250 MRR → €2,000-3,000 MRR** (200-300 users across Basic €5 + Pro €12)

### Expected User Perception Shift

| Before V24 | After V24 |
|------------|-----------|
| "This works" | "This is fast" |
| "I create invoices" | "Invoices create themselves" |
| "Basic tool" | "Professional platform" |
| "I might switch" | "I can't switch — my clients use the portal" |
| "Worth €5" | "Worth €12" |

### V24 Success Metric
**Net Revenue Retention > 100%** (existing users upgrade, don't downgrade)

---

## V25: "IT'S THE DEFAULT" — The Market Release

### Objective
**InvoiceStudio becomes the default invoicing tool recommended by Italian commercialisti.**

V23 made it work. V24 made it fast. V25 makes it the standard.

### Timeline
**6 months** (Month 6-12)

### Features

| Category | Features |
|----------|----------|
| **Accountant Features** | Commercialista access (read-only). Massivo export for Agenzia delle Entrate. DDT (documento di trasporto). Reverse charge. |
| **Team** | Multi-user with roles. Activity feed. Invoice assignment. Approval workflows. |
| **White-Label** | Custom domain (CNAME). Remove InvoiceStudio branding. Custom email from address. |
| **Integrations** | Full REST API. Webhooks. Zapier app. Make integration. |
| **Mobile** | Mobile app is primary interface. Push notifications for payments. Offline mode. Widget for quick invoice creation. |
| **Trust** | SOC2 Type II (start process). Penetration test. Bug bounty program. Public roadmap. |

### Ship Criteria
- [ ] Commercialista can access client's invoices with read-only magic link
- [ ] Massivo export format accepted by Agenzia delle Entrate
- [ ] Multi-user works with role-based permissions
- [ ] White-label removes all InvoiceStudio branding
- [ ] API documented with OpenAPI spec
- [ ] Zapier app published
- [ ] Mobile app rated 4.5+ stars on App Store / Play Store
- [ ] SOC2 Type II audit in progress

### Expected Value Increase
**From €3,000 MRR → €10,000-15,000 MRR** (500+ users across Basic €5 + Pro €12 + Agency €25)

### Expected User Perception Shift

| Before V25 | After V25 |
|------------|-----------|
| "Fast tool" | "Industry standard" |
| "I use it" | "My whole studio uses it" |
| "Good for freelancers" | "Good for agencies too" |
| "Italian-specific" | "The Italian choice" |
| "Worth €12" | "Worth €25" |

### V25 Success Metric
**Market share > 5%** of Italian freelancer invoicing tools (measured by survey or App Store rankings)

---

## VERSION COMPARISON

| Dimension | V22 (Current) | V23 (30 days) | V24 (6 months) | V25 (12 months) |
|-----------|:------------:|:------------:|:-------------:|:-------------:|
| **Core Flow** | BROKEN | WORKS | FAST | DEFAULT |
| **Trust Score** | 12/100 | 60/100 | 80/100 | 90/100 |
| **Activation** | 0% | 40% | 60% | 75% |
| **Paying Users** | 0 | 50 | 250 | 500+ |
| **MRR** | €0 | €250 | €3,000 | €12,500 |
| **Price Range** | €0 | €5 | €5-12 | €5-25 |
| **Team Size Needed** | 1 | 1-2 | 2-3 | 3-5 |
| **Competitive Position** | Last | Niche | Contender | Leader (Italy) |

---

## VERSION PITFALLS TO AVOID

### V23 Pitfall: Scope Creep
**Risk:** "While we're fixing the create flow, let's also add E-Sign and AI predictions."
**Reality:** V23 is about making the product WORK. Nothing else. Ship when the core flow works. Everything else is V24/V25.

### V24 Pitfall: Premature Enterprise
**Risk:** "A 20-person agency wants to use us. Let's build multi-user now."
**Reality:** One enterprise customer can consume all your resources. Say no until V25. Build for the 100 solo freelancers, not the 1 agency.

### V25 Pitfall: Over-Engineering
**Risk:** "Let's rebuild the entire frontend in a new framework."
**Reality:** The current architecture (Next.js + Supabase + Repository pattern) is good enough. Don't rewrite. Add features.

---

## THE VERSION PROMISE

| Version | Promise to Users | Promise to Yourself |
|---------|-----------------|-------------------|
| **V23** | "This works." | "I will not ship until the core flow is unbroken." |
| **V24** | "This is fast." | "I will not add features that slow down the core flow." |
| **V25** | "This is the standard." | "I will not chase enterprise until the solo freelancer experience is perfect." |

**Ship V23. Prove V24. Scale V25. In that order. No skipping steps.**
