# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core is the **single canonical safety/runtime and protocol core** for the Codex Safe family:

- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)
- [Codex Review Service](https://github.com/jiying2007/codex-review-service)

Current protocol line: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contracts v1**.

## Consumption model

Consumers pin this repository as a Git submodule. The gitlink is the version lock; there is no copied runtime, branch-following mode, npm runtime dependency or compatibility proxy.

## Ownership

Core owns Codex capability probing/invocation, process lifecycle, generic Git primitives, Semantic Context, coverage-preserving Review Evidence Chunking, Policy Schema v3, deterministic review rules, fingerprints and Receipt validation/provenance. Products own only Commit, Review, PR or GitLab-service domain behavior. A product must not carry an independent implementation of a Core-owned primitive.

## Safe Contract v2

The safety contract remains v2. Required capabilities include `--ask-for-approval never`, `exec --json`, ephemeral execution, ignored user/repository Codex rules, read-only sandbox, Structured Output and explicit disabling of shell/unified execution, web search, apps, multi-agent, plugins, hooks, goals, memories and dependency installation. Missing capabilities fail closed; there is no legacy CLI fallback.

## Policy Schema v3

The only repository policy is `.codex-safe.json`. Older policy schemas are intentionally rejected. Commit, Review, Review Service and PR consume separate sections of the same closed schema.

## Receipt v4 provenance

Review and Commit Receipts are closed v4 contracts. Core canonicalizes and records:

- Safe Core / Safe Contract / Policy Schema / Prompt Contract versions;
- requested and resolved model identity;
- Codex CLI version;
- immutable Git subject/evidence fingerprints and verdict metadata.

Receipt v3 is intentionally unsupported. Receipts are AI-workflow provenance, never human approval, build evidence or test evidence.

## Deterministic boundary

Git evidence identity, policy evaluation, Receipt validation, coverage/readiness/mechanical gates, severity/confidence filtering and stale-publication rejection are deterministic. Model wording and findings are non-deterministic inputs and cannot bypass schema validation, evidence binding or deterministic gates.

## Family governance

- **Family Compatibility:** weekly/manual Linux + Windows + macOS validation ensures Commit, Review, PR and Review Service all pin the current Core and pass their CI.
- **Codex CLI Canary:** daily/manual checks the latest upstream Codex CLI on Linux, Windows and macOS against the Safe Contract capabilities.
- **OpenSSF Scorecard:** recurring security-regression signal.
- **Release supply chain:** immutable tags/assets, SHA-256 checksums, deterministic SPDX 2.3 SBOM and GitHub build-provenance attestation.

## Development

```bash
npm run ci
```

Node.js 22 or newer is required.

## Versioning

Core major versions are implementation/protocol-family boundaries. Protocol numbers remain independent and change only when their own semantics change. Breaking Receipt/Core changes require a hard switch across consumers; permanent compatibility shims are forbidden.

## Security

See [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

The invariant is: **AI output is untrusted data and never gains authority to mutate Git, execute arbitrary commands, bypass safety capabilities, or create provider side effects.**

## License

MIT
