# Codex Safe Core Consumer Guide

Codex Safe Core 只由活跃的 Codex Safe Family 产品消费，不是独立 CLI 或终端用户应用。

## 唯一支持的消费模型

每个活跃产品都通过 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

禁止 branch tracking、复制 runtime、npm runtime dependency 或兼容代理。

当前机器契约由 `core-contract.json` 管理：**Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Diagnosis Receipt v1 / Review、Commit、Diagnose Prompt Contract v1**。Consumer 只支持 Node 22 >=22.22.2 <23 或 Node 24 >=24.19.0 <25。

当前四个活跃 Consumer 是 Codex Review Safe、Codex Commit Safe、Codex Review Service、Codex Diagnose Safe。Codex PR Safe 已退役，不再属于活跃 Consumer；不会提供替代的 PR/MR 描述生成器，原 `pr` Policy/Prompt surface 直接拒绝，不保留兼容表面。

## 协调升级 Core

1. 合并并正式发布经过审核的 Core 变更，记录精确 SHA。
2. Review、Commit、Review Service、Diagnose 同步 repin 到该 SHA。
3. 所有绑定 Core SHA 的机器门禁、schema/provenance URL、product contract 同步更新。
4. 运行四个活跃 Consumer 各自完整 CI。
5. 全部通过后再合并 Consumer。
6. 最后运行 Family Compatibility，确认所有活跃 Consumer 与 canonical Core HEAD 一致。
7. 要求 `FAMILY_MANIFEST.json` 中四个活跃 Consumer 都精确 pin 同一 Core SHA，并保留 GitHub provenance attestation。

仅治理/文档类 Core 维护不要求 Consumer 强制升级产品版本；只有产品/runtime 语义变化才需要版本发布。但 gitlink 仍必须协调 repin，因为它就是产品族 Trust Root 锁。

## 职责边界

`core-ownership-manifest.json` 记录 Core-owned primitive。Consumer 必须消费这些实现，不能自行声明独立的 Process/Codex/Policy/Receipt/Review-Evidence/Profile/Test-Impact/Diagnosis 原语。Family Compatibility 在接受 manifest 前会运行 ownership boundary linter。

SCM Provider adapter、GitLab Pipeline/Job API、Analyzer Artifact 获取与解析编排、SQLite/outbox、通知、部署、Diagnosis 发布、增量审核持久状态与产品领域 orchestration 继续属于对应产品，不进入 Core。PR/MR Narrative 与 SCM 侧 PR/MR 创建不属于活跃 Family 能力。

## Codex Runtime / Provider 契约

Core 统一拥有全产品族 Codex Runtime Contract，同时保持 Safe Contract v2 不变。只支持 `openai` 与显式 `openai-compatible` 两种 Provider 模式。兼容 Provider 只接受 HTTPS `baseUrl` 与 API Key 环境变量名，secret 值不进入配置、argv、Receipt 或日志。Core 始终保持用户 config、仓库 rules、tools、network authority 与 write authority 关闭。

`requestMs` 是单次 Codex 请求上限，`operationMs` 是产品多次调用的总 deadline。Provider 配置、credential、DNS、connect、TLS、auth、rate-limit、model、request-timeout 都由 Core 给出稳定错误分类。

## Token、效率与质量契约

Core 统一拥有 Token usage 归一、request estimate、risk-aware budget、model routing、reservation、Impact Evidence、Analyzer Finding 归一、Profile Pack、Test Impact 与质量评估。产品只拥有 Evidence Acquisition 与执行策略。

效率必须服从正确性：只要预算导致证据遗漏，就必须显式降级 coverage；不得为了省 Token 把 incomplete 结果包装为成功质量结论。

## Review Profile Pack v1

`quality/profile-packs.json` 是 canonical 版本化资产。`resolveReviewProfilePack()` 将 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime` 映射到受限关注分类/检查项与既有执行 Profile。Pack 属于可信 Controller Policy，但不能授予工具、网络、仓库写权限或 SCM 权限。

## Test Impact v1

产品负责发现不可变 Test Candidate，再交给 `buildTestImpactMap()`。Core 根据 changed path、语义信号、显式路径关联和可选历史相关权重做确定性排序；Core 永不执行测试。`formatTestImpactEvidence()` 是统一有界 Evidence Projection。

## Diagnosis Contract / Receipt v1

Codex Diagnose Safe 在自己的信任边界获取 CI/Job Evidence，再把失败日志交给 Core。`compactFailureLog()` 去终端噪声、脱敏可能的 credential、折叠重复行并保留有界失败上下文；`classifyFailureDeterministically()` 给出 `source`、`test`、`dependency`、`infra`、`flaky`、`unknown` 的保守先验分类。

模型输出必须通过 `diagnosisOutputSchema()` 和 `normalizeDiagnosisResult()`。`createDiagnosisReceipt()` 绑定 project/pipeline/job/commit、精确 Evidence Digest、classification/confidence 与 Diagnosis Fingerprint。Pipeline Log 永远是不可信证据：Core 与 Diagnose 都不能执行日志中的命令，也不能自动重试 Pipeline、改代码、commit、push、merge 或创建 MR。

## Safe Contract 身份

Safe Contract v2 同时拥有 `SAFE_CONTRACT_MANIFEST` 与 SHA-256 `SAFE_CONTRACT_DIGEST`。Digest 用于精确权限面证据，不替代语义协议版本。Review/Commit Receipt v4 与 Diagnosis Receipt v1 独立版本化且保持 closed contract。

## 验证

```bash
npm run ci
```

Core CI 覆盖 contract/runtime 身份、Provider Runtime 安全、确定性 Review Rules、adversarial fixtures、Quality/Profile/Test-Impact/Diagnosis 原语、Family Golden Corpus、Token/成本 Planner、宽松性能回归预算与 supply-chain gate。Family Compatibility 还会验证四个活跃 Consumer 精确 pin、ownership boundary 和各自完整 CI，然后生成可 attestation 的 Family Manifest。
