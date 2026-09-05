# Family Efficiency Contract

Codex Safe Core v4.17.4 centralizes generic model-cost and execution-efficiency primitives for all Family consumers.

The contract is intentionally product-neutral:

- normalize actual/cached/cache-write/output/reasoning Codex usage from JSONL;
- incrementally consume Codex JSONL while independently bounding total transcript bytes and retained diagnostic output;
- estimate request tokens conservatively before execution and keep preflight budgets fail closed;
- calibrate bytes/token per provider+model from actual input-token usage using a bounded EWMA that activates only after a minimum sample count;
- persist only numeric provider/model calibration when configured, with per-model observation TTL, bounded no-follow reads, owner/permission checks, write locking, merge-on-write and atomic mode-0600 replacement;
- retain a safety discount and hard lower/upper bounds so calibration cannot turn a conservative budget into an optimistic one;
- score evidence risk deterministically and shrink context/evidence budgets without exceeding the configured cap; systems-language file types are only a weak prior, while security/lifetime/concurrency semantics raise risk when they occur on actual changed lines;
- route model work through Model Routing Contract v1 using `fast` / `balanced` / `deep` intent and `scout` / `reviewer` / `adjudicator` roles;
- prefer `healthy` automatic candidates over `unknown` health and reject `unhealthy` candidates;
- optionally consume sufficiently sampled, quality-approved segmented Model Economics in `auto` routing, using deterministic Pareto dominance without allowing cost to bypass compatibility or quality gates;
- bind canonical `registryDigest` and `routingPolicyDigest` into Model Evidence, including the economics identity that influenced an automatic selection, while keeping cross-provider fallback explicit and machine/admin controlled;
- prioritize higher-risk chunks when a product imposes a total byte budget and reserve token capacity across concurrent product jobs;
- produce Model Economics scorecards for tokens per fresh review, cached-input ratio, tokens/cost per verified finding, coverage, false positives, escalation rates and P50/P95 latency;
- segment economics by mode, role, provider, model, Profile Pack and repository-size bucket;
- compare shadow candidate findings and usage without changing the production verdict;
- reject promotion when minimum sample counts or quality constraints are not met, even when the candidate is cheaper;
- report request estimates, actual usage and duration from structured Codex execution.

`TokenEstimatorCalibration` defaults to two UTF-8 bytes/token. Its persistent state contains only provider/model identity, numeric ratios/sample counts and `lastObservedAtMs`; it never retains prompts, source text, findings, judgments or credentials. Unrelated model writes cannot renew a stale calibration entry.

Model selection remains separate from repository policy. A machine Model Registry may describe model class, roles, qualification, health and scalar capability metadata. Discovery alone does not make a model eligible for automatic selection. Registry and routing-policy revisions are accompanied by canonical SHA-256 digests so execution evidence is reproducible. Economics is advisory only when its samples meet the configured minimum and its quality gate is explicitly approved; absent or insufficient economics falls back to deterministic health/class/priority routing rather than invented data.

Quality optimization is constrained rather than token-minimal. The historical recorded corpus remains a regression baseline; the Promotion Corpus adds at least 80 dev/holdout/real-regression cases and clean negatives. A promotion candidate must produce real results and satisfy minimum total/critical sample counts before quality-constrained promotion can pass.

Products remain responsible for their budgets, quality thresholds, deterministic evidence persistence, routing adoption and UI. Budget-induced evidence omissions must remain explicit. Persisted model judgment is not an efficiency primitive: Judgment Lifecycle v1 forbids treating historical model findings as fresh results or verdict input. Codex Change Safe uses zero model calls by default, so these primitives do not add a Change-stage model request.
