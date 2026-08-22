# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 **Codex Safe Git Workflow** 产品族的唯一共享安全/运行时内核：

- [Codex Review Safe](https://github.com/jiying2007/codex-review)
- [Codex Commit Safe](https://github.com/jiying2007/codex-commit)
- [Codex PR Safe](https://github.com/jiying2007/codex-pr)

当前协议线：**Safe Core v2 / Safe Contract v2 / Policy Schema v2 / Receipt Schema v2**。

## 消费方式

三个插件以**固定 commit 的 Git submodule**方式使用本仓库，路径统一为 `src/codex-safe-core`。

```text
codex-safe-core commit
        ↓ 160000 gitlink
Review / Commit / PR 源码
        ↓ 产品 build
production dist/
        ↓
VSIX
```

不再存在 copied vendoring、`safe-core.lock.json`、逐字节 sync/upstream workflow、runtime npm dependency 或跟踪 `main` 的 submodule 配置。

**gitlink 本身就是版本锁。** 升级 Core 必须显式移动 submodule commit，并重新跑完整产品门禁。

## 公开 Runtime API

仓库根目录就是 v2 的公开运行时边界：

- `index.js`
- `safe-contract.js`
- `codex-cli.js`
- `process-runner.js`
- `git-repository.js`
- `context-builder.js`
- `policy.js`
- `codex-safe.schema.json`

v2 不提供 `src/` 兼容代理。

## 所有权边界

Core 只拥有跨产品基础设施。

### Codex Runtime

- CLI capability probe；
- executable resolution；
- fail-closed 安全 argv；
- 临时目录执行；
- JSONL / Structured Output 处理。

### Process Runtime

- 原生进程启动；
- Windows script 处理；
- cancellation；
- timeout；
- process-tree termination；
- stdout/stderr 限制。

### Git Primitives

- 通用 Git 命令；
- HEAD/index snapshot；
- raw-index fingerprint；
- staged diff / changed paths；
- 通用仓库原语。

### Semantic Context

- 按文件解析 unified diff；
- source/generated/binary 分类；
- generated/lock/binary metadata-only；
- source 文件公平预算；
- 大文件受控上下文。

### Policy Protocol

- 唯一策略文件 `.codex-safe.json`；
- `schemaVersion: 2`；
- `commit` / `review` / `pr` 三个 section；
- 只读 HEAD；
- 顶层 closed schema；
- 稳定 fingerprint。

### Receipt Contract

- Review Receipt v2 校验；
- Commit Receipt v2 校验；
- canonical fingerprint helper。

产品仓库只保留领域逻辑：

- **Review：** finding、confidence/severity、diagnostics、report、review workflow；
- **Commit：** Conventional Commit policy、scope intelligence、repository style、rendering、Receipt persistence/range binding；
- **PR：** Base/Fork 语义、PR narrative、provider、preview、provenance 展示。

产品仓库不得再独立实现 Core 已拥有的 Process、Codex runtime、Semantic Context 或 Policy contract。

## 不可妥协的安全契约

Safe Codex execution 要求 CLI 具备：

- `--ask-for-approval never`
- `exec --json`
- `--ephemeral`
- `--skip-git-repo-check`
- `--ignore-user-config`
- `--ignore-rules`
- `--sandbox read-only`
- `--output-schema`
- 明确的 Safe Core `--config` overrides

Safe Core 会关闭 shell/unified exec、shell snapshot、web search、apps、multi-agent、remote plugin、hooks、goals、memories、skill dependency install 等能力。

必要 flag/config capability 缺失或被 CLI 拒绝时直接 fail closed。**不存在 v1/legacy fallback。**

## Semantic Context Budget

`buildSemanticContext()` 不使用全局 `diff.slice(0, N)`。

它按文件处理 unified diff：

```text
unified diff
    ↓ per-file blocks
分类
    ├ source → 公平预算 → 受控 block context
    ├ generated/lock → 仅元数据
    └ binary → 仅元数据
```

消费产品会另外保留完整原始 diff，用于 fingerprint/provenance；Context Budget 只影响模型输入。

## Policy v2

唯一仓库策略示例：

```json
{
  "$schema": "https://raw.githubusercontent.com/jiying2007/codex-safe-core/d49dc356824b984166e81e42bb5f9d7abfb90099/codex-safe.schema.json",
  "schemaVersion": 2,
  "commit": {},
  "review": {},
  "pr": {}
}
```

旧产品专属 v1 策略文件故意不兼容。

## Receipt v2

Review Receipt v2 将 Review evidence 绑定到 HEAD/index/diff/policy fingerprint。

Commit Receipt v2 将生成 evidence 绑定到 parent HEAD/index/完整 diff/最终 Commit Message/policy，以及可选 Review Receipt fingerprint。Receipt 的持久化由产品层负责，但 shape 与 fingerprint semantics 由 Core 统一校验。

Receipt v1 在 v2 下直接无效。

## 开发

```bash
npm test
npm run check
```

要求 Node.js 22+。

产品仓构建前需初始化 submodule：

```bash
git submodule update --init --recursive
```

## 版本策略

Safe Core major version 就是协议边界。安全、Policy、Receipt 的 breaking change 必须提升 major，并由消费者硬切换。不同 major 之间不维护永久 compatibility shim。

## 安全原则

详见 [SECURITY.md](SECURITY.md) 和 [ARCHITECTURE.md](ARCHITECTURE.md)。

核心原则：**AI 输出始终是不可信数据，不得获得修改 Git、执行任意命令、绕过必要安全能力或制造远端副作用的权限。**

## License

MIT
