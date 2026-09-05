# Quality Platform

Codex Safe Core 4.17.4 / Quality Platform v3 keeps the shared deterministic quality platform stable while hardening Model Routing Contract v1 with health-aware, quality-constrained economics, making evidence-risk scoring change-aware, and closing the Family repository-governance control plane around one canonical `CI Gate`. Safe Contract v2, Policy Schema v4, Runtime v3 and Provider Contract v3 remain the safety boundary.

## Runtime / Provider Contract v3

Core owns compatible-provider credential, transport and machine-runtime resolution. Consumers default to `provider.mode=auto`, inheriting an explicit product override, machine Family Runtime at `~/.codex-safe/runtime.json`, user Codex configuration, then the built-in OpenAI runtime. Compatible providers keep `credentialSource=auto|env|auth-json`; secrets remain references and never enter repository policy or receipts. Repository-local provider configuration cannot redirect machine credentials. HTTPS is preferred; private-network HTTP inheritance remains machine-owned, visible and bounded. Structured Codex JSONL is streamed incrementally with independent retained-output and total-transcript ceilings.

## Model Routing Contract v1

Model Routing Contract v1 separates stable product semantics from changing model generations:

- **Mode:** `fast`, `balanced`, `deep`.
- **Role:** `scout`, `reviewer`, `adjudicator`.
- **Model Class:** `fast`, `balanced`, `frontier`.
- **Selection Strategy:** `auto`, `preference`, `fixed`.
- The deterministic Safe Gate is never a model role.

`auto` and `preference` choose only approved registry entries; unhealthy entries are ineligible and healthy entries outrank unknown-health candidates. Explicit `fixed` remains an advanced benchmark/debug control. Cross-provider fallback is disabled unless explicitly enabled. Qualification remains evidence-based; discovery alone never grants authority.

For `auto`, sufficiently sampled Model Economics may influence selection only after normal role/status/health/compatibility eligibility. An economics candidate marked quality-rejected is excluded. Eligible candidates are compared by Pareto dominance across tokens per verified finding, cost per verified finding, P95 latency, false-positive rate and coverage rather than by an opaque weighted score. This can reduce cost only when the candidate is no worse on every tracked quality/economics axis and better on at least one. The normalized economics input is bound into `routingPolicyDigest`, so a routing decision remains auditable without introducing Routing v2.

Model Evidence binds human-readable revisions and canonical `registryDigest` / `routingPolicyDigest`. Resolved model/revision, Qualification identity, lineage, fallback/degradation and normalized token usage are recorded without credentials, prompts or source. Model Routing stays at v1; the stable `fast / balanced / frontier` compatibility classes remain unchanged.

## Token efficiency and calibration

Token optimization is quality-constrained rather than token-minimal. Core measures actual/cached/cache-write/output/reasoning usage, tokens and cost per verified finding, coverage, false positives, verifier/scout/adjudicator call ratios and P50/P95 latency.

Evidence-risk scoring is change-aware. Sensitive paths such as auth/security/schema remain strong priors, while C/C++/Rust file extensions contribute only a weak systems-language prior. Lifetime, allocation, lock/concurrency, auth and compatibility indicators raise risk only when they occur on actual changed diff lines; unchanged context no longer promotes an ordinary embedded edit into the highest budget tier merely because the file is C/C++/Rust or contains nearby mutex/free/malloc text.

Economics is segmented by `mode`, `role`, `provider`, `model`, `profilePack` and repository-size bucket. Promotion can require minimum total and critical-case sample counts before recall/false-positive constraints are evaluated. Routing consumes only sufficiently sampled, quality-approved economics; absence of trustworthy economics falls back to deterministic compatibility, health, class distance, priority and stable identity ordering.

Token Estimator Calibration persists only numeric provider/model calibration. TTL is based on each model's actual `lastObservedAtMs`; unrelated writes cannot renew stale entries. The shared secure local-file primitive provides bounded no-follow reads, same-descriptor validation, owner/permission checks where supported, exclusive write locking, merge-on-write and atomic mode-0600 replacement.

## Promotion corpus

The historical 24-case recorded baseline remains an observed regression baseline; it is not reinterpreted as universal 100% model quality. Core 4.16 introduced a deterministic promotion corpus of at least 80 cases across `dev`, `holdout` and `real-regression` partitions, including at least ten clean negatives and ten real Family regressions. It spans security, concurrency, resource, correctness and test findings; small/medium/large repositories; and the engineering profile packs.

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

Family Registry v1 remains the topology source. Before an Atomic Family Snapshot v3 is frozen, Core verifies the live server-side Ruleset contract for every active Family repository. Snapshot v3 then freezes the current exact immutable Core release and both Core digests, plus each exact consumer release, its exact pinned Core SHA/digests, Consumer CI Receipt and required distribution evidence.

Family Manifest v5 records Snapshot v3, exact Core/consumer release identities, runtime/governance digests, Product Contract/package-lock digests, CI receipt identity and distribution evidence in `FAMILY_MANIFEST.json`. It is provenance-attested and published under a digest-addressed immutable evidence release that is explicitly not allowed to become GitHub Latest.

Family Freshness requires every active consumer to be runtime-compatible with the newest released Core and to have an exact immutable current product release, verified Consumer CI Receipt and required distribution. It no longer requires all consumers to repin a governance-only Core SHA.

Ordinary Family Compatibility trusts immutable consumer CI receipts and runs one Ubuntu cross-family validation. The full five-consumer × Linux/Windows/macOS matrix remains a weekly or explicit `full_matrix=true` audit, preserving test strength while removing repeated work from routine refreshes.

Coordinated Family Upgrade is two-phase. Phase 1 prepares every runtime-changing consumer PR and waits for all checks before any merge. Phase 2 freezes PR head SHAs and merges only the validated set. Runtime-equivalent consumers are recorded as skipped. On retry, an existing open upgrade PR whose changes are already materialized remains `prepared` and must pass Phase 1b rather than being silently reclassified as runtime-equivalent. Release-state polling collects the Family once per attempt; transient 429/5xx/network failures are retried within the existing bound, while permanent evidence errors still fail closed. The transaction state is preserved as an artifact for audit/retry, and release/distribution/CI evidence must still converge before Family Freshness.

## Repository governance

`repository-governance-contract.json` defines one canonical server-side GitHub Ruleset baseline for all six Family repositories: PR-based changes, exactly one strict required status context (`CI Gate`), deletion/non-fast-forward protection, at most one `pull_request` bypass actor, and repository-native `delete_branch_on_merge`. Each repository keeps its full product-specific CI matrix; `CI Gate` is an `if: always()` aggregate that fails unless every declared CI dependency succeeds. `scripts/verify-repository-ruleset.js` audits the live server state and `scripts/apply-repository-governance.js` is the dry-run-first administrator repair path. Core Release Validation, Family Snapshot creation and the shared Family Release Guard fail closed when this control is absent or drifted.

Change Safe remains a deterministic delivery product with zero model calls by default; unifying Family model evidence does not restore model-generated PR/MR narrative.
