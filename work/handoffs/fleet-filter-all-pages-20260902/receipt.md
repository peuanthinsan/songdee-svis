# Review receipt

## Status and provenance

- Requested review: Claude Code, opposite-provider, read-only
- Requested effort: high
- Claude model/effort observed: UNKNOWN; no review session started
- Claude result: BLOCKED — the local CLI reported that it was not logged in
  in both normal and bare modes
- Fallback reviewer: Codex read-only subagent / inherited GPT-5 surface /
  UNKNOWN effort
- Fallback review result: **APPROVE**
- Base commit: `c119e72df98b5a1cabab5971380b0b53fd37cb6c`
- Reviewed artifact: final uncommitted working-tree diff after the fixes below

This is a fallback receipt, not proof that the repository's preferred
opposite-provider review was completed.

## Files reviewed

- `web/src/App.tsx`
- `web/src/FleetFilterContext.tsx`
- `web/src/fleet-filter.ts`
- `web/src/components/FleetFilterSelect.tsx`
- `web/src/api.ts`
- `web/src/pages/DashboardPage.tsx`
- `web/src/pages/InspectionsPage.tsx`
- `web/src/pages/IssuesPage.tsx`
- `web/src/pages/HistoryPage.tsx`
- Exclusion references: `web/src/pages/ExportPage.tsx`,
  `web/src/pages/ChecklistPage.tsx`, `web/src/pages/AdminPage.tsx`
- `web/src/styles.css`
- `tests/web-fleet-filter.test.mjs`
- Relevant fleet-aware API handlers listed in `handoff.md`

The reviewer changed no implementation or test files and did not mutate git.

## Initial findings and disposition

1. **[P1] Stale saved inspection history on fleet/vehicle changes** — fixed.
   `web/src/pages/InspectionsPage.tsx:206` and `:328` now clear saved rows
   and detail state, and `:855` suppresses rows while replacement history is
   loading.
2. **[P1] Invalid custom History dates retained the previous fleet's data** —
   fixed. `web/src/pages/HistoryPage.tsx:159` clears history and pagination
   state before date validation.
3. **[P2] Raw fleet IDs were trimmed before exact-match API requests** — fixed.
   `web/src/fleet-filter.ts:8` deduplicates while preserving the exact server
   value, including whitespace and case; the regression test covers distinct
   spaced and unspaced values.
4. **[P2] Fleet options became stale after Admin changes or a transient fetch
   failure** — fixed. `web/src/FleetFilterContext.tsx:54` refreshes options on
   eligible-route entry, retains the last successful list on failure, and
   validates removed selections after a successful refresh.
5. **[P2] Stale History pagination could unlock a newer request** — fixed.
   `web/src/pages/HistoryPage.tsx:209` guards the loading-state release by the
   request generation, and effect cleanup invalidates the prior generation.

The fallback re-review found no remaining correctness, race, authorization,
route-exclusion, accessibility, or React lifecycle issue in the reviewed scope.

## Checks and evidence

- Targeted Node test: passed 5/5.
- Web TypeScript and production Vite build: passed.
- `git diff --check`: passed.
- In-app browser with local non-production mock data:
  - shared selection scoped all four eligible pages;
  - incomplete custom dates cleared the previous fleet's History rows;
  - fleet options reloaded on eligible route entry;
  - Export retained only its independent report filter;
  - Checklist and Admin had no shared selector;
  - 390x844 Inspections layout visually inspected;
  - console errors: none.

## Assumptions and unresolved risk

- Existing API authorization remains authoritative; handlers were not changed.
- Fleet IDs remain raw exact-match text keys.
- Historical snapshot-vs-current-membership semantics are pre-existing and out
  of scope.
- Strict process risk remains: an authenticated Claude reviewer should rerun
  this final snapshot if opposite-provider approval is mandatory before commit
  or release.

## Verdict

**APPROVE (same-provider fallback).** The implementation is technically ready
for Codex integration. Opposite-provider review remains pending solely because
the available Claude Code CLI is not authenticated.
