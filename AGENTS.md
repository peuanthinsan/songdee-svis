# SVIS agent contract

Read [WORKSPACE.md](WORKSPACE.md) for the provider-neutral Codex/Claude root,
handoff, review, and recovery rules. The active root owns integration and git;
delegated lanes receive exact paths and must not commit, push, merge, or deploy.

Preserve deliberate user WIP and inspect `git status` before editing. Do not
touch `.env*`, database targets, migrations, Vercel configuration, or EAS
release artifacts without an explicit task scope and safety check.
