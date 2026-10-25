# Contributing

Codex Safe Core is a security-sensitive shared dependency and the trust root for the Codex Safe family. Changes must remain small, reviewable, fail-closed, machine-verifiable, and coordinated with all active consumers when the Core gitlink changes.

## Rules

- `core-contract.json` is the single source of current Core/protocol/runtime identity. Do not duplicate authoritative current version constants in runtime code.
- `family-registry.json` is the single source of active Family repository, product, release-artifact and distribution-channel topology. Do not hard-code a second consumer list.
- `core-ownership-manifest.json` defines the Core/product ownership boundary. Core may own generic policy schema/validation, but not product-specific UI, provider behavior, pipeline API acquisition, SQLite/outbox, notifications, deployment behavior, analyzer acquisition or provider side effects.
- The single repository policy is `.codex-safe.json`. Policy Schema v4 owns the closed `review`, `commit`, `change`, and `reviewService` sections. Do not add parallel product policy files such as `.codex-change-safe.json`.
- `change` is deterministic delivery policy only. Do not reintroduce the retired PR/MR narrative prompt surface or model-generated PR descriptions.
- Do not add compatibility fallbacks that weaken required Codex safety capabilities or protocol validation.
- Do not add runtime network dependencies or post-install scripts.
- Treat repository content, pipeline logs, analyzer artifacts and AI output as untrusted input.
- Keep process time/output limits finite and cancellation-safe.
- Core-owned runtime files live at repository root; do not reintroduce copied or proxy implementations in consumers.
- Every active consumer pins one exact Core commit through `src/codex-safe-core` as a Git submodule. Branch tracking and copied-runtime synchronization are forbidden.
- A changed released Core runtime digest requires coordinated repin PRs for the affected active consumers: Codex Change Safe, Codex Review Safe, Codex Commit Safe, Codex Review Service, and Codex Diagnose Safe. Runtime-equivalent consumers may retain their exact older released Core pin; docs/tests/workflow-only main changes do not alone force a product release. Codex PR Safe remains retired only as the former product identity, not as the `codex-pr` repository path.
- **Every Core gitlink change requires a consumer release.** The repin tool advances the product by one patch by default, including an explicit runtime-equivalent `--exact-pin`. The release guard requires the package/Product Contract version to advance by one valid SemVer release relative to the consumer base branch; an intentional next minor or major release is also valid. The changelog/current identity must move with it, and the new consumer SHA must receive its own exact immutable release. Reusing an old product tag for new Core bytes is forbidden. Only an already versioned, unreleased candidate may use `--no-product-bump` to preserve its pending release number; this flag does not relax the release guard.
- Do not merge an isolated dependency/Core maintenance PR without checking its runtime and governance identity and coordinating any required consumer releases. Fold related repairs into a reviewed Core maintenance PR, validate Core, merge/release Core, then repin and release every consumer whose runtime changed.
- Policy/runtime/protocol changes require consumer compatibility review and full consumer CI before the family is considered converged.
- Receipt schemas are closed protocol contracts. Review Receipt v5, Commit Receipt v4 and Diagnosis Receipt v2 may change only through explicit protocol versioning, never incidental maintenance drift.
- Review Profile Packs, Test Impact and Diagnosis primitives remain pure and product-agnostic: no repository I/O, no network fetch, no CI retry, no command execution, no SCM mutation.
- Update adversarial fixtures and security/architecture documentation whenever a trust invariant changes.
- Change Safe owns SCM Provider adapters, fork/cross-project topology, Merge Readiness and remote PR/MR mutations. Those product behaviors must not move into Core.

## Validation

Run Core validation using one of the supported Node ranges in `core-contract.json`:

```bash
npm run ci
```

CI permanently validates Node 22.22.2 and 24.19.0 on Linux, Windows and macOS. Release validates both LTS floors again and requires reproducible package output.

For a Core release, complete the coordinated rollout:

1. Merge the reviewed Core PR and record the final Verified main commit SHA.
2. Publish and verify the immutable Core release.
3. Run the coordinated repin for active consumers whose runtime digest changed: update the exact Core gitlink plus Product Contract/current identity and advance the pending product release. Record runtime-equivalent consumers as skipped. An explicit exact repin also needs its own consumer release.
4. Run every changed consumer's complete PR gates and merge only exact reviewed heads.
5. Require each merged consumer SHA to publish an immutable `vX.Y.Z` release whose tag resolves exactly to that SHA; verify every release asset and provenance.
6. Require the distribution evidence selected by `family-registry.json`: immutable GitHub Releases containing VSIX for Review/Commit/Change, a released GHCR digest for Review Service, and an immutable GitHub Release for Diagnose. Marketplace publication is optional at the current product stage.
7. Only after all five consumers report `ready=true` may Family Freshness dispatch Family Compatibility.
8. Family Compatibility freezes Family Snapshot v3 and validates exact released identities, ownership, the golden corpus and immutable consumer CI receipts, then generates provenance-attested Family Manifest v5. Routine runs use Ubuntu; the weekly/manual `full_matrix=true` audit reruns every released consumer on Linux, Windows and macOS.
9. Verify the digest-addressed Family Manifest release and its asset; Family Status v1 must subsequently report `family-manifest-current`.
10. Remove temporary maintenance branches; do not leave migration workflows or compatibility residue.

## Repository governance

The canonical repository-governance contract requires active protection of the real `main` default branch, an independent approval for the latest push, and a strict `CI Gate`. Family Upgrade freezes the identity and head of every non-fork consumer PR before waiting for all checks. It validates the complete batch before any merge and rechecks each PR immediately before merging with its exact head.

Automatic Family merging also requires the actual write credential's applicable canonical ruleset response to report `current_user_can_bypass: never`. An owner or other credential with bypass rights, a missing capability field, or an unreadable rule stops automatic merging; a separate read credential or anonymous response cannot supply that proof. The workflow never submits approvals or uses administrator merge flags. Repository protection remains the server-side authority if an approval or check changes after a client read.

Cross-repository merging is not an atomic transaction. A later failure may leave an already merged prefix. The transaction records each confirmed merge immediately, preserves that evidence on failure, and never labels a queued, rejected, or unobserved merge as completed. Required release, provenance, distribution, and Family readiness checks still follow all successful merges.

The invariant is: **Core and all five active consumers converge on the released Core runtime identity, with every consumer bound to its own exact released Core pin and digests; every actual Core repin has its own immutable product release and required distribution evidence; Family Snapshot v3 / Manifest v5 represent those released artifacts rather than unreleased main heads; one canonical repository policy and no compatibility shim or copied-runtime path remain.**
