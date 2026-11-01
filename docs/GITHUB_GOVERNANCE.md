# GitHub repository governance

Codex Safe uses a **solo-maintainer governance model**: ordinary development is protected by deterministic automation, while production publication remains fail-closed. A second human reviewer is useful when available but is not a machine-required condition for a repository maintained by one person.

## Three protection tiers

1. **Development / pull request** — require a pull request and the repository's canonical `CI Gate`. The contract does not require an approving review, stale-review dismissal, or last-push approval. A repository may keep stricter GitHub settings; stricter settings still satisfy the contract.
2. **Merge to main** — native-protected public repositories keep deletion and force-push protection plus strict `CI Gate`. A bounded maintainer bypass may exist only in `pull_request` mode. It is an explicit single-maintainer control, not evidence of an independent review.
3. **Production release** — exact SHA, immutable release/tag or image digest, release qualification, secrets, migration/backup/rollback and real target-environment checks remain fail-closed. Development evidence cannot substitute for publication evidence.

## Native vs publisher protection

`repository-governance-contract.json` assigns each Family repository one protection mode.

- Public repositories use **native** protection and must expose the canonical GitHub Ruleset.
- The private `codex-review-service` uses **publisher** protection. GitHub Free does not expose private-repository Rulesets for this repository, so Core must not pretend that a missing paid feature is a code-quality failure. The Service remains private, and its production release workflow is the authority for immutable publication. This is not equivalent to server-side branch protection: it protects the supported production publication path, not every possible direct write by an administrator.

The publisher exception is intentionally narrow. It does not waive exact source SHA, package/OCI provenance, release tests, database migration safety, rollback evidence, credentials or real GitLab validation.

## Family credentials

`CODEX_SAFE_FAMILY_READ_TOKEN` is a **cross-repository observability / coordinated Family release credential**, not a prerequisite for ordinary PR work or Core publication.

- `Family Status` and `Family Freshness` publish a partial, non-dispatching result when the token is absent instead of producing a red build.
- Core `Release Validation` verifies native public Rulesets and the static publisher assignment without requiring the private-read token.
- When coordinated Family release/upgrade actually needs private Service state, the scoped token remains required and the operation must fail closed if it is unavailable.

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

The contract minimum approval count is zero for the solo-maintainer profile. A repository may keep one or more approvals as an extra local policy; the verifier accepts stricter review requirements.

## CI Gate ownership

`CI Gate` is the single server-required merge context. Normal PR CI should optimize for fast feedback on the canonical runtime and high-value checks. Full supported runtime/OS matrices, provider/HIL tests, migration/rollback qualification and immutable artifact checks belong to main/release qualification unless the change directly affects those boundaries.

The Release workflow remains the place where production requirements become strict. Do not weaken release checks merely because development CI was simplified.

## Administrator migration

`scripts/apply-repository-governance.js` is dry-run by default. It applies the native policy only to repositories assigned `protection: native`; publisher-protected repositories are deliberately skipped.

```bash
GH_TOKEN=... node scripts/apply-repository-governance.js
GH_TOKEN=... node scripts/apply-repository-governance.js --apply
```

The token used for `--apply` needs repository Administration write permission for the native-protected repositories. Optional historical branch cleanup remains a separate Contents-write operation.

This governance model intentionally separates **engineering velocity** from **production safety**: a solo maintainer can develop and merge with reproducible automation, while production publication still requires strong, independently verifiable machine evidence.
