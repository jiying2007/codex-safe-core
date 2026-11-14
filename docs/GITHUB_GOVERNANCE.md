# GitHub repository governance

Codex Safe uses a **solo-maintainer governance baseline**: ordinary development is protected by deterministic automation, while production publication remains fail-closed. Explicit repository policies retain stricter existing protection. Service requires one approval, stale-review dismissal and last-push approval; this migration does not remove those requirements.

## Three protection tiers

1. **Development / pull request** — require a pull request and the repository's canonical `CI Gate`. The default policy requires zero approving reviews and no stale-review dismissal or last-push approval. Service's explicit policy preserves its existing one-approval, stale-review and last-push requirements. Each repository is audited against its declared policy; optional independent advice remains welcome.
2. **Merge to main** — native-protected public repositories keep deletion and force-push protection plus strict `CI Gate`. A bounded maintainer bypass may exist only in `pull_request` mode. It is an explicit single-maintainer control, not evidence of an independent review.
3. **Production release** — exact SHA, immutable release/tag or image digest, release qualification, secrets, migration/backup/rollback and real target-environment checks remain fail-closed. Development evidence cannot substitute for publication evidence.

## Seven public repositories, one native baseline

`repository-governance-contract.json` includes Core, Review, Commit, Change, Diagnose, Service and development-stage Debug. Every repository is public and requires native branch protection. Service no longer has a static private/publisher exception. Debug's development lifecycle controls release admission, not basic branch protection.

The read-only audit fetches actual repository visibility and native Rulesets for every entry. Missing, private, unbound or ambiguous state does not count as protection. Immutable product publication, migration/rollback safety and real target-environment checks remain independent requirements.

## Family credentials

`CODEX_SAFE_FAMILY_READ_TOKEN` is an optional **cross-repository read identity**. All current Family repositories are public. Snapshot, Status and Freshness API collectors use this identity when supplied, otherwise the existing job `github.token` with read permissions.

- `Family Status` and `Family Freshness` always collect actual evidence. Missing optional credentials never produce an empty-consumer synthetic status. Unreadable evidence fails or remains not ready; Freshness dispatches only when its actual readiness decision permits it.
- Public Git checkout remains credential-free when no dedicated read identity is supplied. The existing same-repository Freshness dispatch authority does not grant cross-repository write access.
- Core `Release Validation` verifies all seven public native Rulesets without requiring a private-read token.
- When coordinated Family operations require additional scopes, they must report unavailable visibility honestly and must not fabricate release or runtime readiness.

Never place the token in source, PR text, issues or chat.

`FAMILY_BOT_TOKEN` is a separate **coordination write credential**, not a Core release credential. A fully qualified immutable Core release may publish without it. When the bot token is configured, Trusted Release attempts the coordinated Family Upgrade dispatch; when it is absent, the Core release remains valid and consumers stay pinned until an authorized maintainer performs the upgrade. An invalid configured credential, including HTTP 401, remains an actual dispatch failure; the job token is not substituted for cross-repository writes. Consumer releases remain independently fail-closed on their exact Core pin and release qualification.

## Required native Ruleset

For every repository whose protection mode is `native`, the default branch must have one active `Codex Safe main protection` Ruleset with:

- pull requests required before merge;
- exactly one strict required status context: `CI Gate`;
- branch deletion blocked;
- non-fast-forward / force-push blocked;
- at most one bounded bypass actor;
- bypass limited to `pull_request` mode;
- repository-side `delete_branch_on_merge` enabled when administratively observable;
- repository-side `allow_auto_merge` disabled; preparation and validation never grant merge authority.

The default solo policy specifies exactly zero required approvals, with no last-push, stale-review or code-owner requirement. Service's repository policy specifies exactly one approval with stale-review dismissal and last-push approval. The verifier rejects drift against each repository's explicit policy. The migration builder preserves higher existing approval counts and enabled review protections; an undeclared stricter state is reported for review and rejected before writing that repository instead of silently lowering it.

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

Read-only workflow audits report hidden administrative settings as `null`, never as disabled/enabled. An actual apply must read back both settings as the intended booleans; missing observability fails post-write qualification instead of reporting a verified administration result.

The GitHub connector may lack Administration-write capability. A prepared PR does not grant that capability, and no new credential or bypass is implied. The optional trusted observation remains evidence only and cannot authorize a merge.

## High-signal workflow YAML analysis

The existing `Security` reusable workflow uses the pinned `zizmor-action v0.8.1` to inspect `.github/workflows` with `zizmor 1.32.0`. It is **offline** (no token-backed online audits), `regular` persona, and only reports high-severity, high-confidence findings to the existing GitHub code-scanning channel. Its separate job isolates the action's bundled SARIF uploader from CodeQL's versioned configuration. Both jobs remain required through the existing `Security` dependency of `CI Gate`; no new schedule, model workload or server-required check context is introduced.

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
