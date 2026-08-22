'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const pkg = require('../package.json');

const namespaceSeed = `${pkg.name}@${pkg.version}`;
const namespaceHash = crypto.createHash('sha256').update(namespaceSeed, 'utf8').digest('hex');
const document = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `${pkg.name}-${pkg.version}`,
  documentNamespace: `https://github.com/jiying2007/codex-safe-core/spdx/${pkg.version}/${namespaceHash}`,
  creationInfo: {
    created: new Date(0).toISOString(),
    creators: ['Tool: codex-safe-core/scripts/generate-sbom.js']
  },
  packages: [{
    name: pkg.name,
    SPDXID: 'SPDXRef-Package',
    versionInfo: pkg.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: pkg.license || 'NOASSERTION',
    licenseDeclared: pkg.license || 'NOASSERTION',
    copyrightText: 'NOASSERTION',
    externalRefs: [{
      referenceCategory: 'PACKAGE-MANAGER',
      referenceType: 'purl',
      referenceLocator: `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version}`
    }]
  }],
  relationships: [{ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: 'SPDXRef-Package' }]
};

fs.writeFileSync(process.argv[2] || 'SBOM.spdx.json', `${JSON.stringify(document, null, 2)}\n`);
