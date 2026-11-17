# Deterministic Review Optimization (Core 4.18.8)

The review quality and efficiency improvements are **independently implemented** after studying [Alibaba OpenCodeReview](https://github.com/alibaba/open-code-review) (Apache-2.0). They do not import Go runtime code or copy upstream prompt/code. The default path stays offline and deterministic.

## Components

- `planSemanticReviewGroups(files, options)`: inputs are immutable changed-file metadata and unified-Diff text. Links implementation, header, tests, localization counterparts and changed include/import references; enforces max files/bytes per group, never omits a file, and falls back to singleton grouping for very large file counts without model calls. Grouping changes dispatch order, **not** the admissible changed-line/coverage contract; a too-large singleton is reported as oversized and must remain an explicit coverage gap if downstream scheduling rejects it.
- `resolveFileReviewRules(path, options)`: bounded, fixed built-in rules for MCU/ISR/DMA, motor/FOC, OTA/boot, Linux driver, API/ABI, CI supply chain, config, localization and regression tests. Output comes only from trusted Core constants. A file path is **data** for deterministic matching, never an instruction source. These rules can emphasize checks; they cannot override machine policy, output schema, tooling restrictions or authentication.
- `buildReviewPlanPreview({files,chunks,groups,coverageGaps})`: reports selected, excluded and unplanned paths plus groups/chunks and explicit gaps before model execution. `modelCalls=0` by construction. Provider Diff completeness, preview coverage and actual completed model coverage remain **separate** facts.
- `auditReviewClaims(findings,{evidenceByPath})`: signals only a narrow literal missing-code claim directly contradicted by an added line in that **same** file. Security, concurrency, resource and API findings are protected. Always preserves the full findings set; a disputed claim requires human/authorized verification, never silent model-based suppression.

## Offline quality comparison

```bash
node scripts/review-quality-compare.js --corpus cases.json --baseline prior-run.json --candidate candidate-run.json
```

Corpus requires `{cases:[{id,expected:[{file,line,category,severity},...]}]}`. Both runs must have exactly one `{id,findings,usage:{inputTokens,outputTokens},durationMs}` per case plus identical `provider`, `model`, `budgetClass`, and `corpusDigest` (SHA-256 over `JSON.stringify(cases)`). Missing result/usage, duplicate/foreign cases, mismatched run identity or corpus digest rejects the comparison. The scorer reports recall, critical recall, precision, false-positive/review, duplicate/invalid-line rate, tokens per true positive, average duration when available, and direct candidate-minus-baseline deltas.

This is **offline scoring only**; it does not call a model and makes no claim about fresh execution or superior real-world performance. For AACR-Bench, ingest only an approved normalized/licensed subset, preserve ground-truth labels and provenance, and compare the same holdout cases under the same model, provider, budget and environment. Preserve Source/Model SHA and latency measurement metadata in a higher-level run receipt rather than inventing missing evidence.

## Safety boundaries

- File selection may not silently exclude tests, build files, security files or generated evidence needed for compatibility; existing repository policy remains authoritative.
- All groups still flow through the canonical Diff/Hunk budget planner, which must retain omission reasons and changed-line anchors.
- Do **not** add an automatic grouping LLM call, autonomous code-search shell, new provider credentials, uncontrolled reflection rounds or replay of stale judgment.
- No production deployment, GitLab data/SQLite migration or Codex/Work API execution is part of these primitives.
