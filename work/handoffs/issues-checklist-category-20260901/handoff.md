# Issues checklist evidence review — 2026-09-01

## Contract

- Objective: review the Codex implementation that adds failed checklist item context after Fleet in the web Issues table and preserves the checklist-item association for each defect photo.
- Requested lane: read-only code review.
- Active root: Codex desktop at `/Users/peuan/songdee-svis`.
- Delegated provider: Claude Fable, high effort, if available.
- Base ref: `d7a2038ec8abfe89013b8648c897062d3529d3ea`.
- Writer lease: the active Codex root owns every source/test file. The delegated reviewer may write only `work/handoffs/issues-checklist-category-20260901/receipt.md`.

## In scope

- `api/issues.ts`
- `lib/i18n.ts`
- `web/src/api.ts`
- `web/src/i18n.ts`
- `web/src/issue-checklist.ts`
- `web/src/pages/IssuesPage.tsx`
- `web/src/styles.css`
- `tests/issues-checklist-category.test.mjs`
- Existing focused context/tests: `tests/date-and-issue-evidence.test.mjs`, `tests/issues-visibility.test.mjs`, `api/inspections.ts`, and the relevant SQL schema.

## Frozen artifact checksums

- `api/issues.ts`: `131d9029953d7124a2474a25e5a64dfe331269308aac7ae8c81cd782b9098bd8`
- `lib/i18n.ts`: `8022b46db5c377d84b779f0f097311f12ef6d489972045269f9e867239928122`
- `web/src/api.ts`: `fa24874af2462d6c3e5207532e2a96293f75f8a99bb99095de4da5d2b1828af9`
- `web/src/i18n.ts`: `dc68f61cf7f102fcfc7b88c5390abcd53e772ef1bf1f838de351756b003db441`
- `web/src/issue-checklist.ts`: `b6e2a8eaf72ecc82b66b4119247379f70a11512c8233e29e80a1d79bd980619f`
- `web/src/pages/IssuesPage.tsx`: `1e6c238d7b97ced3907114ef1c0b6d1f2f4a8c3f7b1029f716fbf2303ced0e2f`
- `web/src/styles.css`: `c5d0d6a41a1f242665ed82249745575199de4487932220bcbc0a67f19548891b`
- `tests/issues-checklist-category.test.mjs`: `4697f6d4fcb1b090f21e541194072af9d1a671cb3d273d3dfef7040f241d2188`

Any source or scope change invalidates the review receipt.

## Required review questions

1. Is the list query valid Postgres and correctly scoped by the authenticated company?
2. Do the flat defect-photo list and structured failed-item list come from one consistent snapshot and retain per-item photo URLs?
3. Does the web UI place the localized failed-items column immediately after Fleet, handle multiple/empty/legacy values, and avoid unbounded row height?
4. Does the issue modal preserve the visible photo-to-checklist-item association while keeping completion and legacy/unassociated photos separate?
5. Are the new type/helper/i18n contracts safe and are the focused tests behaviorally meaningful?
6. Did the implementation introduce a security, tenancy, performance, accessibility, or compatibility regression?

## Evidence already collected

- `tests/issues-checklist-category.test.mjs`: 5 passed.
- `tests/date-and-issue-evidence.test.mjs` + `tests/issues-visibility.test.mjs`: 3 passed.
- `npm run typecheck`: passed.
- `npm run build` in `web/`: passed.
- `git diff --check`: passed.
- In-app Browser at `http://127.0.0.1:5173/dashboard/issues?status=open`: correct header order, empty fallback, `+N more` compaction, row-click modal interaction, two separately labeled defect-photo groups, no console warnings/errors, and horizontal table scrolling at 390×844.
- QA screenshots: `/private/tmp/svis-issues-checklist-desktop.png`, `/private/tmp/svis-issues-checklist-modal.png`, `/private/tmp/svis-issues-checklist-mobile.png`.

## Prohibited / out of scope

- Do not edit any source or test file.
- Do not commit, stage, push, merge, deploy, or alter git state.
- Do not touch `.env*`, databases, migrations, Vercel configuration, or EAS artifacts.
- Do not run broad test suites; inspection is sufficient unless a narrowly targeted read-only check is needed.
- Do not make production or external mutations.

## Required return

Write `receipt.md` in this handoff directory. Record provider/model/effort, files read, checks run, findings ordered by severity with exact paths/lines, assumptions, unresolved risks, and whether the artifact is ready for integration. If there are no findings, say so explicitly.
