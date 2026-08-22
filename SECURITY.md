# Security Policy

## Scope

Codex Safe Core is the canonical security/runtime boundary for Codex Review Safe, Codex Commit Safe and Codex PR Safe. A regression here is a product-family regression.

Current protocol line: **Core/Contract/Policy/Receipt v2**.

## Trust boundaries

1. **Workspace / repository content** — source, diffs, paths, configuration, history, templates and generated text are untrusted input.
2. **Codex executable** — the configured executable must expose every capability required by the Safe Core contract. Missing/rejected capabilities fail closed.
3. **Git executable / repository state** — consumers must use snapshots/fingerprints around operations that depend on stable Git state.
4. **AI output** — always untrusted structured data; validate syntax, schema, semantics, sizes, paths and domain constraints before use.
5. **Remote/provider boundary** — GitHub/GitLab/provider adapters belong to product code and must never increase Codex execution authority.

## Non-negotiable Codex invariants

Safe Core constructs the safety-critical argv. Required semantics include:

- `--ask-for-approval never`;
- `exec --json`;
- ephemeral execution;
- ignored user Codex configuration and repository rules for the request;
- read-only sandbox;
- Structured Output schema;
- explicit Safe Core configuration overrides.

The request disables unnecessary capabilities including:

- web search;
- shell tool;
- unified exec;
- shell snapshot;
- apps;
- multi-agent;
- remote plugins;
- hooks;
- goals;
- memories;
- skill MCP dependency installation.

If a required CLI flag or config key is unsupported, Safe Core returns a compatibility/capability failure. **No legacy fallback may remove or weaken a required safety constraint.**

## Process invariants

- Process execution has finite timeout and output limits.
- Cancellation is supported.
- Process-tree termination is handled on Windows/POSIX.
- Native executables do not use an unrestricted shell.
- Windows script-shim invocation uses explicit quoting.
- Temporary Codex working directories are isolated from repository roots.

## Git invariants

Core provides common primitives for HEAD/index snapshots, staged diffs and fingerprints. Product code remains responsible for choosing the correct stable snapshot for its workflow and rechecking it before accepting model results or producing external effects.

Raw-index fingerprints are derived from raw staged-index bytes, not display-formatted Git output.

## Semantic-context invariants

Context reduction must not silently use global first-N-byte truncation.

`buildSemanticContext()` parses unified diff by file and applies:

- source-first evidence;
- fair source-file budget allocation;
- generated/lock metadata-only representation;
- binary metadata-only representation;
- bounded head/tail context for oversized source files.

The semantic context is model input only. Consumers retain full original diffs independently when full-data fingerprints or provenance are required.

## Policy invariants

- Only `.codex-safe.json` is part of Policy v2.
- `schemaVersion` must be `2`.
- Top-level unknown fields fail closed.
- Product sections are `commit`, `review`, `pr`.
- HEAD-pinned policy reads prevent staged/working-tree policy edits from changing the policy applied to their own change.
- v1 product-specific policy formats are intentionally unsupported.

## Receipt invariants

Review Receipt v2 and Commit Receipt v2 must pass Core validation before product code stores or consumes them.

Receipt fingerprints are evidence bindings, not authorization. A receipt must never by itself authorize:

- Git commit;
- push;
- source write;
- remote PR creation/submission;
- claim of human approval;
- claim of build/test success.

Receipt v1 is invalid under the v2 contract.

## Consumer pinning

Consumers use a **commit-pinned Git submodule**. The `160000` gitlink is the Core version lock.

There is no copied vendored runtime, lock/hash sync layer, branch-following submodule mode or runtime npm package compatibility path in v2.

A Core update must move the consumer gitlink explicitly and pass that product's complete CI/release gate.

## Supply-chain expectations

Consumer packages should stage only required Core runtime files into their production `dist/` boundary. Git/submodule metadata and development files must not enter user-facing artifacts.

Actions used in consumer release workflows should be pinned by full commit SHA. Release artifacts should be checksummed and, where available, receive build-provenance attestations.

## Reporting

Report suspected vulnerabilities privately through GitHub Security Advisories when available. Do not place credentials, secrets, private repository data or exploit details in public issues.
