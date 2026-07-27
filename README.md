# SVIS

**Songdee Vehicle Inspection System** is a multi-company mobile and web platform for
daily fleet inspections, defect reporting, repair evidence, maintenance planning, and
operations dashboards.

DHL Express is the first and default company. The platform identity stays SVIS while
each company owns its users, vehicles, fleets, checklist, inspections, issues,
maintenance records, and telematics settings.

## Applications

- Expo / React Native mobile app for drivers, supervisors, and admins
- Vite / React dashboard for supervisors and admins
- Vercel Functions API
- Neon Postgres database

## Local development

```bash
cp .npmrc.example .npmrc
npm install
npm start
```

Dashboard:

```bash
npm run dev:dashboard
```

Verification:

```bash
npm run typecheck
npm run build:dashboard
```

Copy `.env.local.example` to `.env.local` and fill in the required credentials. Do not
point local scripts at production unintentionally.

## Security and operational data

Never commit passwords, tokens, database connection strings, employee/user exports,
vehicle registrations, customer contact lists, or private document URLs.

- Local secrets belong in ignored `.env.*` files.
- Operational imports belong in ignored `scripts/data-*.json` files.
- Store screenshots remain local-only until every displayed identity and vehicle is fictional.
- User-seeding passwords must be supplied through `SVIS_SEED_PASSWORD`.
- Admin password resets must use `SVIS_ADMIN_PASSWORD`.
- Public client endpoints such as `EXPO_PUBLIC_API_URL` are configuration, not secrets.

## Multi-company migration

Apply migrations in numeric order. Migration
[`sql/019-multi-company-svis.sql`](sql/019-multi-company-svis.sql) creates the
`companies` table and assigns all existing records to the default DHL tenant.

The migration intentionally invalidates legacy JWT sessions. Everyone signs in again
and selects a company; DHL is selected by default.

To onboard another company:

1. Insert the company in `companies`.
2. Create its admin user with that `company_id`.
3. Add vehicles and checklist items under the same `company_id`.
4. Configure company-specific telematics settings in the SVIS admin dashboard.

Company admins can access every fleet inside their company, but no data from another
company. Supervisors and drivers are additionally restricted to their assigned fleet.

## Branding

SVIS uses navy `#06264B` and cyan `#00A6C8`, with the Songdee red location mark and the
vehicle-inspection shield artwork. Source and store assets are in `assets/`,
`store-assets/`, and `web/public/`.
