# Quality Platform

Codex Safe Core 4.16.0 / Quality Platform v3 keeps the shared deterministic quality platform stable while completing Model Routing Contract v1, runtime/governance identity separation, Consumer CI Receipt v1 and the runtime-aware Family evidence chain. Safe Contract v2, Policy Schema v4, Runtime v3 and Provider Contract v3 remain the safety boundary.

## Runtime / Provider Contract v3

Core owns compatible-provider credential, transport and machine-runtime resolution. Consumers default to `provider.mode=auto`, inheriting an explicit product override, machine Family Runtime at `~/.codex-safe/runtime.json`, user Codex configuration, then the built-in OpenAI runtime. Compatible providers keep `credentialSource=auto|env|auth-json`; secrets remain references and never enter repository policy or receipts. Repository-local provider configuration cannot redirect machine credentials. HTTPS is preferred; private-network HTTP inheritance remains machine-owned, visible and bounded. Structured Codex JSONL is streamed incrementally with independent retained-output and total-transcript ceilings.

## Model Routing Contract v1

Model Routing Contract v1 separates stable product semantics from changing model generations:

- **Mode:** `fast`, `balanced`, `deep`.
- **Role:** `scout`, `reviewer`, `adjudicator`.
- **Model Class:** `fast`, `balanced`, `frontier`.
- **Selection Strategy:** `auto`, `preference`, `fixed`.
- The deterministic Safe Gate is never a model role.

`auto` and `preference` choose only approved, healthy-enough registry entries. Explicit `fixed` remains an advanced benchmark/debug control. Cross-provider fallback is disabled unless explicitly enabled. Qualification remains evidence-based; discovery alone never grants authority.

Model Evidence now binds both human-readable revisions and canonical `registryDigest` / `routingPolicyDigest`. Resolved model/revision, Qualification identity, lineage, fallback/degradation and normalized token usage are recorded without credentials, prompts or source. Model Routing stays at v1: capability metadata and segmented economics are collected before any future change to the coarse `fast / balanced / frontier` classes.

## Token efficiency and calibration

Token optimization is quality-constrained rather than token-minimal. Core measures actual/cached/cache-write/output/reasoning usage, tokens and cost per verified finding, coverage, false positives, verifier/scout/adjudicator call ratios and P50/P95 latency.

Economics is segmented by `mode`, `role`, `provider`, `model`, `profilePack` and repository-size bucket. Promotion can require minimum total and critical-case sample counts before recall/false-positive constraints are evaluated.

Token Estimator Calibration persists only numeric provider/model calibration. TTL is based on each model's actual `lastObservedAtMs`; unrelated writes cannot renew stale entries. The shared secure local-file primitive provides bounded no-follow reads, same-descriptor validation, owner/permission checks where supported, exclusive write locking, merge-on-write and atomic mode-0600 replacement.

## Promotion corpus

The historical 24-case recorded baseline remains an observed regression baseline; it is not reinterpreted as universal 100% model quality. Core 4.16 adds a deterministic promotion corpus of at least 80 cases across `dev`, `holdout` and `real-regression` partitions, including at least ten clean negatives and ten real Family regressions. It spans security, concurrency, resource, correctness and test findings; small/medium/large repositories; and the engineering profile packs.

Promotion candidates must produce real evaluation results for that corpus. Core never fabricates recorded outputs for generated cases. Quality-constrained promotion rejects undersized samples even when their observed precision/recall is perfect.

## Judgment Lifecycle v1

ReviewSubject identity binds code subject, diff, policy, Evidence Manifest, prompt contract, review profile and resolved model. Only fresh inference creates a Review Receipt. Structural Evidence may be cached; a persisted model judgment is never replayed as a new authoritative judgment. Review Receipt v5 requires `reviewSubjectFingerprint` and `evidenceManifestDigest`.

## Review profiles and Profile Packs

The existing `quick`, `standard`, `deep`, `security` and `embedded` execution profiles remain supported while model intent uses `fast`, `balanced` and `deep`. Profile Pack v1 continues to expose `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel` and `realtime` emphasis without granting tools, network or write authority.

## Impact Evidence and Test Impact

Core builds deterministic bounded Impact Evidence from controller-provided source context and paths. Test Impact ranks controller-provided test candidates; Core does not discover or execute tests. Budget pressure may reduce coverage only when the gap remains explicit and fail closed.

## Analyzer, Diagnosis and semantic review contracts

Analyzer findings and SARIF are normalized as untrusted evidence. Diagnosis compacts and redacts failure evidence, validates structured model output and binds the Diagnosis Input Manifest into Diagnosis Receipt v2. Quality evaluation tracks classification accuracy, false positives, calibration and token cost. Review Evidence chunking preserves changed-hunk coverage or records a gap; Profile Packs, Test Impact, Diagnosis and semantic review contracts remain deterministic Core primitives.

Patch proposals are evidence only. Core never applies, commits, pushes or merges a proposal.

## Core runtime / governance identity

Core Digest Contract v1 separates:

- `runtimeDigest`: shipped Core runtime modules, policy schema and runtime-relevant contract identity;
- `governanceDigest`: workflows, tests, quality corpora, docs, orchestration and governance-only identity.

Every consumer still pins one exact formally released Core SHA. A consumer is runtime-compatible with a newer Core only when both formally released Core identities have the same `runtimeDigest`. There is no semantic compatibility shim and a mismatched runtime digest is always stale.

Product Contract v2 binds `safeCoreCommit`, `safeCoreRuntimeDigest` and `safeCoreGovernanceDigest`. A runtime-changing Core release requires a consumer patch release. A governance-only Core release does not force five byte-identical product artifacts to be rebuilt or redistributed.

## Consumer CI Receipt v1

Every active consumer product release carries an attested `CONSUMER_CI_RECEIPT.json`. The receipt binds product SHA/version, exact Core pin and Core digests, successful CI workflow run identity/attempt and validated suites. Family release readiness verifies this immutable receipt instead of treating a transient green check as durable evidence.

## Family Evidence

Family Registry v1 remains the topology source. Atomic Family Snapshot v3 freezes the current exact immutable Core release and both Core digests, plus each exact consumer release, its exact pinned Core SHA/digests, Consumer CI Receipt and required distribution evidence.

Family Manifest v5 records Snapshot v3, exact Core/consumer release identities, runtime/governance digests, Product Contract/package-lock digests, CI receipt identity and distribution evidence in `FAMILY_MANIFEST.json`. It is provenance-attested and published under a digest-addressed immutable release.

Family Freshness requires every active consumer to be runtime-compatible with the newest released Core and to have an exact immutable current product release, verified Consumer CI Receipt and required distribution. It no longer requires all consumers to repin a governance-only Core SHA.

Ordinary Family Compatibility trusts immutable consumer CI receipts and runs one Ubuntu cross-family validation. The full five-consumer × Linux/Windows/macOS matrix remains a weekly or explicit `full_matrix=true` audit, preserving test strength while removing repeated work from routine refreshes.

Coordinated Family Upgrade is two-phase. Phase 1 prepares every runtime-changing consumer PR and waits for all checks before any merge. Phase 2 freezes PR head SHAs and merges only the validated set. Runtime-equivalent consumers are recorded as skipped. The transaction state is preserved as an artifact for audit/retry, and release/distribution/CI evidence must still converge before Family Freshness.

## Repository governance

`repository-governance-contract.json` defines the required server-side GitHub Ruleset baseline for all six Family repositories: PR-based changes, strict required checks, deletion/non-fast-forward protection and bounded bypass. `scripts/verify-repository-ruleset.js` audits that server-side state. Repository tests are not substitutes for repository administration controls.

Change Safe remains a deterministic delivery product with zero model calls by default; unifying Family model evidence does not restore model-generated PR/MR narrative.
