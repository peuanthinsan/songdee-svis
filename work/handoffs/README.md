# Cross-provider handoffs

Create one directory per task with `handoff.md`, optional `evidence/` and
`output/`, plus `receipt.md` and `task-state.yaml`. The active root writes the
handoff; the delegated provider writes only assigned output paths and the
receipt. Freeze the base ref, scope, evidence, acceptance criteria, and
permissions before delegation. Never commit, push, merge, deploy, or mutate
production from a delegated lane.
