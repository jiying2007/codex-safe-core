'use strict';

const contract = require('../core-contract.json');

function renderCurrentContractBlock(value = contract) {
  return [
    '<!-- GENERATED:CORE-CONTRACT:START -->',
    `- Core ${value.coreVersion} / Safe Core v${value.safeCoreMajorVersion}`,
    `- Safe Contract v${value.safeContractVersion} / Policy Schema v${value.policySchemaVersion}`,
    `- Review Receipt v${value.reviewReceiptVersion} / Commit Receipt v${value.commitReceiptVersion} / Diagnosis Receipt v${value.diagnosisReceiptVersion}`,
    `- Review / Commit / Diagnose Prompt Contract v${value.reviewPromptContractVersion}`,
    `- Runtime v${value.codexRuntimeVersion} / Provider Contract v${value.providerContractVersion}`,
    `- Model Routing / Registry / Lineage / Economics v${value.modelRoutingContractVersion}/${value.modelRegistryVersion}/${value.modelLineageVersion}/${value.modelEconomicsVersion}`,
    `- Token Calibration / Store v${value.tokenCalibrationVersion}/${value.tokenCalibrationStoreVersion}`,
    `- Family Snapshot v${value.familySnapshotVersion} / Family Manifest v${value.familyManifestVersion} / Product Contract v${value.productContractVersion}`,
    `- Consumer CI Receipt v${value.consumerCiReceiptVersion} / Core Digest Contract v${value.coreDigestContractVersion} / Repository Governance Contract v${value.repositoryGovernanceContractVersion}`,
    `- Node 22 LTS >=${value.minimumNodeVersion} <23 / Node 24 LTS >=${value.canonicalNodeVersion} <25`,
    '<!-- GENERATED:CORE-CONTRACT:END -->'
  ].join('\n');
}

module.exports = { renderCurrentContractBlock };
