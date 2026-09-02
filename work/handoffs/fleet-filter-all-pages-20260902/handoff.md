# Cross-page fleet filter review handoff

## Objective and requested lane

Review the uncommitted Codex implementation that adds one shared admin fleet
filter to the Vite dashboard's operational pages: Dashboard, Inspections,
Issues, and History. Export, Checklist, Admin, Login, and the Expo mobile app
are explicitly out of scope.

Requested lane: **review**. Do not implement changes.

## Ownership and provenance

- Active user-facing root: Codex
- Active provider/model/effort: Codex / GPT-5 surface / UNKNOWN effort
- Delegated provider: Claude Code
- Delegated provider/model/effort: record observed values in `receipt.md`
- Base commit: `c119e72df98b5a1cabab5971380b0b53fd37cb6c`
- Branch: `codex/issues-failed-checklist-items`
- Writer lease: Codex owns every implementation and test path below. Claude
  has a read-only review lease and may write only `receipt.md` in this folder.

## Allowed review paths

- `web/src/App.tsx`
- `web/src/FleetFilterContext.tsx`
- `web/src/fleet-filter.ts`
- `web/src/components/FleetFilterSelect.tsx`
- `web/src/api.ts`
- `web/src/pages/DashboardPage.tsx`
- `web/src/pages/InspectionsPage.tsx`
- `web/src/pages/IssuesPage.tsx`
- `web/src/pages/HistoryPage.tsx`
- `web/src/pages/ExportPage.tsx` (exclusion reference only)
- `web/src/pages/ChecklistPage.tsx` (exclusion reference only)
- `web/src/pages/AdminPage.tsx` (exclusion reference only)
- `web/src/styles.css`
- `tests/web-fleet-filter.test.mjs`
- Relevant API handlers may be read to validate security/data-flow assumptions:
  `api/dashboard.ts`, `api/maintenance.ts`, `api/vehicles.ts`,
  `api/issues.ts`, `api/history.ts`, and `api/admin/fleets.ts`.

## Out of scope and permission boundaries

- Do not edit implementation or test files.
- Do not inspect or change `.env*`, database targets, migrations, Vercel/EAS
  configuration, production data, or credentials.
- Do not commit, push, merge, deploy, install dependencies, or mutate git.
- Do not broaden the task into the Expo mobile app or excluded web routes.
- Write findings and the required receipt only to
  `work/handoffs/fleet-filter-all-pages-20260902/receipt.md`.

## Implementation summary

- `FleetFilterProvider` is mounted around the shared authenticated layout, so
  an admin's single selected fleet persists across nested route navigation.
- The provider gets fleet options from the existing admin fleet endpoint.
  Admin `undefined` means all company fleets. Non-admin scope always derives
  from the signed-in user's assigned fleet. Option refresh is limited to the
  four eligible routes and reruns after returning from Admin or another route.
- A reusable `FleetFilterSelect` is rendered only by Dashboard, Inspections,
  Issues, and History.
- Existing Dashboard-local fleet state was removed. Its dashboard and
  maintenance requests now consume the shared scope.
- Issues and History now consume the shared scope and clear stale detail state.
  History adds a request generation guard so stale pagination cannot append
  rows after the filter changes.
- The inspection vehicle request helper now serializes `fleetId`; the page
  reloads the server-scoped roster and clears old vehicle rows immediately.
- Export keeps its existing report-specific selector. Checklist and Admin do
  not receive the shared selector or shared scope.

## Security and domain assumptions to validate

- The backend remains authoritative. Dashboard, Maintenance, Vehicles,
  Issues, and History ignore client fleet selection for non-admins and use the
  JWT fleet; missing non-admin fleet fails closed.
- Live filtering is intentionally single-select. Multi-fleet selection remains
  limited to excluded export flows.
- `/api/admin/fleets` is admin-only and may include fleets represented only by
  inactive vehicles; selecting one can legitimately produce empty operational
  results. No endpoint behavior was changed in this task.
- History uses inspection-time fleet snapshots while operational pages can use
  current vehicle membership. This pre-existing semantic difference is out of
  scope unless the new client wiring introduces an additional defect.

## Acceptance criteria

1. Admins can choose All Fleets or one exact fleet on Dashboard, Inspections,
   Issues, and History, and the chosen value persists while navigating among
   those pages.
2. Dashboard sends the scope to both dashboard and maintenance data loads.
3. Inspections sends the scope to `/api/vehicles`, replaces stale roster/editor
   state safely, and keeps downstream vehicle-ID authorization intact.
4. Issues and History send the scope on every relevant load; History pagination
   cannot append stale data after a scope change.
5. Supervisors cannot use client state to escape their JWT fleet.
6. Export, Checklist, Admin, Login, and the Expo app are unchanged by the
   shared filter behavior.
7. Responsive header layout remains usable and no material React lifecycle,
   race, accessibility, or performance regression is introduced.
8. Tests meaningfully lock the route matrix and request wiring without claiming
   backend behavior they do not exercise.

## Evidence already collected

- `npm run build` in `web/`: passed (`tsc --noEmit` and Vite production build).
- Targeted test:
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/web-fleet-filter.test.mjs`
  passed 5/5.
- In-app browser against local mock data:
  - FLEET-B filtered Dashboard from two vehicle types to Van only.
  - Selection persisted to Inspections, Issues, and History.
  - Inspections showed only TEST-B / FLEET-B.
  - Issues showed only the FLEET-B row.
  - History summary and row reflected only FLEET-B.
  - Export exposed exactly its independent `#export-fleet` selector, reset to
    All Fleets; Checklist and Admin had no shared `.fleet-select`.
  - 390x844 Inspections header/filter visually inspected without overlap.
  - Browser console error log was empty.
- `git diff --check`: passed.

The first fallback review requested five changes around raw fleet identity,
route refresh, stale inspection/history state, and pagination generations. All
five were fixed and the fallback re-review approved the updated snapshot. The
local Claude Code CLI was attempted both normally and in bare mode but could
not start because it is not authenticated; see `receipt.md`.

## Required output

Write `receipt.md` with:

- observed provider/model/effort;
- files and diff reviewed;
- checks run and results;
- findings ordered by severity with exact file/line references;
- assumptions and unresolved risks;
- explicit verdict: `APPROVE` or `CHANGES REQUESTED`;
- readiness for Codex integration.

If there are no findings, say so explicitly. Do not edit the source.
