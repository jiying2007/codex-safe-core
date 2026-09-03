# Quality Platform

Codex Safe Core 4.13.1 / Quality Platform v3 keeps the shared deterministic quality platform stable while Policy Schema v4 includes the `change` repository-policy section. Product-owned GitHub/GitLab provider behavior, VS Code UI, pipeline APIs, databases, analyzer acquisition and notifications remain outside Core.

## Runtime / Provider Contract v3

Core owns compatible-provider credential, transport and machine-runtime resolution. Consumers should default to `provider.mode=auto`: Core first honors an explicit product override, then a machine-scoped Family Runtime profile at `~/.codex-safe/runtime.json` (or `CODEX_SAFE_RUNTIME_FILE`), then the user Codex configuration at `${CODEX_HOME}/config.toml` / `~/.codex/config.toml`, and finally the built-in OpenAI runtime. Repository-local `.codex/config.toml` is deliberately not used for provider inheritance, preventing repository content from redirecting machine credentials.

For an inherited OpenAI-compatible provider, `credentialSource=auto|env|auth-json` remains secret-by-reference. `auto` prefers the provider's configured environment variable and otherwise follows the existing bounded `auth.json` path. Secrets are injected only into the child Codex process environment and never enter argv, settings, receipts, Family Runtime profiles or diagnostics.

HTTPS remains preferred. Loopback and literal private-network HTTP endpoints (RFC1918/link-local/loopback and IPv6 ULA/link-local) configured in machine-owned Codex or Family Runtime state may be inherited without repeating a per-product insecure-HTTP switch; diagnostics must surface the plaintext transport warning. Public/non-IP HTTP is still rejected unless it is explicitly trusted in the machine-scoped Family Runtime profile. Repository policy can never enable or trust insecure transport. Provider Contract v3 and Codex Runtime v3 continue to require Responses HTTP/SSE and structured output.

Structured Codex execution uses separate bounded budgets for transcript production and retained stdout. Long JSONL event streams may exceed the in-memory capture window without terminating a valid review, while the total child-output ceiling remains fail-closed. Only the bounded stdout tail needed for the final structured agent message, usage, and diagnostics is retained; a truncated leading JSONL fragment is tolerated only when Core itself reports bounded-tail truncation.

## Judgment Lifecycle v1

Core owns the Family-wide AI Judgment Lifecycle contract. ReviewSubject identity now binds the code subject, diff, policy, Evidence Manifest, prompt contract, review profile and resolved model. A Review Receipt is emitted only for a fresh inference; replay never creates a new receipt. Consumers may cache deterministic structural evidence, but persisted model judgment may not be reused as a new judgment or verdict.

Review Receipt v5 therefore requires both `reviewSubjectFingerprint` and `evidenceManifestDigest`. Delivery products qualify Review evidence from quality, coverage and mechanical gates; merge readiness remains a Change Safe responsibility.

## Review profiles and Profile Packs

`quick`, `standard`, `deep`, `security`, and `embedded` remain the execution profiles. Profile Pack v1 adds `general`, `backend`, `frontend`, `security`, `cpp`, `embedded-linux`, `embedded-mcu`, `driver`, `kernel`, and `realtime` engineering emphasis without granting tools, network or write authority.

## Impact Evidence and Test Impact

Core builds deterministic bounded Impact Evidence from controller-provided text and changed paths. `buildTestImpactMap()` ranks controller-provided test candidates; Core never discovers or executes tests itself. Budget pressure may reduce coverage only when that reduction remains explicit and fail closed.

## Analyzer contract

Core normalizes generic analyzer findings and SARIF 2.1 into a bounded deterministic contract. Analyzer text is untrusted evidence, never instructions. Repository policy cannot define executable analyzer commands.

## Diagnosis Contract / Receipt v2

Diagnosis primitives compact and redact failure logs, derive a conservative classification prior, validate structured model output and bind the full model-visible Diagnosis Input Manifest into Diagnosis Receipt v2. The manifest covers failure evidence, deterministic prior, changed-path metadata, artifact text digests, prompt contract and model identity. Products own pipeline/job retrieval and publication. Diagnosis never retries CI, edits source, commits, pushes or merges.

Quality evaluation tracks classification accuracy, false positives, calibration and token cost against labeled Review/Diagnose corpora.

## Semantic review contracts

Review Evidence chunking preserves changed-hunk coverage or records an explicit gap. Review Profile Packs, Test Impact, analyzer normalization, Diagnosis and semantic review contracts remain pure deterministic Core primitives. Model output is never allowed to create authority.

## Safe patch boundary

Patch proposals are evidence only. Core **never applies, commits, pushes or merges** a proposal. Products may display bounded proposals but may not convert model text into implicit repository mutation.

## Family evidence

Atomic Family Snapshot v1 freezes one exact Core SHA and the five active consumer SHAs before cross-platform validation. Family Manifest v3 then records exact Core/consumer pins, Product Contract digests, Core Contract digest, runtime/protocol identity and the snapshot digest in `FAMILY_MANIFEST.json` before provenance attestation and immutable publication.

Family Freshness is a Core-owned maintenance watcher, not a runtime capability. Core `main` must first be the exact tag target of its current immutable final Release. Each active consumer may keep its existing product version during a governance-only Core repin; the watcher instead requires that consumer `main` has a matching package/Product Contract identity and that both `safeCoreVersion`/`safeCoreCommit` and the `src/codex-safe-core` gitlink point to the released Core. Only after all five consumers converge does it compare their active heads with the newest immutable Family Manifest and dispatch Family Compatibility when that snapshot is missing or stale. An already queued/running Family validation suppresses duplicate dispatch. The watcher distributes no cross-repository credentials, runs no model, and never replaces the full three-platform Family gate.

Coordinated repin is identity-complete: besides the exact Core gitlink and Product Contract, the maintenance tool synchronizes current verifier constants, current contract tests and a bounded current-state documentation allowlist. For Review Service that allowlist uses the repository's real current paths, including root `OPERATIONS.md` and both English/Chinese deployment guides; nonexistent shadow paths are not treated as coverage. Historical changelog and migration records remain excluded. Trusted Core publication retries release/asset attestation verification for a bounded propagation window while remaining fail closed.

Change Safe participates as an active Core consumer for deterministic policy/fingerprint and Judgment Lifecycle primitives. Its SCM Provider and Delivery Authorization behavior remains product-owned; its `change` policy schema/validation is Core-owned through the same `.codex-safe.json` Policy Schema v4 used by Review, Commit and Review Service.
