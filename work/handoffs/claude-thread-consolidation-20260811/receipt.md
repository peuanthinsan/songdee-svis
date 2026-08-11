# Consolidation receipt — 2026-08-11

## Outcome

- Status: complete and verified in the isolated Codex worktree.
- Provider: Codex; model/effort metadata: `UNKNOWN`.
- Base: `origin/main` at `8c6ccc9`.
- Branch: `codex/consolidate-claude-threads`.
- External mutations: none. No commit, push, merge, deploy, production database access, or environment change was performed.

## Changes integrated

- Claude inventory/docs: `CLAUDE.md`, `scripts/migrate-014.js` (comment only), `scripts/lib/company-target.js`, `tests/company-target.test.mjs`, `web/src/pages/admin/VehiclesTab.tsx`, `api/admin/vehicles/index.ts`, and `claude-inventory.md`.
- Van checklist/editor: `api/admin/checklist.ts`, `app/(app)/admin/checklist.tsx`, `web/src/api.ts`, `web/src/pages/admin/ChecklistTab.tsx`, and `tests/checklist-pagination-and-password-cost.test.mjs`.
- Inspection behavior: `api/inspections.ts`, `app/(app)/vehicles/[id]/index.tsx`, `app/(app)/vehicles/[id]/inspect.tsx`, and `tests/inspection-frequency-state.test.mjs`.
- PC access: `web/src/App.tsx`, `web/src/components/Layout.tsx`, and new `web/src/pages/ChecklistPage.tsx`.
- Login/security: `api/auth/users-list.ts`, `app/(auth)/login.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/api.ts`, and `tests/public-login-disclosure.test.mjs`.
- Password-cost consistency: `api/admin/users/[id].ts` and `scripts/reset-admin-password.js`.

## Verification

- Focused Node tests: 52 passed, 0 failed:
  - `tests/checklist-pagination-and-password-cost.test.mjs`
  - `tests/inspection-frequency-state.test.mjs`
  - `tests/public-login-disclosure.test.mjs`
  - `tests/company-target.test.mjs`
- Root TypeScript: `/Users/peuan/songdee-svis/node_modules/.bin/tsc --noEmit --pretty false -p tsconfig.json` — passed.
- Dashboard TypeScript: `web/node_modules/.bin/tsc --noEmit --pretty false -p web/tsconfig.json` using the existing primary dependency install through a temporary symlink — passed; symlink removed.
- Dashboard production bundle: Vite 8.2.0, 48 modules transformed — passed; output written only to `/private/tmp/svis-web-final.2mSO69`.
- Diff hygiene: `git diff --check` — passed.
- Rendered QA at `http://127.0.0.1:4173/dashboard/checklist` in the Codex in-app browser — direct admin tab rendered, no framework overlay, no console warnings/errors, and Van + Daily filters opened an Add form preselected to `van` + `daily`. Screenshot: `/private/tmp/svis-checklist-van-form-final.png`.
- The local API server was intentionally not started, so rendered QA also verified that a failed checklist load is shown explicitly (`Request failed (502)`) instead of masquerading as an empty successful list.

## Security invariant

- Fixed: unauthenticated callers can no longer enumerate login accounts through `/api/auth/users-list`; it returns a non-cacheable 404.
- Preserved: mobile and web login still accept company, typed username, and password; authenticated admin checklist access remains role-gated.
- No change: `/api/companies` continues exposing active workspace slug/name/branding metadata required by the pre-auth multi-company selector. This does not include account or personal data, though it intentionally reveals tenant existence.

## Assumptions and remaining risk

- Checklist configuration is small enough to load as one admin-only snapshot. PostgreSQL `LIMIT NULL` makes that request unlimited and atomic, avoiding truncation and cross-page mutation races; legacy 500-row pagination remains compatible for other callers.
- Weekly “incomplete” behavior referred to the UI initially filtering to the first vehicle zone. The canonical stored questions were not rewritten; the editor now opens the complete frequency list and zone buttons are optional filters.
- The direct PC tab exposes the checklist editor to admins. Performing driver inspections in the PC dashboard was not added.
- No live database CRUD or authenticated API end-to-end test ran because this worktree has no isolated database fixture. Handler tests, typechecks, production bundling, and authenticated rendered form QA passed.
- Existing dirty Claude and user worktrees were inventoried and deliberately preserved, not deleted or reset.
- Report retention is unchanged: operational inspection, issue, and audit history is pruned after six months by the daily cleanup cron; failed-login records are pruned after 24 hours.

## Readiness

The candidate is ready for review/commit. It has not been published or deployed.

## Follow-up — checklist organization

- The PC checklist editor is now grouped by Frequency, then Vehicle Type; repeated category columns were replaced by nested headings and per-group item counts.
- Each vehicle group has an Add action that opens the form with that frequency and vehicle type preselected.
- Frequency and Vehicle Type remain available as narrowing filters, with bilingual search unchanged.
- The mobile admin editor now presents Frequency before Vehicle Type and shows the active pair beside the item count.
- API full-list ordering now matches the UI hierarchy: `frequency, vehicle_type, sort_order, id`.
- Focused checklist tests: 6 passed, 0 failed (`tests/checklist-grouping.test.mjs` plus `tests/checklist-pagination-and-password-cost.test.mjs`).
- Root TypeScript, dashboard TypeScript, dashboard production build, and `git diff --check` passed. The dashboard build transformed 49 modules.
- Rendered QA used a temporary read-only localhost fixture only; no database or checklist mutation occurred. It verified three Frequency sections, eight Vehicle Type subsections, clean console/framework state, filtering to Weekly, and Weekly → Van Add defaults (`weekly`, `van`).
- Screenshots: `/private/tmp/svis-checklist-grouped.png` and `/private/tmp/svis-checklist-group-add.png`.
