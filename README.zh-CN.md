# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 Codex Safe 产品族唯一的**安全运行时与协议核心**。它是产品族内部基础组件，不是面向最终用户独立安装使用的应用。

| 产品 | 面向用户的职责 |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | 在 VS Code 中审查 staged changes |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | 生成并校验 Conventional Commit Message |
| [Codex Change Safe](https://github.com/jiying2007/codex-pr) | 开发者侧 GitHub/GitLab 交付授权、Merge Readiness 与 Change Receipt v1 |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | 服务端 GitLab Self-Managed MR 审查、发布、门禁与审计 |
| [Codex Diagnose Safe](https://github.com/jiying2007/codex-diagnose) | 对 CI / Build / Test 失败做有界根因诊断，并生成 Diagnosis Receipt v2 |

**Codex PR Safe 已退役。** 旧的模型生成 PR 描述身份不会恢复。**Codex Change Safe** 是新的确定性交付产品：默认模型调用为 0，负责 GitHub/GitLab PR/MR 的交付授权与 Merge Readiness。

## Family SCM 一级 UI 契约

VS Code 源代码管理器标题栏的正式一级顺序固定为 **Review → Commit → Change**。三个产品各只占一个一级入口：Review 使用 `navigation@5`，Commit 使用 `navigation@6`，Change 使用 `navigation@7`。Independent Review 与 Delivery Preflight 保留为二级能力，不再占用主 SCM 工具栏。机器真相源为 `family-ui-contract.json`。

当前协议线：**Safe Core v4 / Safe Contract v2 / Policy Schema v4 / Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2 / Codex Runtime v3 / Provider Contract v3 / Review、Commit、Diagnose Prompt Contract v1**。`core-contract.json` 是当前 Core / 协议 / 运行时事实的机器校验唯一来源。

## 我应该使用哪个仓库？

开发者侧提交前审查使用 Codex Review Safe，Commit Message 生成使用 Codex Commit Safe，PR/MR 交付授权使用 Codex Change Safe，服务端 GitLab MR 审查使用 Codex Review Service，CI / Build / Test 失败根因分析使用 Codex Diagnose Safe。只有在开发 Codex Safe Family 本身、升级共享 runtime/protocol 或协调 repin 时，才需要直接操作本仓库。

详见 [Consumer Guide](docs/CONSUMER_GUIDE.zh-CN.md) 与 [SUPPORT.md](SUPPORT.md)。

## 使用模型

五个活跃 Consumer 统一以 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit。gitlink 就是版本锁；不复制 runtime、不跟随分支、不通过 npm runtime dependency，也不保留兼容代理。

```bash
git submodule update --init --recursive
npm run ci
```

Core 变更只有在五个活跃 Consumer 都 coordinated-repin 到同一个已审核、已正式发布的 Core commit，并通过各自 CI 后才算完成。

## 机器可验证的 Trust Root 身份

`core-contract.json` 管理当前版本和受支持运行时；`safe-contract.js` 从它派生协议常量，并导出闭合的 `SAFE_CONTRACT_MANIFEST` 与 SHA-256 `SAFE_CONTRACT_DIGEST`。Digest 用于精确标识权限/能力面，不会暗中改变 Safe Contract v2 语义，也不会静默改变任何独立版本化的 Receipt schema。

Native runtime 明确只支持：

- Node 22 LTS：**>=22.22.2 <23**
- Node 24 LTS：**>=24.19.0 <25**

CI 在 Linux、Windows、macOS 上验证两个精确基线，不再用 `>=22` 隐式承诺未测试的奇数/未来 Node major。

## 职责边界

Core 负责 Codex capability probe/调用、进程生命周期、本地 Git 通用原语、Semantic Context、coverage-preserving Review Evidence Chunking、**Policy Schema v4**、确定性 Review Rules、指纹以及 Receipt 校验与 provenance。Core 4.x 还统一拥有 Runtime/Provider Contract v3 的 Credential/Transport 解析、版本化 Review Profile Pack、确定性 Test Impact、Diagnosis Contract / Receipt 纯函数原语、有界 Token Estimator Calibration、Review/Diagnose Quality Eval、Atomic Family Snapshot v1、Family Manifest v3、Product Contract v1 校验以及 immutable released-Core pin 校验。

产品领域继续由产品自己负责：Change Safe 拥有 SCM Provider、source/target topology、SCM 原生 policy 发现、PR/MR mutation、Merge Readiness 与 Delivery Authorization；Review Service 拥有 webhook/queue/publication/audit；Diagnose 拥有 CI Evidence 获取与诊断编排。Core 不执行 Provider 副作用。

模型生成 PR/MR Narrative 仍然是明确非目标。Change Safe 是确定性交付授权产品，不是旧 PR Narrative Generator 的复活。

## Safe Contract v2

要求 `--ask-for-approval never`、`exec --json`、ephemeral、忽略用户/仓库 Codex 规则、read-only sandbox、Structured Output，并显式关闭 shell/unified exec、web search、apps、multi-agent、plugins、hooks、goals、memories 与 dependency install。缺少能力直接 fail closed，不提供 legacy fallback。

每日 Codex CLI Canary 在 Linux/Windows/macOS 检查最新上游 CLI 并记录 Safe Contract digest；配置受保护 OpenAI 凭据时，还会真实尝试被禁止的文件写入与 loopback network side effect，任一成功即失败。永久 adversarial corpus 验证仓库/模型中的恶意指令不能改变 Safe Contract argv。

## Runtime / Provider Contract v3

`openai-compatible` Consumer 可以从配置的环境变量，或直接从 `${CODEX_HOME}/auth.json` / `~/.codex/auth.json` 解析中转站 API Key。`credentialSource=auto` 优先环境变量，缺失时回退到 `auth.json`；只有 `auth_mode=apikey` 且包含 `OPENAI_API_KEY` 才会被接受。Secret 只注入 Codex 子进程环境，不进入 argv、产品 Settings、Receipt 或诊断日志。

Consumer 默认使用零配置机器 Runtime 解析：产品显式 Override → `~/.codex-safe/runtime.json` / `CODEX_SAFE_RUNTIME_FILE` → `${CODEX_HOME}/config.toml` / `~/.codex/config.toml` → 内置 OpenAI。Provider 路由绝不继承仓库内 `.codex/config.toml`。HTTPS 仍为首选；机器配置中的字面量私网 IP HTTP 可直接继承并显示明文风险，公网/非 IP HTTP 默认 fail-closed，除非机器级 Family Runtime 显式信任。兼容 Provider 继续固定使用 Responses HTTP/SSE + Structured Output，并关闭 WebSocket。

## Policy Schema v4

仓库策略唯一入口仍是 committed `.codex-safe.json`。Policy Schema v4 是硬切升级：旧 schema 不自动迁移、不兼容读取。

闭合的顶层 section 为：

- `review`：Codex Review Safe；
- `commit`：Codex Commit Safe；
- `change`：Codex Change Safe 的交付门禁；
- `reviewService`：Codex Review Service 的仓库策略。

原 `pr` Policy/Prompt surface 继续明确拒绝。新的 `change` 不是旧 `pr` 的兼容别名：它只包含 required checks/approvals、Review/Commit provenance、clean/pushed/fresh 等确定性交付要求，不接受模型 Narrative 指令。

所有产品统一通过 Core 的 parser/validator 读取自己的 section，并共享同一 committed Policy fingerprint。Change Safe 本地设置只能加严 committed `change` policy；SCM 原生要求在 Change 产品层与它取并集，本地配置不能减弱。

Diagnose 继续使用独立产品配置，因为 CI Diagnosis 不属于 repository review/delivery policy surface。

## Core 4.13 Quality Platform v3

原有 `quick`、`standard`、`deep`、`security`、`embedded` 五种执行 Profile 保持稳定。Profile Pack v1 提供 `general`、`backend`、`frontend`、`security`、`cpp`、`embedded-linux`、`embedded-mcu`、`driver`、`kernel`、`realtime` 十个版本化工程 Pack。Test Impact v1 根据 changed paths 与语义证据对 Controller 提供的测试候选做确定性排序，但不执行测试。Diagnosis Contract v1 保持不变。Quality Platform v3 增加带标签的 Review / Diagnose 回归语料，包括 clean negative/cascade case 与明确的质量、校准、Token 成本门禁。Token Calibration v1 可从真实 usage 改进预估，但不能削弱 fail-closed budget。

## Receipt provenance

Review Receipt v5 与 Commit Receipt v4 是分别独立版本化的闭合 Contract。Change Receipt v1 继续由 Change Safe 拥有，绑定确定性交付快照与远端 change-request identity。Diagnosis Receipt v2 绑定 project/pipeline/job/commit 以及完整 Diagnosis Input Manifest，包括模型可见 Evidence 的精确身份。Receipt 是 Workflow provenance，本身不是人工批准、构建或测试证据。

Core Trust Root 治理不会静默给 Receipt schema 增加字段。Safe Contract / execution / runtime identity 继续作为独立版本化的机器身份存在，只有某个 Receipt 版本显式采用时才进入其 schema。

## 确定性边界

Git evidence identity、Policy evaluation、Receipt validation、coverage/readiness/mechanical gate、severity/confidence filtering、stale publication rejection、Profile Pack 解析、Test Impact 排序、Diagnosis Evidence Digest、质量指标、Family Snapshot 身份和 Manifest 身份都是确定性逻辑。模型 wording/findings/diagnoses 属于非确定性输入，不能绕过 schema validation、evidence binding 或 deterministic gate。

## Family 治理

- **Atomic Family Compatibility：** 每周/手动先冻结一份精确 Core/Consumer Snapshot，再在 Linux、Windows、macOS checkout 同一组 SHA，验证五个活跃 Consumer 只 pin 已正式发布的 Core、检查是否重新实现 Core-owned primitive，并运行各自 CI。
- **Family Manifest v3 Attestation：** Manifest job 消费同一冻结 Snapshot，记录 Core/Consumer SHA、Product Contract digest、Core Contract digest、完整版本化 protocol map/fingerprint、Runtime 与 manifest digest，再生成 build provenance 和 immutable digest-addressed Release。
- **Released Core Gate：** 活跃 Consumer 只能 pin 到 final、immutable `vX.Y.Z` Core Release 精确指向的 SHA。
- **Codex CLI Canary：** 每天/手动使用最新上游 Codex CLI，在三平台检查 Safe Contract 必需能力；有受保护凭据时执行 live negative behavior check。
- **Adversarial Corpus：** 持续覆盖 prompt injection、工具提权、网络/文件系统诱导等输入。
- **Performance / Quality Budget：** 宽松性能门禁阻止数量级退化；带标签 Review/Diagnose corpus 阻止准确率、误报、校准和 Token 成本回退。
- **OpenSSF Scorecard：** 持续安全回归信号。
- **Release Supply Chain：** trusted reusable publication workflow、Node 22/24 release gate、可复现 npm package、immutable tag/assets、SHA-256、SPDX SBOM、GitHub build provenance attestation 与消费侧验证。

## 开发

```bash
git submodule update --init --recursive
npm run ci
```

使用 `core-contract.json` 中受支持的 Node 22/24 LTS 区间。

## 版本治理

Core Major 是实现/产品族协议边界；各协议版本独立，只在自身语义变化时升级。Policy Schema v4、Safe Contract v2、Review Receipt v5、Commit Receipt v4、Diagnosis Receipt v2、Codex Runtime v3 与 Provider Contract v3 分别独立版本化。Policy/Core breaking change 必须硬切所有活跃 Consumer，不维护永久兼容层。

## 安全

见 [SECURITY.md](SECURITY.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 与 [VERIFY_RELEASE.md](VERIFY_RELEASE.md)。核心原则：**AI 输出永远是不可信数据，不能获得修改 Git、执行任意命令、绕过安全能力、重试 CI 或直接产生 Provider 副作用的权限。**

## License

MIT

## 用户可见时区

机器可读 Receipt、Evidence 与持久化审计时间继续使用 canonical UTC。用户可见时间默认跟随运行环境系统时区；如果服务器或容器运行在 UTC、但运维希望显示业务本地时间，可设置 `CODEX_SAFE_DISPLAY_TIME_ZONE` 为 IANA 时区，例如 `Asia/Singapore`、`Asia/Shanghai` 或 `America/New_York`。展示时区永远不参与 fingerprint、Receipt 或 Evidence digest。
