# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 Codex Safe 产品族唯一的**安全运行时与协议核心**：

- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)
- [Codex Review Service](https://github.com/jiying2007/codex-review-service)

当前协议线：**Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contract v1**。

## 使用模型

Consumer 通过 Git submodule 固定到明确的 Core commit。gitlink 就是版本锁；不复制 runtime、不跟随分支、不通过 npm 运行时依赖，也不保留兼容代理。

## 职责边界

Core 负责 Codex capability probe/调用、进程生命周期、本地 Git 通用原语、Semantic Context、coverage-preserving Review Evidence Chunking、Policy Schema v3、确定性 Review Rules、指纹以及 Receipt 校验与 provenance。产品仓库只负责 Commit、Review、PR 或 GitLab Service 的领域行为，不得自行维护 Core 已拥有的实现。

## Safe Contract v2

安全执行协议继续保持 v2：要求 `--ask-for-approval never`、`exec --json`、ephemeral、忽略用户/仓库 Codex 规则、read-only sandbox、Structured Output，并显式关闭 shell/unified exec、web search、apps、multi-agent、plugins、hooks、goals、memories 与 dependency install。缺少能力直接 fail closed，不提供 legacy fallback。

## Policy Schema v3

仓库策略文件只有 `.codex-safe.json`。旧 Policy Schema 明确拒绝。Commit、Review、Review Service 和 PR 使用同一个闭合 Schema 的不同 section。

## Receipt v4 provenance

Review/Commit Receipt 是闭合的 v4 Contract。Core 统一规范并记录：

- Safe Core / Safe Contract / Policy Schema / Prompt Contract 版本；
- requested/resolved model identity；
- Codex CLI version；
- immutable Git subject/evidence fingerprint 与 verdict metadata。

Receipt v3 明确不兼容。Receipt 只是 AI Workflow provenance，不是人工批准、构建或测试证据。

## 确定性边界

Git evidence identity、Policy evaluation、Receipt validation、coverage/readiness/mechanical gate、severity/confidence filtering 与 stale publication rejection 都是确定性逻辑。模型生成 wording/findings 属于非确定性输入，不能绕过 schema validation、evidence binding 或 deterministic gate。

## Family 治理

- **Family Compatibility：** 每周/手动在 Linux、Windows、macOS 验证 Commit、Review、PR、Review Service 都固定当前 Core 并通过各自 CI。
- **Codex CLI Canary：** 每天/手动使用最新上游 Codex CLI，在三平台检查 Safe Contract 必需能力。
- **OpenSSF Scorecard：** 作为持续安全回归信号。
- **Release Supply Chain：** immutable tag/assets、SHA-256、确定性 SPDX 2.3 SBOM 和 GitHub build provenance attestation。

## 开发

```bash
npm run ci
```

要求 Node.js 22+。

## 版本治理

Core Major 是实现/产品族协议边界；各协议版本独立，只在自身语义变化时升级。Receipt/Core breaking change 必须硬切所有 Consumer，不维护永久兼容层。

## 安全

见 [SECURITY.md](SECURITY.md) 与 [ARCHITECTURE.md](ARCHITECTURE.md)。核心原则：**AI 输出永远是不可信数据，不能获得修改 Git、执行任意命令、绕过安全能力或直接产生 Provider 副作用的权限。**

## License

MIT
