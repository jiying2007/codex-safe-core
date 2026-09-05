# Family 效率契约

Codex Safe Core v4.17.3 为整个产品族统一提供通用的模型成本与执行效率原语。

该契约保持产品无关：

- 从 Codex JSONL 统一解析 actual/cached/cache-write/output/reasoning Token usage；
- 增量消费 Codex JSONL，并独立限制 transcript 总字节数与 retained diagnostic output；
- 执行前保守估算请求 Token，preflight budget 保持 fail closed；
- 根据真实 input-token usage 为 provider+model 维护有界 EWMA bytes/token 校准，达到最小样本数后才启用；
- 可选持久化只保存 provider/model 与数值校准，TTL 按每个模型真实 observation 计算，并使用 no-follow read、owner/permission 检查、写锁、merge-on-write 与 atomic mode-0600 replacement；
- 校准始终保留安全折扣和硬上下界，不能把保守预算变成乐观预算；
- 确定性评估 Evidence Risk，自适应预算只允许缩小，绝不突破配置上限；C/C++/Rust 等系统语言只作为弱先验，security、lifetime、concurrency 等语义只有出现在真实 changed line 时才提高风险；
- 使用 Model Routing Contract v1 的 `fast` / `balanced` / `deep` Mode 与 `scout` / `reviewer` / `adjudicator` Role 路由模型工作；
- `auto` 选择优先 `healthy`，其次 `unknown`，并拒绝 `unhealthy`；
- `auto` 可使用达到最小样本量且质量门禁明确 approved 的分层 Model Economics，通过确定性的 Pareto dominance 优选，但成本永远不能绕过兼容性或质量门禁；
- Model Evidence 绑定 canonical `registryDigest` 与 `routingPolicyDigest`，并绑定实际影响自动选择的 Economics identity；Cross-provider fallback 必须显式且由机器/管理员控制；
- 总字节预算下优先保留高风险 Chunk，并为并发任务提供 Token reservation；
- Model Economics 统计 fresh review Token、cached-input ratio、token/cost per verified finding、coverage、false positive、升级调用率和 P50/P95 latency；
- Economics 按 Mode、Role、Provider、Model、Profile Pack 与 Repo-size bucket 分层；
- Shadow Candidate 永远不改变 Production Verdict；
- 即使候选更便宜，只要样本量不足或质量回归超出批准门禁，就禁止晋升；
- Structured Codex 执行统一返回 request estimate、实际 usage 与 duration。

`TokenEstimatorCalibration` 默认仍为 2 UTF-8 bytes/token。持久化状态只包含 provider/model identity、数值比例/样本数和 `lastObservedAtMs`，绝不保存 Prompt、源码、Finding、Judgment 或 Credential。其他模型写 Store 不会给陈旧 calibration 条目续命。

Model Selection 与 Repository Policy 严格分层。机器级 Model Registry 可以描述 Model Class、Role、Qualification、Health 和标量 Capability metadata；Discovery 本身绝不意味着模型可以被 `auto` 选择。Registry 与 Routing Policy 的可读 Revision 都会配套 canonical SHA-256 Digest，使执行 Evidence 可以精确复现。Economics 只有在样本量达到配置下限且质量门禁明确 approved 时才参与排序；缺失或不足时回退到确定性的 health/class/priority 路由，不会虚构成本数据。

质量优化不是 Token 最小化。历史 recorded corpus 继续作为回归 baseline；Promotion Corpus 增加至少 80 个 dev/holdout/real-regression case 和 clean negative。候选模型必须产生真实评估结果，并满足最小总样本数/critical 样本数后，才允许进入 quality-constrained promotion。

各产品继续负责自己的预算值、质量阈值、确定性 Evidence 持久化、Routing 接入和 UI。预算导致的证据遗漏必须显式暴露。持久化 Model Judgment 不属于效率原语：Judgment Lifecycle v1 禁止把历史模型 Finding 当成 fresh 结果或重新参与 Verdict。Codex Change Safe 默认模型调用为 0，因此这些原语不会给 Change 阶段增加模型请求。
