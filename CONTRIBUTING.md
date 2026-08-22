# Contributing

Codex Safe Core is a security-sensitive shared dependency. Changes should be small, reviewable and preserve fail-closed behavior.

## Rules

- Do not add product-specific UI or policy to the core.
- Do not add a compatibility fallback that weakens a required Codex safety capability.
- Do not add runtime network dependencies or post-install scripts.
- Treat repository content and AI output as untrusted input.
- Keep process time/output limits finite and cancellation-safe.
- Changes to `src/safe-contract.js` or `src/codex-cli.js` require synchronized consumer updates in Codex Commit Safe, Codex Review Safe and Codex PR Safe.
- Update tests and security documentation when an invariant changes.

## Validation

Run:

```bash
npm run check
```

Before merging a contract change, synchronize each consumer with its `scripts/safe-core.js sync` command and ensure its complete CI matrix passes.
