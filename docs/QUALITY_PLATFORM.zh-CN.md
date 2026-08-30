# 质量平台

Codex Safe Core 4.9.0 / Quality Platform v3 扩展统一、确定性的质量平台，同时继续禁止把 GitLab、VS Code、Pipeline API、数据库、Analyzer 获取、通知等产品职责塞进 Core。

## Review Profile

继续提供 `quick`、`standard`、`deep`、`security`、`embedded` 五种底层执行 Profile。Profile 只在产品既有上限内缩放 evidence/context/token 预算并选择影响分析深度，不能削弱 Safe Contract、Receipt 校验、changed-line anchoring 或 fail-closed coverage。

## 版本化 Review Profile Pack

Profile Pack v1 在底层执行 Profile 之上增加数据驱动的工程领域关注点。Canonical Pack 包括 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime`。Pack 只能声明受限的关注分类与 Review 检查点，不能授予工具、网络、写权限，也不能放宽任何安全契约。`quality/profile-packs.json` 是版本化唯一数据资产，`resolveReviewProfilePack()` 是共享解析器。

## Impact Evidence Graph

Core 从 diff 中提取 include/import、symbol、构建、Kconfig、DeviceTree 等有界信号，并对 Controller 提供的候选文件进行确定性评分。Core 自身不读工作区、不访问网络；Consumer 在自己的信任边界内获取候选证据，再把不可变文本传给 `buildImpactEvidenceGraph()`。

## Test Impact v1

`buildTestImpactMap()` 根据 changed path、语义信号、显式路径映射和可选历史失败相关权重，对 Controller 提供的测试候选进行确定性排序。结果有界、可摘要、可复现。产品负责发现或执行测试；Core 永远不启动测试命令。`formatTestImpactEvidence()` 可把推荐测试集合转换为 Review Service 使用的有界证据。

## Static Analyzer Contract

Core 将通用 analyzer finding 和 SARIF 2.1 结果归一成统一 Finding Contract。Analyzer 文本始终是“不可信证据”，绝不是指令。仓库 Policy 不能定义可执行 analyzer 命令。产品可以通过产品侧 Adapter 导入 CI 产生的 SARIF、JUnit、GitLab Code Quality、Coverage、Compiler、SBOM 或 Scanner Artifact，再把 finding 类结果归一到 Core。

## Diagnosis Contract / Receipt v1

Core 4.9.0 保持 Diagnosis Contract / Receipt v1 不变：失败日志有界压缩、保守确定性分类、closed structured output schema、Diagnosis Result 归一、Evidence Digest 与 Diagnosis Receipt。Pipeline 日志和 Artifact 文本永远是不可信证据。Core 不获取 Pipeline、不重试 Job、不执行日志中的命令、不修改代码、不创建 MR，也不发布 Diagnosis。

## Quality Eval

Quality Platform v3 提供两套带标签的离线门禁：

- Review：`quality/corpus.json` 覆盖 Critical/High/Medium 缺陷和 clean negative case；`scripts/quality-eval.js` 门禁 Critical Recall、Recall、Precision、False Positive/Review、重复/无效行号率和 Token/True Positive。
- Diagnose：`quality/diagnosis-corpus.json` 覆盖 source、test、dependency、infra、flaky、unknown、cascade failure；`scripts/diagnosis-quality-eval.js` 门禁 classification accuracy、root-cause Top-1 accuracy、affected-file recall、retry accuracy、evidence validity、confidence calibration 和 tokens/diagnosis。

仓库内 recorded result 是确定性回归 fixture，不代表生产模型效果声明。产品或定时评测可以通过 `--results` 注入新结果；修改 baseline 必须和解释该变化的 corpus 修改一起审计。

## Patch Proposal Safety

Core 只验证候选 unified patch。二进制补丁、超出已审证据路径、NUL、超预算补丁都会拒绝。Core 永远不会自动 apply、commit、push 或 merge。

## Token Calibration v1

`TokenEstimatorCalibration` 从保守的 2 UTF-8 bytes/token 开始，只根据真实 input-token usage 为 provider+model 维护有界 EWMA；达到最小样本数后才启用，并带安全折扣与上下界。进程重启后重新回到保守默认值；校准不能放宽已配置 Token Budget。

## Performance

保留宽松绝对预算用于阻断灾难性退化；定时性能历史增加同 Runner 相对比较，Latency 或 RSS 回退超过 10% 直接失败。

## Atomic Family Snapshot v1 / Manifest v3

Family Compatibility 先冻结一份精确的 Core + Consumer Snapshot。Linux、Windows、macOS 与 Manifest job 都 checkout 同一组 SHA，不再在不同阶段重新解析移动中的 `main`。每个活跃 Consumer 必须包含 Product Contract v1，并且所 pin 的 Core SHA 必须对应 final、immutable 的 Core `vX.Y.Z` Release。

`FAMILY_MANIFEST.json` v3 记录 Snapshot digest、Core/Consumer 精确 SHA、每个 Consumer 的 Product Contract digest、Core Contract digest、完整的整数 `*Version` 协议映射、protocol fingerprint、Runtime 与 package-lock digest，再由 manifest digest 总锁定。以后 Core 新增版本化协议时，不再需要手工维护第二份协议清单。

## Semantic review contracts

Core 4.5+ 提供纯函数语义 Review 契约：不可变 Evidence Manifest 摘要、稳定 Review Key、稳定 Finding ID、按证据摘要生效的人工 Resolution、证据支撑的验证等级/状态、按 chunk 选择证据、重复 Review 稳定性以及 C/C++ 调用符号提取。Core 不读取仓库，也不执行 analyzer/model；产品负责获取不可变的受限证据，再交给 Core。
