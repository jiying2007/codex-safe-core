# GitHub repository governance

`repository-governance-contract.json` is the machine-readable server-side governance baseline for every active Codex Safe Family repository.

The baseline requires an active Ruleset covering the default `main` branch with:

- pull requests required before merge;
- at least one approving review, stale-review dismissal, and last-push approval;
- a non-empty strict required-status-check set;
- branch deletion blocked;
- non-fast-forward updates / force-push blocked;
- no more than the explicitly bounded bypass actor count.

`Repository Governance` remains the scheduled/manual audit surface, but it is no longer the only enforcement point. Formal Core Release Validation executes the same server-side audit before a trusted release can publish. Family Snapshot creation executes the audit before any snapshot or Family Manifest can be generated. The shared Family Release Guard executes it before a consumer release is authorized. Repository tests and workflow YAML are not substitutes for these server-side controls.

## Fail-closed release behavior

If any active Family repository lacks a contract-compliant Ruleset, the release/snapshot operation fails with `EREPOSITORYGOVERNANCE`. This is intentional. A missing Ruleset cannot be downgraded to a warning, substituted by a repository-local test, or bypassed with a synthetic receipt.

The check covers all six active repositories as one Family control. A release from one product is therefore not allowed to proceed while another active Family repository has lost its server-side baseline.

## Required administrative action

The GitHub App used by automation intentionally has no repository-administration write authority, so Rulesets must be created in GitHub repository settings by an authorized administrator. Use the same contract for:

- `jiying2007/codex-safe-core`
- `jiying2007/codex-review`
- `jiying2007/codex-commit`
- `jiying2007/codex-pr`
- `jiying2007/codex-review-service`
- `jiying2007/codex-diagnose`

After the Rulesets are installed, run the `Repository Governance` workflow manually once. It must pass before server-side governance is considered closed. Until then, new formal releases and Family manifests are expected to remain blocked.
