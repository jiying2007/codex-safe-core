# Codex Safe Core Consumer Guide

Codex Safe Core is consumed only by Codex Safe Family products. It is not a standalone CLI or application.

## Supported model

Each product pins one exact Core commit as a Git submodule at `src/codex-safe-core`.

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

Do not use branch tracking, copied runtime files, npm runtime dependencies, or compatibility proxies.

The current machine contract is `core-contract.json`: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contracts v1**. Consumers must use a supported Node LTS line: Node 22 >=22.22.2 <23 or Node 24 >=24.19.0 <25.

## Coordinated Core update

1. Merge the reviewed Core change and record the exact Core commit SHA.
2. Repin Review, Commit, PR and Review Service to that SHA.
3. Repin any `.codex-safe.example.json` schema URL to the same SHA.
4. Run every consumer CI.
5. Merge consumers only when all are green.
6. Run Family Compatibility against the canonical Core HEAD.
7. Require the generated `FAMILY_BASELINE.json` to show the same Core pin for all four consumer SHAs and retain its GitHub provenance attestation.

Governance/docs-only Core updates do not require consumer product-version bumps unless product/runtime semantics change. They still require coordinated gitlink repin because the gitlink is the family trust lock.

## Ownership boundary

`core-ownership-manifest.json` records Core-owned primitives. Consumer products must import/consume those primitives instead of declaring independent Process/Codex/Policy/Receipt/Review-Evidence implementations. Family Compatibility runs a boundary linter before accepting a baseline.

Provider adapters, SQLite/outbox, notifications, deployment and product-domain orchestration stay in the owning product and must not be pulled into Core.

## Safe Contract identity

Safe Contract v2 has both a semantic version and a machine digest:

- `SAFE_CONTRACT_MANIFEST` — closed authority/capability declaration;
- `SAFE_CONTRACT_DIGEST` — SHA-256 of that manifest.

The digest is evidence of the exact manifest and does not replace semantic protocol versioning. Receipt v4 remains closed and does not gain maintenance-only digest fields.

## Verification

Run:

```bash
npm run ci
```

Core CI covers contract/runtime identity, deterministic review rules, adversarial safety fixtures, golden behavior, broad performance budgets, trusted release governance and supply-chain canaries. Family Compatibility additionally validates exact consumer pins, ownership boundaries and every consumer CI before producing the attested family baseline.
