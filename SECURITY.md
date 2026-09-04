# Security Policy

## Scope

Codex Safe Core is the canonical security/runtime and protocol boundary for Codex Change Safe, Codex Review Safe, Codex Commit Safe, Codex Diagnose Safe and Codex Review Service. A regression here is a product-family regression. **Codex PR Safe** remains retired only as the former model-generated PR-description identity.

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Prompt Contracts v1 / Runtime v3 / Provider Contract v3 / Family Snapshot v3 / Family Manifest v5 / Product Contract v2**. `core-contract.json` is the machine-checked source of current protocol/runtime facts.

## Trust boundaries

1. **Repository/provider content** — source, diffs, paths, policy, history, templates, PR/MR metadata and generated text are untrusted input.
2. **Codex executable** — must expose every capability required by Safe Contract v2; missing/rejected capabilities fail closed.
3. **Git/provider snapshot identity** — products bind evidence to the correct immutable local/remote snapshot and recheck before external effects.
4. **AI output** — always untrusted structured data; validate schema, sizes, paths, changed-line evidence and domain constraints.
5. **Remote/provider boundary** — GitHub/GitLab adapters and provider credentials stay in product code and never increase Codex authority.
6. **Machine configuration** — model/runtime/calibration files are machine-owned; no-follow/same-descriptor checks, bounded size, owner/permission checks and atomic writes prevent repository-controlled substitution.

## Codex invariants

Safe Core constructs the safety-critical argv: `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of web search, shell/unified execution, shell snapshots, apps, multi-agent, remote plugins, hooks, goals, memories and skill dependency installation.

Unsupported required flags/config fail closed. **There is no legacy fallback.** `SAFE_CONTRACT_MANIFEST` is the canonical capability declaration and `SAFE_CONTRACT_DIGEST` its SHA-256 identity.

Change Safe performs zero model calls by default; consuming Core policy/fingerprint primitives does not grant it Codex runtime authority.

## Process invariants

- finite timeout and output limits;
- cancellation and process-tree termination on Windows/POSIX;
- shell-free native execution;
- explicit Windows shim quoting;
- isolated temporary Codex directories outside repository roots;
- incremental Codex JSONL parsing with independent retained-output and total-transcript ceilings.

## Context and review-evidence invariants

`buildSemanticContext()` is bounded model context. `buildReviewEvidenceChunks()` is Review evidence: changed hunks are never silently middle-truncated; any budget overflow becomes an explicit coverage gap and review products fail closed.

Provider-specific immutable source windows remain product-owned evidence acquisition and are treated as untrusted evidence, never instructions.

## Model routing and calibration invariants

Model Routing Contract v1 keeps model generations outside repository policy. Automatic selection requires approved Registry evidence and records canonical `registryDigest` and `routingPolicyDigest`; cross-provider fallback is disabled unless explicitly machine/admin enabled. Required Reviewer/Adjudicator authority never silently downgrades.

Token Calibration stores only numeric provider/model observations. TTL is per model's real `lastObservedAtMs`; unrelated writes cannot renew stale data. Calibration and Registry files use the shared secure local-file primitive and never persist prompts, source, findings, judgments or credentials.

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

Review Receipt v5 and Commit Receipt v4 remain closed contracts. Change Receipt v1 is product-owned by Change Safe. Diagnosis Receipt v2 separately binds diagnosis evidence. Receipts are provenance evidence, never authorization, human approval, build evidence or test evidence.

Consumer CI Receipt v1 is release evidence, not a substitute for the test run it binds. It must reference the exact consumer SHA, exact pinned Core SHA/digests and a successful CI run. Product Contract v2 binds the consumer to the exact Core pin plus its `runtimeDigest` and `governanceDigest`.

## Consumer pinning and Core identity

All five active consumers use an exact commit-pinned Git submodule. No branch-following submodule, copied runtime, npm runtime dependency or cross-major compatibility shim is supported.

Core Digest Contract v1 separates runtime and governance identity. Every consumer pin must itself be an exact immutable Core Release. A consumer may remain on an older exact Core SHA only when that released Core has the same `runtimeDigest` as the newest released Core. A mismatched runtime digest is stale and fails Family readiness; governance equivalence never relaxes runtime/protocol checks.

`core-ownership-manifest.json` defines Core-owned primitives and product-owned domains. Core owns Policy Schema/validation; Change Safe owns SCM Provider behavior, topology, readiness and mutations.

## Family evidence

Family Snapshot v3 freezes the exact current Core SHA/digests and every exact consumer release, including each consumer's exact pinned Core SHA/digests, Consumer CI Receipt and required distribution evidence.

Family Manifest v5 binds that snapshot, Product Contract/package-lock digests, protocol/runtime identity and distribution evidence, then receives GitHub provenance attestation and immutable digest-addressed publication. Routine Family Compatibility consumes immutable CI receipts and performs cross-family validation; the full five-consumer × three-OS matrix remains a scheduled/manual audit.

## Supply chain

Actions are full-SHA pinned. Core Release Validation checks supported Node floors and reproducible package output. Trusted release publication emits checksums, SPDX SBOM, contract/ownership manifests, `CORE_DIGESTS.json` and GitHub build-provenance attestations. Existing release identities are never overwritten.

Runtime-changing Core releases use a two-phase Family Upgrade: prepare every required consumer repin and wait for all checks before any merge, then freeze PR heads and merge only the validated set. Governance-only Core releases do not force byte-identical consumer artifacts to be rebuilt.

## Repository governance

`repository-governance-contract.json` defines the required server-side GitHub Ruleset baseline: PR-based changes, strict required checks, stale-review handling, deletion/non-fast-forward protection and bounded bypass. `scripts/verify-repository-ruleset.js` audits the live server-side state. Workflow tests cannot substitute for GitHub-side enforcement.

## Reporting

Report suspected vulnerabilities privately through GitHub Security Advisories when available. Never publish credentials, private repository data or exploit details in public issues.
