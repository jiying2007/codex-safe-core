# Quality Platform

Codex Safe Core 4.13.1 / Quality Platform v3 保持共享确定性质量平台稳定，同时 Policy Schema v4 包含 `change` Repository Policy section。GitHub/GitLab Provider、VS Code UI、Pipeline API、数据库、Analyzer 获取与通知仍属于产品层，不进入 Core。

## Runtime / Provider Contract v3

Core 统一拥有 compatible Provider 的 Credential、Transport 与机器级 Runtime 解析。Consumer 默认应使用 `provider.mode=auto`：优先尊重产品显式 Override，其次读取机器级 Family Runtime `~/.codex-safe/runtime.json`（或 `CODEX_SAFE_RUNTIME_FILE`），再读取 `${CODEX_HOME}/config.toml` / `~/.codex/config.toml`，最后回退到内置 OpenAI Runtime。出于凭据安全，Provider 自动继承**不会读取仓库内 `.codex/config.toml`**，防止 Repository 内容把机器凭据重定向到其他 Endpoint。

继承 OpenAI-compatible Provider 时，`credentialSource=auto|env|auth-json` 继续保持 Secret-by-reference。`auto` 优先使用 Provider 配置的环境变量，否则沿用现有有界 `auth.json` 解析。Secret 只注入 Codex 子进程环境，绝不会进入 argv、Settings、Receipt、Family Runtime profile 或诊断日志。

HTTPS 仍是首选。机器拥有的 Codex / Family Runtime 中，如果 Endpoint 是 Loopback 或字面量私网 HTTP（RFC1918、link-local、loopback、IPv6 ULA/link-local），各产品可以直接继承，不再重复要求每个插件单独打开 insecure HTTP；Doctor 必须明确显示明文传输风险。公网/非 IP HTTP 默认继续拒绝，只有机器级 Family Runtime 显式 `trustedPrivateHttp=true` 才可信任。Repository Policy 永远不能开启或信任明文 HTTP。Provider Contract v3 与 Codex Runtime v3 继续强制 Responses HTTP/SSE 与 Structured Output。

Structured Codex execution 现在把 transcript 总产出预算与内存 stdout 保留预算分开：较长的 JSONL 事件流可以超过内存捕获窗口而不误杀合法 Review，同时子进程总输出仍保留 fail-closed 硬上限。Core 只保留足够解析最终结构化 agent message、usage 与诊断信息的有界 stdout 尾部；只有在 Core 自己明确标记发生有界尾部截断时，解析器才允许忽略第一个不完整 JSONL 片段。

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

Coordinated repin 现在要求身份同步完整：除了精确 Core gitlink 与 Product Contract，还同步当前 verifier 常量、当前 contract test 与有界 current-state 文档白名单。对 Review Service，该白名单按仓库真实路径覆盖根目录 `OPERATIONS.md` 以及中英文 Deployment，禁止用不存在的影子路径冒充覆盖。历史 CHANGELOG / MIGRATION 记录继续不参与替换。Trusted Core 发布仍对 Release/Asset attestation 的传播延迟进行有界重试并最终 fail closed。

Change Safe 作为活跃 Core Consumer 消费确定性的 Policy/Fingerprint 与 Judgment Lifecycle primitive。其 SCM Provider 与 Delivery Authorization 继续由产品拥有；`change` Policy schema/validation 通过与 Review、Commit、Review Service 相同的 `.codex-safe.json` Policy Schema v4 由 Core 统一拥有。
