# Codex Safe Core Consumer Guide

Codex Safe Core 只由 Codex Safe Family 产品消费，不是独立 CLI 或终端用户应用。

## 唯一支持的消费模型

每个产品都通过 `src/codex-safe-core` Git submodule 固定到一个明确 Core commit：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

禁止 branch tracking、复制 runtime、npm runtime dependency 或兼容代理。

当前机器契约由 `core-contract.json` 管理：**Safe Core v4 / Safe Contract v2 / Policy Schema v3 / Review Receipt v4 / Commit Receipt v4 / Prompt Contract v1**。Consumer 只支持 Node 22 >=22.22.2 <23 或 Node 24 >=24.19.0 <25。

## 协调升级 Core

1. 合并经过审核的 Core 变更并记录精确 SHA。
2. Review、Commit、PR、Review Service 同步 repin 到该 SHA。
3. `.codex-safe.example.json` 的 schema URL 同步 pin 到相同 SHA。
4. 运行四个 Consumer 各自完整 CI。
5. 全部通过后再合并 Consumer。
6. 最后运行 Family Compatibility，确认所有 Consumer 与 canonical Core HEAD 一致。
7. 要求生成的 `FAMILY_BASELINE.json` 中四个 Consumer 都精确 pin 同一 Core SHA，并保留对应 GitHub provenance attestation。

仅治理/文档类 Core 维护不要求 Consumer 强制升级产品版本；只有产品/runtime 语义变化才需要版本发布。但 gitlink 仍必须协调 repin，因为它就是产品族 Trust Root 锁。

## 职责边界

`core-ownership-manifest.json` 记录 Core-owned primitive。Consumer 必须消费这些实现，不能自行声明独立的 Process/Codex/Policy/Receipt/Review-Evidence 原语。Family Compatibility 在接受 baseline 前会运行 ownership boundary linter。

Provider adapter、SQLite/outbox、通知、部署、增量审核持久状态与产品领域 orchestration 继续属于对应产品，不进入 Core。

## Token、效率与质量契约

Core v4.3 统一拥有全产品族通用的成本感知执行原语：

- 统一解析 Codex JSONL 中 input、cached-input、cache-write、output、reasoning-output Token；
- 统一使用保守 Token 估算，并支持在启动 Codex 进程前 fail-closed preflight；
- 确定性证据风险评分、自适应预算、低风险模型路由，其中动态预算只允许缩小，绝不突破有效上限；
- 按风险优先的总字节预算选择；任何被预算遗漏的证据都必须显式暴露，不能静默宣称完整；
- 为存在并发模型任务的产品提供进程内 Token Reservation Ledger；
- `runStructuredCodex()` 统一返回 usage、request estimate 和 duration，消费者不再自行重复解析。

Consumer 只负责自己的策略值和领域行为：Commit 优化 staged semantic context，Review 优化审核 chunk，PR 优化描述生成，Review Service 负责项目日预算持久化与增量状态。Consumer 不得复制 Core 的 usage 解析、Token 估算或 reservation 实现。

效率必须服从正确性：只要预算导致证据遗漏，就必须显式降级 coverage；不得为了省 Token 把 incomplete 结果包装为成功质量结论。

## Safe Contract 身份

Safe Contract v2 同时拥有语义版本与机器 digest：

- `SAFE_CONTRACT_MANIFEST`：闭合的权限/能力声明；
- `SAFE_CONTRACT_DIGEST`：该 manifest 的 SHA-256。

Digest 用于精确证据，不替代语义协议版本。Receipt v4 保持闭合，不通过 maintenance release 偷加 digest 字段。

## 验证

```bash
npm run ci
```

Core CI 覆盖 contract/runtime 身份、确定性 Review Rules、adversarial safety fixtures、Family Golden Corpus、Token/成本 Planner、宽松性能回归预算、trusted release 治理与 supply-chain canary。Family Compatibility 还会验证 Consumer 精确 pin、ownership boundary 和四个 Consumer CI，然后生成可 attestation 的 Family Baseline。
