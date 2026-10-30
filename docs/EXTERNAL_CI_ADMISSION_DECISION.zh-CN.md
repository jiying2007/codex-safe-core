# 私有仓库免费 CI 与受保护发行的分级治理决策草案（未生效）

> 状态：仅供独立安全审读与决策。**不改变当前 Core 发行门禁**。关联 [Core #91](https://github.com/jiying2007/codex-safe-core/issues/91)、[Service #117](https://github.com/jiying2007/codex-review-service/issues/117)、[Service PR #118](https://github.com/jiying2007/codex-review-service/pull/118)。

## 问题，不应混为一谈的三种资格

1. **开发阶段可测试**：可信隔离 Runner 执行某个 exact SHA 的代码测试；测试的退出码、原始日志摘要可重验。这可以在没有 GitHub Actions Runner 或私仓 Ruleset 的情况下实现。
2. **仓库合并受保护**：GitHub 原生 Ruleset/Branch Protection 强制要求非作者审核、required CI Gate、限制直接 push 与 force push。这属于**服务端合并控制**，不是测试报告，也不能由 PR 自带脚本自动创造。
3. **生产发行受保护**：独立发行端验证代码、测试、审核、凭据、镜像摘要和不可变交付物，拒绝无授权部署。即使没有 GitHub 原生强制合并规则，也能对**本发行端**实施约束，但无法阻止仓库拥有者绕开此发行端修改未保护的 main 或经其他途径部署。

当前私有 `jiying2007/codex-review-service` 的 Rulesets API 明确拒绝，提示需要符合条件的付费计划或将仓库公开，且 `main.protected=false`；Actions 历史运行存在 20 个 Job 在无 Runner/无 Steps 时失败。**不能**因此把代码认定为失败，或将 PR comment、模拟 receipt、未执行的 GitHub Check 记为成功。

## 有界免费开发通道（无需修改 Core 治理合同）

- 保留私有 GitHub Repo 和普通 PR。对低风险变更由隔离临时环境运行当前 SHA 的语法、单测、数据库迁移等**真实**离线检查。
- 隔离 Runner **不部署在 192.168.1.22 旧生产服务器**。无 GitHub 写凭据、私有 GitLab API Token、现网 SQLite、模型 Key、Codex 登录态。对不可信 PR 代码禁用到模型 Provider 的网络路径；环境变量清空**不能**替代真实 OS/容器隔离。
- 原始测试日志、退出码、SHA256 和 Git commit 由独立 CI 负责人按固定来源签发。可选 `Ed25519` 工具独立于产品运行；签名私钥与审核私钥须在不同受保护主体中保管，公钥信任根由管理员安装在源仓库之外。
- 开发 Evidence 只证明有受信任的执行者对特定 SHA 作出了声明，**不使 GitHub PR Check 变绿、不自动准许合并、不修改 Core 发行资格**。完整测试仍需真实在支持 Node 22.22.2/24.19.0、Ubuntu/Windows/macOS 及相应 GitLab CE 环境执行。

## 对正式发行，必须保留的独立条件

| 证据层 | 最低内容 | 不能由什么替代 |
| --- | --- | --- |
| 提交身份 | 来源仓库、完整 Git SHA、Core pin、产品版本和受信任作者身份 | PR 标题、工作树自报 |
| 功能与恢复 | 有界测试、数据库迁移、当前 HEAD 真实回归、HIL/Provider 完整性 | 只有语法检查的 PASS |
| 安全 | 实际依赖审计、CodeQL/SARIF、凭据边界、Webhooks、状态写入 CAS | 随意新建名叫 security 的空日志 |
| 审核 | 非作者独立审读、签名与 CI 凭据绑定、可撤销的签发主体 | 作者自审、GitHub owner bypass |
| 供应链 | 完整 OCI 镜像 digest、SBOM/provenance、不可变 release assets | 可变 tag、未核验镜像 |
| 生产实机 | 双 GitLab API/Hook/回写、旧 SQLite 在线备份、停旧 Writer、Schema 迁移/回滚和通知 | CI 模拟、手工「完成」评论 |

若独立受控的发行端提供实际强制控制，可以保护**该发行通道**，但与 GitHub 原生 Ruleset 的安全效果并不等价。失去 GitHub 保护意味着 main 仍可被有权限主体直接修改，因此**只有已安装的独立发布端、独立签发角色及额外源锁定**可信时，才可以考虑接受。未经安全审核不得让该通道替换现有六仓 RuleSet 核验。

## 选项与待批准决策

**方案 A（当前可直接执行，免费）**：仅启用受信任、隔离的外部 CI 作为开发证据来源；原 Core `repository-governance-contract.json` 六仓与 Trusted Release 不变。CI 不能启动时开发任务可继续，发行继续保持阻断。优先推荐。

**方案 B（待安全设计/签审）**：对唯一私有 Service 增加版本化 `publisher-attested-private` 治理能力。它要求独立于仓库的强制发行服务、实体/密钥角色隔离、授权撤销、基线保护与回滚。必须新建正式 v2 治理合同、迁移测试和正反面安全证据；明示「publisher gate 仅保护指定发行通道，不保护 GitHub main」。公开五仓继续要求原生 Ruleset。**未批准前不实施/不调用它**。

**方案 C（可选，付费）**：将私有仓库提升到支持原生 Ruleset 的计划，恢复 GitHub 服务器端强制审批。是否值得购买由管理员决定，购买也不能替代真实 Runner/test 及完整发布资格。

## 强制不变项与执行顺序

- 保留 Service Private 属性，绝不为了免费 Ruleset 而公开私有源码。
- 当前 [Core #85](https://github.com/jiying2007/codex-safe-core/issues/85) 私仓 read secret 仍是独立阻断；不能把临时外部 CI 证据冒充 Family read/upgrade Token 权限。
- 当前 [Service #113](https://github.com/jiying2007/codex-review-service/pull/113)、[#116](https://github.com/jiying2007/codex-review-service/pull/116)、[#114](https://github.com/jiying2007/codex-review-service/issues/114) 原生状态回写、Schema 11、final-ref 边界不能绕过；双 GitLab 不能同时写旧 SQLite。
- 现有 CodeQL、CI Gate、主线保护和不可变发行资产继续按原契约验收，任何失败都保留。
- 2026-10 内继续禁用 Codex Cloud/CLI、ChatGPT Work 以及消耗共享额度的 Provider 真实审查；可以用免费开源工具和无模型离线测试。
- 所有方案的启用均以正式审核/明确独立授权为条件。草案本身、PR 合并、或者某条外部日志的签名，均不代表生产已上线或可信发行。

**本文件不是生产发布策略变更，也没有更改任何现行 Ruleset、秘密、合并或发行脚本。**
