# GitHub repository governance

Codex Safe uses a **solo-maintainer governance model**: ordinary development is protected by deterministic automation, while production publication remains fail-closed. A second human reviewer is useful when available but is not a machine-required condition for a repository maintained by one person.

## Three protection tiers

1. **Development / pull request** — require a pull request and the repository's canonical `CI Gate`. The contract does not require an approving review, stale-review dismissal, or last-push approval. Additional machine-required reviews are policy drift for this solo-maintainer contract; optional independent advice remains welcome.
2. **Merge to main** — native-protected public repositories keep deletion and force-push protection plus strict `CI Gate`. A bounded maintainer bypass may exist only in `pull_request` mode. It is an explicit single-maintainer control, not evidence of an independent review.
3. **Production release** — exact SHA, immutable release/tag or image digest, release qualification, secrets, migration/backup/rollback and real target-environment checks remain fail-closed. Development evidence cannot substitute for publication evidence.

## Seven public repositories, one native baseline

`repository-governance-contract.json` includes Core, Review, Commit, Change, Diagnose, Service and development-stage Debug. Every repository is public and requires native branch protection. Service no longer has a static private/publisher exception. Debug's development lifecycle controls release admission, not basic branch protection.

The read-only audit fetches actual repository visibility and native Rulesets for every entry. Missing, private, unbound or ambiguous state does not count as protection. Immutable product publication, migration/rollback safety and real target-environment checks remain independent requirements.

## Family credentials

`CODEX_SAFE_FAMILY_READ_TOKEN` is a **cross-repository observability / coordinated Family release credential**, not a prerequisite for ordinary PR work or Core publication.

- `Family Status` and `Family Freshness` publish a partial, non-dispatching result when the token is absent instead of producing a red build.
- Core `Release Validation` verifies all seven public native Rulesets without requiring a private-read token.
- When coordinated Family operations require additional scopes, they must report unavailable visibility honestly and must not fabricate release or runtime readiness.

Never place the token in source, PR text, issues or chat.

`FAMILY_BOT_TOKEN` is similarly a **coordination credential**, not a Core release credential. A fully qualified immutable Core release may publish without it. When the bot token is configured, Trusted Release dispatches the coordinated Family Upgrade automatically; when it is absent, the Core release remains valid and consumers stay pinned until an authorized maintainer performs the upgrade. Consumer releases remain independently fail-closed on their exact Core pin and release qualification.

## Required native Ruleset

For every repository whose protection mode is `native`, the default branch must have one active `Codex Safe main protection` Ruleset with:

- pull requests required before merge;
- exactly one strict required status context: `CI Gate`;
- branch deletion blocked;
- non-fast-forward / force-push blocked;
- at most one bounded bypass actor;
- bypass limited to `pull_request` mode;
- repository-side `delete_branch_on_merge` enabled when administratively observable.

The solo-maintainer contract specifies exactly zero required approvals, with no last-push or code-owner approval. The verifier rejects drift in either direction; independent reviewer advice remains welcome but must not be represented as a machine-required step.

## Required GitHub Actions status source

The canonical required check is `CI Gate` bound to the GitHub Actions App (`integration_id=15368`). Name-only rules report `sourceBinding.state=unbound` and fail the authoritative audit; a passing check with the same name from another writer cannot establish the required source binding. Source state is always returned for review.

The migration script verifies a successful exact-main `CI Gate` from this app before preparing a binding. Existing extra rules, foreign source bindings and ambiguous canonical rulesets are refused. Existing bounded bypass actors are preserved; a new development Ruleset grants none. Automatic merge stays disabled.

The complete read-only migration plan is:

```sh
node scripts/apply-repository-governance.js --create-missing
```

An already authorized administrator may apply that plan through an existing trusted execution environment and existing Administration-write authorization:

```sh
node scripts/apply-repository-governance.js --apply --create-missing
node scripts/verify-repository-ruleset.js
```

`--bind-ci-source` remains accepted; source binding is now contract-required by default. `--create-missing` is explicit and only creates the canonical rule when it does not exist. Every actual write is followed by a server readback. Dry-run output is a proposal, not evidence that GitHub has been changed. Do not merge the strict contract migration until the seven server configurations satisfy it; this keeps administrative availability separate from unrelated runtime repairs.

The GitHub connector may lack Administration-write capability. A prepared PR does not grant that capability, and no new credential or bypass is implied. The optional trusted observation remains evidence only and cannot authorize a merge.

## High-signal workflow YAML analysis

The existing `Security` reusable workflow uses the pinned `zizmor-action v0.8.1` to inspect `.github/workflows` with `zizmor 1.32.0`. It is **offline** (no token-backed online audits), `regular` persona, and only reports high-severity, high-confidence findings to the existing GitHub code-scanning channel. The scan runs inside the existing CodeQL job: **no new scheduled task, additional model, separate full review service or new CI Gate context**.

This is an **advisory security baseline**, not an authorization or proof that every workflow is secure. CodeQL continues to analyze JavaScript; zizmor concentrates on GitHub Actions workflow semantics such as template injection, credential persistence and permissions. The zizmor action's Advanced Security integration does not intentionally fail the job on discovered findings; review and remediate real findings first, then evaluate whether any individual rule should be independently enforced. A tool installation/upload failure may still fail the Security job.

Keep the action SHA pin and explicit zizmor version fixed. Do not enable online audits with a cross-repository token, bypass existing CI Gate, or add duplicate SARIF upload jobs merely to inflate security activity.

## CI Gate ownership

`CI Gate` is the single server-required merge context. Normal PR CI should optimize for fast feedback on the canonical runtime and high-value checks. Full supported runtime/OS matrices, provider/HIL tests, migration/rollback qualification and immutable artifact checks belong to main/release qualification unless the change directly affects those boundaries.

The Release workflow remains the place where production requirements become strict. Do not weaken release checks merely because development CI was simplified.

## Administrator migration

`scripts/apply-repository-governance.js` is dry-run by default. It audits and applies the native policy to all seven public repositories; no product is skipped by a stale publisher label.

```bash
node scripts/apply-repository-governance.js --create-missing
node scripts/apply-repository-governance.js --apply --create-missing
```

The token used for `--apply` needs repository Administration write permission for the native-protected repositories. Optional historical branch cleanup remains a separate Contents-write operation.

This governance model intentionally separates **engineering velocity** from **production safety**: a solo maintainer can develop and merge with reproducible automation, while production publication still requires strong, independently verifiable machine evidence.
