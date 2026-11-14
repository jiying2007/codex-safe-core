# Paired Core performance measurements

Performance Trend resolves the newest final immutable Core release on the
candidate's ancestry whose commit differs from the candidate. It verifies the
release attestation and checks out that exact commit in a separate worktree.
An unavailable, unverified or non-ancestor release stops qualification.

The current benchmark harness measures both runtime checkouts in the same job
with the same Node executable, workload and resource limits. Seven pairs run
in isolated subprocesses, alternating which side runs first. Each subprocess
has a 30-second deadline. Source SHAs and clean tracked files are checked before
and after measurement; the report includes harness and orchestrator hashes.

Raw observations, including a failed child and all observations preceding it,
are uploaded before comparison. Missing or invalid samples are never zero-cost
or zero-time observations. Relative latency/RSS limits remain 10 percent and
the absolute limits remain 5 seconds / 256 MiB. A failure prevents publication
of passing immutable evidence. Existing historical snapshots remain immutable;
their measurements from different runners are not reused as denominators.

The new asset has `kind: paired-core-performance` and contains `baseline`,
`candidate`, `comparison`, and ordered raw `sampling.observations`. It is a
deterministic 4 MiB microbenchmark. The seven-sample P95 fields are observed
maxima useful for diagnosis, not a population latency SLO. Estimated tokens
describe this synthetic workload, not actual model usage, cost savings, or
proof of unchanged model quality. Product and model qualification remain
separate.

The existing Performance Trend workflow runs on relevant main-branch changes
as well as its existing manual/weekly triggers. No new scheduled job or model
invocation is introduced. CI regression tests exercise source selection,
measurement failure, real subprocess loading, clean-source identity and the
unchanged absolute/relative budgets.
