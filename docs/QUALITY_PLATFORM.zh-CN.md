# Quality Platform

Codex Safe Core 4.15.0 / Quality Platform v3 在保持共享确定性质量平台稳定的同时，引入独立版本的 **Model Routing Contract v1**。Policy Schema v4、Safe Contract v2、各 Receipt schema 与 Provider Contract v3 均不因此改变。GitHub/GitLab Provider 行为、VS Code UI、Pipeline API、数据库、Analyzer 获取与通知仍属于产品层，不进入 Core。

## Runtime / Provider Contract v3

Core 统一拥有 compatible Provider 的 Credential、Transport 与机器级 Runtime 解析。Consumer 默认应使用 `provider.mode=auto`：优先尊重产品显式 Override，其次读取机器级 Family Runtime `~/.codex-safe/runtime.json`（或 `CODEX_SAFE_RUNTIME_FILE`），再读取 `${CODEX_HOME}/config.toml` / `~/.codex/config.toml`，最后回退到内置 OpenAI Runtime。出于凭据安全，Provider 自动继承**不会读取仓库内 `.codex/config.toml`**，防止 Repository 内容把机器凭据重定向到其他 Endpoint。

继承 OpenAI-compatible Provider 时，`credentialSource=auto|env|auth-json` 继续保持 Secret-by-reference。Secret 只注入 Codex 子进程环境，绝不会进入 argv、Settings、Receipt、Family Runtime profile 或诊断日志。

HTTPS 仍是首选。机器拥有的 Codex / Family Runtime 中，如果 Endpoint 是 Loopback 或字面量 private-network HTTP，各产品可以继承，但 Doctor 必须明确显示明文传输风险。公网/非 IP HTTP 默认继续拒绝，只有机器级 Family Runtime 显式信任时才允许。Repository Policy 永远不能开启或信任明文 HTTP。Provider Contract v3 与 Codex Runtime v3 继续强制 Responses HTTP/SSE 与 Structured Output。

Structured Codex execution 现在提供增量 JSONL 消费路径：Process 层可以把 stdout chunk 逐步交给 Core，同时独立执行 transcript 总上限和诊断 tail 上限。生产路径只保留最新结构化 agent message、usage 与有界错误状态，不再要求进程退出后依赖完整 retained transcript 才能解析结果。没有 streaming hook 的测试替身继续使用原来的有界 tail parser；Malformed stream 与 total-output overflow 继续 fail closed。

## Model Routing Contract v1

Model Routing Contract v1 把稳定产品语义与快速变化的具体模型世代彻底分开：

- **Mode**：`fast`、`balanced`、`deep`，只表达执行意图。
- **Role**：`scout`、`reviewer`、`adjudicator`，表达模型在一次流程中的权限层级。
- **Model Class**：`fast`、`balanced`、`frontier`，只表达能力等级。
- **Selection Strategy**：`auto`、`preference`、`fixed`。
- **Safe Gate 永远不是模型角色**；最终 Policy、Evidence、Coverage、Schema、Provenance 判定继续完全确定性执行。

Core 不包含任何具体模型世代的路由规则。Provider/model ID 只允许出现在机器/管理员 Registry 与实际执行 Evidence 中，不进入 Repository Policy。`auto` 和 `preference` 只选择 `approved`、未 deprecated、未 unhealthy 的模型。`fixed` 面向 benchmark/debug，可以显式固定模型；它默认使用 `warn` compatibility，使故意的 Mode/Model 不匹配表现为 `degraded` Evidence，而不是偷偷换模型。

Cross-provider fallback 默认关闭，并可继续受 allowlist 限制。因此公司 relay 失败时，代码证据不能静默流向另一个 Provider。找不到合格模型时返回 `MODEL_UNAVAILABLE`。可选 Scout 可以被产品 bypass；必需 Reviewer 或已经触发的 Adjudicator 不允许降级成低权限模型。

Registry 晋升链属于管理员/质量证据：`discovered → compatible → qualified → shadow → canary → approved`，health/deprecation 独立记录。Qualification 必须依据 corpus 中的 confirmed-finding recall、FP/FN、causal-anchor validity、structured-output validity、convergence、latency、token/cost 等指标。模型仅仅出现在 `/models` 中，绝不意味着可以被 `auto` 选择。

每次已解析模型调用都可以生成 Model Evidence：Mode、Role、Strategy、requested/resolved Provider、resolved model/revision、Model Class、routing/registry revision、Qualification identity、lineage pin、fallback/degradation 标记和规范化 Token usage。Credential、源码、Prompt、Finding 永远不属于该 Evidence。

## Token 效率与 Calibration

Core 继续统一 actual/cached/cache-write/output/reasoning Token usage、request estimate、risk score、adaptive budget 与 project reservation。Token Estimator Calibration 现在支持恢复历史数值快照；可选持久化 Store 只保存 provider/model identity 与数值 Calibration，具有 TTL、条目上限、原子 mode-0600 写入和 symlink 拒绝，不保存 Prompt、Source、Finding 或 Model Judgment。

最终优化目标不是单纯“更少 Token”，而是**质量约束下的效率最优**。Consumer 应同时跟踪 fresh review Token、cached-input ratio、token/cost per verified finding、coverage per token、verifier/adjudicator call ratio、P50/P95 latency 与 recall/FP gate。只要质量回归超出已批准的 corpus budget，就不能因为模型更便宜而晋升。

## Judgment Lifecycle v1

Core 统一拥有整个 Family 的 AI Judgment Lifecycle Contract。ReviewSubject identity 绑定代码 Subject、Diff、Policy、Evidence Manifest、Prompt Contract、Review Profile 与 resolved model。只有 fresh inference 才允许生成 Review Receipt；replay 永远不能创建新 Receipt。Consumer 可以缓存确定性 Structural Evidence，但持久化 Model Judgment 不得作为新的 Judgment 或 Verdict 被再次使用。

Review Receipt v5 因此继续强制包含 `reviewSubjectFingerprint` 与 `evidenceManifestDigest`。Delivery 产品根据 Quality、Coverage 与 Mechanical Gate 判断 Review Evidence 是否合格；Merge Readiness 仍由 Change Safe 自己负责。

## Review Profile 与 Profile Pack

现有 `quick`、`standard`、`deep`、`security`、`embedded` Execution Profile 在当前 Consumer 中继续稳定；Model Routing v1 新增与之正交的 `fast`、`balanced`、`deep` 模型意图 Mode。后续只有在全部 Consumer 完成迁移后，才允许通过 coordinated hard cut 删除混合 Execution Profile，不建立永久 alias。Profile Pack v1 继续提供 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime` 工程关注点，但不能授予工具、网络或写权限。

## Impact Evidence 与 Test Impact

Core 仅根据 Controller 提供的文本和 changed paths 构建有界、确定性的 Impact Evidence。`buildTestImpactMap()` 对 Controller 提供的测试候选排序；Core 不负责发现或执行测试。预算压力只有在显式暴露 coverage 缺口并保持 fail closed 时才能减少证据。

## Analyzer Contract

Core 将通用 Analyzer Finding 与 SARIF 2.1 归一到同一有界确定性 Contract。Analyzer 文本始终是不可信 Evidence，不是指令；Repository Policy 不允许定义可执行 Analyzer command。

## Diagnosis Contract / Receipt v2

Diagnosis primitive 负责压缩/脱敏 failure log、形成保守 classification prior、校验结构化模型输出，并把完整的 Model-visible Diagnosis Input Manifest 绑定到 Diagnosis Receipt v2。Pipeline/Job 获取与发布由产品拥有。Diagnosis **永远不会自动重试 CI、修改源码、commit、push 或 merge**。

质量评估持续检查 classification accuracy、false positive、校准与 Token 成本。

## Semantic Review Contract

Review Evidence Chunking 必须保留 changed-hunk coverage，否则产生显式 gap。Review Profile Pack、Test Impact、Analyzer normalization、Diagnosis 与 semantic review contracts 都继续是纯确定性的 Core primitive；模型输出永远不能获得 authority。

## Safe Patch 边界

Patch Proposal 只是 Evidence。Core **永远不会自动 apply、commit、push 或 merge** Proposal。产品可以展示有界 Proposal，但不能把模型文本转换成隐式仓库修改。

## Family Evidence

Family Registry v1 是仓库、产品身份和 Distribution topology 的唯一来源。Atomic Family Snapshot v2 冻结一个精确已发布 Core 与五个精确 Consumer 产品 Release，包括 immutable release tag、tag SHA、Release assets 和必须的 Distribution evidence。只要 `src/codex-safe-core` gitlink 改变，该 Consumer 就必须提升一个 patch 产品版本，否则共享 Family Release Guard 直接失败。

Family Manifest v4 把 Snapshot v2 digest、Core/Consumer exact release tag 与 tag SHA、immutable 状态、artifact digest、Product Contract/package-lock digest 以及 Distribution evidence 一并写入 `FAMILY_MANIFEST.json`。VS Code 产品必须提供 Marketplace Distribution Receipt；Review Service 必须通过 Release 中的 `IMAGE_DIGEST.txt` 绑定 GHCR multi-arch image digest；Diagnose 以 immutable GitHub Release 作为 Distribution boundary。

Family Freshness 要求每个活跃 Consumer 当前 `main` 同时满足 Core exact alignment、当前 `vX.Y.Z` immutable release tag 精确指向同一个 main SHA，并存在要求的 Distribution evidence。仅源码 repin、但用户安装包仍旧的状态明确判为 **not fresh**。五个已发布产品全部收敛后才允许触发三平台 Family Compatibility。

Family Status v1 提供当前机器可读运维视图：Core Release readiness、Consumer Core alignment、immutable Release readiness、Distribution readiness、当前 Manifest digest 与 Freshness decision。它只描述“现在”，绝不替代不可变的 Family Manifest 历史证据。

Coordinated Upgrade 是完整 release-aware 链：同步 exact Core gitlink、Product Contract、verifier、contract tests 与 current-state docs，同时强制产品 patch bump；PR merge 后必须等每个 Consumer 的 immutable Release 与要求的 Distribution evidence 全部完成，才触发 Family Freshness。

Change Safe 作为活跃 Core Consumer 消费确定性的 Policy/Fingerprint 与 Judgment Lifecycle primitive。其 SCM Provider 与 Delivery Authorization 继续由产品拥有；**Change Safe 默认继续 0 model call，不因为统一 Model Routing 而引入 Scout/Reviewer/Adjudicator 来恢复 narrative generation。** `change` Policy schema/validation 继续通过与 Review、Commit、Review Service 相同的 `.codex-safe.json` Policy Schema v4 由 Core 统一拥有。
