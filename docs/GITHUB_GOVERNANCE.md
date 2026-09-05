# GitHub repository governance

`repository-governance-contract.json` is the machine-readable server-side governance baseline for every active Codex Safe Family repository.

The baseline requires one active Ruleset named `Codex Safe main protection` covering the default `main` branch with:

- pull requests required before merge;
- at least one approving review, stale-review dismissal, and last-push approval;
- exactly one strict required status context: `CI Gate`;
- branch deletion blocked;
- non-fast-forward updates / force-push blocked;
- at most one explicitly bounded bypass actor;
- bypass limited to `pull_request` mode only; `always` bypass is forbidden;
- repository-side `delete_branch_on_merge` enabled.

`CI Gate` is a stable aggregate context only. It does not replace or remove the underlying test matrix. Each repository's `ci.yml` runs the complete product-specific CI graph, then executes `CI Gate` with `if: always()` and fails unless every declared dependency result is exactly `success`. This keeps the Ruleset independent of matrix names, runner versions and job fan-out while retaining the same test strength.

`Repository Governance` remains the scheduled/manual audit surface, but it is not the only enforcement point. Formal Core Release Validation executes the same server-side audit before a trusted release can publish. Family Snapshot creation executes the audit before any snapshot or Family Manifest can be generated. The shared Family Release Guard executes it before a consumer release is authorized. Repository tests and workflow YAML are not substitutes for these server-side controls.

## Fail-closed release behavior

If any active Family repository lacks a contract-compliant Ruleset, the release/snapshot operation fails with `EREPOSITORYGOVERNANCE`. This is intentional. A missing or drifted Ruleset cannot be downgraded to a warning, substituted by a repository-local test, or bypassed with a synthetic receipt.

The check covers all six active repositories as one Family control. A release from one product is therefore not allowed to proceed while another active Family repository has lost its server-side baseline.

## Administrator migration and repair

The GitHub App used by normal Family automation intentionally has no repository-administration write authority. Administrators use `scripts/apply-repository-governance.js` with a short-lived token that has repository Administration write access.

The script is **dry-run by default**. After `CI Gate` has successfully appeared in all six repositories, run:

```bash
GH_TOKEN=... node scripts/apply-repository-governance.js
GH_TOKEN=... node scripts/apply-repository-governance.js --apply
```

Use `--zero-bypass` when a second trusted reviewer is available and no maintainer bypass is required. Without that option, existing bounded bypass actors are retained but converted to `pull_request` mode. The apply operation also enables GitHub's native merged-branch deletion and removes only stale local branches whose current ref still exactly equals the merged PR head SHA; advanced or reused branches are preserved.

The canonical repositories are:

- `jiying2007/codex-safe-core`
- `jiying2007/codex-review`
- `jiying2007/codex-commit`
- `jiying2007/codex-pr`
- `jiying2007/codex-review-service`
- `jiying2007/codex-diagnose`

After an apply or repair, run the `Repository Governance` workflow manually. It must pass before server-side governance is considered closed.
