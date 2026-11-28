# Codex 全系列终态收敛｜SDD 实施计划

状态：IN PROGRESS。G0/G1 有已合并实现，G2 外部语料仅形成 development 快照，G3 模型竞争尚未执行，G4–G6 仍需真实现场与生产证据。任务号长期稳定；每条交付需要需求、代码/删除、测试和结果引用；已有实现先验证、禁止重复建设。详见 [需求](requirements.md)、[设计](design.md)、[验收](verification.md)。

## 执行顺序与依赖

主链：G0 冻结与关键风险 → G1 公共/产品精简 → G2 审查质量 → G3 模型竞争 → G4 Debug 产品化 → G5 TUI/资产收敛 → G6 生产联合验收。非共享的 TUI/codex 只读基线、Debug 历史语料、Service 环境准备可提前并行；共享 Core API/策略/schema/锁文件、生产发布、同一数据库迁移必须串行。并行保持 2–4 个互不写相同资产的任务；各仓使用自身 Git/PR 与 CI，不新建编排系统。G0 先锁定用于后续比较的基线，不先删除参照。每个阶段按真实证据退出，不按日历、PR 数量或代码行数宣布完成。

## G0 — 冻结基线、关键风险（P0）

- [ ] T01 | 全系列 | R16 | V01 | 无依赖：读取九仓最新 main、open PR/issue、contracts/gitlinks、CI、发布渠道和已知现场版本；冻结实际测试/成本基线及适用范围，已完成项记录证据，避免重复。产出一份在现有任务/PR 中的基线引用和差距，不新增巡检。
  进度：已核查九仓元数据、近期 PR/Issue、contracts/gitlinks、CI 与产品契约。Live branch/ruleset GET（2026-11-28）：Safe Core、Service、Commit、Review、Change、Diagnose、Debug 七仓有 active ruleset，但均使用 `~DEFAULT_BRANCH` 且 `dismiss_stale_reviews_on_push=false`；其中六仓有 owner PR-only bypass、Debug 无 bypass。统一策略审查跟踪于 [Safe Family #139](https://github.com/jiying2007/codex-safe-core/issues/139)，Debug promotion exact-main lock 另行处理。Codex main SHA `f3a559f2c688af51dd7cc5459cba25b9a6f92ad3` 为 `protected=false`、rulesets `[]`（[Codex #24](https://github.com/jiying2007/codex/issues/24)）。TUI main SHA `af0f6669be2462a42ea56ff1d9af81f17d826b62` 为 `protected=true`，rulesets `[]`；classic protection details endpoint 对当前集成返回 403，不能推断其具体规则（[TUI #459](https://github.com/jiying2007/codex-tui/issues/459)）。TUI main 的七个 push workflow 和 release package workflow 已成功，Stable/GitHub publish 被明确 skipped；真实安装版本、生产主机和现场部署证据仍缺，T01 不关闭。
- [ ] T02 | Change | R07 | V02 | T01：用正常/缺失/不一致 HEAD、写前/写后 mock/真实 provider replay 复现 workflow.js 条件边界；修复必要的 head 断言及未知状态；测试并发 push、fork/target、陈旧 pipeline/native merge；不自动重放写请求。交付源码、正负例与 CI。
- [ ] T03 | Core、Commit、Review、Service | R01/R02 | V03 | T01：复核已合并 binary metadata 修复；用真实 Git 仓生成大 BIN、无扩展、rename/delete、quoted paths、LFS、attributes、混合巨大 hunk、无匹配 inventory；仅修复真实缺口并保证 bounded acquisition/fingerprint；不重新发送二进制。交付跨消费者契约回归。
- [ ] T04 | Diagnose | R01/R09 | V04 | T01：复现 Artifact redirect 目的地策略；在有界 HTTP 客户端增加必要 allowlist/连接校验和合法内网正控；测试跨域凭据、代理、DNS、循环及限额，不新增通用下载服务。
- [ ] T05 | Debug | R10 | V05 | T01：复现 verification 状态与前后 workspace identity、测试自改源文件/环境/产物；有问题先修复或保守拒绝，覆盖恢复与回滚；不扩大 shell/历史执行权限。
- [ ] T06 | Service | R08 | V06 | T01：现有双实例配置、数据库、凭据、入口、健康及事件模拟核查；针对实际发现修复错位/重入/未知或资源泄漏，补独立实例和故障注入 fixture；不声称现场部署完成。

退出 G0：T01–T06 的已确认关键风险已修复或证明不可复现（保留精确证据），所有新安全负例 fail-closed 且正常用例通过。未解决 P0 不进入相关产品生产发布。

## G1 — 公共核心和确定性产品收敛（P1）

- [ ] T07 | Core | R01/R14 | V07 | G0：生成一次真实调用方/导出/契约/脚本引用清单，区分 runtime vs governance；对无用字段/符号/重复 wrapper 做小批删除，不搬进 Core 任何 provider、DB、UI、通知；保留 exact pin 和现有运行安全。
- [ ] T08 | Commit | R02/R03 | V08 | T03/T07：binary/generated-only 保守零模型、明确可判定简单变更；复杂 staged diff 一次模型，上下文预算、重入、HEAD/index 校验；保持 SCM-only 与 provenance。使用真实 Git fixture 验证零/一调用及信息不捏造。
- [ ] T09 | Review、Service、Core | R04/R14 | V09 | T03/T07：对比本地/service 已有 review planner、evidence validation、risk routing/coverage 重复实现，只抽取真实重复的纯函数和数据约束；保留 snapshot 获取/发布归属；用同一 immutable fixture 比较两端语义，不强求异种快照身份相等。
- [ ] T10 | Diagnose | R09/R14 | V04/V07 | T04/T07：已知可机械判断基础设施错误零模型、复杂情况有界一次调用；复用公共 parser/预算；删除多余 wrapper 只在无消费者且有真实回归时。
- [x] T11 | Safe 族 | R14/R16 | V07/V15 | T07–T10：沿用 Core runtimeDigest/governanceDigest 和既有 Family release admission；runtime 有语义变化才按当前契约正式发布并 repin，文档/治理等价不强迫相同 runtime 重发。消费者分别 CI、exact SHA 和发布校验，不创建新版本家族。
  证据：六个消费者均已绑定同一 Safe Core 4.18.15 exact SHA `779afbd6982d6271942301e6f59656b50ff7e3cb`，runtime digest `9331f48aa1e943293a5d89371df68bb3d688937cf62c5b90442bdca5c128e39d`、governance digest `1c0b66ac5fba925888bcec52210f8d000ad78ea026bef26afe97234453151dd8` 一致；当前产品版本分别 Commit 4.6.15、Review 4.8.19、PR 5.4.21、Diagnose 1.5.12、Service 8.0.4、Debug 0.1.18。Commit #158、Review #146、Diagnose #50、Service #172、Change #80、Debug #64 均已合并，六个对应 CI Gate 成功；Commit/Review/PR/Diagnose/Service 的 immutable Release Integrity 也成功。Service main CI run `46102380101` 另已验证 GitLab CE 14.6.1/17.11.7/19.3.0 E2E、Ubuntu/Windows fault injection、migration portability 与 recovery gate 全部成功；v8.0.4 immutable release + independent integrity 成功。Debug 0.1.18 仍是 development，不宣称发布或 promotion。

退出 G1：功能/安全基线保持；实际重复或无用代码减少，有调用方证明及 CI；Commit 零/一调用，服务与本地共享真实公共逻辑；不存在新兼容架构。

## G2 — 专业代码审查能力（P1）

- [ ] T12 | Review、Service | R05/R06 | V10 | T01/G1：核实外部 benchmark 许可和下载快照，建立独立标注、根因 group、repo/语言/严重度分层、正负例、保留 holdout；收集至少两类真实嵌入式项目缺陷来源，未授权私有内容只在允许的本地环境。冻结 evaluator、dataset digest 和去重规则；不复制所有 benchmark。
  进度：Core PR #133 已合并到 main，merge SHA `aefdab4caf3a48c3f9b87a7074f16fafac76def7`；同一精确 Head CI run `46107717681` 全部必需任务成功（两项影响范围 canary skipped）。已保存 ReviewBench 25 PR/25 仓库、CloudAEye C/C++ 16 PR/13 仓库及既有嵌入式 2 PR/2 仓库的许可绑定、去源码/评论快照；共 43 PR、40 仓库、33 个候选分组单元、18 个高危候选组。根因独立性尚未复核，干净负例 0、盲测 holdout 0、fresh model execution 0；T12 仍未完成。Core #135 已合并，后续 PR CI 的七个隔离性能样本通过 run `46109089478` artifact `15249016090` 保留 30 天；该数据是单候选诊断，不是配对模型/性能晋级证据。
- [ ] T13 | Review、Service、Core | R04/R05 | V09/V10 | T09/T12：确定性分析接入实际可用的 compiler/lint/SARIF 等输出；工具白名单、时间/输出上限、未受信 PR 脚本不运行；按嵌入式语言/风险选择规则，工具缺失与不适用分别标记。
- [ ] T14 | Review、Service、Core | R04/R05 | V09/V10 | T13：证据按调用、声明、资源/错误路径、配置、测试关联进行有界检索；记录已规划/读取/推理/缺口；支持 deleted/cross-file 根因及精确主锚点，禁止虚构 changed-line。
- [ ] T15 | Review、Service | R04/R05 | V09/V10 | T14：比较高危低置信候选的待核实语义、证据反例及独立发现；可选 fresh blind，不将 replay 算 fresh；用真实误报、漏报、缺口样本确认风险阈值。
- [ ] T16 | Review、Service | R04/R06 | V10 | T12–T15：冻结候选实现、离线固定样本安全/功能与覆盖门禁、负例误报率、成本采集字段；保留基线模型结果独立；禁止 fixture 分数冒充在线评测。

退出 G2：有可执行真实语料、可核查标注和一致输入；高危及覆盖负例通过；候选可以正式参加配对实验。无真实语料/权限则 BLOCKED，其他独立任务可继续。

## G3 — 模型竞争与 Token/延迟实测（P1）

- [ ] T17 | Core/Review/Service | R06 | V11 | T12/T16：冻结同一 Base/Head、源码/上下文限制、模型版本/配置、预算、盲测计划、重复次数、计费口径、失败处理。原生 Codex 同可见输入与权限；不支持相同约束时独立记录不可直接比较。授权预算、独立计费身份确认后才调用模型。
- [ ] T18 | Review、Service | R06 | V11 | T17：真实运行当前 Safe、原生 Codex、单次低成本候选、风险路由候选、独立发现/验证候选；先小规模开发集淘汰明显劣势，再固定候选跑未看标签 holdout。每个调用真实 usage/latency/失败/重试/缓存/结果引用，不循环试到通过。
- [ ] T19 | Core/Review/Service | R06/R14 | V11 | T18：按严重度、仓库/根因分组输出 precision/recall/F1、关键漏报、时间/Token/费用、置信区间与逐案例差异；采用安全约束内 Pareto 候选或保留 baseline。现有 benchmark comparator 只做研究，证据未到生产不晋级。
  进度：Core #132 已合并高危逐标签召回及真实 Usage/P95 比较器；Core #135 已合并 PR performance diagnostic 原始七样本 artifact 保留（精确 CI run `46109089478` 的上传 artifact `15249016090` 已验证）。这仍是单候选诊断；当前无 fresh model execution、完整模型身份/计费回执或配对 holdout 结果，不能晋级。
- [ ] T20 | Review、Service、Core | R04/R06 | V11/V15 | T19：将唯一获证据支持的行为接入现有路由/预算契约，保留必要安全 fallback 而非多套永久实验实现；回归、exact Core repin、正式发布资格检查；无实质收益候选明确停止。

退出 G3：独立对比证据达到 verification.md 的晋级规则。若候选未获收益，保留 baseline、记录失败结论；不把预算不足或未运行写作优化成功。

## G4 — Debug 产品化

- [ ] T21 | Debug/Core | R10/R14 | V05/V12 | T05/T11：更新到经资格确认的最新 Core runtime、重跑 CI 与实际 patch/rollback 负例；检查安全调用约束，不恢复旧 fallback。
  进度：Debug #64 已合并 Core 4.18.15 精确绑定；当前 main `bb21da19a58f0f1ecabf49cba9af29ea35a13701` 的 CI run `46104118043` 全部 11 项成功。Product `0.1.18` 仍为 `development`，corpus `promotionEligible=false`；22 条历史候选全是 retrospective（4 repo、7 failure kind、3 insufficient、20 RCA groups），不是 blind holdout。Admission Policy 与 Governance Lock 均 `reviewed=false`；live ruleset `27347666` 虽有 CI Gate、strict、deletion/non-fast-forward、无 bypass，但仍为 `~DEFAULT_BRANCH` 且 stale-review dismissal false。最新 10 个 workflow_dispatch 都在 2026-09-08 或更早，三次 Model Evaluation 全失败；没有 fresh successful model run。实际 patch/rollback 负例及 Remote SSH/现场 smoke 尚未提供。
- [ ] T22 | Debug | R11/R06 | V12 | T21：已有 22 历史转移只用于回归与资格复现；获取新增独立未泄漏样本（许可、准确坏/好版本、相同命令、独立 root-cause group、正控），涵盖 native、嵌入式 MCU/Linux/RTOS 中可安全复现类型和不足证据，必要时隔离 HIL。
- [ ] T23 | Debug | R10/R11/R06 | V12 | T22/T17：在授权执行历史代码的隔离环境中复现 exact bad-fails/good-passes；实际模型根因竞争/因果验证/patch 可用性/拒绝指标，记录证据与费用；独立 model holdout 不以历史公开标签冒充盲测。
- [ ] T24 | Debug | R11 | V12/V15 | T23：Linux/Remote SSH、符号解析/回滚/故障样例现场 smoke；按现有 Product Contract 和 promotion policy 决定 development→active；不因结构性门槛、fixture 或发布文档自动晋级。

退出 G4：真实根因、验证和受控修复通过，假 verified 负例零逃逸，真实工具环境及发布证据合格。缺模型/硬件/外部授权则维持 development 并记录缺口。

## G5 — TUI / codex 资产与退役收敛

- [ ] T25 | TUI | R12 | V13 | T01：真实安装版本原生 agents/review/resume/search/queue/doctor 对照，冻结 Lite 五项高频使用故事、跨主机/source/account/parent/fork 能力与时延；未验证来源标 partial。优先复用官方能力。
- [ ] T26 | TUI | R12 | V13 | T25：先完成五能力的真实行为，精确目标、子线程待处理、不可达和分页异常；native resume 或准确定位，不使用 --last 猜测、不接管个人会话；业务 link 仅引用原平台。
- [ ] T27 | TUI | R12/R14 | V13 | T26：按调用关系删除旧 Board/WorkCard、Composer/Queue、重复 Git 写、嵌入终端等不再消费路径及相关配置/help/test；不是直接删除关键回归门禁；保留历史 release 和用户必要数据的离线保全，不维护第二套 runtime。
  进度：TUI #450–#457 已按依赖顺序合并到 main（main SHA `af0f6669be2462a42ea56ff1d9af81f17d826b62`）；八个 PR head CI 均成功。该 SHA 的 main push workflow：ci/security/terminal-regression/retained-soak/scale-evidence/performance-diagnostics/development-qualification 七项均成功；release run `46108371767` 也成功完成 release-gate、Linux/macOS/Windows packages 与 release-bundle，实际 artifact `15251066719`、`15251042308`、`15250519141`、`15250138342`、`15250892309` 已保留。`publish-github-release` 与 Stable checks 明确 skipped，因此这是可下载的构建候选，不是已发布 Stable。main `protected=true` 但 rulesets `[]`，classic details 对当前集成不可读。#458 仍为 Draft（Head `0bb06f4a0ced36f231c8eb156fc4c2d538c06b54`），七个 hosted workflow、12 个 Actions check-run 全部成功，但其自身明确要求真实主机 G1–G3、迁移/恢复、G4 对比 UX 和 Stable 资格；这些尚未完成，不合并。旧 Board/Planning 投影和未使用代码的最终物理删除、无作用域偏好迁移仍受现场数据核验约束，T27 不关闭。
- [ ] T28 | codex、ADK | R13 | V14 | T01：测当前 default 与团队 profile 常驻上下文、安装成本、实际命中；最小化默认配置与长尾按需加载；只从 exact ADK source 导入，排除系统/凭据/用户会话。验证 source→build→plan→apply→doctor→rollback 与不同 host。
- [ ] T29 | codex | R13 | V14 | T28：复用现有 Feishu Engineering Agent SDD，仅补真实远程需求/缺陷交付、项目身份、独立授权/计费、可恢复 UNKNOWN 和受控发布；缺企业 API 走明确用户提供上下文，不造新 Gateway/卡片体系。已有实现不得重写。
- [ ] T30 | engineering-platform、digital-worker（边界） | R15 | V16 | T26/T29：核实实际主机服务/依赖、未完成事项、历史证据、备份恢复与方法吸收映射；不重新产品化；实际停用/归档/删除只有确认无活跃依赖且责任人授权时实施，禁止删除未知数据。

退出 G5：Lite 及资产真实使用场景通过、冗余运行路径实际删除、合法用户数据不丢失。历史证据与未知部署保全。远程执行不具备外部权限/预算时准确记录现场阻塞。

## G6 — 真实生产联合验收与完成归档

- [ ] T31 | Service | R08 | V06/V15 | T06/T20：用实际获授权的两个 GitLab 信任域、多个仓库，执行命名 ingress、重启/断网/乱序/429/状态发布中断、独立预算及恢复；统一入口只读展示；保留真实实例结果（公开记录脱敏）。
  进度：Service 当前 product `8.0.4` / DB12 / Config8，绑定 Core 4.18.15。合并 main `32258bcbd8f1adff88321cbd9f036bdb28be1a79` 的 push CI run `46102380101` 全部关键门禁成功：GitLab CE 14.6.1/17.11.7/19.3.0 provider E2E、Ubuntu/Windows fault-injection、recovery、Linux/macOS/Windows × Node 22/24 migration portability、双架构 Docker smoke、CodeQL、dependency audit 与 Family Release Guard。v8.0.4 immutable release run `46102379849` 发布成功，OCI index digest `sha256:a8230d73a7ab146ac504e852486a2374ebbf7b56576b218d2828735634233a6e`；独立 Release Integrity run `46103397500` 验证所有资产成功。上述关闭 hosted matrix/fault-injection/migration CI 缺口，但两个真实 GitLab trust domains、真实 credentials/webhooks、`192.168.1.22` 管理主机的 SQLite 备份/迁移/回滚现场仍未验证。独立最终-ref 原子 fence 仍未实现或证实，跟踪于 Service #114；在该保证缺失前必须保持 `mergeAuthorized=false`、`refTransactionBound=false`，bot 不得 Required 或拥有 Merge/Approve 权限。
- [ ] T32 | Safe 族 | R01–R11/R14/R16 | V03/V08/V09/V12/V15 | T20/T24/T31：本地 staged→Review→Commit→用户实际提交→Change→MR/CI→Service→Diagnose/Debug 的适用真实工作流验证；覆盖 Windows/Linux/Remote SSH、固件 BIN、源码及嵌入式故障。按产品现有发布渠道核对真实产物、签名和 installed smoke，现场不可用不报通过。
- [ ] T33 | TUI/codex | R12/R13/R16 | V13/V14/V15 | T27/T29：在真实跨主机、业务事项多仓联调中验证会话定位、原生续接、资产升级/回滚、飞书控制与实际证据回写；只在真实授权范围内执行。
- [ ] T34 | 全系列 | R01–R16 | V01–V16 | T31–T33/T30：独立只读收敛审查，按需求逐条验收，记录 exact main/产物/CI/模型/现场证据、剩余风险/未验证；无不明/失败的必选项才声明全系列完成，非必选项明确由责任人接受。结束后提交完成/归档记录，停止重复巡检和计划重写。

## 任务记录与阻塞

每个实现 PR 简明记录：T/R/V ID、基线/候选 SHA、实际修改或删除、执行命令/用例、原始证据链接、通过/失败/跳过/未知、外部授权、回退方法、未验证范围。若复核证实既有功能已满足，链接 exact 证据即可，不重做。如果工作涉及现场主机、真实计费、发布权限、企业 API 或设备，由真实授权与可达性决定，不能伪造、绕过或长期轮询。阶段门槛不能用 checkbox 数量替代。用户请求明确批准计划之外的高风险动作前，禁止执行。
