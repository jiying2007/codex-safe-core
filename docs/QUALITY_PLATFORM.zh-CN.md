# Quality Platform

Codex Safe Core 4.14.3 / Quality Platform v3 保持共享确定性质量平台稳定，同时 Policy Schema v4 包含 `change` Repository Policy section。GitHub/GitLab Provider、VS Code UI、Pipeline API、数据库、Analyzer 获取与通知仍属于产品层，不进入 Core。

## Runtime / Provider Contract v3

Core 统一拥有 compatible Provider 的 Credential、Transport 与机器级 Runtime 解析。Consumer 默认应使用 `provider.mode=auto`：优先尊重产品显式 Override，其次读取机器级 Family Runtime `~/.codex-safe/runtime.json`（或 `CODEX_SAFE_RUNTIME_FILE`），再读取 `${CODEX_HOME}/config.toml` / `~/.codex/config.toml`，最后回退到内置 OpenAI Runtime。出于凭据安全，Provider 自动继承**不会读取仓库内 `.codex/config.toml`**，防止 Repository 内容把机器凭据重定向到其他 Endpoint。

继承 OpenAI-compatible Provider 时，`credentialSource=auto|env|auth-json` 继续保持 Secret-by-reference。`auto` 优先使用 Provider 配置的环境变量，否则沿用现有有界 `auth.json` 解析。Secret 只注入 Codex 子进程环境，绝不会进入 argv、Settings、Receipt、Family Runtime profile 或诊断日志。

HTTPS 仍是首选。机器拥有的 Codex / Family Runtime 中，如果 Endpoint 是 Loopback 或字面量 private-network HTTP（RFC1918、link-local、loopback、IPv6 ULA/link-local），各产品可以直接继承，不再重复要求每个插件单独打开 insecure HTTP；Doctor 必须明确显示明文传输风险。公网/非 IP HTTP 默认继续拒绝，只有机器级 Family Runtime 显式信任时才允许。Repository Policy 永远不能开启或信任明文 HTTP。Provider Contract v3 与 Codex Runtime v3 继续强制 Responses HTTP/SSE 与 Structured Output。

Structured Codex execution 把 transcript 总产出预算与内存 stdout 保留预算分开：较长 JSONL 事件流可以超过内存捕获窗口而不误杀合法 Review，同时子进程总输出仍保留 fail-closed 硬上限。Core 只保留足够解析最终结构化 agent message、usage 与诊断信息的有界 stdout 尾部。

## Judgment Lifecycle v1

Core 统一拥有整个 Family 的 AI Judgment Lifecycle Contract。ReviewSubject identity 绑定代码 Subject、Diff、Policy、Evidence Manifest、Prompt Contract、Review Profile 与 resolved model。只有 fresh inference 才允许生成 Review Receipt；replay 永远不能创建新 Receipt。Consumer 可以缓存确定性 Structural Evidence，但持久化 Model Judgment 不得作为新的 Judgment 或 Verdict 被再次使用。

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

Family Registry v1 成为仓库、产品身份和 Distribution topology 的唯一来源。Atomic Family Snapshot v2 不再只冻结源码 `main`，而是冻结一个精确已发布 Core 与五个精确 Consumer 产品 Release，包括 immutable release tag、tag SHA、Release assets 和必须的 Distribution evidence。只要 `src/codex-safe-core` gitlink 改变，该 Consumer 就必须提升一个 patch 产品版本，否则共享 Family Release Guard 直接失败。

Family Manifest v4 把 Snapshot v2 digest、Core/Consumer exact release tag 与 tag SHA、immutable 状态、artifact digest、Product Contract/package-lock digest 以及 Distribution evidence 一并写入 `FAMILY_MANIFEST.json`。VS Code 产品必须提供 Marketplace Distribution Receipt，该 Receipt 只能在成功发布 GitHub Release 中同一份已 attested VSIX 后生成；Review Service 必须通过 Release 中的 `IMAGE_DIGEST.txt` 绑定 GHCR multi-arch image digest；Diagnose 以 immutable GitHub Release 作为 Distribution boundary。Manifest 自身继续 provenance attestation，并用 digest-addressed immutable Release 保存历史证据。

Family Freshness 现在要求每个活跃 Consumer 当前 `main` 同时满足：Core exact alignment、当前 `vX.Y.Z` immutable release tag 精确指向同一个 main SHA，并且必须的 Distribution evidence 已存在。仅源码 repin、但用户安装包仍旧的状态会明确判为 **not fresh**。五个已发布产品全部收敛后才允许触发三平台 Family Compatibility；已有 queued/in-progress validation 时继续抑制重复 dispatch。

Family Status v1 提供当前机器可读运维视图：Core Release readiness、Consumer Core alignment、immutable Release readiness、Distribution readiness、当前 Manifest digest 与 Freshness decision。它只描述“现在”，绝不替代不可变的 Family Manifest 历史证据。

Coordinated Upgrade 现在是完整 release-aware 链：同步 exact Core gitlink、Product Contract、verifier、contract tests 与 current-state docs，同时强制产品 patch bump；PR merge 后必须等每个 Consumer 的 immutable Release 与要求的 Distribution evidence 全部完成，才触发 Family Freshness。历史 Changelog/Migration 记录继续 append-only。Trusted publication 对 attestation propagation 仍只做有界重试并最终 fail closed。

Change Safe 作为活跃 Core Consumer 消费确定性的 Policy/Fingerprint 与 Judgment Lifecycle primitive。其 SCM Provider 与 Delivery Authorization 继续由产品拥有；`change` Policy schema/validation 通过与 Review、Commit、Review Service 相同的 `.codex-safe.json` Policy Schema v4 由 Core 统一拥有。
