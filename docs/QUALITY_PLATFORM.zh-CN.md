# Quality Platform

Codex Safe Core 4.17.1 / Quality Platform v3 在保持共享确定性质量平台稳定的同时，强化 Model Routing Contract v1 的 Health-aware、质量约束 Economics，改为 change-aware Evidence Risk，让服务器侧 Family Ruleset Contract 真正成为 Release Authority，并让 Coordinated Family Upgrade 的 resume / rate-limit 处理保持 fail-closed 且可安全重试。Safe Contract v2、Policy Schema v4、Runtime v3 与 Provider Contract v3 继续作为安全边界。

## Runtime / Provider Contract v3

Core 统一拥有 compatible Provider 的 Credential、Transport 与机器级 Runtime 解析。Consumer 默认使用 `provider.mode=auto`：产品显式 Override → 机器级 Family Runtime `~/.codex-safe/runtime.json` → 用户 Codex 配置 → 内置 OpenAI Runtime。Compatible Provider 保持 `credentialSource=auto|env|auth-json`，Secret 只以引用方式进入 Runtime，不进入 Repository Policy 或 Receipt。仓库内 Provider 配置不能重定向机器凭据。HTTPS 仍是首选；private-network HTTP 继承保持机器所有、明确可见且有界。Structured Codex JSONL 采用增量消费，并独立限制 retained output 与 total transcript。

## Model Routing Contract v1

Model Routing Contract v1 把稳定产品语义与快速变化的具体模型世代分开：

- **Mode**：`fast`、`balanced`、`deep`；
- **Role**：`scout`、`reviewer`、`adjudicator`；
- **Model Class**：`fast`、`balanced`、`frontier`；
- **Selection Strategy**：`auto`、`preference`、`fixed`；
- 确定性 Safe Gate 永远不是模型角色。

`auto` 与 `preference` 只选择 approved Registry Entry；`unhealthy` 不可参与，`healthy` 明确优先于 `unknown` Health。`fixed` 继续保留为高级 benchmark/debug 控制。Cross-provider fallback 默认关闭，除非显式开启。Qualification 必须基于证据，Discovery 本身绝不授予模型 Authority。

在 `auto` 中，只有达到最小样本量且通过质量约束的 Model Economics 才允许参与模型选择。被标记为 quality-rejected 的候选直接排除。合格候选不使用不可解释的加权总分，而是按 Pareto dominance 比较 tokens per verified finding、cost per verified finding、P95 latency、false-positive rate 与 coverage：只有当某候选在全部轴上都不差、且至少一个轴更好时，Economics 才能确定性优先它。规范化 Economics Input 会进入 `routingPolicyDigest`，因此无需引入 Routing v2 也能审计每次路由依据。

Model Evidence 同时绑定可读 revision 和 canonical `registryDigest` / `routingPolicyDigest`。Resolved model/revision、Qualification identity、lineage、fallback/degradation 与规范化 Token usage 都会记录，但不包含 Credential、Prompt 或源码。Model Routing 保持 v1，稳定的 `fast / balanced / frontier` Compatibility Class 不变。

## Token 效率与 Calibration

Token 优化目标是**质量约束下的效率最优**，而不是单纯最少 Token。Core 统一统计 actual/cached/cache-write/output/reasoning usage、tokens/cost per verified finding、coverage、false positive、verifier/scout/adjudicator 调用比例和 P50/P95 latency。

Evidence Risk 改为 change-aware。Auth/security/schema 等敏感路径仍是强先验，但 C/C++/Rust 文件扩展名只保留弱 Systems-language Prior。Lifetime、allocation、lock/concurrency、auth、compatibility 等信号只有真正出现在本次变更行时才提升 Risk；未修改上下文中的 `mutex/free/malloc` 等文本，以及“仅仅因为是 C/C++/Rust 文件”，不再把普通 Embedded 修改推到最高预算档。

Economics 按 `mode`、`role`、`provider`、`model`、`profilePack` 与 repo-size bucket 分层；Model Promotion 可要求最小总样本数和最小 critical 样本数，再评估 recall/FP 等质量限制。Routing 只消费样本充分且 quality-approved 的 Economics；没有可信 Economics 时，确定性回退到 Compatibility、Health、Class Distance、Priority 与稳定 Identity 排序。

Token Estimator Calibration 只持久化数值 provider/model 校准。TTL 以每个模型真实 `lastObservedAtMs` 为准，其他模型写 Store 不会给陈旧条目续命。共享 secure local-file primitive 提供 no-follow read、same-descriptor validation、owner/permission 检查、exclusive write lock、merge-on-write 与 atomic mode-0600 replacement。

## Promotion corpus

历史 24-case recorded baseline 保留为已观察回归基线，不再解释成“模型普遍达到 100%”。Core 4.16 引入至少 80-case 的确定性 Promotion Corpus，覆盖 `dev`、`holdout`、`real-regression`，包含至少 10 个 clean negative 与 10 个真实 Family regression，并覆盖 security、concurrency、resource、correctness、test、small/medium/large repo 和工程 Profile Pack。

候选模型必须对该 corpus 产生真实 evaluation result 后才能晋升。Core 不会为生成 case 伪造 recorded output；即使小样本 precision/recall 为 100%，样本量不足也必须拒绝 Promotion。

## Judgment Lifecycle v1

ReviewSubject identity 绑定代码 Subject、Diff、Policy、Evidence Manifest、Prompt Contract、Review Profile 与 resolved model。只有 fresh inference 才创建 Review Receipt。Structural Evidence 可以缓存，但持久化 Model Judgment 永远不能被当成新的 Authority Judgment。Review Receipt v5 强制包含 `reviewSubjectFingerprint` 与 `evidenceManifestDigest`。

## Review Profile 与 Profile Pack

现有 `quick`、`standard`、`deep`、`security`、`embedded` Execution Profile 继续保留；模型意图使用 `fast`、`balanced`、`deep`。Profile Pack v1 继续提供 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime`，但不授予 Tool、Network 或 Write Authority。

## Impact Evidence、Test Impact、Analyzer、Diagnosis 与 Semantic Review

Core 根据 Controller 提供的 Source Context 与 Paths 构建有界 Impact Evidence；Test Impact 只对 Controller 提供的测试候选排序，不主动发现或执行测试。Analyzer Finding / SARIF 始终按不可信 Evidence 处理。

Diagnosis 对失败证据压缩与脱敏、校验结构化模型输出，并把 Diagnosis Input Manifest 绑定到 Diagnosis Receipt v2。质量评估持续检查 classification accuracy、false positive、calibration 与 Token cost。Review Evidence Chunking 必须保留 changed-hunk coverage，否则显式产生 coverage gap。Profile Packs、Test Impact、Diagnosis 与 semantic review contracts 继续保持确定性 Core Primitive。

Patch Proposal 只是 Evidence。Core 永远不会自动 apply、commit、push 或 merge。

## Core runtime / governance 身份

Core Digest Contract v1 分离：

- `runtimeDigest`：发布到 Consumer 的 Core Runtime Module、Policy Schema 与 runtime-relevant contract identity；
- `governanceDigest`：Workflow、Test、Quality Corpus、Docs、Orchestration 和 governance-only identity。

每个 Consumer 仍然固定一个精确、正式发布的 Core SHA。只有两个正式 Core Release 的 `runtimeDigest` 完全相同，旧 pin 才能与较新的 Core 判定为 runtime-compatible；这不是语义 Compatibility Shim，runtime digest 不同始终判 stale。

Product Contract v2 绑定 `safeCoreCommit`、`safeCoreRuntimeDigest` 与 `safeCoreGovernanceDigest`。Runtime 改变必须触发 Consumer patch release；纯 Governance Core Release 不再强制五个字节级相同的产品重新构建和分发。

## Consumer CI Receipt v1

每个活跃 Consumer Product Release 必须携带 attested `CONSUMER_CI_RECEIPT.json`。Receipt 绑定 Product SHA/Version、exact Core pin 与 Core digests、成功 CI Workflow Run ID/Attempt 以及已验证 Suite。Family Release Readiness 校验这个 immutable receipt，而不是把瞬时绿勾当成长期证据。

## Family Evidence

Family Registry v1 继续作为 topology 单一来源。在冻结 Atomic Family Snapshot v3 之前，Core 先验证全部活跃 Family Repository 的实时服务器侧 Ruleset Contract。通过后，Snapshot v3 才冻结当前 exact immutable Core Release 及其两个 Digest，同时冻结每个 exact Consumer Release、其实际 pinned Core SHA/digests、Consumer CI Receipt 与要求的 Distribution Evidence。

Family Manifest v5 记录 Snapshot v3、exact Core/Consumer Release Identity、runtime/governance digests、Product Contract/package-lock digest、CI Receipt identity 与 Distribution Evidence，并通过 provenance attestation + digest-addressed immutable Evidence Release 发布。该历史证据 Release 显式禁止成为 GitHub Latest。

Family Freshness 要求每个活跃 Consumer 与最新 released Core **runtime-compatible**，并拥有 exact immutable 当前 Product Release、verified Consumer CI Receipt 与所需 Distribution。Governance-only Core 更新不再要求所有 Consumer 改成同一个 Core SHA。

普通 Family Compatibility 信任 immutable Consumer CI Receipt，并只运行一次 Ubuntu cross-family validation；完整 5 Consumer × Linux/Windows/macOS 矩阵保留为每周或显式 `full_matrix=true` 审计，保持测试强度但移除日常重复工作。

Coordinated Family Upgrade 使用两阶段事务：Phase 1 准备所有需要 Runtime Repin 的 Consumer PR，并等待全部 CI 通过；Phase 2 冻结 PR Head SHA 后才合并。Runtime-equivalent Consumer 记录为 skipped。重试时，如果 upgrade branch 已经完整 materialize 且对应 Open PR 仍存在，则该 PR 必须继续保持 `prepared` 并重新经过 Phase 1b，而不能因为 branch worktree 已 clean 就误判成 runtime-equivalent。Release-state polling 每轮只采集一次完整 Family；瞬时 429/5xx/网络错误在既有有界次数内重试，永久 Evidence 错误仍 fail closed。Transaction State 作为 Artifact 保留用于审计/重试；Release、Distribution、CI Receipt 仍必须全部收敛后才能 Family Freshness。

## Repository Governance

`repository-governance-contract.json` 定义六个 Family Repository 的服务器侧 GitHub Ruleset Baseline：PR-based changes、strict required checks、禁止 deletion / non-fast-forward，并限制 bypass。`scripts/verify-repository-ruleset.js` 审计服务器侧状态。Core Release Validation、Family Snapshot 生成与共享 Family Release Guard 都会在实时服务器控制缺失或漂移时 fail closed；仓库内测试不能替代 GitHub Administration 控制。

Change Safe 继续是默认 0 model call 的确定性交付产品；统一 Family Model Evidence 不会恢复旧的 Model-generated PR/MR Narrative。
