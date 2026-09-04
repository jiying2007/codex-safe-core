# Family 效率契约

Codex Safe Core v4.15.0 为整个产品族统一提供通用的模型成本与执行效率原语。

该契约保持产品无关：

- 从 Codex JSONL 统一解析 actual/cached/cache-write/output/reasoning Token usage；
- 增量消费 Codex JSONL，同时独立限制 transcript 总字节数与 retained diagnostic output；
- 在执行前保守估算请求 Token，并支持 fail-closed preflight；
- 根据真实 input-token usage 为 provider+model 维护有界 EWMA bytes/token 校准，达到最小样本数后才启用；
- 可选通过 Token Calibration Store 只持久化 provider/model 与数值校准，具备 TTL、原子 mode-0600 写入和 symlink 拒绝；
- 校准始终保留安全折扣与硬上下界，不能把保守预算变成乐观预算；
- 确定性评估证据风险；
- 自适应预算只允许缩小，绝不突破配置上限；
- Consumer 接入 Model Routing Contract v1 后，以稳定的 `fast` / `balanced` / `deep` Mode 和 `scout` / `reviewer` / `adjudicator` Role 路由模型工作；
- Cross-provider fallback 必须显式、由机器/管理员控制，不能由 Repository Policy 开启；
- 在产品设置总字节预算时优先保留高风险 chunk；
- 为并发产品任务提供 Token reservation；
- 生成 Model Economics scorecard，包括 fresh review Token、cached-input ratio、token/cost per verified finding、coverage efficiency、升级调用率以及 P50/P95 latency；
- 比较 Shadow Candidate 与 Production Finding/usage，但 Shadow 永远不改变生产 Verdict；
- 即使候选模型更便宜，只要质量回归超过批准的 corpus budget，就禁止晋升；
- Structured Codex 执行统一返回 request estimate、实际 usage 与 duration。

`TokenEstimatorCalibration` 默认仍为 2 UTF-8 bytes/token。内存状态只包含数值比例与样本数。可选持久化 Store 额外保存 provider/model identity 与数值时间戳，绝不保存 Prompt、源码、Finding、Judgment 或 Credential；没有配置 Store 时，进程重启仍回到保守默认值。

Model Selection 与 Repository Policy 严格分层。机器级 Model Registry 可以描述 Model Class、Role、Qualification、Health 与标量 Capability metadata；Discovery 本身绝不意味着模型可以被 `auto` 选择。Live Probe 对发生冲突的手工 Override 具有最高事实优先级，因此 Override 可以补充 unknown metadata，但不能把已被 Live Probe 证明为 false 的能力伪造为 true。

各产品继续负责自己的预算值、质量阈值、确定性 Evidence 持久化、Routing 接入与 UI。预算导致的证据遗漏必须显式暴露，禁止静默宣称覆盖完整。持久化 Model Judgment 不属于效率原语：Judgment Lifecycle v1 禁止把历史模型 Finding 当成 fresh 结果或重新参与 Verdict。Codex Change Safe 默认模型调用为 0，因此这些模型效率原语不会给 Change 阶段增加模型请求。
