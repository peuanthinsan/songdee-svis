# Dashboard metrics and app-wide bug audit — 2026-08-20

## Contract

- Objective: audit the app for bugs and edge cases, reconcile dashboard statistics with the documented business rules, and identify or implement high-value improvements that answer operator questions.
- Requested lane: read-only plan, followed by active-root implementation and opposite-provider review.
- Active root: Codex desktop (`/Users/peuan/songdee-svis`).
- Delegated provider: Claude Fable planner/reviewer if available; no delegated writer lease.
- Base ref: `b0b52faf4cb087d72920d1cc6c8892b1c2c16ecd`.
- Writer lease: active root owns all source changes; delegated lanes may write only their own receipt/output if invoked.

## In scope

- `api/dashboard.ts`, `web/src/pages/DashboardPage.tsx`, dashboard API types and translations.
- Existing dashboard metric documentation and relevant tests.
- Cross-cutting inspection, authentication/RBAC, maintenance, telematics, and mobile-layout edge cases discovered from source review.
- Focused regression tests for validated findings.

## Out of scope / prohibited

- `.env*`, production database writes, migrations, Vercel configuration, deployment, EAS release artifacts, git commit/push/merge.
- Broad unrelated refactors.
- Treating missing live database telemetry as measured production data.

## Acceptance criteria

1. Dashboard formulas are checked against the repository’s current business rules and discrepancies are documented or fixed.
2. At least the highest-value validated bug/edge cases receive focused regression coverage.
3. Dashboard improvements are source-backed, role-scoped, and explicit about denominator/data freshness limitations.
4. `npm run typecheck`, `npm test`, and `npm run build:dashboard` pass after implementation, subject to the repository’s local-test agreement.
5. Opposite-provider review is recorded with model/effort metadata or explicitly marked unavailable.

## Evidence to collect

- `CLAUDE.md`, `Specification.md`, dashboard API/UI/types, relevant tests, and git diff/status.
- Planner and reviewer receipts from the hybrid lane, when the Claude CLI is available.
