# V23 Roadmap — 14-Day Execution Plan

## Constraint
Maximum 14 days. 1 developer. Focus on unblockers, not perfection.

---

## WEEK 1: STRIP & FIX (Days 1-7)

### Day 1 — Remove the Lies
| Time | Task | Files |
|------|------|-------|
| 2h | Remove Agency plan, fake features, fake social proof from landing | `page.tsx` |
| 1h | Replace all emoji icons with Lucide (sidebar, dashboard, settings, invoice detail) | `layout.tsx`, `DashboardView.tsx`, `SettingsClient.tsx`, `InvoiceDetailPanel.tsx` |
| 30m | Hide Analytics and Clients from sidebar nav | `layout.tsx` |
| 30m | Remove referral banner from dashboard | `layout.tsx`, `DashboardView.tsx` |
| 30m | Remove "Coming Soon" settings tabs — show only Profile, Plan, Danger Zone | `SettingsClient.tsx` |
| 30m | Remove rewarded ads credit display from settings Plan tab | `SettingsClient.tsx` |

**Day 1 Deliverable**: App no longer lies. Nav is clean. Zero emojis.

---

### Day 2 — Auth Unblocking
| Time | Task | Files |
|------|------|-------|
| 3h | Build password reset flow: forgot-password page + reset-password page | New files + `login/page.tsx` |
| 1h | Add "Resend confirmation email" link on login | `login/page.tsx` |
| 1h | Add Terms checkbox to signup with links to /terms, /privacy | `signup/page.tsx` |
| 1h | Add signup error translation map | `signup/page.tsx` |

**Day 2 Deliverable**: Auth never leaves user stranded.

---

### Day 3 — Auth Polish & SMTP
| Time | Task | Files |
|------|------|-------|
| 2h | Configure Resend SMTP for transactional emails | Env config, Supabase dashboard |
| 1h | Fix auth callback error handling (expired links) | `auth/callback/route.ts`, `login/page.tsx` |
| 1h | Add session persistence config to Supabase client | `lib/supabase/client.ts` |
| 1h | Add multi-tab logout sync | `layout.tsx` |
| 1h | Add client-side rate limiting (3 attempts → 60s cooldown) | `login/page.tsx`, `signup/page.tsx` |

**Day 3 Deliverable**: Auth is bulletproof.

---

### Day 4 — OCR-First Navigation
| Time | Task | Files |
|------|------|-------|
| 1h | Redirect new users to /scanner after login (not /dashboard) | `middleware.ts`, `auth/callback/route.ts` |
| 2h | Redesign dashboard: giant scan CTA, remove revenue chart, simplify KPIs | `DashboardView.tsx` |
| 2h | Add `capture="environment"` to OCR file input for mobile camera | `OcrUploadZone.tsx` |
| 1h | Rewrite all scanner copy: "fattura" → "ricevuta", clearer CTAs | `ScannerView.tsx`, `OcrUploadZone.tsx`, `OcrReviewForm.tsx` |

**Day 4 Deliverable**: App screams "SCAN HERE" to every user.

---

### Day 5 — PDF Generation (Part 1)
| Time | Task | Files |
|------|------|-------|
| 4h | Create PDF invoice template with `@react-pdf/renderer` | New `PdfInvoice.tsx` |
| 2h | Include business info on PDF (pull from settings) | `PdfInvoice.tsx`, `SettingsClient.tsx` |
| 1h | Create `/api/invoices/{id}/pdf` route | New API route |
| 1h | Wire Download PDF button in InvoiceDetailPanel | `InvoiceDetailPanel.tsx` |

**Day 5 Deliverable**: PDF download works end-to-end.

---

### Day 6 — PDF Generation (Part 2) & Settings
| Time | Task | Files |
|------|------|-------|
| 2h | Polish PDF template: Italian format, proper styling, logo placeholder | `PdfInvoice.tsx` |
| 2h | Add business info fields to settings (VAT, address, city, provincia) | `SettingsClient.tsx` |
| 1h | Add `notification_settings` DB column + PATCH endpoint | Migration + new API |
| 1h | Wire notification toggles to real API | `SettingsClient.tsx` |

**Day 6 Deliverable**: PDF looks professional. Settings work for real.

---

### Day 7 — Stripe Integration (Part 1)
| Time | Task | Files |
|------|------|-------|
| 4h | Create real Stripe Checkout for €5/month Pro plan | New API route |
| 2h | Wire "Upgrade" button in settings to real checkout | `SettingsClient.tsx` |
| 1h | Add plan limit modal when free user hits scan limit | `InvoicesView.tsx` or global handler |

**Day 7 Deliverable**: Users can actually pay money.

---

## WEEK 2: POLISH & SHIP (Days 8-14)

### Day 8 — Stripe Integration (Part 2)
| Time | Task | Files |
|------|------|-------|
| 3h | Create Stripe Customer Portal for subscription management | New API route |
| 2h | Wire webhook handlers: `checkout.session.completed`, `subscription.deleted` | `api/webhooks/stripe/route.ts` |
| 1h | Replace all placeholder Stripe links | `SettingsClient.tsx` |
| 1h | Add downgrade logic (Pro → Free on cancellation) | Webhook handler |

**Day 8 Deliverable**: Full payment lifecycle works.

---

### Day 9 — Tester Experience Polish
| Time | Task | Files |
|------|------|-------|
| 2h | Add onboarding overlay for first-time users on scanner | `ScannerView.tsx` or new component |
| 2h | Add scan quality tips (lighting, alignment, text legibility) | `OcrUploadZone.tsx` |
| 2h | Redesign success state: primary action = Download PDF | `ScannerView.tsx` |
| 1h | Add empty state illustration for invoice list | `InvoicesView.tsx` |
| 1h | Add search to invoice list | `InvoicesView.tsx` |

**Day 9 Deliverable**: First-time user completes scan without confusion.

---

### Day 10 — Mobile & Responsive
| Time | Task | Files |
|------|------|-------|
| 2h | Ensure all touch targets ≥ 48px | Multiple files |
| 2h | Test scanner on mobile browser (camera upload, processing) | Manual testing |
| 2h | Fix mobile sidebar hamburger (replace ☰ with Menu icon) | `layout.tsx` |
| 1h | Test PDF download on mobile | Manual testing |
| 1h | Fix any mobile layout breaks in review form | `OcrReviewForm.tsx` |

**Day 10 Deliverable**: Mobile experience is solid.

---

### Day 11 — End-to-End Testing
| Time | Task |
|------|------|
| 2h | Test complete flow: signup → confirm → login → scan → review → save → download PDF → send email |
| 2h | Test edge cases: expired link, wrong password, file too large, unsupported format, empty OCR fields |
| 2h | Test payment flow: upgrade → checkout → webhook → downgrade |
| 1h | Test auth edge cases: multi-tab logout, session expiry, password reset |
| 1h | Document all bugs found |

**Day 11 Deliverable**: Bug list documented.

---

### Day 12 — Bug Fixes & Final Polish
| Time | Task |
|------|------|
| 6h | Fix all P0 and P1 bugs found in Day 11 testing |
| 1h | Final emoji sweep (ensure zero emojis remain) |
| 1h | Final placeholder sweep (ensure no `your_link`, `example.com`) |

**Day 12 Deliverable**: All blockers fixed.

---

### Day 13 — Pre-Launch Checklist
| Time | Task |
|------|------|
| 2h | Run Ship Threshold checklist (see SHIP_THRESHOLD.md) |
| 2h | Performance check: ensure scanner loads in < 3s, PDF generates in < 5s |
| 2h | Accessibility check: labels, focus states, color contrast |
| 1h | Final copy review: ensure no "fattura" where "ricevuta" is meant |
| 1h | Environment check: all env vars set, Stripe in test mode, SMTP configured |

**Day 13 Deliverable**: Product is shippable.

---

### Day 14 — Soft Launch
| Time | Task |
|------|------|
| 2h | Deploy to production |
| 2h | Send to 3 friends for "no-questions" test: can they scan → PDF without asking for help? |
| 2h | Fix any last-minute issues from friend test |
| 2h | Prepare Google Play submission assets (screenshots, description, privacy policy URL) |
| 2h | Submit to Google Play Internal Testing track |

**Day 14 Deliverable**: Submitted to Google Play.

---

## BUFFER
If any day slips, cut from lowest priority:
1. Day 9: Onboarding overlay (nice but not blocker)
2. Day 10: Mobile polish beyond camera capture
3. Day 6: Notification toggle persistence
4. Day 3: Multi-tab logout sync

---

## SCORE PROJECTION

| Metric | Day 0 | Day 7 | Day 14 |
|--------|-------|-------|--------|
| Product | 28 | 42 | 50 |
| Commercial | 5 | 25 | 35 |
| Trust | 12 | 50 | 70 |
| UX | 52 | 60 | 65 |
| Play Store Ready | 10 | 50 | 80 |

---

*Document generated by BEHEMOTH*
*Date: 2026-06-02*
