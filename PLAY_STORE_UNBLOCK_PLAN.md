# Play Store Unblock Plan

## Goal
Google Play testers must complete the entire flow without asking questions.
Every blocker below prevents Play Store approval or earns 1-star reviews.

---

## BLOCKER 1: PDF Download Returns 404

**Problem**: InvoiceDetailPanel has "Scarica PDF" button linking to `/api/invoices/{id}/pdf`. No such route exists.
**Impact on tester**: Clicks button → error → "This app is broken" → 1-star review.
**Root Cause**: PDF generation was never built.
**Fix**: Build `/api/invoices/{id}/pdf` route using `@react-pdf/renderer`.
**Time**: 6 hours
**Priority**: P0

---

## BLOCKER 2: No Password Reset

**Problem**: Tester forgets password → no recovery → cannot log in → cannot test → 1-star review.
**Impact**: 100% of testers who forget password abandon.
**Root Cause**: No forgot-password page, no reset flow.
**Fix**: Build complete flow (forgot page → email → reset page).
**Time**: 4 hours
**Priority**: P0

---

## BLOCKER 3: Fake Stripe Links

**Problem**: Settings Plan tab has `href="https://buy.stripe.com/your_link"`. Tester clicks → 404 on Stripe.
**Impact**: "Payment doesn't work" → trust destroyed.
**Root Cause**: Placeholder URL never replaced.
**Fix**: Create real Stripe Checkout session or hide Plan tab until ready.
**Time**: 5 hours (if building real checkout) or 15 min (if hiding)
**Priority**: P0 (hide if not building)

---

## BLOCKER 4: Emoji Everywhere

**Problem**: Sidebar uses `📊📄👥📈⚙️🚪`. Dashboard KPIs use `💰📄⏳⚠️👥`. Invoice detail uses `📄📋🔗📤🔔`.
**Impact**: Play Store screenshot review flags app as "unprofessional" or "toy app".
**Root Cause**: Developer used emojis instead of proper icons.
**Fix**: Replace ALL with Lucide icons.
**Time**: 2 hours
**Priority**: P0

---

## BLOCKER 5: Empty Dashboard with No Guidance

**Problem**: New user sees "0 fatture", empty revenue chart, referral banner. No "what do I do?"
**Impact**: Tester closes app, never returns.
**Root Cause**: Dashboard designed for returning users, not activation.
**Fix**: Redirect to `/scanner`. Add giant scan CTA. Remove empty chart.
**Time**: 2 hours
**Priority**: P0

---

## BLOCKER 6: No Camera Capture on Mobile

**Problem**: Mobile tester taps upload → sees file picker instead of camera.
**Impact**: "Can't use camera" → thinks app is broken.
**Root Cause**: Missing `capture="environment"` on file input.
**Fix**: Add attribute.
**Time**: 5 minutes
**Priority**: P0

---

## BLOCKER 7: English Confirmation Email

**Problem**: Italian tester receives "Confirm your signup" email in English from supabase.co.
**Impact**: Looks like spam. May not click.
**Root Cause**: Supabase default email template.
**Fix**: Configure custom SMTP + Italian email templates.
**Time**: 2 hours
**Priority**: P1

---

## BLOCKER 8: No Resend Confirmation Email

**Problem**: Tester misses confirmation email → no way to resend → stuck.
**Impact**: Cannot complete signup → cannot test.
**Root Cause**: No UI for resend.
**Fix**: Add "Reinvia email" link on login page.
**Time**: 30 minutes
**Priority**: P1

---

## BLOCKER 9: "Coming Soon" Settings Tabs

**Problem**: Tester opens Settings → sees tabs → clicks Notifications/Workspace → "Sezione in arrivo".
**Impact**: App looks unfinished. Play Store rejects for incomplete product.
**Root Cause**: Placeholder tabs.
**Fix**: Show only working tabs (Profile, Plan, Danger Zone).
**Time**: 15 minutes
**Priority**: P1

---

## BLOCKER 10: Fake Landing Page Claims

**Problem**: App store listing will reference landing page. If listing promises features that don't exist, Play Store can remove for "misleading content."
**Impact**: App removed from Play Store.
**Root Cause**: Landing page overpromises.
**Fix**: Strip all unimplemented features from landing.
**Time**: 1 hour
**Priority**: P1

---

## BLOCKER 11: Auth Callback Silent Fail

**Problem**: Tester clicks expired confirmation link → silently redirected to login → no error message.
**Impact**: Tester thinks link worked but they're still not logged in. Confusion.
**Root Cause**: No error handling in callback route.
**Fix**: Redirect with `?error=expired` and show message.
**Time**: 30 minutes
**Priority**: P2

---

## BLOCKER 12: App Opens to Landing Instead of App

**Problem**: If app is a webview wrapper, opening it may show marketing landing page instead of login/scanner.
**Impact**: Tester must navigate to login manually. Confusion.
**Root Cause**: Default route is landing page.
**Fix**: If in webview/mobile context, redirect `/` to `/login` or `/scanner`.
**Time**: 30 minutes
**Priority**: P2

---

## GOOGLE PLAY SPECIFIC CHECKLIST

Before submission, verify:

- [ ] App launches to functional screen (not broken landing)
- [ ] Signup works without errors
- [ ] Confirmation email arrives (in Italian)
- [ ] Login works
- [ ] Password reset works
- [ ] Session persists across app restarts
- [ ] Scanner page is accessible
- [ ] Camera upload works on mobile
- [ ] OCR processes image
- [ ] Review screen allows editing
- [ ] Save generates invoice
- [ ] PDF download works
- [ ] Email send works (or is hidden if not ready)
- [ ] Settings save correctly
- [ ] No "Coming Soon" screens visible
- [ ] No placeholder URLs
- [ ] No emoji icons
- [ ] App has Privacy Policy link
- [ ] App has Terms of Service link
- [ ] Account deletion works
- [ ] No crashes on any screen

---

*Document generated by BEHEMOTH*
*Date: 2026-06-02*
