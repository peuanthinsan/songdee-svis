# Receipt

## Provider accounting

- Active root: Codex desktop; observed model/effort: `UNKNOWN` / `UNKNOWN`.
- Requested reviewer: Claude Fable, high effort, read-only review lane.
- Availability check: `claude auth status` returned `loggedIn: false`, `authMethod: none`.
- Opposite-provider result: unavailable; no Claude review is represented as completed.
- Fallback review: a fresh independent Codex review checked the frozen patch and reported no findings.

## Files reviewed / changed by the active root

- `api/dashboard.ts`
- `web/src/api.ts`
- `tests/dashboard-metrics.test.mjs`
- `CLAUDE.md`

The review lane changed no source, test, git, database, environment, deployment, or release state.

## Result

- Active remains derived from the scoped GPS snapshot used by embedded Unit Status.
- Pre-Route and Post-Route now count distinct saved inspections for Bangkok today without requiring GPS activity.
- Weekly now counts distinct saved weekly inspections from Bangkok Monday through today without requiring GPS activity.
- All three inspection circles use the selected active fleet roster as their denominator, preserving coherent counts and percentages.
- Existing authenticated-company, effective-fleet, inactive-vehicle, date, and frequency constraints remain intact.
- GPS activity logging remains awaited; only the unused weekly GPS-activity read was removed.

## Verification

- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/dashboard-metrics.test.mjs` — passed (5/5).
- The new regression failed against the old code with Active `0/2` and inspection circles `0/0`; it now passes with Active `0/2` and Pre/Post/Weekly each `1/2`.
- `npm run typecheck` — passed.
- `git diff --check` — passed.
- In-app Browser at `http://127.0.0.1:5173/dashboard` with a local non-production GDR fixture — passed: Active rendered `0/2`, Pre/Post/Weekly rendered `1/2` (50%), no framework overlay appeared, and console warnings/errors were empty.
- Interaction proof — selecting `All Vehicles (2)` showed offline vehicle `68-7043` as Checked for Pre-Route, Post-Route, and Weekly while `68-7070` remained Pending.
- QA screenshots: `/private/tmp/svis-gdr-dashboard-fixed.png` and `/private/tmp/svis-gdr-dashboard-unit-status.png`.

## Assumptions and remaining risk

- Daily and post-route circles intentionally count only the inspection's saved Bangkok date. The user's screenshot labels both visible defects as one day old, so those specific records would not count as today's inspections after this fix.
- Weekly still counts only records whose saved frequency is `weekly`; one daily inspection does not satisfy all three categories.
- Live GDR data and the production GPS sheet were not queried or mutated. Exact GPS plate/status issues can still make Active display zero, but they no longer suppress inspection completion.
- Broad existing test suites were intentionally left to CI under the repository's local-test agreement.
- Opposite-provider review remains unavailable until Claude Code is authenticated.

## Readiness

Ready for integration subject to normal CI.
