# Verify a Codex Safe Core release

Download these files from the **same immutable GitHub Release**:

- `jiying2007-codex-safe-core-<version>.tgz`
- `SBOM.spdx.json`
- `CORE_CONTRACT.json`
- `CORE_OWNERSHIP_MANIFEST.json`
- `CORE_DIGESTS.json`
- `SHA256SUMS`

Verify checksums first:

```bash
sha256sum -c SHA256SUMS
```

Then verify GitHub build provenance for every attested release file:

```bash
gh attestation verify jiying2007-codex-safe-core-<version>.tgz -R jiying2007/codex-safe-core
gh attestation verify SBOM.spdx.json -R jiying2007/codex-safe-core
gh attestation verify CORE_CONTRACT.json -R jiying2007/codex-safe-core
gh attestation verify CORE_OWNERSHIP_MANIFEST.json -R jiying2007/codex-safe-core
gh attestation verify CORE_DIGESTS.json -R jiying2007/codex-safe-core
gh attestation verify SHA256SUMS -R jiying2007/codex-safe-core
```

Replace `<version>` with the version of the immutable release being verified. Confirm the downloaded `CORE_CONTRACT.json` matches the protocol/runtime identity expected by the consumer and that the consumer gitlink points to the release tag's exact commit. Verify that `CORE_DIGESTS.json` identifies that same Core version and that its runtime and governance digests match the consumer's `product-contract.json`. Do not treat a matching major version as equivalent to the exact Core pin.

The release workflow verifies two independently generated npm packages are bit-for-bit identical before publication. Provenance proves which GitHub repository/workflow produced an artifact; reproducibility/provenance do not claim the code is bug-free.

For a coordinated family baseline, also retain the attested `FAMILY_BASELINE.json` produced by Family Compatibility. It binds the exact Core SHA and every active consumer SHA selected by `family-registry.json` at one tested family state. Development consumers remain outside that production baseline.

# 验证 Codex Safe Core Release

从**同一个不可变 GitHub Release** 下载：

- `jiying2007-codex-safe-core-<version>.tgz`
- `SBOM.spdx.json`
- `CORE_CONTRACT.json`
- `CORE_OWNERSHIP_MANIFEST.json`
- `CORE_DIGESTS.json`
- `SHA256SUMS`

先验证：

```bash
sha256sum -c SHA256SUMS
```

再逐项验证 GitHub Build Provenance：

```bash
gh attestation verify jiying2007-codex-safe-core-<version>.tgz -R jiying2007/codex-safe-core
gh attestation verify SBOM.spdx.json -R jiying2007/codex-safe-core
gh attestation verify CORE_CONTRACT.json -R jiying2007/codex-safe-core
gh attestation verify CORE_OWNERSHIP_MANIFEST.json -R jiying2007/codex-safe-core
gh attestation verify CORE_DIGESTS.json -R jiying2007/codex-safe-core
gh attestation verify SHA256SUMS -R jiying2007/codex-safe-core
```

将 `<version>` 替换为待验证的不可变 Release 版本。确认 `CORE_CONTRACT.json` 与 Consumer 预期的协议/运行时身份一致，并验证 Consumer gitlink 精确指向 Release Tag 的 commit。确认 `CORE_DIGESTS.json` 标识同一 Core 版本，且其中的 runtime、governance digest 与 Consumer 的 `product-contract.json` 一致；不能把“同 major”当作“同一个 Core pin”。

Release workflow 在发布前会生成两份独立 npm package，并要求 bit-for-bit digest 一致。Attestation、可复现构建与 checksum 都是供应链证据，不表示代码没有缺陷。

协调完成产品族 repin 后，还应保留 Family Compatibility 生成并 attestation 的 `FAMILY_BASELINE.json`，它绑定一个已验证 Family 状态下的 Core SHA 与 `family-registry.json` 选中的所有 active consumer SHA。Development consumer 不纳入该生产基线。
