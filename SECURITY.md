# Security Policy

## Scope

Codex Safe Core is the canonical security/runtime and protocol boundary for Codex Review Safe, Codex Commit Safe, Codex PR Safe and Codex Review Service. A regression here is a product-family regression.

Current protocol line: **Safe Core v3 / Safe Contract v2 / Policy v3 / Review Receipt v3 / Commit Receipt v3**.

## Trust boundaries

1. **Repository/provider content** — source, diffs, paths, policy, history, templates, MR metadata and generated text are untrusted input.
2. **Codex executable** — must expose every capability required by Safe Contract v2; missing/rejected capabilities fail closed.
3. **Git/provider snapshot identity** — products must bind evidence to the correct immutable local or remote snapshot and recheck before external effects.
4. **AI output** — always untrusted structured data; validate schema, sizes, paths, changed-line evidence and domain constraints.
5. **Remote/provider boundary** — GitHub/GitLab adapters stay in product code and never increase Codex authority.

## Codex invariants

Safe Core constructs the safety-critical argv: `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of web search, shell/unified execution, shell snapshots, apps, multi-agent, remote plugins, hooks, goals, memories and skill dependency installation.

Unsupported required flags/config fail closed. **There is no legacy fallback.**

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

Review Receipt v3 uses an explicit subject envelope: `git-index` for staged local review or `gitlab-mr` for server review. Commit Receipt v3 may bind a Review Receipt v3 fingerprint. Every receipt must pass Core closed-schema validation before storage/consumption.

Receipts are provenance evidence, never authorization, human approval, build evidence or test evidence.

## Consumer pinning

Consumers use a commit-pinned Git submodule. The gitlink is the Core lock. No branch-following submodule, copied runtime, npm runtime dependency or cross-major compatibility shim is supported.

A Core update must explicitly move the consumer gitlink and pass that product's complete gate.

## Supply chain

Actions must be full-SHA pinned. Release artifacts should be checksummed and receive build-provenance attestations where supported. Only final release jobs should receive write/id-token permissions.

## Reporting

Report suspected vulnerabilities privately through GitHub Security Advisories when available. Never publish credentials, private repository data or exploit details in public issues.
