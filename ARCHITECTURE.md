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
- Family Snapshot, Product Contract and Family Manifest validation.

Active products own their domain orchestration:

- **Review Safe:** staged snapshot, findings, local Review UX and Review Receipt persistence;
- **Commit Safe:** Commit Message generation, scope/style behavior and Commit Receipt binding;
- **Change Safe:** source/target topology, GitHub/GitLab providers, native SCM policy discovery, PR/MR mutations, Merge Readiness, Delivery Authorization and Change Receipt v1;
- **Review Service:** GitLab webhook/provider semantics, durable queue/outbox, MR review publication/gating/audit;
- **Diagnose Safe:** CI evidence acquisition, diagnosis orchestration and publication.

No product may reimplement Core-owned Process/Codex/Policy/Receipt/Review-Evidence primitives. Conversely, provider APIs, SQLite/outbox, notifications, deployment and SCM side effects must not move into Core.

**Codex PR Safe is retired** as the old model-generated PR-description identity. Model-generated PR/MR narrative remains outside the Family. Codex Change Safe is a distinct deterministic delivery product with zero model calls by default.

## Contract identity boundary

The current line is machine-owned by `core-contract.json`:

- Safe Core v4
- Safe Contract v2
- Policy Schema v4
- Review Receipt v4
- Commit Receipt v4
- Diagnosis Receipt v1
- Review / Commit / Diagnose Prompt Contract v1
- Family Snapshot v1 / Family Manifest v3 / Product Contract v1
- Node 22 LTS >=22.22.2 <23
- Node 24 LTS >=24.19.0 <25

There is no PR Prompt Contract. The retired `pr` policy/prompt section remains rejected. `change` is a new deterministic delivery-policy section, not a compatibility alias for `pr`.

Safe Contract version and digest solve different problems: the version represents semantic compatibility; `SAFE_CONTRACT_DIGEST` identifies the exact authority/capability manifest. Policy Schema v4 is independently versioned and does not alter Safe Contract v2 or Review/Commit Receipt v4.

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
- Family Snapshot/Manifest identity;
- Change provider-state normalization and authorization in the owning product.

Model-generated wording/findings/diagnoses are untrusted inputs. They cannot bypass schema validation, evidence binding or deterministic gates.

## Context and provider boundary

Core `buildSemanticContext()` and Review Evidence Chunking are generic bounded primitives. Provider-specific acquisition remains outside Core. Review Service fetches immutable GitLab evidence; Change Safe queries GitHub/GitLab delivery state; neither grants provider credentials or provider tools to Codex.

## Family manifest boundary

Every active consumer pins one exact formally released Core commit. A coordinated Family state is complete only when all five active consumer CIs pass on that same Core.

Family Compatibility freezes an Atomic Family Snapshot and then generates `FAMILY_MANIFEST.json` containing exact Core/consumer SHAs, Product Contract digests, policy/runtime/protocol identity and a manifest digest. The manifest receives GitHub build-provenance attestation and immutable digest-addressed publication.

## Release and supply-chain boundary

Core Release Validation runs supported Node floors and reproducible package checks. `_trusted-release.yml` owns authority-bearing tag/release publication, checksums, SPDX SBOM and build-provenance attestation. Existing release identities are never overwritten.

## Compatibility policy

There is no permanent compatibility layer. Policy Schema v3 → v4 is a coordinated hard switch across active consumers. Missing required Codex safety capabilities, obsolete Policy schemas and obsolete Receipt schemas fail closed. The retired PR narrative/prompt surface remains rejected.

The default branch should be protected by a GitHub Ruleset requiring PR-based changes and required checks, blocking deletion/force push and tightly limiting bypass. Repository policy enforcement is a server-side control; tests cannot substitute for it.
