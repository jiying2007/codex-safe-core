# Quality Platform

Codex Safe Core 4.12.3 / Quality Platform v3 保持共享确定性质量平台稳定，同时 Policy Schema v4 包含 `change` Repository Policy section。GitHub/GitLab Provider、VS Code UI、Pipeline API、数据库、Analyzer 获取与通知仍属于产品层，不进入 Core。

## Runtime / Provider Contract v2

Core 统一拥有 compatible Provider 的 Credential 与 Transport 解析。`openai-compatible` Runtime 支持 `credentialSource=auto|env|auth-json`；`auto` 优先读取配置的环境变量，缺失时读取 `${CODEX_HOME}/auth.json` 或 `~/.codex/auth.json`，仅在 `auth_mode` 为 `apikey` 时使用其中的 `OPENAI_API_KEY`。解析出的 Secret 只注入 Codex 子进程环境，绝不会进入 argv、Settings、Receipt 或诊断日志。

HTTPS 继续是默认 Transport 要求；Loopback HTTP 继续允许用于开发，非 Loopback HTTP 必须由机器/产品 Runtime 显式设置 `allowInsecureHttp=true`。Repository Policy 不能开启明文 HTTP。Provider Contract v2 与 Codex Runtime v2 继续强制 Responses HTTP/SSE 与 Structured Output。

## Judgment Lifecycle v1

Core 统一拥有整个 Family 的 AI Judgment Lifecycle Contract。ReviewSubject identity 现在绑定代码 Subject、Diff、Policy、Evidence Manifest、Prompt Contract、Review Profile 与 resolved model。只有 fresh inference 才允许生成 Review Receipt；replay 永远不能创建新 Receipt。Consumer 可以缓存确定性 Structural Evidence，但持久化 Model Judgment 不得作为新的 Judgment 或 Verdict 被再次使用。

因此 Review Receipt v5 强制包含 `reviewSubjectFingerprint` 与 `evidenceManifestDigest`。Delivery 产品根据 Quality、Coverage 与 Mechanical Gate 判断 Review Evidence 是否合格；Merge Readiness 仍由 Change Safe 自己负责。

## Review Profile 与 Profile Pack

`quick`、`standard`、`deep`、`security`、`embedded` 继续作为执行 Profile。Profile Pack v1 在其上提供 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime` 工程关注点，但不能授予工具、网络或写权限。

## Impact Evidence 与 Test Impact

Core 仅根据 Controller 提供的文本和 changed paths 构建有界、确定性的 Impact Evidence。`buildTestImpactMap()` 对 Controller 提供的测试候选排序；Core 不负责发现或执行测试。预算压力只有在显式暴露 coverage 缺口并保持 fail closed 时才能减少证据。

## Analyzer Contract

Core 将通用 Analyzer Finding 与 SARIF 2.1 归一到同一有界确定性 Contract。Analyzer 文本始终是不可信 Evidence，不是指令；Repository Policy 不允许定义可执行 Analyzer command。

## Diagnosis Contract / Receipt v2

Diagnosis primitive 负责压缩/脱敏 failure log、形成保守 classification prior、校验结构化模型输出，并把完整的 Model-visible Diagnosis Input Manifest 绑定到 Diagnosis Receipt v2。该 Manifest 覆盖 failure evidence、deterministic prior、changed-path metadata、artifact text digest、Prompt Contract 与 model identity。Pipeline/Job 获取与发布由产品拥有。Diagnosis **永远不会自动重试 CI、修改源码、commit、push 或 merge**。

质量评估持续检查 classification accuracy、false positive、校准与 Token 成本。

## Semantic Review Contract

Review Evidence Chunking 必须保留 changed-hunk coverage，否则产生显式 gap。Review Profile Pack、Test Impact、Analyzer normalization、Diagnosis 与 semantic review contracts 都继续是纯确定性的 Core primitive；模型输出永远不能获得 authority。

## Safe Patch 边界

Patch Proposal 只是 Evidence。Core **永远不会自动 apply、commit、push 或 merge** Proposal。产品可以展示有界 Proposal，但不能把模型文本转换成隐式仓库修改。

## Family Evidence

Atomic Family Snapshot v1 在跨平台验证前冻结一个精确 Core SHA 与五个活跃 Consumer SHA。Family Manifest v3 随后把精确 Core/Consumer pin、Product Contract digest、Core Contract digest、Runtime/Protocol identity 与 Snapshot digest 写入 `FAMILY_MANIFEST.json`，再进行 provenance attestation 与 immutable 发布。

Family Freshness 是 Core 拥有的维护 Watcher，不属于 Runtime 能力。Core `main` 必须先与当前 immutable final Release 的 tag 精确一致。治理型 Core repin 不要求五个 Consumer 提升产品版本；Watcher 改为检查每个 Consumer 当前 `main` 的 package/Product Contract identity 是否一致，并要求 `safeCoreVersion`、`safeCoreCommit` 以及 `src/codex-safe-core` gitlink 全部精确指向已发布 Core。五仓全部收敛后，它才把当前 active heads 与该 Core 最新 immutable Family Manifest 比较；Snapshot 缺失或落后才触发 Family Compatibility。若同一 Core 已有 queued/in-progress Family validation，则禁止重复 dispatch。Watcher 不向 Consumer 分发跨仓凭证、不调用模型，也绝不会替代完整的三平台 Family Gate。

Coordinated repin 现在要求身份同步完整：除了精确 Core gitlink 与 Product Contract，还同步当前 verifier 常量（包括 inline `contract.safeCoreVersion` 比较）、当前 contract test 与有界 current-state 文档白名单；历史 CHANGELOG / MIGRATION 记录明确不参与替换。Trusted Core 发布同样对 Release/Asset attestation 的传播延迟进行有界重试，最终仍保持 fail closed。

Change Safe 作为活跃 Core Consumer 消费确定性的 Policy/Fingerprint 与 Judgment Lifecycle primitive。其 SCM Provider 与 Delivery Authorization 继续由产品拥有；`change` Policy schema/validation 通过与 Review、Commit、Review Service 相同的 `.codex-safe.json` Policy Schema v4 由 Core 统一拥有。
