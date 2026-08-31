# Security Policy

## Scope

Codex Safe Core is the canonical security/runtime and protocol boundary for Codex Change Safe, Codex Review Safe, Codex Commit Safe, Codex Diagnose Safe and Codex Review Service. A regression here is a product-family regression. **Codex PR Safe** remains retired only as the former model-generated PR-description identity.

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v4 / Commit Receipt v4 / Diagnosis Receipt v1 / Prompt Contracts v1**. `core-contract.json` is the machine-checked source of current protocol/runtime facts.

## Trust boundaries

1. **Repository/provider content** — source, diffs, paths, policy, history, templates, PR/MR metadata and generated text are untrusted input.
2. **Codex executable** — must expose every capability required by Safe Contract v2; missing/rejected capabilities fail closed.
3. **Git/provider snapshot identity** — products bind evidence to the correct immutable local/remote snapshot and recheck before external effects.
4. **AI output** — always untrusted structured data; validate schema, sizes, paths, changed-line evidence and domain constraints.
5. **Remote/provider boundary** — GitHub/GitLab adapters and provider credentials stay in product code and never increase Codex authority.

## Codex invariants

Safe Core constructs the safety-critical argv: `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of web search, shell/unified execution, shell snapshots, apps, multi-agent, remote plugins, hooks, goals, memories and skill dependency installation.

Unsupported required flags/config fail closed. **There is no legacy fallback.** `SAFE_CONTRACT_MANIFEST` is the canonical capability declaration and `SAFE_CONTRACT_DIGEST` its SHA-256 identity.

Change Safe performs zero model calls by default; consuming Core policy/fingerprint primitives does not grant it Codex runtime authority.

## Process invariants

- finite timeout and output limits;
- cancellation and process-tree termination on Windows/POSIX;
- shell-free native execution;
- explicit Windows shim quoting;
- isolated temporary Codex directories outside repository roots.

## Context and review-evidence invariants

`buildSemanticContext()` is bounded model context. `buildReviewEvidenceChunks()` is Review evidence: changed hunks are never silently middle-truncated; any budget overflow becomes an explicit coverage gap and review products fail closed.

Provider-specific immutable source windows remain product-owned evidence acquisition and are treated as untrusted evidence, never instructions.

## Policy invariants

- exactly one repository policy file: `.codex-safe.json`;
- `schemaVersion` must be `4`;
- older schema versions and parallel product policy files such as `.codex-change-safe.json` are unsupported;
- unknown top-level/section/rule fields and wrong field types fail closed;
- sections are `commit`, `review`, `change`, `reviewService`;
- `change` contains deterministic delivery requirements only; it never restores the retired PR narrative/prompt surface;
- all consumers use Core parsing/validation and the same committed policy fingerprint;
- local Change settings may only tighten validated committed `change` rules; SCM-native requirements are unioned in Change Safe and cannot be weakened locally.

## Receipt invariants

Review Receipt v4 and Commit Receipt v4 remain closed contracts. Change Receipt v1 is product-owned by Change Safe. Diagnosis Receipt v1 separately binds diagnosis evidence. Receipts are provenance evidence, never authorization, human approval, build evidence or test evidence.

Policy Schema v4 does not change Safe Contract v2 or Review/Commit Receipt v4.

## Consumer pinning and ownership

All five active consumers use an exact commit-pinned Git submodule. The gitlink is the Core lock. No branch-following submodule, copied runtime, npm runtime dependency or cross-major compatibility shim is supported.

`core-ownership-manifest.json` defines Core-owned primitives and product-owned domains. Core owns Policy Schema/validation; Change Safe owns SCM Provider behavior, topology, readiness and mutations. A Core update must explicitly move every active consumer gitlink and pass each product's complete gate.

## Family evidence

After all five consumers converge on one formally released Core SHA, Family Compatibility freezes an Atomic Family Snapshot and generates `FAMILY_MANIFEST.json` containing exact Core/consumer SHAs, Product Contract digests, protocol/runtime identity and a manifest digest. The manifest receives GitHub provenance attestation and immutable digest-addressed publication.

## Supply chain

Actions are full-SHA pinned. Core Release Validation checks supported Node floors and reproducible package output. Trusted release publication emits checksums, SPDX SBOM, contract/ownership manifests and GitHub build-provenance attestations. Existing release identities are never overwritten.

Default-branch governance should require pull requests and required security/CI checks, block force pushes and branch deletion, and keep bypass narrowly restricted. Repository Rulesets are the authoritative server-side control; workflow tests cannot substitute for GitHub-side enforcement.

## Reporting

Report suspected vulnerabilities privately through GitHub Security Advisories when available. Never publish credentials, private repository data or exploit details in public issues.
