# Family Efficiency Contract

Codex Safe Core v4.15.0 centralizes generic model-cost and execution-efficiency primitives for all Family consumers.

The contract is intentionally product-neutral:

- normalize actual/cached/cache-write/output/reasoning Codex usage from JSONL;
- incrementally consume Codex JSONL while independently bounding total transcript bytes and retained diagnostic output;
- estimate request tokens conservatively before execution;
- support fail-closed preflight budgets;
- calibrate bytes/token per provider+model from actual input-token usage using a bounded EWMA that activates only after a minimum sample count;
- optionally persist only numeric provider/model calibration through the bounded Token Calibration Store with TTL, atomic mode-0600 writes and symbolic-link rejection;
- retain a safety discount and hard lower/upper bounds so calibration cannot turn a conservative budget into an optimistic one;
- score evidence risk deterministically;
- shrink context/evidence budgets without ever exceeding the configured cap;
- route model work through Model Routing Contract v1 using stable `fast` / `balanced` / `deep` intent and `scout` / `reviewer` / `adjudicator` roles when a consumer adopts routing;
- keep cross-provider fallback explicit and machine/admin controlled rather than repository controlled;
- prioritize higher-risk chunks when a product imposes a total byte budget;
- reserve token capacity across concurrent product jobs;
- produce Model Economics scorecards such as tokens per fresh review, cached-input ratio, tokens/cost per verified finding, coverage efficiency, escalation rate and P50/P95 latency;
- compare shadow candidate findings and usage without changing the production verdict;
- reject a cheaper candidate from promotion when quality regression exceeds the approved corpus budget;
- report request estimates, actual usage and duration from structured Codex execution.

`TokenEstimatorCalibration` defaults to two UTF-8 bytes/token. Its in-memory state contains only numeric ratios/sample counts. The optional persistent store adds provider/model identity and numeric timestamps only; it never retains prompts, source text, findings, judgments or credentials. Without a configured store, a process restart still returns to the conservative default.

Model selection remains separate from repository policy. A machine model registry may describe model class, roles, qualification, health and scalar capability metadata. Discovery alone does not make a model eligible for automatic selection. Live capability evidence is authoritative over a conflicting manual override, so an override can fill unknown metadata but cannot turn a proven-negative live probe into a proven capability.

Products remain responsible for deciding their budgets, quality thresholds, deterministic evidence persistence, routing adoption and UI. A product must surface budget-induced evidence omissions rather than silently claim complete coverage. Persisted model judgment is not an efficiency primitive: Judgment Lifecycle v1 forbids treating historical model findings as fresh results or verdict input. Codex Change Safe uses zero model calls by default, so these model-efficiency primitives do not add a Change-stage model request.
