# Audit remediation and production acceptance

Audit baseline: 2026-10-25 (Asia/Shanghai), Core `190651770a444b0693d82228afc66879dd57b0c0`.

## Runtime and final-outcome repairs

The 4.18.2 candidate also closes process-group cleanup after the direct child exits, applies bounded no-follow machine-file reads to runtime/config/auth, and preserves real `a/` and `b/` repository directories in evidence identities. Consumer candidates must cover staged verification evidence and incomplete coverage, deterministic readiness, domain profile checks, and final SCM draft compare-and-set. Service must combine required analyzer evidence into the final gate and prevent stale status generations from publishing. Diagnose and Service artifact redirects must drop authentication when leaving GitLab. Debug verification and rollback proof repairs remain development-only.

These are executable regression requirements, not model-recall or deployment claims.

## Repair order

1. Runtime JSONL repair (Core PR #78): byte-correct UTF-8 streaming, successful terminal state, and shared streaming/non-streaming validation. This changes runtime identity and requires a new formal Core release before consumer repins.
2. Service publication recovery: authoritative remote reconciliation after uncertain writes, bounded same-MR serialization and a fresh snapshot check. Unknown semantic claims must not obtain invented reuse authority. This is not a distributed exactly-once guarantee.
3. This governance change: frozen CLI identity, stage-bound qualification evidence, private Family reads and authenticated Git materialization. It must not substitute for the runtime repair.
4. Service bilingual quickstart/backup schema consistency and executable documentation regressions.

## Family credentials

Configure the protected Core repository secret `CODEX_SAFE_FAMILY_READ_TOKEN` for Core's own Family jobs. Separately, make the same named secret available to every consumer caller through its protected repository secret or an organization secret whose repository access includes that caller. A secret stored only in Core is not automatically available to a workflow called by another repository. The credential needs read access limited to the registered Family repositories, including any private stable consumer: use only the read permissions needed for repository contents/releases, Actions CI evidence and attestations. It must not be an administrator or publication credential, and `FAMILY_BOT_TOKEN` must not be substituted for it.

Family Status/Freshness/Snapshot, repository governance and release validation API reads use this credential. Every exact-commit JSON file is read through the authenticated Contents API with its Git blob digest verified. Private release evidence uses the asset API; CDN redirects permanently drop authentication. Consumer callers pass the same narrowly scoped read secret explicitly into the reusable Family Release Guard. Both consumer materialization jobs use it only in the Git subprocess environment, scoped to `https://github.com/`; redirects and interactive credential prompts are disabled. Tokens are not included in clone URLs, argv, generated receipts or persisted Git configuration. The repository-scoped `github.token` remains the credential for dispatch and publication writes.

Canonical `repin-consumer.js` reads the Family Release Guard declaration from the exact target Core Git object and rejects substantive working-tree drift without overwriting the file. Only LF/CRLF checkout normalization is allowed in that comparison; the declaration decision still uses the exact blob. An unreadable target object fails; the script never falls back to an edited working-tree declaration. If that exact callee declares this optional secret, repin adds the following job-level mapping to each matching caller. It preserves existing explicit block-style mappings and their indentation and does not use `secrets: inherit`. An existing read-secret binding may use a controlled, single-line `secrets.NAME` expression; folded scalars, YAML anchors/aliases, literal credentials and dynamic expressions are rejected rather than resolved:

```yaml
secrets:
  CODEX_SAFE_FAMILY_READ_TOKEN: ${{ secrets.CODEX_SAFE_FAMILY_READ_TOKEN }}
```

GitHub requires [the caller to pass named secrets explicitly](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#passing-inputs-and-secrets-to-a-reusable-workflow). Configure the secret at the caller as well as adding this mapping; the expression contains no credential value. Do not add the new mapping to an old Core callee that has not declared the secret. Repin validates all related workflow edits before writing consumer files. The related workflows, including their job maps, must use the supported block-style layout; this is not a general YAML rewriter. Ambiguous or unsupported layouts fail before consumer file writes instead of broadening secret access. A failed filesystem write remains atomic for that file; the entire repin, including its preceding Git checkout, is not a transaction.

Without the optional cross-repository read secret, the public-only topology can use the repository token. A private consumer that is inaccessible still blocks the Family: do not drop that consumer, replace its evidence or change repository visibility to make the workflow green. Repository governance entitlement and CI runner availability are separate requirements that a read token does not repair.

Automatic freshness convergence uses the receipt-backed routine Family audit. The weekly schedule and explicit `full_matrix=true` still perform the complete cross-platform audit.

## Codex qualification

Configure `CODEX_CANARY_OPENAI_API_KEY` (or the existing `OPENAI_API_KEY` fallback) through the protected secret store. `CODEX_CANARY_MODEL` remains an optional repository variable. Never substitute a GitHub PAT for provider credentials.

Both the scheduled qualification and relevant PR checks resolve one exact Codex package version and its SHA-512 tarball integrity before fan-out. Each platform verifies those archive bytes before installation and checks the installed CLI version. Capability results for Linux/Windows/macOS and the two Linux live checks are separately bound to the same Core SHA, Safe Contract digest, run and attempt.

Compatibility record schema 2 is emitted only after all five reports and their receipts validate. A non-zero exit, timeout, missing structured result, missing stage, package/CLI drift or tampered binding fails qualification. Capability checks alone are not live behavioral qualification. The behavioral check now uses the bounded production execution path, not the absence of escape files after an unsuccessful process.

Rerun the complete qualification workflow after a failed attempt; mixing partial attempts is rejected. Compatibility evidence tags include run/attempt identity. Compatibility, performance and Family evidence releases are not latest product releases.

## Security results

The reusable Security job evaluates its actual CodeQL SARIF output before completing. High/critical security results and error-level non-security results fail that job and therefore `CI Gate`; an analyzer execution success alone cannot satisfy the gate. Missing/malformed analysis output fails closed. No suppression or unchanged-baseline label silently exempts a blocking result.

## Production completion criteria

- Required CI and repository review controls pass on the exact repair heads; no gate bypass.
- A new immutable Core patch release includes the runtime repair and its actual runtime digest.
- All five stable consumers repin to that formally released identity, pass CI and publish their required immutable products/CI receipts. Review Service also supplies the required OCI digest.
- Family private API reads and Git checkouts both succeed, the complete snapshot is verified, and a fresh immutable manifest is published.
- The frozen-version live Canary completes with real provider execution and verifiable stage-bound evidence.
- Service recovery tests execute in the supported runtime and the deployed release passes its health/upgrade/backup acceptance.

PR creation, static tests, a credentialless PR canary, or individually green product builds are not substitutes for these completion criteria. Debug remains a development consumer until a separate explicit promotion is approved. Marketplace publication is not a mandatory substitute for the current GitHub VSIX distribution boundary.
