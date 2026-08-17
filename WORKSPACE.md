# Cross-provider workspace contract

This repository may be operated from either a Codex root or a Claude Code
root. The active user-facing root owns scope, user decisions, workspace state,
integration, verification, and the final response. The other provider may be
delegated bounded read-only, implementation, or review work.

## Handoffs

- Use `work/handoffs/<task-id>/` for cross-provider work.
- Freeze objective, base ref, allowed paths, evidence, acceptance criteria, and
  requested lane before delegation.
- Only one session may write assigned paths at a time.
- The delegated provider returns its work plus `receipt.md`.
- Any source or scope change invalidates the previous review receipt.

## Root switching

Before switching providers, write task status and receipt, record the exact base
SHA or artifact version, identify dirty-file ownership, and release the writer
lease. The next root starts from the handoff artifact, not chat history.

## Review and mutations

For substantive work, use the opposite provider for review: Codex implementation
is reviewed by Claude and Claude implementation by Codex. Publishing, ticket
changes, deployment, database writes, and production mutations require explicit
approval independent of provider.

Record provider, model, effort, phase, and fallback reason when available. Use
`UNKNOWN` when the active surface did not verify the value.
