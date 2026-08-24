# Codex Safe Core Consumer Guide

Codex Safe Core is consumed only by Codex Safe Family products. It is not a standalone CLI or application.

## Supported model

Each product pins one exact Core commit as a Git submodule at `src/codex-safe-core`.

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

Do not use branch tracking, copied runtime files, npm runtime dependencies, or compatibility proxies.

## Coordinated Core update

1. Merge the reviewed Core change and record the exact Core commit SHA.
2. Repin Review, Commit, PR and Review Service to that SHA.
3. Repin any `.codex-safe.example.json` schema URL to the same SHA.
4. Run every consumer CI.
5. Merge consumers only when all are green.
6. Verify Family Compatibility against the canonical Core HEAD.

Governance/docs-only Core updates do not require consumer product-version bumps unless product/runtime semantics change.

## Protocol line

- Safe Core v4
- Safe Contract v2
- Policy Schema v3
- Review Receipt v4
- Commit Receipt v4
- Prompt Contracts v1

Older protocol variants are intentionally unsupported. Do not add compatibility shims.

## Verification

Run:

```bash
npm run ci
```

The Core CI covers contract/runtime behavior, deterministic review rules, golden behavior fixtures, broad performance budgets, release governance and supply-chain canaries.
