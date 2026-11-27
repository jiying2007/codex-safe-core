# Codex 全系列终态收敛｜头脑风暴与架构方案

日期：2026-11-28。状态：PROPOSED，供后续实现，不是已上线能力声明。
关联：[需求规格](requirements.md) · [执行计划](tasks.md) · [验证规范](verification.md)。

## 1. 基线与证据边界

2026-11-27/28 的 GitHub 只读检查读取以下主线快照、目录树、关键源文件、gitlink 和近期 CI。均为观察到的仓库状态，不代表重跑全部测试、现场部署或模型效果。开工时以最新 main 重新确认相关文件/PR，若已修复只验收、不重复实现。

| 仓库 | 基线 SHA | 已观测证据 |
|---|---|---|
| [codex](https://github.com/jiying2007/codex/tree/f3a559f2c688af51dd7cc5459cba25b9a6f92ad3) | f3a559f2 | Full Regression #45836613501 |
| [codex-safe-core](https://github.com/jiying2007/codex-safe-core/tree/d517dccf1e636f22fd7f9d938a5dd552a91420d3) | d517dccf | [Freshness](https://github.com/jiying2007/codex-safe-core/actions/runs/46011375756)、[Compatibility](https://github.com/jiying2007/codex-safe-core/actions/runs/46007219192)；4.18.13 |
| [codex-commit](https://github.com/jiying2007/codex-commit/tree/e6cab145c876efc5a3c762e6feda607e05e3b1b9) | e6cab145 | [CI](https://github.com/jiying2007/codex-commit/actions/runs/46004189973)、Release Integrity #46004588834 |
| [codex-review](https://github.com/jiying2007/codex-review/tree/eb85f7f23885e2eded989120870bbcb5a5000611) | eb85f7f2 | CI #46004255855、Release 4.8.17 |
| [codex-pr](https://github.com/jiying2007/codex-pr/tree/5ac82c0d862959692c8601ad4fe49b24c20d4ae9) | 5ac82c0d | CI #46004967925、Change 5.4.19 |
| [codex-review-service](https://github.com/jiying2007/codex-review-service/tree/411a577e4e56ee7a678b914035608a52dfb7f85a) | 411a577e | CI #46004663606、Service 8.0.2 |
| [codex-diagnose](https://github.com/jiying2007/codex-diagnose/tree/e9e00d00eef5ea4ac7ea014927c4fb6e3667a353) | e9e00d00 | CI #46004364868、Diagnose 1.5.9 |
| [codex-debug](https://github.com/jiying2007/codex-debug/tree/1927c0c05af4c7d6c70afd175d1245edbc8dfcce) | 1927c0c0 | CI #43615813347；development，旧 Core gitlink ac5203e1 |
| [codex-tui](https://github.com/jiying2007/codex-tui/tree/2c9a5f2a86be9b7d10b32e9f56d94b039945dcc5) | 2c9a5f2a | CI #45322296113、development qualification #45322296106；不是 Stable 现场资格 |

五个生产 Safe 消费者在该基线均锁定 d517dccf；Core #127、Commit #154 已修复 Git binary metadata/隔离，禁止重新创造同一修复。Debug 的 [MODEL_EVALUATION.md](https://github.com/jiying2007/codex-debug/blob/1927c0c05af4c7d6c70afd175d1245edbc8dfcce/MODEL_EVALUATION.md) 记录 22 历史转移、20 根因组、3 个不足证据变体；回顾性而非盲测。TUI 已有 [Lite 终态设计](https://github.com/jiying2007/codex-tui/blob/2c9a5f2a86be9b7d10b32e9f56d94b039945dcc5/docs/design/codex-tui-lite-L1.3-unified-final-20261119.md)，不重新设计一套。关联公开 [engineering-platform README](https://github.com/jiying2007/engineering-platform/blob/9ef3f129fe0fdcd6d994189f38c07178eb4bc05c/README.md) 与 [digital-worker README](https://github.com/jiying2007/digital-worker/blob/28f1c61c1de2627f1dd428c55d9e4a623abae209/README.md) 已明确退役方向，仍非已删除。未经现场核验，不披露任何私有会话、内部仓库数据或环境。

## 2. 头脑风暴（发散→质疑→收敛）

| 候选路线 | 收益 | 失败预演 | 决定 |
|---|---|---|---|
| A 现有产品继续加功能 | 上手快，已有发布链 | 维护成本、重复协议和回归面增长，缺少真实用户收益 | 拒绝 |
| B 一个 monorepo/研发平台 | 可共享运行时 | 共同故障域、所有产品同权限/生命周期，迁移和发布成本扩大 | 拒绝；仅共享真实重复的纯逻辑 |
| C 只使用原生 Codex/Git/CI | 最低维护 | 丧失 staged 精确快照、独立 GitLab、嵌入式诊断/可追溯交付边界 | 部分采用；官方能力优先 |
| D 保留专业产品，减掉重复面 | 单一权威、独立交付、专业质量 | 接口定义不清或“公共核心”无限膨胀 | 采用；限制 Core 公共接口与消费者 |
| E 全部默认多 Agent/多模型 | 可能发现不同问题 | Token 爆炸、错误相关、跨权限、虚假共识 | 拒绝默认；对高风险或实验才启用独立复审 |
| F 全部无模型 | 成本/可重复性最好 | 漏掉真实语义缺陷、复杂根因 | 用于确定性充分的行为，不强制覆盖语义任务 |

反向质疑及决策：
- 假如原生 Codex agents、review、resume、queue、doctor 已覆盖任务？在真实安装版本上先对照。TUI 若无可测跨目标收益，可进一步收缩为极薄导航甚至停用重复模块；不因已有代码而保留。Safe 若原生能力在相同证据约束下更优，可采用原生机制，但不能丢失安全和交付身份。
- 假如独立复审发现的只是同一问题？复审的用途是降低盲点/验证高风险，不是为了达到次数。真实独立发现、召回、误报、成本由分组配对实验决定。
- 假如 Core 中的统一协议没有第二个消费者？留在所属产品；现有证据字段须验证消费者与威胁后再删除。不能先增新 schema/receipt 再写使用方。
- 假如“精简”破坏线上迁移？既有部署需备份、演练、原子切换；无真实旧部署不引入兼容路径，历史保留不等于 runtime 兼容。
- 假如生产 CI 通过但现场失败？每个阶段明确独立的产品、现场、费用及安全证据；候选失败即保留旧稳定实现。
- 假如 SDD 变成文档工厂？只维护这一跨系列决策及各仓实际 delta，任务结束写真实证据，不建立新控制系统、定期巡检或无产出队列。

## 3. 外部研究与吸收边界（已复核来源，2026-11-28）

| 来源 | 采用 | 拒绝/约束 |
|---|---|---|
| [GitHub Spec Kit Quickstart](https://github.github.com/spec-kit/quickstart.html) | spec→plan→tasks→跨文档一致性→实现→收敛检查 | 不安装新 CLI 或复制其状态机 |
| [OpenSpec Concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md) | 增/改/删 delta、场景和完成后归档 | 不恢复 OpenSpec authoring/runtime/bridge；计划提交并不意味着已实现 |
| [ADK Canonical Change Authority](https://github.com/jiying2007/agent-dev-kit/blob/c030a8e147441799b458f5310107124e2ce8816f/docs/architecture/canonical-change-authority.md) | 原生 docs/changes、需求→任务→证据→审核→来源 | 不创造并行 SDD 权威 |
| [Codex CLI](https://learn.chatgpt.com/docs/cli/reference)、[Non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode)、[App Server](https://learn.chatgpt.com/docs/app-server) | 原生 exec/agents/review/resume/queue/doctor，按版本能力验证 | App Server 等实验接口不成为默认强依赖；不重写 Agent Harness |
| [OpenCodeReview](https://github.com/alibaba/open-code-review) | 确定性管线+语义探索、精确定位、公开真实 PR benchmark 思路 | 上游自报 precision/Token 优势与 recall 取舍不是 Safe 实测，须核实许可和独立复测，不复制其全部 Agent |
| [GitLab Webhooks](https://docs.gitlab.com/user/project/integrations/webhooks/)、[Diff limits](https://docs.gitlab.com/administration/instance_limits/) | 异步、有界、幂等、完整性证明与截断显式处理 | 不假设不同 GitLab 版本具备完全相同字段或信任边界 |
| [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) | 发布产物来源及消费验证 | 不给普通文档或每次测试生成额外证明；签名不证明代码无漏洞 |

候选补充（需在 T12 先核实许可、固定版本、标注与数据偏差，非本轮已吸收实现）：Reviewdog/SARIF、编译器诊断、独立 PR benchmark、真实故障语料、fuzz/property tests。仅采纳可证明收益的特性，避免重复依赖。

## 4. 最终架构与权威

三条主线：
- 执行：原生 Codex CLI/VS Code + ADK + 项目 Git/CI。codex 仅维护 source→build→live 声明式资产与受控远程飞书入口；既有飞书/TAPD 等为需求缺陷权威。无 API 仅使用明确输入/受控只读来源，不自动猜测或抓取。
- 质量：Core 共享纯安全、运行、Git 证据、预算、审查/诊断、最小策略及证据校验；Commit/Review/Change/Service/Diagnose/Debug 各自拥有领域编排及副作用。Git/Forge/CI 是各自权威。
- 管理：TUI 仅跨目标 Find、Attention、Locate、Link、Evidence；无执行、独立任务权威或 Git 远端写入。既有业务系统保存业务状态。

Core 的依赖方向：消费者→Core；Core 不访问 provider API、SQLite 队列、VS Code UI、飞书、业务项目、SCM 写入。现有 runtimeDigest/governanceDigest 分离继续使用；纯文档变化不触发强制同运行时重发。公共逻辑在 Core 有真实重复时提取，单仓职责不硬迁；仅需要结构整理时先内部模块化而非新仓/新包。质量评测、发布脚本不进入 runtime 分发面。保持现有版本/Policy v4，只有实际行为不兼容才按既有协议变更规则更新。

| 产品 | 保留/强化 | 收敛/删除 |
|---|---|---|
| Core | process、Safe Contract、Git inventory、token planner、evidence/validation、review/diagnosis primitives | 审核实际消费者后去掉重复工具/字段/过期协议；不复制产品流程 |
| Commit | staged only、保守确定性摘要、一次受限语义生成、SCM 手工提交 | binary/generated-only 模型调用、冗余 Git/预算包装；不放宽 provenance |
| Review | 计划预览、风险/语义证据、独立验证、精确发布锚点 | 所有低风险变更默认重复模型、以 confidence/一致代替缺陷质量 |
| Service | MR immutable snapshot、worker/SQLite/outbox、发布、恢复、named ingress | 不新增中央执行队列；复用同一 review engine 核心 |
| Change | 确定性 preflight/receipt、Provider HEAD/政策、用户授权写入和核对 | 旧 PR narrative generator、未知 HEAD 通过路径；仓名不必迁移 |
| Diagnose | 日志/Artifact、有界失败因果、一次模型/确定性诊断 | 自动修复、无界网络/重复 API 封装 |
| Debug | 真实复现、因果竞争、受控补丁/回滚、绑定验证 | 未晋级的过度协议、无效模型试验；不自动扩权 |
| TUI | 跨目标五能力、原生导航、最小 UI 持久化 | Board/WorkCard 业务编排、Composer、Queue、Git mutation、Terminal Drawer 等重复 surface，按真实依赖逐片删除 |
| codex | ADK 来源、最小 profile、原子安装/doctor/rollback、已有 Feishu 单入口 | 重复资产、原生已有功能、遗留 execution routes；不重写正在收敛的远程设计 |

ADK 管复用方法；退役仓仅保留必要历史并吸收有价值的通用方法至原所属处。无删除授权不删仓。此文是跨系列协调计划，不改变 safe-core Family registry 的产品范围。

## 5. 技术设计要点

### 5.1 安全与快照（R01–R03/R07/R09/R10）

Change 已知检查点 [workflow.js L5–10](https://github.com/jiying2007/codex-pr/blob/5ac82c0d862959692c8601ad4fe49b24c20d4ae9/src/workflow.js#L5-L10) 在 expected 有值、headSha 缺失时不抛出。优先用真实 provider/fixture 复现，写前须确认 HEAD、写后读取仍缺失记 unknown/remoteMutationPossible、禁止自动重放；检查 merge native SHA CAS、目标分支变化及 pipeline 绑定。对正常 provider 返回保留正控。仅当失败可复现才改生产代码。

Core [context-builder](https://github.com/jiying2007/codex-safe-core/blob/d517dccf1e636f22fd7f9d938a5dd552a91420d3/context-builder.js#L91-L107) 与 [Commit prepareStagedDiff](https://github.com/jiying2007/codex-commit/blob/e6cab145c876efc5a3c762e6feda607e05e3b1b9/src/commit-runtime.js#L270-L338) 已识别 Git binary metadata。进一步检验 staged inventory 映射完整性、非 canonical header、LFS pointer 敏感元数据、超大 diff 的获取与内存上限；原始 identity 与模型语义输入分离。优先流式指纹/元数据及安全上限，未知不能当源码。二进制-only 生成基于路径/变更类型的保守 message，不猜内容；版本/文档只在规则与内容足以决定时零模型。

Diagnose [gitlab.js](https://github.com/jiying2007/codex-diagnose/blob/e9e00d00eef5ea4ac7ea014927c4fb6e3667a353/src/gitlab.js#L8-L30) 已剥离跨域认证；进一步核实 signed object-store allowlist、DNS/连接端校验、代理影响、私网/loopback/link-local/metadata 访问策略、协议降级和响应界限。合法 self-managed 内部对象存储须由管理员显式允许；不只按 URL 前缀或字符串判断。不要求所有外部存储可用；未知则证据缺口。

Debug [debug.js](https://github.com/jiying2007/codex-debug/blob/1927c0c05af4c7d6c70afd175d1245edbc8dfcce/src/debug.js#L164-L191) 已记录前后 workspace state；复核验证期间源码、测试和关键环境变化会否误标 verified，允许受限 build artifacts 与明确已声明输出，不以全目录任意变化误拒。使用实际命令及上下文、patch/restore identity、测试目标与源状态证明，必要时标 unbound 或 interrupted。验证成功不自动确认根因。Debug 先 repin 已合格 Core，再完成独立模型与现场资格。

### 5.2 Review 混合引擎（R04–R06）

执行链：冻结 snapshot → inventory/风险分组 → deterministic analyzers（预安装、受信配置、沙箱；不得执行未授权 PR 脚本）→ bounded evidence retrieval（相关声明/调用/配置/测试/错误路径，只读；明确 chunk、引用、缺口）→ independent hypotheses → evidence verification（必要时）→ findings/coverage/readiness 分离→ product publisher。模型不得自行决定授权、执行命令或读取任意路径。统一语义 evidence identity、finding schema 与规则，provider-specific acquisition/publishing 独立。切分大 diff 不截断隐藏；文件覆盖和 hunk/语义分析覆盖分别计量；budget exhaustion 明示 incomplete。

严重缺陷以稳定 root-cause identity 去重，changed-line 锚点仅发布需要：真实未修改相关代码以支持锚点引用，删除行/跨文件发现允许报告而非虚构 changed line。对低置信度高危假设输出待核实，不能静默算 no-findings，也不能自动变成已证实 blocking defect。按风险选择 fast/balanced/deep 或独立新鲜复审；已缓存 deterministic evidence 可复用，缓存 judgment 不算新鲜。建立带正负例的 C/C++、MCU ISR、RTOS、驱动、资源、并发、OTA、音频实时性、定点溢出、模型版本一致性规则；工具不可用记录范围/原因。不发起硬件动作。

### 5.3 Service 独立多 GitLab（R08）

沿用 v8 命名 ingress、各实例独立 worker、队列/SQLite、凭据、Token 与日志。统一只读目录/健康、异常和费用聚合，不集中秘密/原始日志、不跨实例共享写状态。Webhook 快速确认但需持久化；按 instance/project/MR/snapshot/version 去重与 generation fencing；处理旧 target/head、乱序/重复、publish outbox 部分失败、429 重试、模型启动后未知账单/写后未知；未知先核对，不盲目再次付费。验证实际支持的 classic/modern Provider 能力和真实版本、恢复快照、独立停止/重启及并发隔离。依赖不健康不得输出绿色 readiness。

### 5.4 模型竞争与产品精简（R06/R11–R14）

先冻结 baseline 及任务样本，随后做实验：当前 Safe、原生 Codex review、确定性+单次模型、风险路由+有界检索、高风险独立发现+因果验证；同预算与同输入，分阶段重复盲测，成本包含失败/重试、缓存标记、模型身份。只有测试适用且授权时运行；默认不触发额外实验。不要增加新模型 registry 或平台，复用 Core/Service/Debug 现有评测工具，若不够补最小必要 adapter。

TUI 按原生实际能力探测后拆删除：先以 Lite 五能力证明无回归（包括父子、Fork、跨目标身份和不可达），再删重复入口和调用链、同步帮助/配置/测试。避免维护多个未来版本计划；原有历史 release 保存。若原生 agents 在真实场景满足五能力，不再扩展 TUI UI。codex profile 先测常驻 Token/耗时/命中率，再减少高负担资产；以 canonical ADK source/manifest 验证安装，保护 .system、auth、session、cache、私有配置；复用已有飞书设计，不扩展新 Gateway。现场权限不具备即明确受限，不使用非授权 Cookie/账号。

## 6. 主要风险与停止条件

| 风险 | 缓解与回退 |
|---|---|
| 漏报换取低 Token | 严重度分层、独立 holdout、保留 baseline；失败候选不晋级 |
| 缺失/过期证据误放行 | fail-closed、unknown 与明确失败区分、读后核对、精确 snapshot |
| 安全沙箱只是提示 | 最小权限、capability probe、负例、无凭据隔离、无模型自动执行 |
| 多 GitLab 串扰、状态重复 | 独立 trust domain、outbox/对账、故障注入、恢复演练 |
| 资产重构误删用户数据 | dry-run、受保护路径、源到产物、备份恢复、只迁移实际消费者 |
| TUI 删功能损坏定位 | 五项真实场景先通过再删；保留历史 Git，不留无用 runtime fallback |
| 外部语料泄漏或许可不明 | 固定许可/来源、脱敏、禁止私有数据外传；不足则不使用 |
| 计划无限迭代 | G0–G6 的退出证据；无价值候选终止，阻塞只记录实际原因，不新增巡检 |

## 7. SDD 权威与归档

现有 ADK 原生 change workspace 是方法参考；本目录是唯一跨系列协调入口，产品实际规格仍由其仓库维护。四份文档存档是提案版本冻结，不声称已实施。实现任务用需求 ID、exact SHA、PR、真实用例/现场证据闭环。各产品只提交必要变更，遵守现有保护规则；不能为计划合并而降低门禁。待所有强制范围证据达到且未授权现场项处理清楚后，再归档完成记录，保留失败和未验证事实。
