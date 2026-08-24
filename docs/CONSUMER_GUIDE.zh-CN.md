# Codex Safe Core Consumer Guide

Codex Safe Core 只由 Codex Safe Family 产品消费，不是独立 CLI 或终端用户应用。

## 唯一支持的消费模型

每个产品都通过 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

禁止 branch tracking、复制 runtime、npm runtime dependency 或兼容代理。

## 协调升级 Core

1. 合并经过审核的 Core 变更并记录精确 SHA。
2. Review、Commit、PR、Review Service 同步 repin 到该 SHA。
3. `.codex-safe.example.json` 的 schema URL 同步 pin 到相同 SHA。
4. 运行四个 Consumer 各自完整 CI。
5. 全部通过后再合并 Consumer。
6. 最后运行 Family Compatibility，确认所有 Consumer 与 canonical Core HEAD 一致。

仅治理/文档类 Core 维护不要求 Consumer 强制升级产品版本；只有产品/runtime 语义变化才需要版本发布。

## 当前协议线

- Safe Core v4
- Safe Contract v2
- Policy Schema v3
- Review Receipt v4
- Commit Receipt v4
- Prompt Contract v1

旧协议明确不兼容，不增加 compatibility shim。

## 验证

```bash
npm run ci
```

Core CI 覆盖 contract/runtime、确定性 Review Rules、Family Golden Corpus、宽松性能回归预算、Release 治理与 supply-chain canary。
