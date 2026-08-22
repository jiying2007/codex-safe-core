# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime core** for the Codex Safe Git Workflow family:

- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)

Current protocol line: **Safe Core v2 / Safe Contract v2 / Policy Schema v2 / Receipt Schema v2**.

## Consumption model

Consumers use this repository as a **commit-pinned Git submodule** at `src/codex-safe-core`.

```text
codex-safe-core commit
        ↓ gitlink (160000)
Review / Commit / PR source tree
        ↓ product build
production dist/
        ↓
VSIX
```

There is no copied-vendored runtime, `safe-core.lock.json`, byte-sync workflow, runtime npm dependency, or branch-following submodule mode.

The gitlink itself is the version lock. Consumers update Core by explicitly moving the submodule commit and running their complete product gate.

## Public runtime surface

The repository root is the public runtime boundary:

- `index.js`
- `safe-contract.js`
- `codex-cli.js`
- `process-runner.js`
- `git-repository.js`
- `context-builder.js`
- `policy.js`
- `codex-safe.schema.json`

No `src/` compatibility proxy is part of the v2 contract.

## Ownership boundary

Core owns cross-product infrastructure only:

### Codex runtime

- capability probing;
- executable resolution;
- fail-closed safe argv construction;
- temporary-directory execution;
- JSONL / Structured Output handling.

### Process runtime

- native process launch;
- Windows script handling;
- cancellation;
- timeout;
- process-tree termination;
- stdout/stderr bounds.

### Git primitives

- repository commands;
- HEAD/index snapshots;
- raw-index fingerprints;
- staged diff / changed paths;
- common repository primitives.

### Semantic context

- unified-diff per-file parsing;
- source/generated/binary classification;
- generated/lock/binary metadata-only policy;
- fair source-file budget allocation;
- bounded large-file context.

### Policy protocol

- only `.codex-safe.json`;
- `schemaVersion: 2`;
- `commit`, `review`, `pr` sections;
- HEAD-pinned policy read;
- closed top-level document;
- stable fingerprint.

### Receipt contract

- Review Receipt v2 validation;
- Commit Receipt v2 validation;
- canonical fingerprint helpers.

Product repositories own only domain behavior:

- **Review:** finding model, confidence/severity policy, diagnostics, reports, workflow.
- **Commit:** Conventional Commit policy, scope intelligence, repository-style intelligence, rendering, receipt persistence/range binding.
- **PR:** Base/fork semantics, PR narrative, provider integration, preview and provenance presentation.

A product repository must not carry an independent implementation of Core-owned Process/Codex/context/policy-contract primitives.

## Non-negotiable safety contract

Safe Codex execution requires the capabilities needed for:

- `--ask-for-approval never`
- `exec --json`
- `--ephemeral`
- `--skip-git-repo-check`
- `--ignore-user-config`
- `--ignore-rules`
- `--sandbox read-only`
- `--output-schema`
- explicit Safe Core `--config` overrides

Safe Core disables shell/unified execution, shell snapshots, web search, apps, multi-agent, remote plugins, hooks, goals, memories and skill dependency installation for the request.

If a required flag/config capability is missing or rejected, execution fails closed. **There is no v1/legacy fallback.**

## Semantic Context Budget

`buildSemanticContext()` never relies on global `diff.slice(0, N)` truncation.

It parses diff blocks by file and prioritizes source evidence:

```text
unified diff
    ↓ per-file blocks
classify
    ├ source → fair budget → bounded block context
    ├ generated/lock → metadata only
    └ binary → metadata only
```

Consumers keep the original complete diff separately for fingerprints/provenance. Context reduction affects model input only.

## Policy v2

Canonical repository configuration:

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/d49dc356824b984166e81e42bb5f9d7abfb90099/codex-safe.schema.json",
  "schemaVersion": 2,
  "commit": {},
  "review": {},
  "pr": {}
}
```

v1 product-specific policy files are intentionally unsupported.

## Receipt v2

Review Receipt v2 binds review evidence to HEAD/index/diff/policy fingerprints.

Commit Receipt v2 binds generation evidence to parent HEAD/index/full diff/final message/policy and optional Review Receipt fingerprint. Product code may persist receipts, but Core is the authority that validates their shape and fingerprint semantics.

Receipt v1 is intentionally invalid under v2.

## Development

```bash
npm test
npm run check
```

Node.js 22 or newer is required.

Consumers must initialize the submodule before building:

```bash
git submodule update --init --recursive
```

## Versioning policy

A Safe Core major version is a protocol boundary. Breaking safety/policy/receipt changes require a major version and consumer hard switch. The project does not maintain permanent compatibility shims across major protocol lines.

## Security

See [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

The core rule is: **AI output is untrusted data and never gains authority to mutate Git, execute arbitrary commands, bypass required safety capabilities, or create remote side effects.**

## License

MIT
