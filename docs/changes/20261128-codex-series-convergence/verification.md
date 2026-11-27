# Codex 全系列终态收敛｜验证与归档规范

状态：PROPOSED；本轮未运行下列产品测试或模型/生产验证。对应 [需求](requirements.md)、[设计](design.md)、[任务](tasks.md)。

## 1. 证据类型与可追溯性

每项验收绑定需求 Rxx、任务 Txx、用例 Vxx、所属仓/immutable SHA、环境/实际命令、真实退出码/结果、证据来源及限制。代码评审、CI、真实模型、设备/HIL、现场部署、正式发布、用户接受是不同事实。以现有产物/回执/日志/PR 为准；无需新 Receipt schema。原始凭据、会话、生产日志、网络拓扑不入公开仓。hash 只证明内容一致性；真实来源与身份靠独立执行记录、受信产物校验和审核。未知/缺失/跳过不写成 pass；证据过期须重新验证受影响范围。

## 2. 验收矩阵（实际执行时填结果和链接）

| ID | 需求与场景 | 合格条件 | 证据/执行层 |
|---|---|---|---|
| V01 | R16 基线与 SDD | 所有 R/T/V 互相覆盖，现状/候选/目标分开；基线 SHA/CI 与真实状态；开工检查最新 main；所有阻塞诚实标记 | Git diff/PR、只读独立审查 |
| V02 | R07 Change 交付 | missing HEAD（初读/复读/写后）不放行；不一致 SHA、目标变化、旧 pipeline、fork、分页失败、取消/写后不确定均正确；正常 create/update/merge 能走原生约束 | provider 正负例、真实 GitLab/GitHub 受控场景 |
| V03 | R01/R02 Git、安全与预算 | 大 BIN/无扩展/rename/delete/LFS/路径/attributes/大 hunk/恶意 diff、JSONL/超限、超时/取消；不发送二进制；证据身份和覆盖一致，未知拒绝，资源有界；默认 read-only/ephemeral/no approval 实际有效 | 真实 Git fixture、property/fuzz、实际 CLI 版本 smoke |
| V04 | R09 Diagnose | 合法对象存储跳转通过；跨域凭据不泄露；未批准地址、降级、DNS/代理异常、循环、超限 fail-closed；失败链、缺失及未知 DAG 不造事实；0/1 模型策略真实计数 | mock server、隔离网络测试、授权 GitLab smoke |
| V05 | R10 Debug 验证 | exact 同命令/环境/基线/变更；恶意测试自改源码、无变更、不同命令、环境漂移、不足基线、验证中断及 rollback 不误标 verified；合法声明产物不误拒；因果与修复事实分离 | 真实临时 Git workspace、负例/正控、CI |
| V06 | R08 Service | 两独立信任域、独立队列/DB/凭据/预算；duplicate/out-of-order、429、crash、head/target 变化、发布部分失败及恢复不串扰、不重复付费/副作用；未知先对账 | fixture + 授权实际两个 GitLab/多个 repo，重启/备份/恢复记录、状态与费用 |
| V07 | R14 Core 与精简 | 真实消费者追踪；删除冗余前后公共安全/协议行为等价或已审查变更；现有 runtime/governance digest 证明；无未使用兼容入口、新权威或强制同 runtime 重发 | 调用图/源码 diff、Core CI、Family Compatibility/Freshness |
| V08 | R03 Commit | 可确定 binary/generated-only 0 调用、普通语义复杂 1 调用；输出信息可由输入支持；SCM-only、index/HEAD drift 拒绝、review 证据可选且不伪造；记录 P95 | 实际 Git/VS Code smoke、调用计数、资源基线 |
| V09 | R04/R05 Review 计划/证据/覆盖 | local/service 语义输入一致性；未读、未审、预算耗尽、工具失败不假 complete；删除/跨文件真实缺陷可报告、位置可核实；高危待核实不静默 no_findings；replay 不算 fresh | 同输入 fixture、真实源码及独立缺陷标注 |
| V10 | R05/R06 专项规则与语料 | 实际许可、固定版本/标注、根因分组；有真实 C/C++、MCU/RTOS/Linux、资源、并发/OTA 等相关覆盖和干净负例；独立未看标签 holdout；无真值泄露 | dataset digest、审查标注、可执行正负例、来源 |
| V11 | R06 模型竞争 | 预算批准、同输入/配置/预算、实际模型身份；同一数据配对比较含失败/重试；高危召回不退化、安全门禁零逃逸、真实成本/时间；符合下文晋级规则 | 真实执行原始 usage/费用/结果、独立评测器报告、exact SHA |
| V12 | R10/R11 Debug 晋级 | 新 Core；历史可复现+新增独立真值样本；根因、拒绝、patch applicability、错误 verified/rollback 负例、安全、真实工具环境均满足现有 promotion policy；不靠回顾性样本独自晋级 | 实际历史坏/好复现、live model、CI、现场 CLI/VS Code smoke、发布 |
| V13 | R12 TUI Lite | Find/Attention/Locate/Link/Evidence；真实不同主机/账号/source、父子/Fork、孤立/分页/归档/未知、SSH exact resume 与不可达；无错误接管、无旧执行 surface；TTY 恢复可靠 | 实际 Codex 版本、Linux/SSH/适用 Windows 前端；10k/长记录有界测试、实测用户路径 |
| V14 | R13 资产/飞书 | exact source→build→plan→apply→doctor/rollback，用户资产保护；按需加载与成本真实比较；真实授权需求/缺陷多仓关联、独立模型费用、重启/unknown 对账；权限不足不绕过 | 实际两类 host 受控安装/恢复，真实飞书/业务权限 smoke |
| V15 | R14/R16 交付 | current exact SHA、必需 CI、产物签名/来源和实际安装/部署结果；模型/现场/发布资格分别核验；不把 docs PR 或 CI 绿当生产合格 | GitHub/GitLab runs、release assets、受信校验、现场回读 |
| V16 | R15 退役 | 真实进程/依赖/未知外部效果核查，备份/恢复和历史证据保全，有责任人授权才停用/删除；非当前依赖 | 受控主机只读报告、迁移/停用验收、授权引用 |

## 3. 真实模型竞争方法与晋级标准

目标是质量不退化前提下实质降成本，不追求模型数量或单次高分。正式实验前先登记开发集、独立保留集、分组规则、固定 Base/Head、代码/证据视图、模型/版本/温度等实际可配参数、预算/超时、运行次数、判定器和失败口径。使用至少 30 个独立真实变更/根因组（建议 60–100，至少含 10 个高危组及有意义干净负例）作为首个比较的规划下限；如果样本不足以支持统计结论，增加独立数据或报告区间/不确定，不用重复同类样本扩大 n。高风险真实基线不能因模型错误而过滤。Debug 沿用现有 promotion floor，另要求真正独立样本；数量/能力不能由旧历史回归替代。

运行：在 dev 小试决定至多 2 个候选进入冻结 holdout；对已选候选与 baseline 做相同输入配对、至少两次独立运行或明确受预算限制的重复方案。模型看不到标注、固定修复、测试答案、其它模型判断（独立验证例外仅看到待核验假设）。输出逐案例真实发现匹配、证据锚点、未覆盖、失败、拒绝、低置信及模型请求 ID（脱敏）、实际 input/output/cache tokens、耗时、计费来源。重试、失败计入 cost/coverage；usage unknown 禁止宣称节省。原生 Codex 如不支持相同 evidence/permission 约束，则作为独立观察而非强行等价。真实训练/模型调用预算须经当前授权；不得消耗未授权额度或伪造在线回执。

匹配：按缺陷根因、证据和代码位置，由独立标注/审核判断；不按字符串碰撞或模型自评作为真值。precision=TP/(TP+FP)，recall=TP/(TP+FN)，F1 分母为零明确 NA；按严重度/语言/仓库/根因分组报告，提供 paired bootstrap 或适当区间；遗漏、截断、未执行按预注册规则计入，不能只统计成功输出。

| 指标 | 建议晋级门槛/判定 |
|---|---|
| 安全/证据负例 | 固定对抗用例中错误放行、越权、过期证据、Debug false verified、跨实例串扰 = 0；正常用例通过 |
| 确定性计划覆盖 | 所有清单项可解释（已审/排除/未审/未知均有理由）；任何未知不得标完整 |
| 高危召回 | 相对冻结 baseline 不下降，已知高危安全回归零新增漏报；独立样本报告区间/严重度 |
| Precision | 目标 ≥85%，且不低于 baseline 的预注册可接受边界（默认不退化）；不能靠删除候选/漏报实现 |
| 普通 Recall / F1 | 对照 baseline 配对，不允许未获同意的实质退化；质量和统计不确定性明确 |
| Token | 同等质量与输入下，目标真实总 Token 至少下降 20%；usage 缺失不可晋级为省 Token |
| 费用 | 真实计费身份和可核验 usage/账单分开；计入缓存、失败、重试；无真实费用不宣称节省金额 |
| 延迟 | P95 不高于 baseline（同环境），Commit 普通调用建议 P95 ≤15 秒；记录冷/热和分布，非代表环境不硬套 |
| 资源 | 记录实际 CPU/RSS/IO、并发/恢复成本；预算超限明确拒绝，不通过降低安全门禁满足 |
| Debug | 使用现有 promotion policy + 新独立验证；0 假 verified、0 已知未授权执行、错误根因保持 unresolved/open |

上述均为规划门槛，不是实测成绩。前置登记后不得调阈值以迁就 holdout 结果；若样本/预算不足不晋级，保留 baseline，报告具体差距；可接受非安全指标权衡必须由责任人审查后在下一次独立评估预注册，不能用本次 holdout 反复寻优。确定性零模型收益可单独验收，不强求每个产品使用模型竞争。

## 4. 工程和现场关闭条件

- PR 必须通过本仓现有保护、CI 与适用独立审核，不能自行伪造审批、修改 ruleset 或削弱测试。
- Core 的文档治理 digest 与 runtimeDigest 用现有工具实际计算；文档 PR 不等于 runtime release。
- 已发布产物消费端核验来源/签名/精确版本；可在现有 release 管道中记录，不新增证明流水线。
- 真实双 GitLab 部署与独立计费、实际 Windows/Linux/Remote SSH/TUI/飞书及嵌入式工作流、必要设备验证必须有真实执行与授权；CI 模拟不能代替现场。无法访问时明确 blocked/partial。
- 任何阶段只要出现权限扩张、旧/未知证据错误通过、安全负例逃逸、未授权模型调用/生产写入、数据丢失、关键召回退化，即停止相关候选并保留 baseline/回退至真实可用版本；记录失败事实。
- G6 完成前独立检视 R01–R16 的每项证据，检查 tasks.md 逐任务 actual result。只完成文档不关闭变更。完成后在既有 change 目录增加实际归档/交付记录，更新各产品现行规格与 README，保留历史、失败、延后项和批准范围；不新增新的治理服务。

## 5. 本次文档阶段的验证边界

本次通过 GitHub 读取了主线与公开说明、关键源码和现有 CI 元数据，并对照外部官方资料；未逐行穷尽所有源文件，未重跑产品 CI、未执行真实模型、未连接部署主机、未进行发布/停机/删除。文档存档只证明提案与计划存在，不能宣称 G0–G6 任一已完成。待进入 T01 核实最新状态。后续实施以真实结果回填。
