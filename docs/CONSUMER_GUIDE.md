# Codex Safe Core Consumer Guide

Codex Safe Core is consumed only by active Codex Safe Family products. It is not a standalone CLI or application.

## Supported model

Each active product pins one exact Core commit as a Git submodule at `src/codex-safe-core`.

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

Do not use branch tracking, copied runtime files, npm runtime dependencies, or compatibility proxies.

The current machine contract is `core-contract.json`: **Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Review & Commit Prompt Contracts v1**. Consumers must use a supported Node LTS line: Node 22 >=22.22.2 <23 or Node 24 >=24.19.0 <25.

Codex PR Safe is retired. It is not an active consumer, there is no successor PR/MR-description generator, and the former `pr` policy/prompt surface is rejected rather than retained as compatibility.

## Coordinated Core update

1. Merge the reviewed Core change and record the exact Core commit SHA.
2. Repin Review, Commit and Review Service to that SHA.
3. Repin any `.codex-safe.example.json` schema URL to the same SHA.
4. Run every active consumer CI.
5. Merge consumers only when all are green.
6. Run Family Compatibility against the canonical Core HEAD.
7. Require the generated `FAMILY_MANIFEST.json` to show the same Core pin for all three active consumer SHAs and retain its GitHub provenance attestation.

Governance/docs-only Core updates do not require consumer product-version bumps unless product/runtime semantics change. They still require coordinated gitlink repin because the gitlink is the family trust lock.

## Ownership boundary

`core-ownership-manifest.json` records Core-owned primitives. Consumer products must import/consume those primitives instead of declaring independent Process/Codex/Policy/Receipt/Review-Evidence implementations. Family Compatibility runs a boundary linter before accepting a manifest.

SCM provider adapters, SQLite/outbox, notifications, deployment, incremental-review persistence and product-domain orchestration stay in the owning product and must not be pulled into Core. PR/MR narrative generation and SCM-side PR/MR creation are not active Family capabilities. The Codex model-provider runtime is different: its safe configuration, credential-by-reference rules, timeout policy and error classification are Core-owned so all active products invoke Codex identically.

## Codex Runtime / Provider Contract

Core v4.6 owns one explicit runtime contract for every Codex invocation while Safe Contract v2 remains unchanged.

Supported provider modes are:

- `openai` — the built-in Codex OpenAI provider. Core does not import user `config.toml`; normal Codex login/API-key behavior remains owned by Codex.
- `openai-compatible` — an explicit OpenAI-compatible Responses endpoint supplied by the consumer. Core injects a synthetic provider through bounded `--config` overrides while still passing `--ignore-user-config` and `--ignore-rules`.

The compatible-provider contract accepts only `baseUrl` and an API-key environment-variable name. The secret value is never accepted as configuration, argv or receipt metadata. HTTPS is mandatory except for loopback development endpoints. Query strings, URL credentials and fragments are rejected.

Compatible providers are forced to `wire_api="responses"`, `requires_openai_auth=false` and `supports_websockets=false`. This intentionally uses HTTP/SSE rather than the Responses WebSocket path because corporate gateways and OpenAI-compatible relays frequently do not support the WebSocket upgrade. The Safe execution boundary remains unchanged: user config, repository rules, MCP, hooks, tools, web search and other authority-bearing settings are not restored.

Consumers construct only product settings and pass a normalized runtime object to Core:

```js
const runtime = {
  provider: {
    mode: 'openai-compatible',
    baseUrl: 'https://relay.example.com/v1',
    apiKeyEnv: 'RELAY_API_KEY'
  },
  timeouts: {
    connectMs: 15000,
    requestMs: 180000,
    operationMs: 600000,
    idleMs: 60000
  }
};
```

`requestMs` is the per-Codex-call ceiling. `operationMs` is the product-level multi-call deadline and must be enforced by the consumer orchestration when one operation contains multiple structured calls. Consumers must not reuse the old single-timeout model for both concepts.

`probeCodexRuntime()` is the canonical live environment check. It uses the same executable resolution, Safe Contract flags, provider bridge, credential reference, Responses transport and structured-output path as a real request. A capability-only `--version`/`--help` check must not be reported as runtime-ready.

Core classifies provider failures into stable codes such as `ECODEX_PROVIDER_CONFIG`, `ECODEX_CREDENTIAL`, `ECODEX_DNS`, `ECODEX_CONNECT`, `ECODEX_TLS`, `ECODEX_AUTH`, `ECODEX_RATE_LIMIT`, `ECODEX_MODEL` and `ECODEX_REQUEST_TIMEOUT`. Timeout/process failures retain bounded stdout/stderr tails, elapsed time and last-activity age; consumer UIs may render those fields after Core redaction but must never print credential values.

## Token, efficiency, and quality contract

Core v4.3 owns the generic cost-aware execution primitives used by every active product:

- Codex JSONL usage normalization for input, cached-input, cache-write, output and reasoning-output tokens;
- conservative request-token estimation and optional fail-closed preflight before a Codex process starts;
- deterministic evidence risk scoring, adaptive budgets that may shrink but never exceed an effective cap, and optional low-risk model routing;
- risk-prioritized total-byte planning with explicit omissions rather than silent coverage claims;
- in-process token reservation for products that execute multiple jobs concurrently;
- `runStructuredCodex()` execution metadata: normalized usage, request estimate and duration.

Consumers own the policy values and product behavior around these primitives. Commit may optimize staged semantic context, Review may prioritize review chunks, and Review Service may persist project budgets and incremental state. Consumers must not copy Core usage parsing, token estimation or reservation implementations.

Efficiency is subordinate to correctness: a budget-induced evidence omission must be surfaced explicitly. Products must never convert incomplete evidence into a successful quality verdict merely to save tokens.

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

Core CI covers contract/runtime identity, provider runtime safety, deterministic review rules, adversarial safety fixtures, golden behavior, cost/usage planning, broad performance budgets, trusted release governance and supply-chain canaries. Family Compatibility additionally validates the three active exact consumer pins, ownership boundaries and every active consumer CI before producing the attested family manifest.
