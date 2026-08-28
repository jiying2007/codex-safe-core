# 质量平台

Codex Safe Core 4.5 增加统一、确定性的质量原语，同时继续禁止把 GitLab、VS Code、数据库、通知等产品职责塞进 Core。

## Review Profile

统一提供 `quick`、`standard`、`deep`、`security`、`embedded` 五种执行 Profile。Profile 只在产品既有上限内缩放 evidence/context/token 预算并选择影响分析深度，不能削弱 Safe Contract、Receipt 校验、changed-line anchoring 或 fail-closed coverage。

## Impact Evidence Graph

Core 从 diff 中提取 include/import、symbol、构建、Kconfig、DeviceTree 等有界信号，并对 Controller 提供的候选文件进行确定性评分。Core 自身不读工作区、不访问网络；Consumer 在自己的信任边界内获取候选证据，再把不可变文本传给 `buildImpactEvidenceGraph()`。

## Static Analyzer Contract

Core 将通用 analyzer finding 和 SARIF 2.1 结果归一成统一 Finding Contract。Analyzer 文本始终是“不可信证据”，绝不是指令。仓库 Policy 不能定义可执行 analyzer 命令。产品可以导入运维方或 CI 产生的 SARIF，再与 deterministic rules、Codex 语义推理组合。

## Quality Eval

`quality/corpus.json` 定义 Critical/High/Medium 合成缺陷期望；`scripts/quality-eval.js` 计算 Critical Recall、Recall、Precision、每次 Review 的 False Positive、重复率、无效行号率和 Token/True Positive。Critical Recall 低于 100%，或质量/成本相对基线越界，CI 直接失败。仓库内 recorded corpus 是确定性离线门禁；也可以通过 `--results` 输入真实模型评测结果。

## Patch Proposal Safety

Core 只验证候选 unified patch。二进制补丁、超出已审证据路径、NUL、超预算补丁都会拒绝。Core 永远不会自动 apply、commit、push 或 merge。

## Performance

保留宽松绝对预算用于阻断灾难性退化；定时性能历史增加同 Runner 相对比较，Latency 或 RSS 回退超过 10% 直接失败。

## Family Manifest

删除内容重复的 `FAMILY_BASELINE.json` / `FAMILY_BOM.json` 双文件，统一为 `FAMILY_MANIFEST.json`。其中记录 Core/Consumer 精确 SHA、协议版本、Runtime、package-lock digest、product-contract digest，并由唯一 manifest digest 锁定。


## Semantic review contracts

Core 4.5 新增纯函数语义 Review 契约：不可变 Evidence Manifest 摘要、稳定 Review Key、稳定 Finding ID、按证据摘要生效的人工 Resolution、证据支撑的验证等级/状态、按 chunk 选择证据、重复 Review 稳定性以及 C/C++ 调用符号提取。Core 不读取仓库，也不执行 analyzer/model；产品负责获取绑定 Git Index 的受限证据，再交给 Core。
