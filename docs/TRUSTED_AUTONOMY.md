# Trusted autonomy: evidence before automatic merge

Status: **shadow only**. This document is a governance implementation note, not a new release protocol.

## What is implemented

`.github/workflows/trusted-autonomy-shadow.yml` uses `pull_request_target` and checks out **only the event's base SHA on protected `main`**. It never checks out PR head, runs PR code, passes credentials to PR code, or approves/merges a PR. The token can read PR metadata and publish one commit status; it cannot push, approve or merge.

For each PR event, the observer reads live metadata, retrieves the paginated file inventory, then reads metadata again. The deterministic observer refuses mismatched head/base identity, stale event SHA, incomplete inventory, rename tricks, implausible metrics and malformed paths. The policy keeps changes to workflows, governance, security and sensitive Core files **high risk**. Normal source/test/package changes are at least **medium risk**. Small bounded documentation-only changes are low-risk candidates in **shadow mode only**.

The observer uploads `TRUSTED_AUTONOMY_SHADOW.json` and publishes `Codex Safe / Trusted Observation` on the exact PR head. Failure to produce/upload proof publishes a failing status where possible. Status **success means only that the observation was recorded**. It does not mean CI passed, that the patch is correct, or that merging is authorized.

The evidence binds repository, PR number, head SHA, base SHA, trusted checkout SHA, run ID, attempt, changed paths and risk. Its content digest is for accidental integrity detection, **not a signature**. It deliberately sets CI, CodeQL, runtime and downstream validation to `not-evaluated`; do not fabricate results or confuse this report with existing Consumer CI / Review / Commit / Diagnosis Receipts.

## Enforcement and separate server-side qualification

As of this change the existing server-side protection still requires **CI Gate**, not `Codex Safe / Trusted Observation`. This new status is **not an enforced merge gate yet**. The GitHub connector cannot update repository Rulesets or establish which GitHub App is the authoritative status origin.

An administrator must separately inspect the actual protected-branch Ruleset and GitHub Actions status origin, then decide whether to add the trusted observation as an **additional** required status with an expected source. Never replace `CI Gate`; never permit a PR-modifiable workflow to be the sole authority; never enable automatic merge based solely on the observation status. The existing ruleset contract and Family release controls stay unchanged in this PR.

Changing the protected workflow itself is classified as high risk by the still-trusted base revision. An attacker may change the copy in the PR, but that copy will not execute in this observer. This only protects the observer; it does **not** certify the rest of the CI pipeline against workflow tampering until independent required-check and Ruleset configuration is verified.

## CI-result corroboration (independent read-only stage)

`.github/workflows/trusted-ci-corroboration.yml` now listens to the existing `CI` **workflow_run.completed** event. It executes only trusted default-branch code, with Actions/Contents/PR **read-only** permissions. It does not checkout a PR, use a paid model, publish success status, approve, merge, release or deploy anything.

For each pull-request-triggered CI run, the workflow retrieves the run twice, reads **all** paginated jobs, and associates the run's exact source SHA with GitHub's `commits/{sha}/pulls` endpoint. GitHub's `workflow_run.pull_requests` array is often empty; it is never used as provenance. It requires exactly one matching PR, the canonical repository and main target, matching run ID/attempt/workflow ID/workflow path, and the complete canonical job-name set. Any changed SHA, missing/duplicate job, unknown job, skipped mandatory job or mismatched run is refused; a legitimate failed CI is recorded as **observed-non-success**, never silently reclassified as success.

A successful observation is saved as `TRUSTED_CI_OBSERVATION.json` in an ordinary GitHub Actions artifact, identified by run ID and attempt. It includes per-job conclusions, skipped optional Canary jobs, the matching PR head/base SHA and the executing trusted workflow SHA. The digest is a content checksum, not a signing key. **This is corroboration of GitHub-reported CI status, not independent proof that the PR's tests were honest or complete.** Its `mergeAuthorized` remains `false` even if every check is green.

The two complementary artifacts are:

- `TRUSTED_AUTONOMY_SHADOW.json`: risk classification of immutable PR paths and size, generated on PR events.
- `TRUSTED_CI_OBSERVATION.json`: GitHub API run and job cross-check, generated after CI completion.

They are **observations**, not a new CI Receipt contract. They are not yet automatically joined into an L2 approval, and neither can mutate the existing immutable Consumer CI Receipt or release provenance. Missing one of them means no claim of complete evidence. Post-merge revert/hotfix and runtime quality remain unverified until separately attributed to exact merges.

## L1 → L2 → L3 rollout

- **L1 (current):** agents may prepare changes and self-verify. A human or already-authorized process still merges. This observer emits evidence only.
- **L2 (not enabled):** after shadow observation, real CI and post-merge outcomes have been independently joined by exact head SHA and run, consider enabling automatic merge for strictly bounded low-risk changes. Require trusted status origin, independent CI success, a repository opt-in, and a demonstrated rollback path.
- **L3 (not enabled):** broaden scope only by measured outcomes and explicit governance approval; never include workflow/policy/security/release/permission changes or unpublished production credentials.

Assess *no-regret merge rate*, revert/hotfix attribution, escaped defects, manual intervention, CI p95, and tokens per verified completed task. Prefer comparing human and agent changes on equivalent risk cohorts. A green CI or low aggregate revert rate is not sufficient. Any missing evidence, drift, unexpected skip or unknown source must defer to manual action. Do not use periodic polling loops to simulate throughput.

## Read-only live qualification checklist

For a PR that changes only a bounded documentation path, use the two **independent, event-driven** observations, then read the existing protected CI result. These commands are intentionally read-only and make no merge decision:

```sh
repo=jiying2007/codex-safe-core
pr=100  # replace with the actual PR under examination
gh pr view "$pr" -R "$repo" --json number,headRefOid,baseRefName
gh api "repos/$repo/pulls/$pr" --jq '{number,state,head_sha:.head.sha,base_sha:.base.sha}'
gh api "repos/$repo/rulesets/22321766" \
  --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks'
# Only after the CI/observer workflow runs appear in the Actions UI:
gh run list -R "$repo" --limit 20
```

Acceptance is evidence, not a claim: the PR head matches the CI workflow run's `head_sha`, the CI observation lists the same head and exactly thirteen canonical jobs, `CI Gate` succeeds, and the separate PR-event observation reports a bounded low-risk classification with `mergeAuthorized=false`. The second observer's artifact is named `trusted-ci-observation-<CI run ID>-<attempt>`; it is not the same thing as a required status check. If Github does not associate the commit with **exactly one** PR, if the metadata changes mid-fetch, or if any Job is missing, report the gap and keep the workflow non-authoritative.

A protected PR is not proven safe because those two artifacts exist. The canonical `CI Gate` workflow can still be edited by a PR, and its status may not yet have an explicit expected-source binding. Verify this GitHub server-side independently. Do not modify the Ruleset or enable auto-merge on the strength of a read-only workflow's success. There is no fixed sample count that alone demonstrates low defect rates: promotion depends on independently attributed regressions, comparable baseline cohorts, and a formally approved error budget.

## Running locally (no model calls)

```sh
node --test test/trusted-autonomy-shadow.test.js
node --check scripts/trusted-autonomy-shadow.js
node --test test/trusted-ci-corroboration.test.js
node --check scripts/trusted-ci-corroboration.js
```

Live observation is intentionally GitHub Actions-only and consumes GitHub API read calls, not Codex, ChatGPT Work or model tokens. After this branch merges, a **new** PR event is required for the protected-base workflow to run. This PR cannot qualify its own newly-added base workflow.

## Scope and non-goals

This change adds no automation that merges, approves, deploys, rewrites release metadata, or weakens independent publication validation. No shadow result is trusted until the real artifact and head-bound status are inspected. It does not address the separate live GitLab/SQLite deployment and authoritative final-ref Merge Gate issues, or substitute synthetic performance checks for production measurements.
