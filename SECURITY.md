# Security Policy

## Scope

Codex Safe Core is the canonical security/runtime and protocol boundary for Codex Review Safe, Codex Commit Safe, Codex PR Safe and Codex Review Service. A regression here is a product-family regression.

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contracts v1**. `core-contract.json` is the machine-checked source of these current protocol/runtime facts.

## Trust boundaries

1. **Repository/provider content** — source, diffs, paths, policy, history, templates, MR metadata and generated text are untrusted input.
2. **Codex executable** — must expose every capability required by Safe Contract v2; missing/rejected capabilities fail closed.
3. **Git/provider snapshot identity** — products must bind evidence to the correct immutable local or remote snapshot and recheck before external effects.
4. **AI output** — always untrusted structured data; validate schema, sizes, paths, changed-line evidence and domain constraints.
5. **Remote/provider boundary** — GitHub/GitLab adapters stay in product code and never increase Codex authority.

## Codex invariants

Safe Core constructs the safety-critical argv: `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of web search, shell/unified execution, shell snapshots, apps, multi-agent, remote plugins, hooks, goals, memories and skill dependency installation.

Unsupported required flags/config fail closed. **There is no legacy fallback.** `SAFE_CONTRACT_MANIFEST` is the canonical capability declaration and `SAFE_CONTRACT_DIGEST` is its SHA-256 identity. The digest supplements protocol versioning; it does not silently redefine Safe Contract v2 semantics.

The daily Codex CLI Canary validates current upstream capability syntax. When protected OpenAI credentials are configured for the workflow, the live behavioral canary additionally attempts filesystem and loopback-network side effects under the Safe Contract and fails if either side effect succeeds. Unit adversarial-corpus tests permanently verify that repository/model text cannot alter the constructed safety argv.

## Process invariants

- finite timeout and output limits;
- cancellation and process-tree termination on Windows/POSIX;
- shell-free native execution;
- explicit Windows shim quoting;
- isolated temporary Codex directories outside repository roots.

## Context and review-evidence invariants

`buildSemanticContext()` is narrative input for Commit/PR and may fairly reduce source context while keeping generated/lock/binary content metadata-only.

`buildReviewEvidenceChunks()` is review evidence. Changed hunks are never silently middle-truncated: each included hunk must appear in a bounded chunk; any hunk/chunk budget overflow becomes an explicit coverage gap and review products must fail closed.

Provider-specific immutable source windows (for example GitLab `start_sha/head_sha`) remain product-owned evidence acquisition and are treated as untrusted evidence, never instructions.

## Policy invariants

- only `.codex-safe.json`;
- `schemaVersion` must be `3`;
- unknown top-level/section/rule fields fail closed;
- sections: `commit`, `review`, `reviewService`, `pr`;
- `review.rules` contains cross-product deterministic Review rules;
- `reviewService` contains server-only context/coverage controls;
- local consumers read policy from captured HEAD; Review Service reads from immutable target `start_sha`;
- Policy v2 and product-specific legacy policy formats are intentionally unsupported.

## Receipt invariants

Review Receipt v4 uses an explicit subject envelope: `git-index` for staged local review or `gitlab-mr` for server review. Commit Receipt v4 may bind a Review Receipt v4 fingerprint. Every receipt must pass the Core closed-schema validator before storage/consumption.

Receipt v4 remains unchanged by Core 4.1 trust-root governance. Safe Contract/prompt/execution digests are maintained as separate machine identities until a future receipt major explicitly adopts them; no maintenance release may add undeclared receipt fields.

Receipts are provenance evidence, never authorization, human approval, build evidence or test evidence.

## Consumer pinning and ownership

Consumers use a commit-pinned Git submodule. The gitlink is the Core lock. No branch-following submodule, copied runtime, npm runtime dependency or cross-major compatibility shim is supported.

`core-ownership-manifest.json` defines Core-owned primitives and product-owned domains. Family validation checks consumers for forbidden independent declarations of Core-owned safety/process/policy/receipt primitives. A Core update must explicitly move the consumer gitlink and pass that product's complete gate.

## Family baseline evidence

After all consumers are coordinated onto a Core SHA, Family Compatibility generates `FAMILY_BASELINE.json` containing the exact Core SHA, consumer SHAs, protocol/runtime identity and a baseline digest. The Linux baseline artifact is attested by GitHub so a historical family state can be verified without inferring it from moving branches.

## Supply chain

Actions must be full-SHA pinned. Release artifacts are checksummed and receive GitHub build-provenance attestations. Release also verifies package reproducibility at the file-manifest level before publication. Only final release jobs receive write/id-token/attestation permissions.

Default-branch governance should require pull requests and required security/CI checks, block force pushes and branch deletion, and keep bypass narrowly restricted. Repository Rulesets are the authoritative server-side control; workflow tests verify the expected governance files but cannot substitute for GitHub-side enforcement.

## Reporting

Report suspected vulnerabilities privately through GitHub Security Advisories when available. Never publish credentials, private repository data or exploit details in public issues.
