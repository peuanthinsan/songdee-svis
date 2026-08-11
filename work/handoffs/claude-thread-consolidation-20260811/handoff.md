# Claude thread consolidation — 2026-08-11

## Contract

- Objective: consolidate every unresolved Claude thread for `songdee-svis`, integrate still-valid changes, and resolve the newly reported inspection issues.
- Requested lane: implement and verify.
- Active root: Codex desktop (`/root`).
- Delegated provider: Claude Code (historical source threads only; no active writer lease).
- Observed provider/model/effort: historical Claude sessions include Claude Opus 5 / max; otherwise `UNKNOWN`.
- Base ref: `origin/main` at `8c6ccc9` after a fresh fetch on 2026-08-11.
- Writer lease: Codex owns this isolated worktree and all candidate implementation paths for this task.

## In scope

- Classify and integrate or supersede unmerged Claude changes from local Claude branches.
- Fix Van checklist configuration persistence.
- Remove the unusable “Pass All” tab/control.
- Preserve completed Daily Check results when the item list is reopened.
- Make “Return to Center” start neutral instead of defaulting to Pass.
- Verify and repair incomplete Weekly questions against the canonical checklist source.
- Determine and, if repository-native and bounded, expose inspection access from the PC Dashboard.
- Determine actual report-retention behavior from repository evidence.
- Close the previously validated public tenant/user-enumeration findings with focused tests.

The user explicitly confirmed the pie chart is working; it is excluded from changes.

## Allowed paths

- `app/**`
- `components/**`
- `lib/**`
- `web/src/**`
- `api/**`
- `scripts/**`
- `tests/**`
- `CLAUDE.md`
- `work/handoffs/claude-thread-consolidation-20260811/**`

## Out of scope / prohibited

- `.env*`, database targets, SQL migrations, Vercel configuration, and EAS release artifacts.
- Production database writes, deployments, pushes, merges to `main`, or other external mutations.
- Unrelated refactors or edits to the user's dirty primary checkout.

## Evidence

- Claude session logs under `~/.claude/projects/*songdee-svis*`.
- Local Claude branches and worktrees.
- User bug reports in the active Codex task.
- Current source and focused test behavior in this worktree.

## Acceptance criteria

1. Every unresolved Claude branch/task is listed and classified as integrated, superseded, already landed, or external-only.
2. Reported inspection behaviors have focused regression coverage where feasible and pass targeted checks.
3. Van checklist additions survive closing and reopening the configuration window.
4. Completed Daily results are not cleared or silently rewritten by viewing the list.
5. Return-to-Center starts neutral, Weekly uses the complete canonical list, and Pass All is removed.
6. Public endpoints no longer disclose tenant/user rosters without an appropriate security boundary, while legitimate login behavior remains usable.
7. No prohibited paths or user WIP are changed.

## Required proof

- Final diff audit.
- Smallest targeted tests covering each changed behavior.
- Relevant type/build checks only where needed to prove integration.
- `receipt.md` with exact commands, results, assumptions, and remaining risks.
