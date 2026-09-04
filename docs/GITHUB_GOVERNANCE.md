# GitHub repository governance

`repository-governance-contract.json` is the machine-readable server-side governance baseline for every active Codex Safe Family repository.

The baseline requires an active Ruleset covering the default `main` branch with:

- pull requests required before merge;
- at least one approving review, stale-review dismissal, and last-push approval;
- a non-empty strict required-status-check set;
- branch deletion blocked;
- non-fast-forward updates / force-push blocked;
- no more than the explicitly bounded bypass actor count.

The weekly `Repository Governance` workflow executes `scripts/verify-repository-ruleset.js` against all six active Family repositories. Repository tests and workflow YAML are not substitutes for this server-side control.

## Required administrative action

The GitHub App used by automation intentionally has no repository-administration write authority, so Rulesets must be created in GitHub repository settings by an authorized administrator. Use the same contract for:

- `jiying2007/codex-safe-core`
- `jiying2007/codex-review`
- `jiying2007/codex-commit`
- `jiying2007/codex-pr`
- `jiying2007/codex-review-service`
- `jiying2007/codex-diagnose`

After the Rulesets are installed, run the `Repository Governance` workflow manually once. It must pass before server-side governance is considered closed.
