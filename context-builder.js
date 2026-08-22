'use strict';

const GENERATED_PATTERNS = [/package-lock\.json$/i,/pnpm-lock\.yaml$/i,/yarn\.lock$/i,/\.min\.(js|css)$/i,/^dist\//i,/^build\//i,/^vendor\//i];
const BINARY_EXTENSIONS = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.gz','.xz','.7z','.bin','.so','.dll','.exe','.woff','.woff2']);

function classifyPath(filePath) {
  const lower = String(filePath || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  if (BINARY_EXTENSIONS.has(ext)) return 'binary';
  if (GENERATED_PATTERNS.some(pattern => pattern.test(lower))) return 'generated';
  return 'source';
}
function clampBudget(value, fallback = 512 * 1024) { const number = Number(value); return Number.isFinite(number) ? Math.max(4096, Math.min(8 * 1024 * 1024, Math.floor(number))) : fallback; }
function buildSemanticContext({ files = [], diff = '', commits = [], maxBytes = 512 * 1024 } = {}) {
  const budget = clampBudget(maxBytes); const normalizedFiles = files.map(path => ({ path, kind: classifyPath(path) }));
  const source = normalizedFiles.filter(f => f.kind === 'source'); const generated = normalizedFiles.filter(f => f.kind === 'generated'); const binary = normalizedFiles.filter(f => f.kind === 'binary');
  const header = [
    `Changed files: ${normalizedFiles.length}`,
    source.length ? `Source files (${source.length}):\n${source.map(f=>`- ${f.path}`).join('\n')}` : '',
    generated.length ? `Generated/lock files (${generated.length}, metadata only):\n${generated.map(f=>`- ${f.path}`).join('\n')}` : '',
    binary.length ? `Binary files (${binary.length}, metadata only):\n${binary.map(f=>`- ${f.path}`).join('\n')}` : '',
    commits.length ? `Recent commits:\n${commits.slice(0,20).map(v=>`- ${v}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
  const separator = '\n\n--- DIFF ---\n'; const reserved = Buffer.byteLength(header + separator, 'utf8'); const remaining = Math.max(0, budget - reserved);
  const diffBuffer = Buffer.from(String(diff || ''), 'utf8'); const truncated = diffBuffer.length > remaining; const boundedDiff = truncated ? diffBuffer.subarray(0, remaining).toString('utf8') : String(diff || '');
  return Object.freeze({ text: `${header}${separator}${boundedDiff}${truncated ? '\n\n[diff truncated at semantic context budget]' : ''}`, truncated, budgetBytes: budget, inputDiffBytes: diffBuffer.length, sourceFiles: source.map(f=>f.path), generatedFiles: generated.map(f=>f.path), binaryFiles: binary.map(f=>f.path) });
}
module.exports = { classifyPath, clampBudget, buildSemanticContext };
