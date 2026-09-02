# CLAUDE.md

@WORKSPACE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Songdee Vehicle Inspection System (SVIS) — a multi-company mobile app and web dashboard for recording and monitoring fleet vehicle inspections. Drivers inspect vehicles, supervisors monitor fleet status, and company admins have visibility across their company's fleets.

**This repo supersedes the customer-specific DVIS skins.** DHL Express is the first and default company tenant. Existing DHL production data is assigned to the DHL tenant by migration `019`.

See `Specification.md` for the full SRS.

## Tech Stack

- **Mobile**: Expo (React Native) — Android first, iOS second
- **Database**: Neon Postgres with Row-Level Security (RLS)
- **Auth**: Custom company/username/password — bcrypt (12 rounds) hashed in the `users` table; JWT (`jsonwebtoken`, 7d expiry) signed with `JWT_SECRET`. Company + role + fleet are signed into each session.
- **DB Auth**: Per-request Postgres session settings (`app.user_company_id`, `app.user_role`, `app.user_fleet_id`) set in `lib/db.ts#createDbClient()`; RLS policies read these via `current_setting(...)`
- **Photo Storage**: Vercel Blob (defect photos, before/after repair)
- **Email**: SendGrid via `@sendgrid/mail` (auto-notify fleet managers on inspection fail); the `resend` package was removed from package.json
- **API**: Vercel Functions

## Running DB scripts — read this before any migration or seed

Every script in `scripts/` reads `.env.local`, and there is **no dev/prod distinction**:
whatever `DATABASE_URL` names is what gets written. On 2026-07-25 a stale `.env.local`
still pointed at a decommissioned us-east-1 Neon endpoint while production had moved to
ap-southeast-1. A migration and a 359-vehicle import landed in the dead database and were
reported as successful — the verification queries read the same wrong file. Deploying code
that needed the new column then took production down.

Every write script therefore goes through `scripts/lib/db-target.js`, which prints the
target host/database/region and **refuses to write without `--confirm`**:

```
node scripts/seed-db.js               # refuses, prints the target
node scripts/seed-db.js --dry-run     # shows the full plan, writes nothing
node scripts/seed-db.js --confirm     # writes
```

Read the printed host before confirming. `.env.local` is not authoritative — Vercel is:

```
vercel env pull /tmp/p.env --environment=production --yes \
  && grep '^DATABASE_URL=' /tmp/p.env | sed -E 's|.*@([^/]+)/.*|\1|' && rm /tmp/p.env
```

`column X does not exist` immediately after you "applied" a migration means **wrong
database**, not "migration pending". New write scripts must call `requireConfirmedTarget()`.

## Workflow & governance

- **Commands:** gate = `npm run typecheck` + `npm test` at the root + `npm run build:dashboard`.
  There is NO lint script. `npm test` runs `node --test` over `tests/*.test.mjs` — a glob, so
  a new `tests/*.test.mjs` file is picked up automatically. Read the full diff before pushing.
  GitHub Actions runs all three gates on every pull request and push to `main`; rely on CI for
  the broad gate unless diagnosing a CI failure.
  **Know what the gate does NOT cover.** `tsconfig.json`'s `include` lists only `**/*.ts` and
  `**/*.tsx`, so no `.js` file is ever matched and `tsc --noEmit` never reads one — nothing in
  `scripts/` is compiled by anything, and `build:dashboard` only builds `web/`. (Note it is the
  `include` globs that do this, NOT `allowJs`: the repo extends `expo/tsconfig.base`, which sets
  `allowJs: true`. `allowJs` only *permits* a `.js` file to compile once matched; it never adds
  one. Verify with `npx tsc --noEmit --listFiles | grep /scripts/` — zero hits.) A change
  confined to `scripts/` passes typecheck and build whether it works or not. Prove that code
  by running it and asserting on the observable behaviour; do not report "typechecks" as
  if it were coverage.
  Two parts of `scripts/` do have real coverage. `tests/company-target.test.mjs` unit-tests
  `scripts/lib/company-target.js` (tenant selection). And `tests/db-target-guard.test.mjs`
  covers the `.env.local`/wrong-database guard: it spawns every script that calls
  `requireConfirmedTarget()` against a fake host and asserts each one refuses before
  connecting. Its classification matrix is derived from disk by a recursive scan, so **adding a
  new guard-calling script anywhere under `scripts/` fails that suite until you classify it**
  by whether it connects during `--dry-run`. That suite is a complete net for scripts that
  return before connecting, and only a partial one for the three that legitimately read during
  `--dry-run` (`seed-db.js`, `seed-users-postgres.js`, `wipe-history.js`) — see its header
  comment for the exact limits. Every other `.js` file under `scripts/` has no automated
  coverage at all.
- **Tenancy:** every new domain query must be scoped by the JWT `companyId`. Admin means
  company admin, not cross-company platform admin.
- **i18n:** UI strings exist in TWO files with non-corresponding keys
  (`web/src/i18n.ts` AND `lib/i18n.ts`) — change both, Thai and English.
- **Git:** this checkout may carry deliberate uncommitted WIP, and which files are dirty
  changes over time — do not trust a list written here. NEVER `git add -A`; commit only
  your task's files by explicit pathspec. Parallel sessions are real: check `git status`
  + `git log -1` immediately before committing.
- **Deploy:** a push to `main` IS a production release — automatic, no human step, no
  manual command. Never end a response with a `vercel deploy --prod` block for this repo;
  the pipeline already deployed, and a manual run would only add a redundant second
  deployment. Vercel's Git integration is the authoritative production deploy path;
  `git.deploymentEnabled: true` in `vercel.json` is intentional. A push to `main` creates a
  production deployment within about 5 seconds, but creation is not live — it serves
  production only once the build finishes (~30s+). GitHub Actions runs gates only
  (typecheck, unit tests, dashboard build) and does NOT deploy; do not re-add a deploy job
  there, since two armed paths produce two racing production deployments of the same
  commit and whichever finishes last wins. This was the real state from commit `8a01fd5`
  until 2026-08-05 (verified: SHA `032ee6a` went out as `git` at 10:00:32 and again as
  `cli` at 10:15:53). **What gates production (2026-08-05):** Vercel does NOT wait for
  Actions — it starts building seconds after the commit lands, while gates take ~40s. So
  the gate is on what ENTERS `main`, not on the deploy: branch protection on `main`
  requires the `gates` check, with `strict: true` (the branch must be up to date with
  `main`, so the tree that passed gates is the tree that lands) and `enforce_admins: true`
  (no bypass, including for the repo owner). State the guarantee precisely, because it is
  narrower than "everything goes through a PR" AND narrower than "every landed SHA was
  checked": **what is guaranteed is the tree, not the SHA — the content that lands on
  `main` is content that passed `gates`.** GitHub evaluates required checks against the PR
  *head* SHA; the merge button then creates a brand-new merge commit that carries no checks
  of its own, and `gates` runs on that merge SHA only afterwards, as a report. `strict:
  true` is what makes this sound: with the branch up to date, the merge commit's tree is
  identical to the tested head's tree (verified 2026-08-05 — `merge^{tree}` ==
  `merge^2^{tree}` on `cd13c69`, `3c56533`, and `c03d855`). Do NOT restate this as a
  per-SHA guarantee; that is false for every merge-button landing, which is how all of
  PR #8–#14 landed. `required_pull_request_reviews` is deliberately `null` — a solo
  maintainer cannot self-approve, so requiring review would deadlock `main`. Consequence: a
  fresh local commit is rejected outright (no check exists for its SHA), while the green
  head of an open PR *can* be fast-forwarded straight to `main` without the merge button,
  because that SHA already carries the check. The remaining limit: this gates entry to
  `main` only, and
  anything that reaches `main` deploys immediately regardless. Weakening `strict` or
  `enforce_admins`, or an admin editing or deleting the protection rule itself, re-opens
  the ungated path to production. **History warning:** on 2026-08-05 commit `18bee72` set
  `git.deploymentEnabled` to `{"main": false}` to disarm the duplicate, but the Actions
  deploy job it left as the sole path was already broken. Most consistent explanation —
  inferred, not proven: the `VERCEL_TOKEN` secret lost team access about four days after
  being minted, giving "You do not have access to the specified account" where the earlier
  failure had said "token ... is not valid". What was actually tested: both
  `team_1ZYOKeXRL8nUJkgFD8pCksSt` and `uthens-projects` resolve fine as `--scope` values
  against a valid credential. What was NOT tested: the secret itself (GitHub secrets cannot
  be read back), and the CLI version that actually failed — the scope test ran on 58.0.0
  while the failing job installed 58.5.1 via unpinned `vercel@latest`, so a CLI regression
  is not fully excluded, and if it were one then the unpinned install is itself the bug.
  That broken sole path killed production deploys outright and stranded `main` two commits
  ahead of production. Do not assume a non-expiring token makes an Actions-owned path safe — access
  can be lost without expiry; verify any such path actually deploys before relying on it,
  and do not disable the Git path again unless an alternative has been verified working
  first. Vercel promotes by
  build-completion order, not commit order: if two merges land seconds apart and the older
  commit's build finishes last, production serves the OLDER commit; branch protection does
  not fix this, so after rapid back-to-back merges, verify the deployed SHA and redeploy if
  production is serving the older one. Branch pushes and pull requests do get Vercel
  preview deployments (the integration stays connected for non-`main` branches), but never
  production. Mobile (Expo/EAS) releases remain the user's call only.
- **Models:** plan on Fable/Opus; code with Codex by default (codex-delegation skill — Codex prompts must forbid git); review/verify/git on Fable/Opus.

## Codex Delegation

Codex implements features via `codex-delegation` / `codex-build` skills:
- **Codex profiles:** light (Luna/medium) for mechanical work, build (Terra/high) for features/tests/debugging
- **No git access:** Codex receives all edits via Write/Edit tools only; never runs `git commit`, `git push`, or git state changes
- **Staging/commit by Haiku root:** after Codex completes and passes review, the Haiku root stages/commits explicitly by pathspec
- **Max 2 fix rounds:** after two focused fix rounds in same thread, escalate to `deep` (Sol/xhigh) or `hybrid-sonnet-implementer` fallback

## Architecture

### Core Tables

- `vehicle_master` — plate number, fleet category, `region` (`metro`/`provincial`, migration
  `017`, drives the tire-replacement interval), `vendor_email` (migration `016`, repair-vendor
  notify target), fleet manager email (read-only for non-admins)
- `inspection_logs` — daily/post-route/weekly checks per vehicle (date, vehicle_id,
  `frequency`, inspector, pass/fail, photo URLs, `mileage` — the sole odometer source, the
  telematics sheet has none), plus `vehicle_usable` (migration `017`, final checklist
  question — drives Out of Service; `NULL` on legacy pre-migration rows)
- `issue_reports` — repair tracking linked to failed inspections (status, before/after
  photos, `vendor_notified_at`, migration `016`)
- `vehicle_activity_log` (migration `017`) — one row per vehicle per Bangkok day the
  telematics sheet showed it GPS-online (`running`/`stopped`); written as a side effect of
  the dashboard/unit-status APIs; preserves daily GPS activity history
- `vehicle_maintenance` (migration `017`) — admin-entered preventive-maintenance baselines
  (last service/tire/battery date + mileage); no seed data, every vehicle starts `noData`
- `companies` (migration `019`) — active customer tenants; DHL is seeded as the default
- `app_settings` (migration `014`, company-scoped by `019`) — key/value config, notably `unit_status_sheet_url`
- `users` — company, username, bcrypt `password_hash`, `role` (`driver` | `supervisor` | `admin`), `fleet_id`. Authenticated via `/api/auth/login`, which returns a company-scoped JWT

Full metric-by-metric formulas (numerators, denominators, edge cases) live in
`docs/METRICS.md` — read it before trusting any dashboard/unit-status number from memory.

### Key Business Rules

- **Daily reset**: a vehicle is "checked" (green) if it has an inspection log for today's date, otherwise "pending" (red)
- **Mandatory photo on fail**: if any check item fails, photo upload is required before saving
- **Auto-email on fail**: saving a failed inspection triggers a SendGrid email to the fleet manager with vehicle ID, inspector name, and defect photos
- **Repair closure requires completion photo**: mechanics must upload proof-of-repair photo to close an issue
- **RBAC**: Every role is restricted to its company. Supervisors see only their assigned fleet; admins see all fleets inside their company.
- **Active is telematics-based** (shipped 2026-07, `371b2da`): when
  `app_settings.unit_status_sheet_url` is configured, a vehicle is "Active" if the
  telematics sheet shows it `running`/`stopped` (not `offline`) for the day; without
  telematics it falls back to `totalVehicles − outOfService.total`. Pre-Route,
  Post-Route, and Weekly completion are independent of GPS activity: their numerators come
  from saved inspections and their denominators are the selected active fleet roster.
- **Out of Service now comes from a checklist question, not defect count**: driven by
  `inspection_logs.vehicle_usable` (migration `017`, "is the vehicle usable?"), taking each
  vehicle's *most recent* non-null answer. Replaces the earlier open-defect-count proxy;
  legacy pre-`017` inspections have `vehicle_usable = NULL` and don't count either way.
- **Pending Inspection is a second, distinct list from the per-column "Pending" indicator**:
  the unit-status tab labeled "Pending Inspection" (`needsAttention` internally) requires a
  GPS-active vehicle to have completed daily, post-route, *and* weekly inspections to clear
  — not the same UI concept as the per-column "รอตรวจ"/Pending cell shown inside individual
  Pre-Route/Post-Route/Weekly columns.
- **Role-scoped needsAttention**: GPS rows are matched by plate to active `vehicle_master`
  rows inside the JWT company and effective fleet before `needsAttention` is computed.
  Database fleet membership is authoritative; non-admins are locked to `user.fleetId`.
- **Preventive maintenance** (Admin → Maintenance, `api/maintenance.ts`): engine check-up
  every 10,000 km; tires every 40,000 km (metro) / 30,000 km (provincial) OR 24 months,
  whichever comes first; battery every 18 months. Mileage projections use only
  `inspection_logs.mileage` history — the telematics sheet carries no odometer field.
- **Vendor email**: `vehicle_master.vendor_email` (migration `016`) plus
  `issue_reports.vendor_notified_at` drive the "Notify vendor" action on the open-defects
  list.

### RLS Strategy

API routes verify the JWT (`lib/api-auth.ts#verifyAuth`) and explicitly scope domain queries by `companyId`. The optional per-request DB client also sets `app.user_company_id`, `app.user_role`, and `app.user_fleet_id`. RLS policies provide defense in depth: company scope always applies, while admins bypass only the fleet filter. `users` and `audit_log` are gated at the API layer.

## Branding

SVIS platform identity: navy (`#06264B`), cyan (`#00A6C8`), Songdee red, white, and the vehicle-inspection shield artwork. Customer colors are stored on `companies` and used as workspace context.
