# Ship Threshold

## Definition
The exact minimum requirements for InvoiceStudio to be published (not perfect — publishable).

**Ship ≠ Done. Ship = Safe to put in front of strangers who might pay.**

---

## MINIMUM REQUIREMENTS

### 1. Core Function (Must Work, No Fakes)

| Requirement | Why | Current Status |
|-------------|-----|---------------|
| User can create an invoice | Product purpose | Works |
| User can download invoice as PDF | Legal requirement | Missing |
| User can send invoice to client via email | Core delivery mechanism | Partial (sends but no preview) |
| User can scan receipt via OCR | Wedge feature | Works |
| User can view invoice list | Management | Works (basic) |

**Ship gate**: PDF export MUST work before publication.

---

### 2. Authentication (Must Work, No Dead Ends)

| Requirement | Why | Current Status |
|-------------|-----|---------------|
| User can sign up | Entry | Works |
| User receives confirmation email | Activation | Works (Supabase default) |
| User can login | Access | Works |
| User can logout | Security | Works |
| User can reset forgotten password | Retention | Missing (CRITICAL) |
| Session persists across browser restarts | UX | Works |

**Ship gate**: Password reset MUST work before publication.
Without it, every forgotten password = permanent churn.

---

### 3. Payment (Must Be Real, No Placeholders)

| Requirement | Why | Current Status |
|-------------|-----|---------------|
| User can upgrade to paid plan | Revenue | Fake links |
| User can enter payment details securely | Trust | Fake links |
| User is charged correctly | Legal | Not implemented |
| User can cancel subscription | Legal (EU) | Not implemented |
| User can view billing history | Trust | Not implemented |

**Ship gate**: Stripe Checkout + Customer Portal MUST be real before publication.
Taking money with fake payment flows is fraud.

---

### 4. Trust (Must Be Honest, No Lies)

| Requirement | Why | Current Status |
|-------------|-----|---------------|
| Landing page makes no false claims | Legal + trust | Lies everywhere |
| No fake social proof | Ethics | "2.000 freelancer" is fake |
| No fake security badges | Ethics | "PCI-DSS" is fake |
| Pricing matches reality | Legal | Agency plan doesn't exist |
| Support contact exists | Trust | None |

**Ship gate**: Remove every claim you can't prove.
A smaller honest page beats a bigger lying page.

---

### 5. UX (Must Not Embarrass)

| Requirement | Why | Current Status |
|-------------|-----|---------------|
| No emoji icons | Professionalism | Emoji everywhere |
| No "Coming Soon" screens | Completion | Settings has 3 |
| Loading states for async actions | Usability | Partial |
| Error messages are helpful | Usability | Partial |
| Mobile responsive | Accessibility | Partial |

**Ship gate**: Replace all emojis with Lucide icons. Remove all "Coming Soon".
These are 1-day fixes that prevent instant "this is a toy" reactions.

---

### 6. Legal (Must Not Be Illegal)

| Requirement | Why | Current Status |
|-------------|-----|---------------|
| Privacy Policy exists | GDPR | Exists |
| Terms of Service exists | Legal | Exists |
| User accepts Terms during signup | Legal | Missing |
| Cookie banner exists | GDPR | Exists |
| Data deletion possible (GDPR Right to Erasure) | GDPR | Works (account delete) |

**Ship gate**: Add Terms acceptance checkbox during signup.
Without it, contracts are unenforceable and GDPR compliance is questionable.

---

## THRESHOLD CHECKLIST

Before publishing, EVERY item below must be checked:

### Core
- [ ] Invoice creation works end-to-end
- [ ] PDF export button generates valid PDF
- [ ] PDF includes correct business info, items, totals
- [ ] Email send button delivers email to recipient
- [ ] OCR scan works (upload → extract → review → save)

### Auth
- [ ] Signup → confirmation → login works
- [ ] "Forgot password?" link exists on login page
- [ ] Password reset email is sent and link works
- [ ] New password form updates credentials
- [ ] Session survives browser restart

### Payment
- [ ] Stripe Checkout link is real (test mode acceptable)
- [ ] Test payment succeeds end-to-end
- [ ] Webhook updates plan from "free" to "pro"
- [ ] Customer portal link is real
- [ ] Cancellation downgrades plan correctly

### Honesty
- [ ] No claim on landing page exceeds actual functionality
- [ ] No fake numbers, badges, or certifications
- [ ] Pricing page shows only plans that exist
- [ ] Every feature listed on landing is implemented

### Polish
- [ ] Zero emoji icons visible in product
- [ ] Zero "Coming Soon" or "Sezione in arrivo" visible
- [ ] No placeholder URLs (stripe.com/your_link, etc.)
- [ ] Support email listed somewhere (footer or settings)

### Legal
- [ ] Terms checkbox on signup
- [ ] Privacy policy linked in footer
- [ ] Cookie banner present
- [ ] Account deletion works

---

## WHAT IS NOT REQUIRED TO SHIP

These can be missing and you can still publish:

| Feature | Why Not Required |
|---------|-----------------|
| FatturaPA XML / SDI | B2C freelancers don't need it |
| Recurring invoices | Nice-to-have, not core |
| Team members / multi-user | Single-user is fine for v1 |
| Custom branding / logo upload | Default template is acceptable |
| API / webhooks | Developer features for later |
| Mobile app | PWA/web is enough |
| Advanced analytics | Dashboard KPIs are enough |
| Zapier / integrations | Workflow automation for later |
| Phone support | Email support is enough |
| Live chat | Not required at this stage |
| Onboarding wizard | Nice but not a ship blocker |
| Sample/demo data | Nice but not a ship blocker |
| Toast notifications | alert() is ugly but functional |
| Search / filter / sort | Scrolling is acceptable for < 50 invoices |
| Print stylesheet | PDF download is the primary output |

---

## SHIP DECISION MATRIX

| Scenario | Action |
|----------|--------|
| All 6 categories pass | **SHIP IT** — Launch to Product Hunt, HN, communities |
| 5/6 pass, missing is "polish" | **SOFT LAUNCH** — Beta to 20 friends, gather feedback |
| Core or Auth fails | **DO NOT SHIP** — Fix first |
| Payment is fake | **DO NOT SHIP** — This is legally dangerous |
| Landing has lies | **DO NOT SHIP** — Strip lies first |

---

## POST-SHIP RULES

Once shipped:
1. **No new features for 2 weeks** — only bug fixes
2. **Watch error logs daily** — Sentry alerts
3. **Respond to every support email within 24h**
4. **Track activation**: % of signups who create first invoice within 24h
5. **Track paywall**: % of free users who hit scan limit
6. **Weekly changelog** — even if just "Bug fixes"

---

*Document generated by LEVIATAN strategic analysis*
*Date: 2026-06-02*
