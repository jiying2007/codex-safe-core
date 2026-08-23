# Contributing

Codex Safe Core is a security-sensitive shared dependency and the trust root for the Codex Safe family. Changes must remain small, reviewable, fail-closed, and coordinated with all consumers when the Core gitlink changes.

## Rules

- Do not add product-specific UI, provider behavior, or product policy to Core.
- Do not add compatibility fallbacks that weaken required Codex safety capabilities or protocol validation.
- Do not add runtime network dependencies or post-install scripts.
- Treat repository content and AI output as untrusted input.
- Keep process time/output limits finite and cancellation-safe.
- Core-owned runtime files live at repository root (for example `safe-contract.js`, `codex-cli.js`, `process-runner.js`, `policy.js`); do not reintroduce copied or proxy implementations in consumers.
- Every consumer pins one exact Core commit through `src/codex-safe-core` as a Git submodule. Branch tracking and copied-runtime synchronization are forbidden.
- Any merged Core commit changes the canonical gitlink, including docs/tests/workflow-only changes. After Core merge, coordinated repin PRs must update all four consumers: Codex Review Safe, Codex Commit Safe, Codex PR Safe, and Codex Review Service.
- Do not merge an isolated Dependabot/Core maintenance PR if doing so would move Core main without the coordinated consumer repin plan. Fold it into a reviewed Core maintenance PR, validate Core, merge Core, then repin all consumers.
- A Core patch that changes only governance/docs/tests/release automation does not by itself require consumer product-version bumps. Consumer versions change only when their own shipped product/runtime semantics change.
- Runtime/protocol changes require consumer compatibility review and full consumer CI before the family is considered converged.
- Update tests and security/architecture documentation when an invariant changes.

## Validation

Run Core validation:

```bash
npm run ci
```

For any Core merge, complete the coordinated rollout:

1. Merge the reviewed Core PR and record the final main commit SHA.
2. Update the `src/codex-safe-core` gitlink in Review, Commit, PR, and Review Service to that exact SHA.
3. Update any machine gates or provenance references that intentionally bind the Core SHA, such as verifier constants or schema URLs.
4. Run each consumer's complete CI matrix.
5. Merge the four consumer repin PRs.
6. Verify the recurring Family Compatibility workflow now sees all four consumers pinned to current Core.
7. Remove temporary maintenance branches; do not leave migration workflows or compatibility residue.

The invariant is: **Core main and all four consumer gitlinks converge to one exact reviewed Core commit, with no compatibility shim or copied-runtime path.**
