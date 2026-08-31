# Family 效率契约

Codex Safe Core v4.10.2 为整个产品族统一提供通用的模型成本与执行效率原语。

该契约保持产品无关：

- 从 Codex JSONL 统一解析实际 Token usage；
- 在执行前保守估算请求 Token，并支持 fail-closed preflight；
- 根据真实 input-token usage 为 provider+model 维护有界 EWMA bytes/token 校准，达到最小样本数后才启用；
- 校准始终保留安全折扣与硬上下界，不能把保守预算变成乐观预算；
- 确定性评估证据风险；
- 自适应预算只允许缩小，绝不突破配置上限；
- 可选把低风险任务路由到调用方指定的 fast model；
- 在产品设置总字节预算时优先保留高风险 chunk；
- 为并发产品任务提供 Token reservation；
- Structured Codex 执行统一返回 request estimate、实际 usage 与 duration。

`TokenEstimatorCalibration` 默认仍为 2 UTF-8 bytes/token。校准状态只保存数值比例与样本数，不保存 prompt 或源码；进程重启会回到保守默认值。

各产品继续负责自己的预算值、质量阈值、持久化与 UI。预算导致的证据遗漏必须显式暴露，禁止静默宣称覆盖完整。Codex Change Safe 默认模型调用为 0，因此这些模型效率原语不会给 Change 阶段增加模型请求。
