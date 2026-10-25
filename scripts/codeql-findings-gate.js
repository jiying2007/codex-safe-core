#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { secureReadText } = require('../secure-local-file');

function requireEvidence(condition, message) {
  if (!condition) throw new Error(`CodeQL findings gate: ${message}`);
}
function inspectSarif(report) {
  requireEvidence(report?.version === '2.1.0' && Array.isArray(report.runs) && report.runs.length > 0,
    'missing or invalid SARIF analysis.');
  const blocking = [];
  let results = 0;
  for (const run of report.runs) {
    requireEvidence(run?.tool?.driver?.name === 'CodeQL', 'unexpected analysis producer.');
    const extensions = run.tool.extensions || [];
    requireEvidence(Array.isArray(extensions), 'invalid query pack definitions.');
    const components = [run.tool.driver, ...extensions];
    requireEvidence(components.every(component => component && (component.rules === undefined || Array.isArray(component.rules))),
      'invalid query definitions.');
    // CodeQL Action enables --sarif-group-rules-by-pack: query descriptors
    // then live in tool.extensions, and driver.rules may be empty or absent.
    requireEvidence(Array.isArray(run.results) && components.some(component => component.rules?.length > 0),
      'analysis results or query definitions are missing.');
    requireEvidence(!(run.invocations || []).some(invocation => invocation.executionSuccessful === false), 'analysis execution failed.');
    for (const result of run.results) {
      results++;
      const reference = result.rule?.toolComponent;
      const componentIndex = reference?.index;
      let component = run.tool.driver;
      if (componentIndex !== undefined) {
        requireEvidence(Number.isSafeInteger(componentIndex) && componentIndex >= 0 && componentIndex < extensions.length,
          'result references an invalid query pack.');
        component = extensions[componentIndex];
      } else if (reference?.name !== undefined || reference?.guid !== undefined) {
        const matches = components.filter(item => (reference.name === undefined || item.name === reference.name) &&
          (reference.guid === undefined || item.guid === reference.guid));
        requireEvidence(matches.length === 1, 'result references an ambiguous or missing query component.');
        component = matches[0];
      }
      requireEvidence((reference?.name === undefined || component.name === reference.name) &&
        (reference?.guid === undefined || component.guid === reference.guid), 'result query component identity mismatch.');
      const rules = component?.rules || [];
      const ruleId = result.ruleId || result.rule?.id;
      const index = result.ruleIndex ?? result.rule?.index;
      requireEvidence((result.ruleId === undefined || result.rule?.id === undefined || result.ruleId === result.rule.id) &&
        (result.ruleIndex === undefined || result.rule?.index === undefined || result.ruleIndex === result.rule.index) &&
        (index === undefined || (Number.isSafeInteger(index) && index >= 0)), 'result query identity mismatch.');
      const rule = index === undefined ? rules.find(item => item?.id === ruleId) : rules[index];
      requireEvidence(rule && typeof rule.id === 'string' && rule.id.length > 0 &&
        (ruleId === undefined || ruleId === rule.id) && rules.filter(item => item?.id === rule.id).length === 1,
        'result has no unambiguous matching query definition.');
      const rawSeverity = rule.properties?.['security-severity'];
      const severity = rawSeverity === undefined ? null : Number(rawSeverity);
      requireEvidence(severity === null || (String(rawSeverity).trim() !== '' && Number.isFinite(severity) && severity >= 0 && severity <= 10),
        `invalid security severity for ${rule.id}.`);
      const level = result.level || rule.defaultConfiguration?.level || 'warning';
      if ((severity !== null && severity >= 7) || (severity === null && level === 'error')) {
        const location = result.locations?.[0]?.physicalLocation;
        blocking.push({ ruleId: rule.id, securitySeverity: severity, level,
          file: location?.artifactLocation?.uri || null, line: location?.region?.startLine || null });
      }
    }
  }
  return { ok: blocking.length === 0, runs: report.runs.length, results, blocking };
}
function inspectDirectory(directory) {
  const root = path.resolve(directory);
  requireEvidence(!fs.lstatSync(root).isSymbolicLink(), 'analysis directory must not be a symlink.');
  const files = fs.readdirSync(root).filter(name => name.endsWith('.sarif')).sort();
  requireEvidence(files.length > 0 && files.length <= 16, 'expected between one and sixteen SARIF files.');
  const reports = files.map(name => ({ file: name,
    ...inspectSarif(JSON.parse(secureReadText(path.join(root, name), { maxBytes: 64 * 1024 * 1024 }))) }));
  return { ok: reports.every(report => report.ok), reports };
}
if (require.main === module) {
  try {
    requireEvidence(Boolean(process.argv[2]), 'an analysis output directory is required.');
    const result = inspectDirectory(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspectSarif, inspectDirectory };
