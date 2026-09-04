# Codex Safe Core Consumer Guide

Codex Safe Core 只由活跃的 Codex Safe Family 产品消费，不是独立 CLI 或终端用户应用。

## 唯一支持的消费模型

每个活跃产品都通过 `src/codex-safe-core` Git submodule 固定到一个**正式发布的精确 Core commit**：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

禁止 branch tracking、复制 Runtime、npm Runtime dependency 或兼容代理。

当前机器契约由 `core-contract.json` 管理：**Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Runtime v3 / Provider Contract v3 / Model Routing v1 / Family Snapshot v3 / Family Manifest v5 / Product Contract v2 / Consumer CI Receipt v1**。Consumer 只支持 Node 22 >=22.22.2 <23 或 Node 24 >=24.19.0 <25。

当前五个活跃 Consumer 是 **Codex Change Safe、Codex Review Safe、Codex Commit Safe、Codex Review Service、Codex Diagnose Safe**。Codex PR Safe 仅作为旧的模型生成 PR 描述身份退役；Change Safe 是独立的确定性交付产品，不恢复旧 Narrative Generator。

## Repository Policy Schema v4

仓库策略唯一入口是 committed `.codex-safe.json`，必须使用 `schemaVersion: 4`。Core 统一拥有解析、闭合字段/类型校验和 Policy fingerprint。支持 `review`、`commit`、`change`、`reviewService`；原 `pr` section 继续拒绝。Diagnose 因 CI Diagnosis 使用不同执行表面，不进入 Repository Policy。

Consumer 必须调用 Core Policy API，不能再定义第二套 JSON Schema/parser。产品可以解释经过校验的 Rule，但不能重定义字段类型，也不能接受旧 Schema。

## Runtime 与 Governance 身份

Core Digest Contract v1 为每个 immutable Core Release 发布两个独立 Digest：

- `runtimeDigest`：Consumer 实际携带的 Runtime Module、Policy Schema 与 runtime-relevant contract fields；
- `governanceDigest`：Workflow、Test、Quality Corpus、Docs、Release/Orchestration 等治理身份。

每个 Consumer 仍固定一个精确 released Core SHA。只有该 pin 的 `runtimeDigest` 与最新 released Core 完全相同，才允许保持旧 Core SHA；这是密码学上的 Runtime Identity，不是 Compatibility Shim。`runtimeDigest` 不同必须 Product Repin + Patch Release。

Product Contract v2 绑定 `safeCoreCommit`、`safeCoreRuntimeDigest` 与 `safeCoreGovernanceDigest`。因此纯 Governance Core Release 不再强制五个字节完全相同的 VSIX/OCI/tgz 重新构建与分发。

## 协调升级 Core

1. 合并并正式发布经过审核的 Core，验证精确 SHA 和 `CORE_DIGESTS.json`。
2. 比较最新 `runtimeDigest` 与五个 Consumer 实际 pinned released Core。
3. 只为 Runtime 改变的 Consumer 创建 Repin PR；Runtime-equivalent Consumer 记录为 skipped。
4. 所有准备好的 PR 必须先完成完整产品 CI，任何一个未绿都不允许进入 Merge Phase。
5. 冻结全部 PR Head SHA，再只合并这一组已验证 Head。
6. 每个发生 Runtime Repin 的 Consumer 发布 exact immutable Product Release、所需 Distribution Evidence 与 `CONSUMER_CI_RECEIPT.json`。
7. Family Freshness 校验 Runtime Compatibility、Release/Distribution、CI Receipt；Manifest 过期时再触发 Family Compatibility。

该两阶段事务避免“前几个已合并、后一个失败”被误认为完成。Consumer 的精确 gitlink 仍是审计锁；只是纯 Governance Core 更新在 Runtime Identity 不变时无需移动该锁。

## Consumer CI Receipt v1

每个活跃 Consumer Release 必须携带 attested `CONSUMER_CI_RECEIPT.json`，绑定 Product ID/Version/SHA、exact Core pin/digests、成功 CI Run ID/Attempt 和已验证 Suite Identity。Family Readiness 校验这个 immutable receipt，而不是只依赖瞬时绿勾。

Receipt 不授予新 Authority，也不替代真实 CI；它只是“该 Released Product SHA 已通过声明 Gate”的长期证据。

## Family Evidence

Atomic Family Snapshot v3 冻结最新 exact immutable Core Release 与两个 Core Digest，同时冻结每个 exact Consumer Product Release、其实际 pinned Core SHA/digests、Consumer CI Receipt 与所需 Distribution Evidence。

Family Manifest v5 记录 Snapshot、Product Contract/package-lock Digest、Protocol/Runtime Identity 与 Distribution Evidence，然后执行 GitHub build-provenance attestation，并按 digest-addressed immutable Release 发布。

普通 Family Compatibility 直接消费 immutable Consumer CI Receipt，只运行一次 Ubuntu cross-family validation；完整 5 Consumer × Linux/Windows/macOS 矩阵保留为每周/手动 `full_matrix=true` 审计，消除重复 Product CI，但不降低 Product Release Gate。

## 职责边界

`core-ownership-manifest.json` 记录 Core-owned Primitive。Consumer 必须消费这些实现，不能自行声明独立的 Process/Codex/Policy/Receipt/Review-Evidence/Profile/Test-Impact/Diagnosis/Model-Routing 原语。Family Compatibility 在接受 Manifest 前运行 Ownership Boundary Linter。

SCM Provider Adapter、Pipeline/Job API、Analyzer Artifact 获取与编排、SQLite/outbox、通知、部署、Diagnosis 发布、增量审核状态与产品领域 Orchestration 继续属于对应产品。

模型生成 PR/MR Narrative 仍是明确非目标。SCM 侧 PR/MR 交付授权由 Codex Change Safe 拥有；只有其 Repository Policy Schema/Validation 由 Core 统一拥有。

## Codex Runtime / Provider Contract v3

Core 统一拥有全产品族 Codex Runtime Contract，同时保持 Safe Contract v2 不变。Compatible Provider 通过机器所有的 `credentialSource=auto|env|auth-json` 获取凭据；Secret 只注入 Codex 子进程环境，不进入 argv、Settings、Receipt 或诊断日志。

Consumer 默认解析顺序：产品显式 Override → Family Runtime → 用户 Codex Config → 内置 OpenAI。仓库内 Codex Config 不参与 Provider Routing。HTTPS 为首选；私网明文继承必须机器所有、明确可见且有界。Change Safe 默认模型调用为 0。

## Model Routing、Token 与质量契约

Core 统一拥有 Model Routing Contract v1、Machine Registry Validation、canonical `registryDigest` / `routingPolicyDigest`、Token Usage 归一、Request Estimate、Risk-aware Budget、Calibration、Reservation、Profile Pack、Test Impact 与 Quality/Economics Eval。

效率必须服从正确性：预算导致的 Evidence 缺口必须显式暴露。Model Promotion 必须基于真实 Corpus Result 并满足最小样本数；历史 Recorded Baseline 不再被解释为“模型普遍 100%”。

## Diagnosis Contract / Receipt v2

Codex Diagnose Safe 在自身 Trust Boundary 获取 CI/Job Evidence，再把 Failure Log 交给 Core。模型输出必须经过 Core Schema/Normalization 后才可创建 Diagnosis Receipt v2。Pipeline Log 是不可信 Evidence，Core 与 Diagnose 都不会执行日志里的指令。

## Repository Governance

`repository-governance-contract.json` 定义六个 Family Repository 的服务器侧 Ruleset Baseline。仓库内测试不能替代 GitHub 服务器控制。管理员安装 Ruleset 后，运行 `npm run check:repository-governance` 或定时 Repository Governance Workflow 验证。

## 验证

运行：

```bash
npm run ci
```

Core CI 覆盖 Contract/Runtime Identity、Policy Schema v4、Provider Contract v3 Credential/Transport Safety、确定性 Review Rule、Adversarial Fixture、Promotion Corpus 结构、Quality/Profile/Test-Impact/Diagnosis Primitive、Model Routing/Economics、Digest Classification、性能预算与供应链门禁。

Runtime Contract v3 允许 Review、Commit、Diagnose 与 Review Service 共享机器级 `~/.codex-safe/runtime.json`；该文件不保存 Secret，API Key 仍来自环境变量或 Codex `auth.json`。
