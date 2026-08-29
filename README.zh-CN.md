# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 Codex Safe 产品族唯一的**安全运行时与协议核心**。它是产品族内部基础组件，不是面向最终用户独立安装使用的应用。

| 产品 | 面向用户的职责 |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | 在 VS Code 中审查 staged changes |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | 生成并校验 Conventional Commit Message |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | 服务端 GitLab Self-Managed MR 审查、发布、门禁与审计 |

**Codex PR Safe 已退役。** 不会提供替代的 PR/MR 描述生成器；PR/MR 创建和元数据管理交给 SCM 原生 UI、CLI 或 API，Codex Commit Safe 也明确不增加 PR/MR 描述生成功能。

当前协议线：**Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Review & Commit Prompt Contract v1**。`core-contract.json` 是当前 Core / 协议 / 运行时事实的机器校验唯一来源。

## 我应该使用哪个仓库？

开发者侧提交前审查使用 Codex Review Safe，Commit Message 生成使用 Codex Commit Safe，服务端 GitLab MR 审查使用 Codex Review Service。只有在开发 Codex Safe Family 本身、升级共享 runtime/protocol 或协调 repin 时，才需要直接操作本仓库。

详见 [Consumer Guide](docs/CONSUMER_GUIDE.zh-CN.md) 与 [SUPPORT.md](SUPPORT.md)。

## 使用模型

三个活跃 Consumer 统一以 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit。gitlink 就是版本锁；不复制 runtime、不跟随分支、不通过 npm runtime dependency，也不保留兼容代理。

```bash
git submodule update --init --recursive
npm run ci
```

Core 变更只有在三个活跃 Consumer 都 coordinated-repin 到同一个已审核 Core commit，并通过各自 CI 后才算完成。

## 机器可验证的 Trust Root 身份

`core-contract.json` 管理当前版本和受支持运行时；`safe-contract.js` 从它派生协议常量，并导出闭合的 `SAFE_CONTRACT_MANIFEST` 与 SHA-256 `SAFE_CONTRACT_DIGEST`。Digest 用于精确标识权限/能力面，不会暗中改变 Safe Contract v2 语义，也不会给 Receipt v4 增加字段。

Native runtime 明确只支持：

- Node 22 LTS：**>=22.22.2 <23**
- Node 24 LTS：**>=24.19.0 <25**

CI 在 Linux、Windows、macOS 上验证两个精确基线，不再用 `>=22` 隐式承诺未测试的奇数/未来 Node major。

## 职责边界

Core 负责 Codex capability probe/调用、进程生命周期、本地 Git 通用原语、Semantic Context、coverage-preserving Review Evidence Chunking、Policy Schema v3、确定性 Review Rules、指纹以及 Receipt 校验与 provenance。`core-ownership-manifest.json` 固化这条边界。产品仓库只负责 Commit、Review 或 GitLab Service 领域行为，不得自行维护 Core 已拥有的实现。

PR/MR Narrative、GitHub Pull Requests Provider、Compare URL、GitHub Fork Topology 以及 SCM 侧 PR/MR 创建明确不属于 Core。

## Safe Contract v2

要求 `--ask-for-approval never`、`exec --json`、ephemeral、忽略用户/仓库 Codex 规则、read-only sandbox、Structured Output，并显式关闭 shell/unified exec、web search、apps、multi-agent、plugins、hooks、goals、memories 与 dependency install。缺少能力直接 fail closed，不提供 legacy fallback。

每日 Codex CLI Canary 在 Linux/Windows/macOS 检查最新上游 CLI 并记录 Safe Contract digest；配置受保护 OpenAI 凭据时，还会真实尝试被禁止的文件写入与 loopback network side effect，任一成功即失败。永久 adversarial corpus 验证仓库/模型中的恶意指令不能改变 Safe Contract argv。

## Policy Schema v3

仓库策略文件只有 `.codex-safe.json`。旧 Policy Schema 明确拒绝。当前 closed schema 只包含 Commit、Review、Review Service 三个 section；原 `pr` section 直接拒绝，不保留兼容表面。

## Receipt v4 provenance

Review/Commit Receipt 是闭合 v4 Contract，记录协议版本、requested/resolved model identity、Codex CLI version、immutable Git subject/evidence fingerprint 与 verdict metadata。Receipt 是 AI Workflow provenance，不是人工批准、构建或测试证据。

Core 4.x 的 Trust Root 治理强化**不改变 Receipt v4 schema**。Safe Contract / execution digest 作为独立机器身份存在，只有未来显式升级 Receipt major 时才可进入 Receipt 字段。

## 确定性边界

Git evidence identity、Policy evaluation、Receipt validation、coverage/readiness/mechanical gate、severity/confidence filtering 与 stale publication rejection 都是确定性逻辑。模型 wording/findings 属于非确定性输入，不能绕过 schema validation、evidence binding 或 deterministic gate。

## Family 治理

- **Family Compatibility：** 每周/手动在 Linux、Windows、macOS 重放 Family Golden Corpus，验证三个活跃 Consumer 精确 pin 当前 Core、检查是否重新实现 Core-owned primitive，并运行各自 CI。
- **Family Manifest Attestation：** coordinated repin 后生成 `FAMILY_MANIFEST.json`，记录精确 Core/Consumer SHA、协议/运行时身份和 manifest digest，并生成 GitHub build provenance。
- **Codex CLI Canary：** 每天/手动使用最新上游 Codex CLI，在三平台检查 Safe Contract 必需能力；有受保护凭据时执行 live negative behavior check。
- **Adversarial Corpus：** 持续覆盖 prompt injection、工具提权、网络/文件系统诱导等输入。
- **Performance Budget：** 使用宽松回归预算阻止数量级退化，不使用脆弱微基准。
- **OpenSSF Scorecard：** 持续安全回归信号。
- **Release Supply Chain：** trusted reusable publication workflow、Node 22/24 release gate、可复现 npm package、immutable tag/assets、SHA-256、SPDX SBOM、GitHub build provenance attestation 与消费侧验证。

## 开发

```bash
git submodule update --init --recursive
npm run ci
```

使用 `core-contract.json` 中受支持的 Node 22/24 LTS 区间。

## 版本治理

Core Major 是实现/产品族协议边界；各协议版本独立，只在自身语义变化时升级。Receipt/Core breaking change 必须硬切所有活跃 Consumer，不维护永久兼容层。

## 安全

见 [SECURITY.md](SECURITY.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 与 [VERIFY_RELEASE.md](VERIFY_RELEASE.md)。核心原则：**AI 输出永远是不可信数据，不能获得修改 Git、执行任意命令、绕过安全能力或直接产生 Provider 副作用的权限。**

## License

MIT
