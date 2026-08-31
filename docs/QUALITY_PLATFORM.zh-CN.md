# Quality Platform

Codex Safe Core 4.10.0 / Quality Platform v3 保持共享确定性质量平台稳定，同时 Policy Schema v4 正式增加 `change` Repository Policy section。GitHub/GitLab Provider、VS Code UI、Pipeline API、数据库、Analyzer 获取与通知仍属于产品层，不进入 Core。

## Review Profile 与 Profile Pack

`quick`、`standard`、`deep`、`security`、`embedded` 继续作为执行 Profile。Profile Pack v1 在其上提供 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime` 工程关注点，但不能授予工具、网络或写权限。

## Impact Evidence 与 Test Impact

Core 仅根据 Controller 提供的文本和 changed paths 构建有界、确定性的 Impact Evidence。`buildTestImpactMap()` 对 Controller 提供的测试候选排序；Core 不负责发现或执行测试。预算压力只有在显式暴露 coverage 缺口并保持 fail closed 时才能减少证据。

## Analyzer Contract

Core 将通用 Analyzer Finding 与 SARIF 2.1 归一到同一有界确定性 Contract。Analyzer 文本始终是不可信 Evidence，不是指令；Repository Policy 不允许定义可执行 Analyzer command。

## Diagnosis Contract / Receipt v1

Diagnosis primitive 负责压缩/脱敏 failure log、形成保守 classification prior、校验结构化模型输出并把 Evidence 绑定到 Diagnosis Receipt v1。Pipeline/Job 获取与发布由产品拥有。Diagnosis **永远不会自动重试 CI、修改源码、commit、push 或 merge**。

质量评估持续检查 classification accuracy、false positive、校准与 Token 成本。

## Semantic Review Contract

Review Evidence Chunking 必须保留 changed-hunk coverage，否则产生显式 gap。Review Profile Pack、Test Impact、Analyzer normalization、Diagnosis 与 semantic review contracts 都继续是纯确定性的 Core primitive；模型输出永远不能获得 authority。

## Safe Patch 边界

Patch Proposal 只是 Evidence。Core **永远不会自动 apply、commit、push 或 merge** Proposal。产品可以展示有界 Proposal，但不能把模型文本转换成隐式仓库修改。

## Family Evidence

Atomic Family Snapshot v1 在跨平台验证前冻结一个精确 Core SHA 与五个活跃 Consumer SHA。Family Manifest v3 随后把精确 Core/Consumer pin、Product Contract digest、Core Contract digest、Runtime/Protocol identity 与 Snapshot digest 写入 `FAMILY_MANIFEST.json`，再进行 provenance attestation 与 immutable 发布。

Change Safe 作为第五个活跃 Core Consumer 消费确定性的 Policy/Fingerprint primitive。其 SCM Provider 与 Delivery Authorization 继续由产品拥有；`change` Policy schema/validation 通过与 Review、Commit、Review Service 相同的 `.codex-safe.json` Policy Schema v4 由 Core 统一拥有。
