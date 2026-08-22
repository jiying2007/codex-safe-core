# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 Codex Safe 产品族唯一的**安全运行时与协议核心**：

- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)
- [Codex Review Service](https://github.com/jiying2007/codex-review-service)

当前协议线：**Safe Core v3 / Safe Contract v2 / Policy Schema v3 / Review Receipt v3 / Commit Receipt v3**。

## 使用模型

Consumer 通过 Git submodule 固定到明确的 Core commit。gitlink 本身就是版本锁；不复制 vendored runtime、不跟随分支、不通过 npm 运行时依赖、不保留兼容代理。

## 公共运行时边界

- `index.js`
- `safe-contract.js`
- `codex-cli.js`
- `process-runner.js`
- `git-repository.js`
- `context-builder.js`
- `policy.js`
- `codex-safe.schema.json`

## 职责边界

Core 负责跨产品公共能力：Codex capability probe/可执行文件解析/Safe argv/Structured Output/JSONL，进程启动/取消/超时/进程树终止/输出边界，本地 Git 通用原语，Commit/PR 的 Semantic Context Budget，Review 产品的 coverage-preserving Review Evidence Chunking，`.codex-safe.json` Policy Schema v3，以及 Review/Commit Receipt v3 的校验与指纹。

产品只负责领域逻辑：

- **Review Safe：** staged snapshot、finding 校验与本地展示；
- **Commit Safe：** Conventional Commit、scope/style intelligence、Commit Receipt 持久化与绑定；
- **PR Safe：** Base/Fork 语义、PR narrative、Preview 与 provenance 展示；
- **Review Service：** GitLab Webhook/Provider、Projects/Groups Scope、immutable MR evidence 获取、SQLite Queue/Outbox、Merge Gate 与 Publication。

产品仓库不得再自行维护 Core 已拥有的 Codex/Process/Policy/Receipt/Review Chunk 实现。

## Safe Contract v2

Codex 安全执行协议本身没有变化，因此继续保持 v2：要求 `--ask-for-approval never`、`exec --json`、ephemeral、忽略用户/仓库 Codex 规则、read-only sandbox、Structured Output，并显式关闭 shell/unified exec、web search、apps、multi-agent、plugins、hooks、goals、memories 与 dependency install。缺少能力直接 fail closed，不提供 legacy fallback。

## Policy v3

仓库策略文件只有 `.codex-safe.json`：

```json
{
  "schemaVersion": 3,
  "commit": {},
  "review": {
    "confidenceThreshold": 0.7,
    "rules": {
      "requireTestsForCodeChanges": true,
      "codePathPrefixes": ["src/"],
      "testPathPrefixes": ["test/", "tests/"],
      "forbiddenPathPrefixes": []
    }
  },
  "reviewService": {
    "maxContextBytes": 262144,
    "maxContextFiles": 12,
    "contextLines": 20,
    "skipGeneratedFiles": true,
    "blockUnreviewableFiles": false
  },
  "pr": {}
}
```

v3 下不兼容 Policy Schema v2。

## Context 语义

`buildSemanticContext()` 用于 Commit/PR narrative，可以按公平预算缩减 source context，并把 generated/binary 内容降级为 metadata。

`buildReviewEvidenceChunks()` 用于 Review Safe/Review Service。changed hunk 不允许静默截断：要么进入有界 Review chunk，要么形成明确 coverage gap，让审核 fail closed。

## Receipt v3

Review Receipt v3 使用 subject envelope：本地审核为 `type=git-index`，绑定 HEAD/index；服务端审核为 `type=gitlab-mr`，绑定 Project/MR/start SHA/head SHA。

Commit Receipt v3 绑定提交生成证据及可选的 Review Receipt v3 fingerprint。Receipt 只是 AI Workflow provenance，不是人工批准或测试证据。

## 开发

```bash
npm run ci
```

要求 Node.js 22+。

## 版本治理

Core Major 是协议边界。Policy/Receipt/Core 的 breaking change 必须通过 Major 硬切换所有 Consumer，不维护永久兼容层。Safe Contract 拥有独立协议版本，只有 Codex 执行安全协议本身变化时才升级。

## 安全

见 [SECURITY.md](SECURITY.md) 与 [ARCHITECTURE.md](ARCHITECTURE.md)。核心原则：**AI 输出永远是不可信数据，不能获得修改 Git、执行任意命令、绕过安全能力或直接产生 Provider 副作用的权限。**

## License

MIT
