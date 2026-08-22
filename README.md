# Codex Safe Core

English | [简体中文](README.zh-CN.md)

Codex Safe Core is the canonical, auditable safety/runtime core shared by the Codex Safe Git workflow family:

- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)

## Design contract

The core is intentionally small and product-agnostic. It owns only cross-product invariants:

1. **Fail-closed Codex capability negotiation** — required safety flags must exist; unsupported CLIs are rejected rather than silently downgraded.
2. **Read-only, ephemeral structured Codex execution** — no shell, network search, apps, hooks, memories, multi-agent or user rules/config are trusted by default.
3. **Hardened child-process lifecycle** — output limits, timeout, cancellation and process-tree termination on Windows/POSIX.
4. **Git repository primitives** — immutable snapshots, staged/branch diffs and fingerprints without product policy.
5. **Versioned receipts/contracts** — review and commit provenance are schema validated before consumption.
6. **Semantic context budgets** — source changes are prioritized while generated, lock and binary files are represented as metadata.

Product-specific behavior stays outside this repository: commit style/scope intelligence, review findings/reporting and PR provider/UI logic.

## Consumption model

The extension repositories vendor a pinned copy of the runtime files and record the canonical upstream source in `safe-core.lock.json`. Runtime npm dependencies are deliberately avoided so packaged VSIX files remain offline-buildable and auditable.

A consumer update is an explicit operation:

```text
upstream release/commit
        ↓
copy declared runtime files
        ↓
update lock + hashes
        ↓
consumer CI verifies exact bytes
```

No compatibility fallback is allowed for missing safety capabilities.

## Runtime surface

- `src/safe-contract.js`
- `src/codex-cli.js`
- `src/process-runner.js`
- `src/git-repository.js`
- `src/context-builder.js`
- `src/index.js`

`manifest.json` is the source-of-truth list for vendored runtime files.

## Development

```bash
npm test
npm run check
```

Node.js 22 or newer is required for development and CI.

## Security

See [SECURITY.md](SECURITY.md). The guiding rule is simple: AI output is untrusted data and may never gain authority to mutate Git, execute shell commands, or bypass a declared safety capability.
