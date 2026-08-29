# Codex Safe Core Consumer Guide

Codex Safe Core 只由活跃的 Codex Safe Family 产品消费，不是独立 CLI 或终端用户应用。

## 唯一支持的消费模型

每个活跃产品都通过 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

禁止 branch tracking、复制 runtime、npm runtime dependency 或兼容代理。

当前机器契约由 `core-contract.json` 管理：**Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Review & Commit Prompt Contract v1**。Consumer 只支持 Node 22 >=22.22.2 <23 或 Node 24 >=24.19.0 <25。

Codex PR Safe 已退役，不再属于活跃 Consumer；不会提供替代的 PR/MR 描述生成器，原 `pr` Policy/Prompt surface 直接拒绝，不保留兼容表面。

## 协调升级 Core

1. 合并经过审核的 Core 变更并记录精确 SHA。
2. Review、Commit、Review Service 同步 repin 到该 SHA。
3. `.codex-safe.example.json` 的 schema URL 同步 pin 到相同 SHA。
4. 运行三个活跃 Consumer 各自完整 CI。
5. 全部通过后再合并 Consumer。
6. 最后运行 Family Compatibility，确认所有活跃 Consumer 与 canonical Core HEAD 一致。
7. 要求生成的 `FAMILY_MANIFEST.json` 中三个活跃 Consumer 都精确 pin 同一 Core SHA，并保留对应 GitHub provenance attestation。

仅治理/文档类 Core 维护不要求 Consumer 强制升级产品版本；只有产品/runtime 语义变化才需要版本发布。但 gitlink 仍必须协调 repin，因为它就是产品族 Trust Root 锁。

## 职责边界

`core-ownership-manifest.json` 记录 Core-owned primitive。Consumer 必须消费这些实现，不能自行声明独立的 Process/Codex/Policy/Receipt/Review-Evidence 原语。Family Compatibility 在接受 manifest 前会运行 ownership boundary linter。

SCM Provider adapter、SQLite/outbox、通知、部署、增量审核持久状态与产品领域 orchestration 继续属于对应产品，不进入 Core。PR/MR Narrative 与 SCM 侧 PR/MR 创建不再属于活跃 Family 能力。Codex 模型 Provider Runtime 则属于另一层：安全 Provider 配置、凭据引用、timeout 规则和错误分类必须由 Core 统一拥有，保证 Commit / Review / Review Service 以同一种方式启动 Codex。

## Codex Runtime / Provider 契约

Core v4.6 统一拥有全产品族 Codex Runtime Contract，同时保持 Safe Contract v2 不变。

只支持两种 Provider 模式：

- `openai`：使用 Codex 内置 OpenAI provider。Core 不读取用户 `config.toml`；Codex 原生登录/API Key 行为仍由 Codex 自己负责。
- `openai-compatible`：由 Consumer 显式提供 OpenAI-compatible Responses endpoint。Core 通过受控 `--config` 注入合成 provider，同时继续强制 `--ignore-user-config` 与 `--ignore-rules`。

兼容 Provider 只接受 `baseUrl` 和 API Key 环境变量名，不接受 secret 值。Secret 不进入配置、argv、receipt 或日志。除 loopback 开发地址外必须使用 HTTPS；带用户名密码、query 或 fragment 的 URL 直接拒绝。

OpenAI-compatible 模式固定为 `wire_api="responses"`、`requires_openai_auth=false`、`supports_websockets=false`，即直接使用 HTTP/SSE，避免企业网关、中转站或代理环境不支持 Responses WebSocket upgrade 时先长时间重试。安全执行边界没有放松：不会恢复用户 config、仓库 rules、MCP、hooks、tools、web search 或其它权限能力。

Consumer 只负责把产品设置转换为统一 runtime 对象：

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

`requestMs` 是单次 Codex 请求上限；`operationMs` 是一次产品操作包含多次模型请求时的总 deadline。Consumer 必须按自己的 orchestration 使用总 deadline，不能继续用一个 `timeoutSeconds` 同时承担两种语义。

`probeCodexRuntime()` 是唯一正式的 live Environment Check。它必须经过与真实调用完全相同的 executable resolution、Safe Contract flags、Provider Bridge、credential reference、Responses transport 与 structured-output 路径。只跑 `codex --version` / `--help` 不能宣称 Runtime Ready。

Core 统一输出稳定错误码：`ECODEX_PROVIDER_CONFIG`、`ECODEX_CREDENTIAL`、`ECODEX_DNS`、`ECODEX_CONNECT`、`ECODEX_TLS`、`ECODEX_AUTH`、`ECODEX_RATE_LIMIT`、`ECODEX_MODEL`、`ECODEX_REQUEST_TIMEOUT` 等。进程 timeout 会保留限长 stdout/stderr tail、elapsed time 和 last-activity age；Consumer 可以展示 Core 脱敏后的字段，但禁止输出 secret。

## Token、效率与质量契约

Core v4.3 统一拥有活跃产品族通用的成本感知执行原语：

- 统一解析 Codex JSONL 中 input、cached-input、cache-write、output、reasoning-output Token；
- 统一使用保守 Token 估算，并支持在启动 Codex 进程前 fail-closed preflight；
- 确定性证据风险评分、自适应预算、低风险模型路由，其中动态预算只允许缩小，绝不突破有效上限；
- 按风险优先的总字节预算选择；任何被预算遗漏的证据都必须显式暴露，不能静默宣称完整；
- 为存在并发模型任务的产品提供进程内 Token Reservation Ledger；
- `runStructuredCodex()` 统一返回 usage、request estimate 和 duration，消费者不再自行重复解析。

Consumer 只负责自己的策略值和领域行为：Commit 优化 staged semantic context，Review 优化审核 chunk，Review Service 负责项目日预算持久化与增量状态。Consumer 不得复制 Core 的 usage 解析、Token 估算或 reservation 实现。

效率必须服从正确性：只要预算导致证据遗漏，就必须显式降级 coverage；不得为了省 Token 把 incomplete 结果包装为成功质量结论。

## Safe Contract 身份

Safe Contract v2 同时拥有语义版本与机器 digest：

- `SAFE_CONTRACT_MANIFEST`：闭合的权限/能力声明；
- `SAFE_CONTRACT_DIGEST`：该 manifest 的 SHA-256。

Digest 用于精确证据，不替代语义协议版本。Receipt v4 保持闭合，不通过 maintenance release 偷加 digest 字段。

## 验证

```bash
npm run ci
```

Core CI 覆盖 contract/runtime 身份、Provider Runtime 安全、确定性 Review Rules、adversarial safety fixtures、Family Golden Corpus、Token/成本 Planner、宽松性能回归预算、trusted release 治理与 supply-chain canary。Family Compatibility 还会验证三个活跃 Consumer 精确 pin、ownership boundary 和各自完整 CI，然后生成可 attestation 的 Family Manifest。
