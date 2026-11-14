# Trusted PR evidence: verify before autonomy

Status: **read-only shadow observation; no automatic approval, merge or release authority**. This is governance-only and does not create a new Consumer CI/Review/Commit/Diagnosis Receipt.

## Why the event changed

On 2026-11-02, GitHub announced that public repositories without an applicable event-policy exception will have `pull_request_target` **blocked by default on 2026-12-02**, with a brownout on 2026-11-16. See [GitHub Changelog](https://github.blog/changelog/2026-11-02-pull_request_target-blocked-by-default-december-2/). There is no reason to add a privileged event-policy exception solely for optional risk observations.

The former `.github/workflows/trusted-autonomy-shadow.yml` has been **deleted**. Its successful historical `Codex Safe / Trusted Observation` commit statuses are archival, no longer published or required. We do not add them to the server-side Ruleset. No new schedule or model-consuming loop is introduced.

## One observer, two deterministic views

`.github/workflows/trusted-ci-corroboration.yml` reacts to `workflow_run.completed` **only for the canonical `CI` workflow when its source event was `pull_request`**. All work runs from the protected default-branch source checkout, with `contents:read`, `actions:read`, `pull-requests:read`; no `statuses:write`, PR checkout, approval, merge, deployment, Secrets, or model invocation. All PR data and CI metadata are untrusted JSON inputs, never executed as code. CI-run artifacts are not downloaded or executed.

The observer performs these independently checkable predicates inside one read-only execution:

1. Bind the completed CI event to its exact repository, run ID, attempt, workflow ID/path and source head SHA. Re-read GitHub's run metadata around a paginated **13-job** census; do not trust the often-empty `workflow_run.pull_requests` field. Associate the exact commit SHA with **exactly one** PR.
2. Require the canonical job names, source SHA, run ID and complete outcomes. A missing/duplicated job or unknown skip fails closed. A real failed CI records `observed-non-success`, not a fabricated green result. CI status is not proof the checks themselves were honest, since a PR can alter its own CI workflow.
3. Read the matching PR twice around its complete file inventory, then classify paths and size. Workflows, governance, security and critical code are high risk; source/test/package changes are at least medium. Only bounded documentation-only edits can be low. For a PR already merged by the time of observation, keep its historical risk evidence but **never** make it an auto-merge candidate.
4. Before publication, require both views to match exact repository, PR number, source head SHA, target base SHA and trusted executor SHA. Any drift with the actual current PR state fails closed. The two views are produced by the **same observer**, not independent attestations.

The single GitHub Actions artifact is named `trusted-pr-evidence-<CI run ID>-<attempt>` and contains two small JSON files:

- `TRUSTED_CI_OBSERVATION.json` — run/job identity and observed CI verdict.
- `TRUSTED_AUTONOMY_SHADOW.json` — paths, risk, PR state and conservative candidate classification.

The JSON digests detect accidental changes; they are **not signatures, release attestations, independent checks or authorization tokens**. Both explicitly retain `mergeAuthorized=false` and `autoMerge=false`. A failed observer emits **no evidence artifact** and cannot be mistaken for an approval.

## Rollout and non-goals

- **L1 (current):** agents may prepare PRs and self-verify; the actual provider's protected `CI Gate` and existing Change Safe confirmation rules remain authoritative. Shadow observation may lag a merge and has no power to block it.
- **L2 (not enabled):** independent trusted CI authority, server-side expected status source, exact-head evidence and post-merge no-regret metrics must first demonstrate acceptable false-green/false-negative behavior on comparable cohorts. No observer artifact alone qualifies.
- **L3 (not enabled):** broaden only by explicit human governance approval and measured production outcomes, never to security/governance/credential/release/migration changes.

The live native Ruleset still requires `CI Gate` only. See [GitHub Governance](GITHUB_GOVERNANCE.md) for binding its actual GitHub Actions app source (`integration_id=15368`) through independent administrator authorization. Do not claim this server-side binding is complete from a dry-run or a green CI result. Do not expand the existing `workflow_run` observer's permissions or use PR-supplied scripts.

Formal proofs and runtime UI recordings should be added **only for high-value state-machine or user-facing behaviors that need them**. Unit/property tests and static analysis remain the default inexpensive verification. A new runner, distributed job queue, multi-model reviewer or redundant skill library is not a prerequisite.

## Verification without model calls

```sh
node --test test/trusted-autonomy-shadow.test.js test/trusted-ci-corroboration.test.js
node --check scripts/trusted-autonomy-shadow.js
node --check scripts/trusted-ci-corroboration.js
```

For live qualification, use the first **new PR CI completion after this change is merged**. Confirm the protected-default-branch observer ran successfully, produced one artifact with two matching exact-head observations, and never published a merge status. Then verify the unchanged, actual server-side Ruleset separately. A PR modifying this observer cannot verify its own PR with the new code: `workflow_run` executes the version committed to the default branch.

This feature intentionally does not validate live GitLab/SQLite deployment, migration/rollback, or user-visible performance, and does not substitute for those projects' own acceptance gates.
