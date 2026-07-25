# mobile/archived/

This directory holds files that have been **moved out of the live build graph**
because they relied on a deprecated, non‑Play‑Store‑compliant, or otherwise
unsupported SDK, but whose source is still useful as historical reference.

## Rules

- Files here carry a `.DISABLED.ts` (or similar) suffix to keep TypeScript
  happy: `tsconfig.json` only walks the live `mobile/lib/` and `mobile/app/`
  trees.
- **Do not** import from this directory; the path aliases (`@/lib/*`,
  `@/shared/*`) intentionally exclude it.
- When the codebase no longer needs the historical copy, delete it freely
  — git history will preserve the old version if a rollback is required.

## Inventory

| File | Archived on | Reason |
|---|---|---|
| `payment-service.DISABLED.ts` | 2026-07-25 (commit `7b6d9a2` in this PR) | Stripe + PayPal + bank‑transfer payment SDK. Violated Google Play payments policy for Android in‑app purchases. Replaced by RevenueCat + Google Play Billing. |

## Adding a new entry

When retiring a lib file, document it here with the same column shape so the
table stays scannable. Link back to the commit that archived it.
