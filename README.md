# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime and protocol core** for the Codex Safe family:

- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)
- [Codex Review Service](https://github.com/jiying2007/codex-review-service)

Current protocol line: **Safe Core v3 / Safe Contract v2 / Policy Schema v3 / Review Receipt v3 / Commit Receipt v3**.

## Consumption model

Consumers pin this repository as a Git submodule. The gitlink is the version lock; there is no copied runtime, branch-following mode, npm runtime dependency or compatibility proxy.

## Public runtime boundary

- `index.js`
- `safe-contract.js`
- `codex-cli.js`
- `process-runner.js`
- `git-repository.js`
- `context-builder.js`
- `policy.js`
- `codex-safe.schema.json`

## Ownership

Core owns cross-product primitives:

- Codex capability probing, executable resolution, Safe argv, Structured Output and JSONL parsing;
- process launch, cancellation, timeout, tree termination and output bounds;
- generic local Git primitives used by desktop consumers;
- Semantic Context budgeting for narrative generation;
- coverage-preserving Review Evidence Chunking for review products;
- `.codex-safe.json` Policy Schema v3 validation/fingerprints;
- Review Receipt v3 and Commit Receipt v3 validation/fingerprints.

Products own domain behavior:

- **Review Safe:** staged snapshot, finding validation/presentation and local diagnostics.
- **Commit Safe:** Conventional Commit policy, scope/style intelligence and Commit Receipt persistence/binding.
- **PR Safe:** base/fork semantics, PR narrative, preview and provenance presentation.
- **Review Service:** GitLab webhook/provider semantics, Project/Group scope, immutable MR evidence acquisition, SQLite queue/outbox, merge gate and publication.

A product must not carry an independent implementation of Core-owned Codex/process/policy/receipt/review-chunk primitives.

## Safe Contract v2

The safety contract intentionally remains v2. Required capabilities include `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of shell/unified execution, web search, apps, multi-agent, plugins, hooks, goals, memories and dependency installation. Missing capabilities fail closed; there is no legacy CLI fallback.

## Policy v3

The only repository policy is `.codex-safe.json`:

```json
{
  "schemaVersion": 3,
  "commit": {},
  "review": {
    "confidenceThreshold": 0.7,
    "rules": {
      "requireTestsForCodeChanges": true,
      "codePathPrefixes": ["src/"],
      "testPathPrefixes": ["test/", "tests/"],
      "forbiddenPathPrefixes": []
    }
  },
  "reviewService": {
    "maxContextBytes": 262144,
    "maxContextFiles": 12,
    "contextLines": 20,
    "skipGeneratedFiles": true,
    "blockUnreviewableFiles": false
  },
  "pr": {}
}
```

Schema v2 is intentionally unsupported under v3.

## Context semantics

`buildSemanticContext()` is for Commit/PR narrative input and may fairly reduce source context while demoting generated/binary content to metadata.

`buildReviewEvidenceChunks()` is for Review Safe/Review Service. It never silently truncates changed hunks: evidence is either included in bounded chunks or returned as an explicit coverage gap so the review can fail closed.

## Receipt v3

Review Receipt v3 uses a subject envelope:

- local review: `type=git-index` with HEAD/index identity;
- server review: `type=gitlab-mr` with Project/MR/start SHA/head SHA identity.

Commit Receipt v3 binds generated commit evidence and an optional Review Receipt v3 fingerprint. Receipts remain AI workflow provenance, never human approval or test evidence.

## Development

```bash
npm run ci
```

Node.js 22 or newer is required.

## Versioning

Core major versions are protocol boundaries. Breaking Policy/Receipt/Core changes require a hard major switch across consumers; permanent compatibility shims are forbidden. Safe Contract has its own protocol version and changes only when the Codex execution safety contract itself changes.

## Security

See [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

The invariant is: **AI output is untrusted data and never gains authority to mutate Git, execute arbitrary commands, bypass safety capabilities, or create provider side effects.**

## License

MIT
