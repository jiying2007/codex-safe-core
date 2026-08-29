# 质量平台

Codex Safe Core 4.8 扩展统一、确定性的质量平台，同时继续禁止把 GitLab、VS Code、Pipeline API、数据库、Analyzer 获取、通知等产品职责塞进 Core。

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

Core 4.8 为 `codex-diagnose` 增加纯函数 Diagnosis 原语：失败日志有界压缩、保守的确定性分类、closed structured output schema、Diagnosis Result 归一、Evidence Digest 与 Diagnosis Receipt v1。Pipeline 日志和 Artifact 文本永远是不可信证据。Core 不获取 Pipeline、不重试 Job、不执行日志中的命令、不修改代码、不创建 MR，也不发布 Diagnosis。

## Quality Eval

`quality/corpus.json` 定义 Critical/High/Medium 合成缺陷期望；`scripts/quality-eval.js` 计算 Critical Recall、Recall、Precision、每次 Review 的 False Positive、重复率、无效行号率和 Token/True Positive。Critical Recall 低于 100%，或质量/成本相对基线越界，CI 直接失败。仓库内 recorded corpus 是确定性离线门禁；也可以通过 `--results` 输入真实模型评测结果。

## Patch Proposal Safety

Core 只验证候选 unified patch。二进制补丁、超出已审证据路径、NUL、超预算补丁都会拒绝。Core 永远不会自动 apply、commit、push 或 merge。

## Performance

保留宽松绝对预算用于阻断灾难性退化；定时性能历史增加同 Runner 相对比较，Latency 或 RSS 回退超过 10% 直接失败。

## Family Manifest

Canonical `FAMILY_MANIFEST.json` 统一记录 Core 以及 `codex-commit`、`codex-review`、`codex-review-service`、`codex-diagnose` 四个活跃 Consumer 的精确 SHA、协议版本、Runtime、package-lock digest、product-contract digest，并由唯一 manifest digest 锁定。

## Semantic review contracts

Core 4.5+ 提供纯函数语义 Review 契约：不可变 Evidence Manifest 摘要、稳定 Review Key、稳定 Finding ID、按证据摘要生效的人工 Resolution、证据支撑的验证等级/状态、按 chunk 选择证据、重复 Review 稳定性以及 C/C++ 调用符号提取。Core 不读取仓库，也不执行 analyzer/model；产品负责获取不可变的受限证据，再交给 Core。
