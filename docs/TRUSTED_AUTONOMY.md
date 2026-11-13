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

## L1 → L2 → L3 rollout

- **L1 (current):** agents may prepare changes and self-verify. A human or already-authorized process still merges. This observer emits evidence only.
- **L2 (not enabled):** after shadow observation, real CI and post-merge outcomes have been independently joined by exact head SHA and run, consider enabling automatic merge for strictly bounded low-risk changes. Require trusted status origin, independent CI success, a repository opt-in, and a demonstrated rollback path.
- **L3 (not enabled):** broaden scope only by measured outcomes and explicit governance approval; never include workflow/policy/security/release/permission changes or unpublished production credentials.

Assess *no-regret merge rate*, revert/hotfix attribution, escaped defects, manual intervention, CI p95, and tokens per verified completed task. Prefer comparing human and agent changes on equivalent risk cohorts. A green CI or low aggregate revert rate is not sufficient. Any missing evidence, drift, unexpected skip or unknown source must defer to manual action. Do not use periodic polling loops to simulate throughput.

## Running locally (no model calls)

```sh
node --test test/trusted-autonomy-shadow.test.js
node --check scripts/trusted-autonomy-shadow.js
```

Live observation is intentionally GitHub Actions-only and consumes GitHub API read calls, not Codex, ChatGPT Work or model tokens. After this branch merges, a **new** PR event is required for the protected-base workflow to run. This PR cannot qualify its own newly-added base workflow.

## Scope and non-goals

This change adds no automation that merges, approves, deploys, rewrites release metadata, or weakens independent publication validation. No shadow result is trusted until the real artifact and head-bound status are inspected. It does not address the separate live GitLab/SQLite deployment and authoritative final-ref Merge Gate issues, or substitute synthetic performance checks for production measurements.
