# Verify a Codex Safe Core release

Download the release artifact and `SHA256SUMS` from the same immutable GitHub Release, then verify both checksum and GitHub build provenance before use:

```bash
sha256sum -c SHA256SUMS
gh attestation verify <downloaded-core-artifact.tgz> -R jiying2007/codex-safe-core
```

The attestation proves which GitHub repository/workflow produced the artifact; it is not a claim that the artifact is bug-free. Keep checksum and provenance verification together.

# 验证 Codex Safe Core Release

从同一个不可变 GitHub Release 下载产物与 `SHA256SUMS`，使用前同时验证校验和与 GitHub Build Provenance：

```bash
sha256sum -c SHA256SUMS
gh attestation verify <下载的-core-产物.tgz> -R jiying2007/codex-safe-core
```

Attestation 用于证明产物由哪个 GitHub 仓库/工作流构建，并不表示产物没有缺陷；校验和与 provenance 应同时验证。
