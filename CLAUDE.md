# CLAUDE.md

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

- **Commands:** gate = `npm run typecheck` at the root + `npm run build:dashboard`.
  There are NO test or lint scripts — the compiler is the whole net; report changes as
  "builds and typechecks; untested by design" and read the full diff before pushing.
  GitHub Actions runs both gates on every pull request and push to `main`; rely on CI
  for the broad gate unless diagnosing a CI failure.
- **Tenancy:** every new domain query must be scoped by the JWT `companyId`. Admin means
  company admin, not cross-company platform admin.
- **i18n:** UI strings exist in TWO files with non-corresponding keys
  (`web/src/i18n.ts` AND `lib/i18n.ts`) — change both, Thai and English.
- **Git:** this checkout carries deliberate uncommitted WIP (vercel.json, package.json,
  seed scripts) — NEVER `git add -A`; commit only your task's files by explicit
  pathspec. Parallel sessions are real: check `git status` + `git log -1` immediately
  before committing.
- **Deploy:** a push to `main` starts a Vercel web production deploy after
  GitHub Actions gates pass. A newer push cancels the superseded workflow, leaving
  the newest green `main` SHA as the deployment candidate. Pull requests never deploy. Keep
  `git.deploymentEnabled:false` in `vercel.json` to prevent a duplicate Vercel
  Git deployment. Mobile (Expo/EAS) releases remain the user's call only.
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
  the dashboard/unit-status APIs; backs the Active donut and the weekly-donut denominator
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
  telematics it falls back to `totalVehicles − outOfService.total`. Pre-Route/Post-Route/
  Weekly donut denominators switch to the Active set once telematics is on, not full fleet.
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
