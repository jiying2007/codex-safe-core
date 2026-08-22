# Codex Safe Core

[English](README.md) | 简体中文

Codex Safe Core 是 Codex Safe Git 工作流产品族的唯一共享安全/运行时内核：

- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)

## 设计契约

Core 只负责跨产品不变量，不承载具体产品业务：

1. **Codex 能力 Fail Closed 探测**：安全参数缺失时直接拒绝，不做降级兼容。
2. **只读、临时、结构化 Codex 执行**：默认关闭 Shell、网络搜索、Apps、Hooks、Memory、Multi-agent、用户规则和用户配置。
3. **加固的子进程生命周期**：限制输出、超时、取消，并在 Windows/POSIX 上终止进程树。
4. **通用 Git 原语**：仓库快照、staged/branch diff、fingerprint，不包含产品策略。
5. **版本化 Receipt/Contract**：Review/Commit provenance 必须经过 schema/semantic validation 才能消费。
6. **语义 Context Budget**：优先保留源码变更，生成文件、锁文件、二进制文件只保留元信息。

以下内容继续留在各产品仓库：Commit 的 scope/style intelligence、Review 的 finding/report、PR 的 provider/UI。

## 消费模式

三个扩展仓库采用固定版本源码 vendoring，并在 `safe-core.lock.json` 中记录 canonical upstream。运行时不引入 npm 依赖，保证 VSIX 可离线构建和审计。

更新流程：

```text
上游 release/commit
      ↓
复制 manifest 声明的 runtime files
      ↓
更新 lock 与 hashes
      ↓
消费仓库 CI 校验逐字节一致
```

任何安全能力缺失都禁止 compatibility fallback。

## 开发

```bash
npm test
npm run check
```

开发和 CI 使用 Node.js 22+。

## 安全原则

AI 输出始终是不可信数据，不得获得修改 Git、执行 Shell 或绕过安全能力检查的权限。详见 [SECURITY.md](SECURITY.md)。
