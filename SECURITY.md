# Security Policy

## Scope

Codex Safe Core is a safety boundary used by Codex Commit Safe, Codex Review Safe and Codex PR Safe. Security regressions in this repository are considered product-family regressions.

## Trust boundaries

1. **Workspace/repository** — repository content, configuration, paths and Git history are untrusted input.
2. **Codex executable** — the configured executable must expose every required safety capability; missing capabilities fail closed.
3. **Git executable/repository state** — snapshots and fingerprints are rechecked around operations that rely on stable staged state.
4. **AI output** — always untrusted structured data; validate syntax, schema, semantics, size and path fields before rendering or consuming it.
5. **Remote provider** — GitHub/GitLab/provider behavior belongs to product adapters and must never expand Codex execution authority.

## Non-negotiable invariants

- Codex runs with `--ask-for-approval never` and a read-only sandbox.
- Structured output is required.
- User Codex config/rules are ignored for safety-critical runs.
- Shell/unified exec, web search, apps, hooks, memories, multi-agent and remote plugins are disabled.
- Missing or rejected safety flags never trigger a legacy fallback.
- Process execution has finite time and output limits and supports cancellation.
- AI output never directly executes a command, writes a file, commits, pushes or opens a PR without product-side validation and explicit user action.
- Vendored core bytes must be pinned and verified by consuming repositories.

## Reporting

Please report suspected vulnerabilities privately through GitHub Security Advisories when available. Do not include secrets, credentials, private repository content or exploit data in public issues.
