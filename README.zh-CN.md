# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 Codex Safe 产品族唯一的**安全运行时与协议核心**。它是产品族内部基础组件，不是面向最终用户独立安装使用的应用。

| 产品 | 面向用户的职责 |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | 在 VS Code 中审查 staged changes |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | 生成并校验 Conventional Commit Message |
| [Codex PR Safe](https://github.com/jiying2007/codex-pr) | 根据已提交变更生成 PR 标题/正文 |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | 自托管 GitLab MR 审查执行服务 |

当前协议线：**Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contract v1**。

## 我应该使用哪个仓库？

如果目标是代码审查、生成 Commit Message、生成 PR 文案或部署 GitLab 自动审查，请直接安装/部署上表中的对应产品。只有在开发 Codex Safe Family 本身、升级共享 runtime/protocol 或协调 repin 时，才需要直接操作本仓库。

详见 [Consumer Guide](docs/CONSUMER_GUIDE.zh-CN.md) 与 [SUPPORT.md](SUPPORT.md)。

## 使用模型

Consumer 统一以 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit。gitlink 就是版本锁；不复制 runtime、不跟随分支、不通过 npm runtime dependency，也不保留兼容代理。

```bash
git submodule update --init --recursive
npm run ci
```

Core 变更只有在四个 Consumer 都 coordinated-repin 到同一个已审核 Core commit，并通过各自 CI 后才算完成。

## 职责边界

Core 负责 Codex capability probe/调用、进程生命周期、本地 Git 通用原语、Semantic Context、coverage-preserving Review Evidence Chunking、Policy Schema v3、确定性 Review Rules、指纹以及 Receipt 校验与 provenance。产品仓库只负责 Commit、Review、PR 或 GitLab Service 领域行为，不得自行维护 Core 已拥有的实现。

## Safe Contract v2

要求 `--ask-for-approval never`、`exec --json`、ephemeral、忽略用户/仓库 Codex 规则、read-only sandbox、Structured Output，并显式关闭 shell/unified exec、web search、apps、multi-agent、plugins、hooks、goals、memories 与 dependency install。缺少能力直接 fail closed，不提供 legacy fallback。

## Policy Schema v3

仓库策略文件只有 `.codex-safe.json`。旧 Policy Schema 明确拒绝。Commit、Review、Review Service 和 PR 使用同一个 closed schema 的不同 section。

## Receipt v4 provenance

Review/Commit Receipt 是闭合 v4 Contract，记录协议版本、requested/resolved model identity、Codex CLI version、immutable Git subject/evidence fingerprint 与 verdict metadata。Receipt 是 AI Workflow provenance，不是人工批准、构建或测试证据。

## 确定性边界

Git evidence identity、Policy evaluation、Receipt validation、coverage/readiness/mechanical gate、severity/confidence filtering 与 stale publication rejection 都是确定性逻辑。模型 wording/findings 属于非确定性输入，不能绕过 schema validation、evidence binding 或 deterministic gate。

## Family 治理

- **Family Compatibility：** 每周/手动在 Linux、Windows、macOS 重放 Family Golden Corpus，验证四个 Consumer 精确 pin 当前 Core 并运行各自 CI。
- **Codex CLI Canary：** 每天/手动使用最新上游 Codex CLI，在三平台检查 Safe Contract 必需能力。
- **Performance Budget：** 使用宽松回归预算阻止数量级退化，不使用脆弱微基准。
- **OpenSSF Scorecard：** 持续安全回归信号。
- **Release Supply Chain：** immutable tag/assets、SHA-256、SPDX SBOM、GitHub build provenance attestation 与消费侧验证。

## 开发

```bash
git submodule update --init --recursive
npm run ci
```

要求 Node.js 22+。

## 版本治理

Core Major 是实现/产品族协议边界；各协议版本独立，只在自身语义变化时升级。Receipt/Core breaking change 必须硬切所有 Consumer，不维护永久兼容层。

## 安全

见 [SECURITY.md](SECURITY.md)、[ARCHITECTURE.md](ARCHITECTURE.md) 与 [VERIFY_RELEASE.md](VERIFY_RELEASE.md)。核心原则：**AI 输出永远是不可信数据，不能获得修改 Git、执行任意命令、绕过安全能力或直接产生 Provider 副作用的权限。**

## License

MIT
