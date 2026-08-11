# Claude thread and branch inventory — 2026-08-11

Base audited: `origin/main` / `8c6ccc96d327ab47347457732fdb5447c74306b4`.

No Claude worktree was cleaned, reset, or modified during this audit. Integration
was performed only in the Codex-owned consolidation worktree.

## Unique branch commits

| Commit | Source branch | Status | Disposition |
| --- | --- | --- | --- |
| `d906a40` | `claude/beautiful-mccarthy-1faa83` | Integrated (adapted) | Added the still-valid migration-014 ordering / `ON CONFLICT (key)` explanation to `scripts/migrate-014.js` without changing behavior. The duplicate comment in `sql/014-app-settings.sql` was not imported because SQL migrations are explicitly outside this task's writable scope. |
| `6ffc933` | `claude/brave-golick-462b0a` | Superseded, with one durable wording fix integrated | Current `CLAUDE.md` already states the three gates, current test glob, real script coverage, web typechecking, and deployment behavior more accurately than this older commit. Its durable warning not to identify WIP by a stale filename list was integrated into the current Git guidance. The commit's now-obsolete test-count, web-build, deploy, and routing claims were not restored. |
| `f3daf59` | historical Users pagination branch | Already landed / superseded | PR commit `c47381b` landed the Users API ordering, server-side debounced search, pagination, role filter, `loadMore` i18n, `useDebounce`, and web TypeScript gate. Current `UsersTab.tsx` contains later refinements for list errors and request-state cleanup, so the older branch file was not copied over it. |
| `a0b3b6e` | `claude/charming-dubinsky-524ead` | Integrated across active lanes | Adapted the Vehicles pagination, fleet filter, debounced server search, stale-response guard, Load more flow, panel error handling, and rendered-row-only bulk selection into `web/src/pages/admin/VehiclesTab.tsx`. The existing `loadMore` i18n key was reused. The matching API search widening and stable `id` order tiebreakers in `api/admin/vehicles/index.ts` were integrated by the active root lane. |
| `6fd1bbf` | `claude/company-guard-nits` | Integrated (adapted) | Integrated the diagnostic hardening into `scripts/lib/company-target.js`: accurate duplicate/bare-token messages, JSON-quoted raw operator values, and rejection of stale or unknown option keys before SQL. Added focused regression coverage in `tests/company-target.test.mjs`; no database access is used. |
| `18e9854` | `claude/serene-hermann-29f705` | Superseded | Current `CLAUDE.md` already contains a more accurate version of the gate/blind-spot guidance, including the inherited `allowJs` nuance and the two script areas that now have tests. Applying this older text would reintroduce stale statements, so no direct diff was imported. |
| `0976d4f` | ancestry of the gate-doc branch | Already landed (patch-equivalent) | `git cherry origin/main 18e9854` reports this commit with `-`; its database-target guard changes already exist on main. No action required. |

## Live Claude worktree audit

Read-only status captured on 2026-08-11:

| Worktree | Observed state | Classification / action |
| --- | --- | --- |
| `awesome-swanson-9380fb` | Clean, detached at `18bee72` | Historical worktree; no unresolved file changes. Left untouched. |
| `epic-lamarr-7d443c` | Modified `scripts/wipe-history.js` | The underlying fix was later landed. Local WIP is superseded but deliberately preserved; no cleanup or copy performed. |
| `infallible-kapitsa-81c641` | Clean, detached at `81d2458` | Historical worktree; no unresolved file changes. Left untouched. |
| `jolly-tu-25a85c` | Modified roster/login files plus untracked rate-limit, migration, test, and handoff files | Superseded by the active `security_login` lane. This remains user/Claude WIP; no files were read into the integration, deleted, or modified. |
| `serene-hermann-29f705` | Clean, detached at `18e9854` | Gate-doc commit classified above as superseded. Left untouched. |
| `unruffled-williams-91830d` | Modified `CLAUDE.md` and `vercel.json` | Stale deployment WIP superseded by PR #15/current main. Left untouched; prohibited Vercel configuration was not changed. |
| `users-truncation` | Only untracked `PLAN.md`; branch fix commit `c47381b` | Implementation is already landed on main; the plan artifact was preserved and not copied. |

## Focused verification

- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/company-target.test.mjs` — PASS, 40/40.
- `./node_modules/.bin/tsc --noEmit` from `web/` — PASS. The isolated worktree temporarily referenced the existing primary `web/node_modules` install only for dependency resolution; the temporary symlink was removed immediately after the check.
- `git diff --check` — PASS at the final diff audit.

## Integration dependency satisfied

The Vehicles UI intentionally delegates search to the server so unloaded pages
remain searchable. Its companion API widening and stable ordering were integrated
by the active root lane in `api/admin/vehicles/index.ts`, so the UI and server
changes are present together in the final candidate.
