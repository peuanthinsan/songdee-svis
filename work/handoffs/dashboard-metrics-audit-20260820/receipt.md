# Receipt

## Provider accounting

- Active root: Codex desktop; surface model/effort: `UNKNOWN`.
- Requested Claude Fable planner: attempted with `model=fable`, `effort=high`, read-only plan mode; unavailable because the local CLI returned `Not logged in · Please run /login`.
- Opposite-provider review: unavailable for the same authentication reason. No provider result is represented as completed.
- Fallback: active-root source audit and final diff review.

## Findings and changes

- Dashboard and admin analytics counted inspection logs for inactive vehicles while denominators counted active vehicles. This could inflate completion percentages and trend rates above the real active fleet.
- Added `is_active` constraints to dashboard daily/weekly inspection numerators, out-of-service latest rows, open-defect counts/list, and per-fleet daily counts.
- Added active-vehicle joins and an active denominator to admin analytics failure, fleet, daily-trend, and completion-trend queries.
- Added focused static regression coverage in `tests/dashboard-metrics.test.mjs`.
- Existing user WIP remains in the working tree, including the prior vehicle-tax expiry feature, inspection validation changes, and mobile safe-area fix. No `.env*`, production database, deployment, or EAS release artifact was touched.

## Verification

- `node --test tests/dashboard-metrics.test.mjs` — passed (3).
- `npm run typecheck` — passed.
- `npm test` — passed (142, 4 skipped).
- `npm run build:dashboard` — passed.
- `git diff --check` — passed.

## Remaining risks / follow-up

- `docs/METRICS.md` is referenced by `CLAUDE.md` but is absent, so the metric contract should be restored or replaced with an authoritative source before adding more statistics.
- No live database or GPS-sheet sample was available in this audit; production freshness, missing-plate rates, and real denominator behavior remain unmeasured.
- The existing tax-expiry migration is present but was not executed. The dashboard query requires that column to exist in the deployed database before the feature can work in production.
- The dashboard still lacks trend/freshness indicators, explicit denominator explanations, and a failure-rate/repair-SLA summary; these are recommended next metrics, not inferred from unavailable live data.
