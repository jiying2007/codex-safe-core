# Codex Safe Core Consumer Guide

Codex Safe Core 只由活跃的 Codex Safe Family 产品消费，不是独立 CLI 或终端用户应用。

## 唯一支持的消费模型

每个活跃产品都通过 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

禁止 branch tracking、复制 runtime、npm runtime dependency 或兼容代理。

当前机器契约由 `core-contract.json` 管理：**Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Review、Commit、Diagnose Prompt Contract v1 / Codex Runtime v3 / Provider Contract v3**。Consumer 只支持 Node 22 >=22.22.2 <23 或 Node 24 >=24.19.0 <25。

当前五个活跃 Consumer 是 **Codex Change Safe、Codex Review Safe、Codex Commit Safe、Codex Review Service、Codex Diagnose Safe**。Codex PR Safe 仅作为旧的模型生成 PR 描述身份退役；Change Safe 是独立的确定性交付产品，不恢复旧 Narrative Generator。

## Repository Policy Schema v4

仓库策略唯一入口是 committed `.codex-safe.json`，必须使用 `schemaVersion: 4`。Core 统一拥有解析、闭合字段/类型校验和 Policy fingerprint。

支持的 section 为：

- `review`：Review Safe；
- `commit`：Commit Safe；
- `change`：Change Safe 的确定性交付要求；
- `reviewService`：Review Service。

原 `pr` section 继续拒绝。`change` 不是兼容别名，不包含模型 prompt/narrative 配置。Diagnose 仍不进入 Repository Policy，因为 CI Diagnosis 属于不同执行表面。

Consumer 必须调用 Core Policy API，不能再定义第二套 JSON Schema/parser。产品可以解释经过校验的 rules，但不能重定义字段类型，也不能接受旧 schema。

## 协调升级 Core

1. 合并并正式发布经过审核的 Core 变更，记录精确 SHA。
2. Change、Review、Commit、Review Service、Diagnose 同步 repin 到该 SHA。
3. 所有绑定 Core SHA、Policy Schema 的机器门禁、schema/provenance URL、Product Contract 同步更新。
4. 运行五个活跃 Consumer 各自完整 CI，包括 Change Safe Provider / Extension Host 门禁。
5. 全部通过后再合并 Consumer。
6. 最后运行 Family Compatibility，确认所有活跃 Consumer 与 canonical Core HEAD 一致。
7. 要求 `FAMILY_MANIFEST.json` 中五个活跃 Consumer 都精确 pin 同一 Core SHA，并保留 GitHub provenance attestation。

即使只是 governance-only Core 变化，gitlink 仍是 Family Trust Root 锁。

## 职责边界

`core-ownership-manifest.json` 记录 Core-owned primitive。Consumer 必须消费这些实现，不能自行声明独立的 Process/Codex/Policy/Receipt/Review-Evidence/Profile/Test-Impact/Diagnosis 原语。Family Compatibility 在接受 manifest 前会运行 ownership boundary linter。

SCM Provider adapter、Pipeline/Job API、Analyzer Artifact 获取与解析编排、SQLite/outbox、通知、部署、Diagnosis 发布、增量审核持久状态与产品领域 orchestration 继续属于对应产品。

模型生成 PR/MR Narrative 仍是明确非目标。SCM 侧 PR/MR 交付授权由 Codex Change Safe 拥有，并保持在 Core runtime 边界之外；只有其 Repository Policy schema/validation 由 Core 统一拥有。

## Codex Runtime / Provider Contract v3

Core 统一拥有全产品族 Codex Runtime Contract，同时保持 Safe Contract v2 不变。只支持 `openai` 与显式 `openai-compatible` 两种 Provider 模式。

兼容 Provider 支持 `credentialSource=auto|env|auth-json`。`auto` 优先读取配置的 API Key 环境变量；环境变量不存在时，读取 `${CODEX_HOME}/auth.json` 或 `~/.codex/auth.json`。`auth.json` 只接受 API Key 身份：`auth_mode=apikey` 且存在非空 `OPENAI_API_KEY`；不会把 ChatGPT/session token 当作中转站凭据。解析出的 Secret 仅注入 Codex 子进程环境，不进入 argv、产品 Settings、Receipt 或诊断日志。

HTTPS 继续作为默认 Transport。Loopback HTTP 可用于本机开发；非 Loopback HTTP 仅在产品/机器 Runtime 显式设置 `allowInsecureHttp=true` 时允许，Repository Policy 无权开启。URL 中的 credentials、query、fragment 继续拒绝。兼容 Provider 继续强制 Responses HTTP/SSE 与 Structured Output，并关闭 WebSocket。

Change Safe 默认模型调用为 0；它只消费确定性的 Core primitive，不获得 Codex Runtime Authority。

## Token、效率与质量契约

Core 统一拥有 Token usage 归一、request estimate、risk-aware budget、model routing、reservation、Impact Evidence、Analyzer Finding 归一、Profile Pack、Test Impact 与质量评估。产品只拥有 Evidence Acquisition 与执行策略。

效率必须服从正确性：只要预算导致证据遗漏，就必须显式降级 coverage；不得为了省 Token 把 incomplete 结果包装为成功质量结论。

## Diagnosis Contract / Receipt v2

Codex Diagnose Safe 在自身 trust boundary 获取 CI/job evidence，再把 failure log 交给 Core。模型输出必须经过 Core schema/normalization 后才可创建 Diagnosis Receipt v2。Pipeline log 是不可信 Evidence，Core 与 Diagnose 都不会执行日志里的指令。

## Safe Contract 身份

Safe Contract v2 暴露 `SAFE_CONTRACT_MANIFEST` 与 SHA-256 `SAFE_CONTRACT_DIGEST`。Digest 代表精确 Authority/Capability Manifest，不替代语义协议版本。Review Receipt v5、Commit Receipt v4 与 Diagnosis Receipt v2 继续独立版本化。

## 验证

运行：

```bash
npm run ci
```

Core CI 覆盖 contract/runtime identity、Policy Schema v4、Provider Contract v3 Credential/Transport safety、确定性 Review Rules、adversarial fixtures、Quality/Profile/Test-Impact/Diagnosis primitive、golden behavior、成本规划、性能预算与供应链门禁。Family Compatibility 还会验证五个活跃 Consumer 的精确 Core pin、ownership boundary 和完整 CI，再生成带 attestation 的 Family Manifest。


Runtime Contract v3 允许所有 Consumer 共享机器级 `~/.codex-safe/runtime.json`，因此 Review、Commit、Diagnose 与 Review Service 不需要重复录入同一个中转站地址。该文件只保存非 Secret Runtime 元数据；API Key 仍来自环境变量或 Codex `auth.json`。
