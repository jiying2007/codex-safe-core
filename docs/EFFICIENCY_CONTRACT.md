# Family Efficiency Contract

Codex Safe Core v4.3 centralizes generic model-cost and execution-efficiency primitives for all Family consumers.

The contract is intentionally product-neutral:

- normalize actual Codex usage from JSONL;
- estimate request tokens conservatively before execution;
- support fail-closed preflight budgets;
- score evidence risk deterministically;
- shrink context/evidence budgets without ever exceeding the configured cap;
- optionally route low-risk work to a caller-selected fast model;
- prioritize higher-risk chunks when a product imposes a total byte budget;
- reserve token capacity across concurrent product jobs;
- report request estimates, actual usage and duration from structured Codex execution.

Products remain responsible for deciding their budgets, quality thresholds, persistence and UI. A product must surface budget-induced evidence omissions rather than silently claim complete coverage.
