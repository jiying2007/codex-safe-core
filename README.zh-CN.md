# Codex Safe Core

[English](README.md) | [简体中文](README.zh-CN.md)

Codex Safe Core 是 Codex Safe Family 唯一的**安全运行时与协议核心**。它是产品族内部组件，**不是面向最终用户独立安装使用的应用**。

| 产品 | 面向用户的职责 |
| --- | --- |
| [Codex Review Safe](https://github.com/jiying2007/codex-review) | 在 VS Code 中审查 staged changes |
| [Codex Commit Safe](https://github.com/jiying2007/codex-commit) | 生成并校验 Conventional Commit Message |
| [Codex Change Safe](https://github.com/jiying2007/codex-pr) | GitHub/GitLab 交付授权与 Merge Readiness |
| [Codex Review Service](https://github.com/jiying2007/codex-review-service) | 服务端 GitLab MR 审查、发布、门禁与审计 |
| [Codex Diagnose Safe](https://github.com/jiying2007/codex-diagnose) | 对 CI/Build/Test 失败做有界诊断并生成 Diagnosis Receipt v2 |

**Codex PR Safe 已退役。** 旧的模型生成 PR 描述产品不会恢复。**Codex Change Safe** 是确定性后继产品，默认**模型调用为 0**。

## 当前机器契约

`core-contract.json` 是当前状态唯一机器真相源：

- Safe Core v4 / Safe Contract v2 / Policy Schema v4；
- Review Receipt v5 / Commit Receipt v4 / Diagnosis Receipt v2；
- Review、Commit、Diagnose Prompt Contract v1；
- Codex Runtime v3 / Provider Contract v3；
- Model Routing / Registry / Lineage / Economics v1；
- Family Snapshot v3 / Family Manifest v5 / Product Contract v2；
- Consumer CI Receipt v1 / Core Digest Contract v1 / Repository Governance Contract v1；
- Node 22 >=22.22.2 <23 或 Node 24 >=24.19.0 <25。

安全/运行时 Breaking Change 必须 coordinated hard switch；不维护永久 Compatibility Shim。

## 使用模型

每个活跃 Consumer 都通过 `src/codex-safe-core` Git submodule 固定到一个**正式发布的精确 Core Commit**：

```bash
git submodule update --init --recursive
git -C src/codex-safe-core rev-parse HEAD
```

不支持 branch tracking、复制 Runtime、npm Runtime Dependency 或 Compatibility Proxy。

## Runtime / Governance 身份

Core Digest Contract v1 分离两个密码学身份：

- `runtimeDigest` 覆盖 Runtime Module、`codex-safe.schema.json` 与 runtime-relevant machine-contract fields；
- `governanceDigest` 覆盖 Workflow、Test、Quality Corpus、Docs 与 Release/Orchestration Governance。

Consumer 永远保留一个精确 Core SHA Pin。只有两个正式 released Core 的 `runtimeDigest` 完全相同，旧 Pin 才能与更新 Core 判定为 Runtime-Compatible；Digest 不同必须 Consumer Patch Release。这避免纯 Governance Core Release 强制五个字节完全相同的产品重发，同时不削弱 exact-pin 审计。

Product Contract v2 绑定 `safeCoreCommit`、`safeCoreRuntimeDigest` 与 `safeCoreGovernanceDigest`。

## Runtime / Provider Contract v3

Review、Commit、Diagnose、Review Service 可以共享机器级 `~/.codex-safe/runtime.json`。解析顺序是产品 Override → Family Runtime → 用户 Codex Config → 内置 OpenAI；仓库内 Codex 配置绝不参与 Provider Routing。

Compatible Provider 使用 Secret-by-reference 的 `credentialSource=auto|env|auth-json`。Secret 只注入 Codex 子进程环境，不进入 argv、Settings、Receipt 或诊断日志。HTTPS 为首选；机器所有的私网 HTTP 只能在有界 Transport Contract 下继承，并必须明确显示明文风险。

## Policy Schema v4

唯一仓库策略是 committed `.codex-safe.json`，闭合 section 为：

- `review`：Review Safe；
- `commit`：Commit Safe；
- `change`：Change Safe 的确定性交付要求；
- `reviewService`：Review Service。

退役的 `pr` Prompt/Narrative Surface 继续拒绝。Change Safe 不恢复模型生成 PR/MR Narrative。

## Model Routing 与 Token 效率

Model Routing Contract v1 使用稳定的 `fast` / `balanced` / `deep` 执行意图与 `scout` / `reviewer` / `adjudicator` Authority Role。具体模型世代只属于机器/管理员 Registry，不进入 Repository Policy。

自动 Routing 只选择 approved eligible model。Model Evidence 绑定 canonical `registryDigest` 与 `routingPolicyDigest`、resolved provider/model/revision、Qualification identity、fallback/degradation 与规范化 Usage。Cross-provider fallback 默认关闭，除非机器/管理员显式开启。

Token Estimator Calibration 只保存 provider/model 数值 Observation。每个模型独立的 `lastObservedAtMs` 决定 TTL；机器文件使用有界 no-follow read、owner/permission 校验、lock/merge-on-write 与 atomic mode-0600 replacement。Prompt、源码、Finding、Judgment、Credential 永远不是 Calibration Data。

Model Economics 以质量约束为前提，并按 Mode、Role、Provider、Model、Profile Pack、Repo-size bucket 分层。Promotion 必须使用真实 Corpus Result，并满足最小总样本数/critical 样本数。历史 Recorded Baseline 是回归证据，不代表“模型普遍达到 100%”。

## Judgment 与 Evidence 边界

AI 输出永远是不可信数据。Git Identity、Policy Evaluation、Receipt Validation、Coverage/Readiness Gate、Review Evidence Manifest Identity、Model Routing Evidence、Family Snapshot 与 Release Authorization 都保持确定性。

Structural Review Evidence 可以缓存；持久化 Model Judgment 不能被当成新的 Judgment。只有 Fresh Inference 才创建 Review Receipt；有界 Result Replay 不创建 Fresh Provenance。

## Family Evidence 与发行链

Family Registry v1 定义活跃 Topology。Family Snapshot v3 冻结：

- 最新 exact immutable Core Release 与两个 Core Digest；
- 每个 exact Consumer Release；
- 每个 Consumer 实际 pinned Core SHA/digests；
- Consumer CI Receipt v1；
- Marketplace/GHCR/GitHub Release 所需 Distribution Evidence。

Family Manifest v5 绑定 Snapshot、Product Contract/package-lock Digest、Protocol/Runtime Identity 与 Distribution Evidence，再执行 GitHub build-provenance attestation 和 digest-addressed immutable publication。

普通 Family Compatibility 信任 immutable Consumer CI Receipt，只运行一次 Ubuntu cross-family validation；完整 5 Consumer × Linux/Windows/macOS 矩阵保留为每周或显式 `full_matrix=true` 审计。

Runtime-changing Core Upgrade 使用两阶段事务：先准备全部需要的 Consumer PR 并等待所有 CI 通过；再冻结 PR Head 并只合并这一组已验证 Head。Runtime-equivalent Consumer 记录为 skipped。Release、Distribution、CI Receipt 全部收敛后，Family Freshness 才能完成。

## Family SCM UI

VS Code SCM 一级顺序固定为 **Review → Commit → Change**。`family-ui-contract.json` 是主工具栏契约的机器真相源。

## Repository Governance

`repository-governance-contract.json` 定义六个 Family Repository 的服务器侧 GitHub Ruleset Baseline：PR-based changes、strict required checks、Review Requirement、禁止 deletion/non-fast-forward、限制 bypass。`scripts/verify-repository-ruleset.js` 审计 GitHub Live State；仓库内测试不能替代服务器侧门禁。

## Supply Chain

GitHub Actions 使用 Full-SHA Pin。Trusted Release 校验受支持 Node Floor、可复现 Package、Immutable Tag/Release、SHA-256、SPDX SBOM 与 GitHub Build Provenance。Core Release 额外发布 attested `CORE_DIGESTS.json`；Consumer Release 发布 attested `CONSUMER_CI_RECEIPT.json`。

## 验证

```bash
npm run ci
```

服务器侧 Repository Governance 验证：

```bash
npm run check:repository-governance
```

详见 [ARCHITECTURE.md](ARCHITECTURE.md)、[SECURITY.md](SECURITY.md)、[Consumer Guide](docs/CONSUMER_GUIDE.zh-CN.md)、[Quality Platform](docs/QUALITY_PLATFORM.zh-CN.md) 与 [GitHub Governance](docs/GITHUB_GOVERNANCE.md)。

## 用户可见时区

机器可读 Receipt/Evidence 保持 canonical UTC。用户可见时间跟随 Runtime 时区或 `CODEX_SAFE_DISPLAY_TIME_ZONE`；展示时区永远不参与 Fingerprint 或 Evidence Digest。

## License

MIT
