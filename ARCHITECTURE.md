# Codex Safe Core architecture

Codex Safe Core owns the cross-product safety/runtime and protocol boundary for the Codex Safe family. `core-contract.json` is the machine-readable current identity; code and documentation must not independently invent current protocol/runtime facts.

## Ownership boundary

Core owns:

- Safe Contract / Codex CLI capability probing and invocation;
- process lifecycle, cancellation, timeout and output bounds;
- generic local Git primitives;
- canonical JSON/fingerprints and Receipt validation primitives;
- committed `.codex-safe.json` **Policy Schema v4**, including closed validation of `review`, `commit`, `change` and `reviewService`;
- Semantic Context budgeting and Review Evidence Chunking;
- deterministic Review/Profile/Test-Impact/Diagnosis primitives;
- machine-local model/runtime configuration hardening;
- Family Snapshot, Product Contract, Consumer CI Receipt, Core Digest Contract and Family Manifest validation.

Active products own their domain orchestration:

- **Review Safe:** staged snapshot, findings, local Review UX and Review Receipt persistence;
- **Commit Safe:** Commit Message generation, scope/style behavior and Commit Receipt binding;
- **Change Safe:** source/target topology, GitHub/GitLab providers, native SCM policy discovery, PR/MR mutations, Merge Readiness, Delivery Authorization and Change Receipt v1;
- **Review Service:** GitLab webhook/provider semantics, durable queue/outbox, MR review publication/gating/audit;
- **Diagnose Safe:** CI evidence acquisition, diagnosis orchestration and publication.

No product may reimplement Core-owned Process/Codex/Policy/Receipt/Review-Evidence primitives. Conversely, provider APIs, SQLite/outbox, notifications, deployment and SCM side effects must not move into Core.

**Codex PR Safe is retired** as the old model-generated PR-description identity. Model-generated PR/MR narrative remains outside the Family. Codex Change Safe is a distinct deterministic delivery product with zero model calls by default.

## Contract identity boundary

The current line is machine-owned by `core-contract.json`; the block below is generated and verified by `scripts/current-contract-block.js` / `scripts/verify-current-docs.js`:

<!-- GENERATED:CORE-CONTRACT:START -->
- Core 4.16.1 / Safe Core v4
- Safe Contract v2 / Policy Schema v4
- Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2
- Review / Commit / Diagnose Prompt Contract v1
- Runtime v3 / Provider Contract v3
- Model Routing / Registry / Lineage / Economics v1/1/1/1
- Token Calibration / Store v1/1
- Family Snapshot v3 / Family Manifest v5 / Product Contract v2
- Consumer CI Receipt v1 / Core Digest Contract v1 / Repository Governance Contract v1
- Node 22 LTS >=22.22.2 <23 / Node 24 LTS >=24.19.0 <25
<!-- GENERATED:CORE-CONTRACT:END -->

There is no PR Prompt Contract. The retired `pr` policy/prompt section remains rejected. `change` is a deterministic delivery-policy section, not a compatibility alias for `pr`.

Safe Contract version and digest solve different problems: the version represents semantic compatibility; `SAFE_CONTRACT_DIGEST` identifies the exact authority/capability manifest. Policy Schema v4 is independently versioned and does not alter Safe Contract v2.

## Runtime and governance identity boundary

Core has two independent cryptographic surfaces:

- `runtimeDigest` covers shipped top-level runtime modules, the repository policy schema and runtime-relevant `core-contract.json` fields;
- `governanceDigest` covers workflows, tests, quality corpora, documentation, release orchestration and governance-only contract identity.

Every Core release still has one exact immutable SHA and both digests are release evidence. Consumers always pin one exact formally released Core commit. A newer Core may be **runtime-equivalent** to an older pinned Core only when their `runtimeDigest` values are identical. Governance equivalence never weakens runtime or protocol checks and never permits a stale runtime digest.

This split prevents governance-only Core maintenance from forcing five end-user products to rebuild and redistribute identical runtime artifacts. A runtime digest change remains a release-bearing consumer repin.

## Repository policy boundary

`.codex-safe.json` is the only repository policy file. Schema v4 is closed and fail-closed: unknown top-level/section keys, wrong types and older schema versions are rejected.

Core owns parsing, section validation and the committed policy fingerprint. Products consume their validated section. Change Safe may combine `change` with SCM-native requirements and local tightening, but may not redefine the JSON contract or accept a parallel `.codex-change-safe.json` surface.

## Deterministic boundary

The following remain independently testable without a model:

- Git evidence identity and fingerprints;
- Policy parsing/validation;
- Receipt validation;
- coverage/readiness/mechanical gate logic;
- Safe Contract argv/capability construction;
- Core runtime/governance digest classification;
- Family Snapshot/Manifest identity;
- Change provider-state normalization and authorization in the owning product.

Model-generated wording/findings/diagnoses are untrusted inputs. They cannot bypass schema validation, evidence binding or deterministic gates.

## Context, model and provider boundary

Core `buildSemanticContext()` and Review Evidence Chunking are generic bounded primitives. Provider-specific acquisition remains outside Core. Review Service fetches immutable GitLab evidence; Change Safe queries GitHub/GitLab delivery state; neither grants provider credentials or provider tools to Codex.

Model Routing v1 remains deliberately stable. Model Registry and routing-policy revisions are accompanied by canonical SHA-256 digests in Model Evidence. `fast / balanced / frontier` remain coarse compatibility classes while scalar capability metadata and segmented economics gather evidence for any future routing evolution; there is no speculative Routing v2 compatibility layer.

Machine model registries and token calibration stores use the shared secure local-file primitive: no-follow reads, same-descriptor validation, owner/permission checks where supported, bounded size, atomic replacement and bounded exclusive locking for writes.

## Family manifest boundary

A coordinated Family state is complete when all active consumers either pin the current released Core or pin an older formally released Core with the **same runtimeDigest**, and their own exact immutable product release/distribution and CI receipt evidence are valid.

Family Compatibility freezes an Atomic Family Snapshot and then generates `FAMILY_MANIFEST.json` containing exact current Core SHA/digests, exact consumer SHAs, each consumer's exact pinned Core SHA/digests, Product Contract digests, CI receipt identity, policy/runtime/protocol identity and a manifest digest. The manifest receives GitHub build-provenance attestation and immutable digest-addressed publication.

Lightweight Family Compatibility consumes immutable consumer CI receipt evidence and runs cross-family checks. The full five-consumer, three-OS matrix remains a scheduled/manual audit instead of being replayed for every coordinated refresh.

## Release and supply-chain boundary

Core Release Validation runs supported Node floors and reproducible package checks. `_trusted-release.yml` owns authority-bearing tag/release publication, checksums, SPDX SBOM, `CORE_DIGESTS.json` and build-provenance attestation. Existing release identities are never overwritten.

Runtime-changing Core releases drive a two-phase Family Upgrade: prepare every required consumer repin, wait for all prepared PRs to pass, freeze their head SHAs, then merge/release. Governance-only Core releases do not create product repins when the latest released consumer runtime digest is already equivalent.

## Compatibility policy

There is no permanent compatibility layer. Missing required Codex safety capabilities, obsolete Policy schemas and obsolete Receipt schemas fail closed. Runtime equivalence is a cryptographic identity rule, not a schema compatibility shim: mismatched runtime digests are never accepted. The retired PR narrative/prompt surface remains rejected.

The default branch must be protected by the machine-readable `repository-governance-contract.json` Ruleset baseline requiring PR-based changes and strict required checks, blocking deletion/non-fast-forward updates and tightly limiting bypass. `scripts/verify-repository-ruleset.js` validates the server-side control; repository tests cannot substitute for it.
