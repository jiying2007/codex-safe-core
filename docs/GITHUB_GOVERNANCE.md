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
- repository-side `delete_branch_on_merge` enabled as the canonical branch-lifecycle hygiene setting.

`CI Gate` is the single server-required merge context and therefore owns every merge-blocking pull-request check. Product tests, security analysis, dependency review, Family Release Guard and any product-specific Extension Host, GitLab system or fault-injection checks must either run directly in `ci.yml` or be invoked from it as reusable jobs before `CI Gate` completes. Weekly/manual evidence workflows may remain separate, but an independently triggered PR workflow is never relied on as a merge gate.

`CI Gate` does not replace or remove the underlying test matrix. Each repository's `ci.yml` runs the complete applicable product-specific CI graph, then executes `CI Gate` with `if: always()` and fails unless every declared dependency has the explicitly allowed successful outcome. This keeps the Ruleset independent of matrix names, runner versions and job fan-out while retaining the same test strength.

`Repository Governance` remains the scheduled/manual audit surface, but it is not the only enforcement point. Formal Core Release Validation executes the same **Ruleset** audit before a trusted release can publish. Family Snapshot creation executes the Ruleset audit before any snapshot or Family Manifest can be generated. The shared Family Release Guard executes it before a consumer release is authorized. Repository tests and workflow YAML are not substitutes for these server-side controls.

## Fail-closed release behavior

If any active Family repository lacks a contract-compliant Ruleset, the release/snapshot operation fails with `EREPOSITORYGOVERNANCE`. This is intentional. A missing or drifted Ruleset cannot be downgraded to a warning, substituted by a repository-local test, or bypassed with a synthetic receipt.

The check covers all six active repositories as one Family control. A release from one product is therefore not allowed to proceed while another active Family repository has lost its server-side Ruleset baseline.

### Least-privilege observability boundary

GitHub's repository REST API exposes merge-related settings such as `delete_branch_on_merge` only when the caller has both Contents read and write permission. Release Validation deliberately keeps `GITHUB_TOKEN` read-only, so that field can be absent even when the server setting is enabled.

The verifier therefore distinguishes **false** from **unobservable**:

- when `delete_branch_on_merge` is visible and `false`, governance fails closed;
- when it is visible and `true`, the administrative hygiene control is verified;
- when a least-privilege token cannot observe the field, the result records `administrativeMetadata.deleteBranchOnMerge = null` / `observable = false` and does not invent `false` or `true`.

This exception applies only to the merge-related repository hygiene field. The security-critical Ruleset contract remains server-read, exact and release-authoritative. We intentionally do not give Release Validation Contents write permission merely to reveal a read-only merge setting, and we do not store a long-lived repository-administration PAT in normal CI.

An administrator verification using the short-lived migration token can observe this field and must return `true`; this is the authoritative check for native merged-branch cleanup.

## Administrator migration and repair

The GitHub App used by normal Family automation intentionally has no repository-administration write authority. Administrators use `scripts/apply-repository-governance.js` with a short-lived token that has repository **Administration: write** access.

The script is **dry-run by default**. After `CI Gate` has successfully appeared in all six repositories, run:

```bash
GH_TOKEN=... node scripts/apply-repository-governance.js
GH_TOKEN=... node scripts/apply-repository-governance.js --apply
```

`--apply` is the authoritative governance phase. It updates all six Rulesets, enables GitHub's native `delete_branch_on_merge`, and verifies the resulting server state before returning success. It does **not** delete historical branch refs, so the governance token does not need repository Contents write access.

Use `--zero-bypass` when a second trusted reviewer is available and no maintainer bypass is required. Without that option, existing bounded bypass actors are retained but converted to `pull_request` mode.

Historical merged-branch cleanup is a separate optional hygiene phase. Only when branch cleanup is desired, use a short-lived token that additionally has repository **Contents: write** and run:

```bash
GH_TOKEN=... node scripts/apply-repository-governance.js --apply --clean-branches
```

The cleanup phase removes only local branches that have a merged same-repository PR, have no open PR, and whose current ref still exactly equals the merged PR head SHA. Advanced or reused branches are preserved. A branch-cleanup permission failure cannot roll back or invalidate governance already applied in phase 1.

The canonical repositories are:

- `jiying2007/codex-safe-core`
- `jiying2007/codex-review`
- `jiying2007/codex-commit`
- `jiying2007/codex-pr`
- `jiying2007/codex-review-service`
- `jiying2007/codex-diagnose`

After an apply or repair, run the administrator verifier with the short-lived token once; it must report the merge setting as observable and true for all six repositories. The normal `Repository Governance` workflow then verifies the release-authoritative Ruleset baseline without escalating its token to write permission.
