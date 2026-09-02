# Dashboard inspection/GPS decoupling review — 2026-09-02

## Contract

- Objective: review the Codex fix that keeps Active GPS-based while making the Pre-Route, Post-Route, and Weekly dashboard circles count saved inspections independently of GPS activity.
- Requested lane: read-only code review.
- Active root: Codex desktop at `/Users/peuan/songdee-svis`.
- Delegated provider: Claude Fable, high effort, if available.
- Observed active model/effort: `UNKNOWN` / `UNKNOWN`.
- Base ref: `80ba8d4a9459de6f33a8d7d751e590f566cbd14c`.
- Writer lease: the active Codex root owns every source/test file. The delegated reviewer may write only `work/handoffs/dashboard-inspection-gps-decoupling-20260902/receipt.md`.

## In scope

- `api/dashboard.ts`
- `web/src/api.ts`
- `tests/dashboard-metrics.test.mjs`
- `CLAUDE.md`
- Read-only context: `Specification.md`, `lib/unit-status-sheet.ts`, `api/unit-status.ts`, `web/src/pages/DashboardPage.tsx`, and `web/src/components/DonutChart.tsx`.

## Frozen artifact checksums

- `api/dashboard.ts`: `c865e1b1312127d46214e6492ffac2be7f62150228aa9f6665c4e8f2bf889e9b`
- `web/src/api.ts`: `dcde825e161d53d9aa4d8696fcb23cc2611617b429dfcc6f37f8826e3fcf59c1`
- `tests/dashboard-metrics.test.mjs`: `175e7c5ce4b4d7f97396c5d48b08553311afd1f8566b5c71321f67fffb4bc589`
- `CLAUDE.md`: `c92051ccdefaf905fceb2a181859b49b2f3231e7f020599aead4926dcc1a9243`

Any source or scope change invalidates the review receipt.

## Evidence and assumptions

- User screenshot: GDR shows Active `0/37` and all three inspection circles `0/0` despite saved inspections.
- Root cause: the previous aggregation intersected inspection records and denominators with GPS-active IDs whenever a telematics sheet was configured.
- Product interpretation from the user and `Specification.md`: Active is the GPS signal; inspection completion is based on saved inspection logs for the selected fleet.
- Pre-Route maps to `frequency = 'daily'` for Bangkok today.
- Post-Route maps to `frequency = 'post_route'` for Bangkok today.
- Weekly maps to `frequency = 'weekly'` from Bangkok Monday through today.
- Only active `vehicle_master` rows in the authenticated company/effective fleet may count.

## Required review questions

1. Does Active remain derived from the same scoped GPS snapshot as embedded Unit Status?
2. Do all qualifying daily, post-route, and weekly inspection logs now contribute even when GPS is offline, absent, or unmatched?
3. Are completion denominators the selected active fleet roster, keeping checked counts and percentages coherent?
4. Are company, fleet, date-window, distinct-vehicle, and inactive-vehicle constraints preserved?
5. Does removing the weekly GPS-activity query create any functional, data-history, or performance regression?
6. Is the behavioral regression test meaningful and capable of failing under the old implementation?
7. Are documentation/type comments accurate, and did the change introduce any security or compatibility issue?

## Evidence already collected

- Before the fix, the new regression failed with Active `0/2` and all inspection cards `0/0`.
- After the fix, `tests/dashboard-metrics.test.mjs` passes 5/5, including Active `0/2` while each inspection card is `1/2`.
- `git diff --check` passes.

## Acceptance criteria

- Active remains GPS-based when telematics is configured.
- Valid inspections are not suppressed by GPS status or plate matching.
- Pre/Post/Weekly use the full selected active fleet roster as their denominator.
- Existing date, frequency, RBAC, company, fleet, inactive-vehicle, and distinct-vehicle rules remain unchanged.
- Unit Status row flags and attention semantics remain unchanged.
- The targeted regression passes and would fail against the old GPS-coupled code.

## Prohibited / out of scope

- Do not edit source, test, or documentation files.
- Do not commit, stage, push, merge, deploy, or otherwise mutate git state.
- Do not touch `.env*`, databases, migrations, Vercel configuration, or EAS artifacts.
- Do not run broad test suites; inspection or a narrowly targeted read-only check is sufficient.
- Do not make production or external mutations.

## Required return

Write `receipt.md` in this handoff directory. Record provider/model/effort, files read, checks run, findings ordered by severity with exact paths/lines, assumptions, unresolved risks, and whether the artifact is ready for integration. If there are no findings, say so explicitly.
