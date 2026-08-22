'use strict';

const GENERATED_PATTERNS = [
  /package-lock\.json$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /\.min\.(js|css)$/i,
  /^dist\//i,
  /^build\//i,
  /^vendor\//i
];
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.xz', '.7z',
  '.bin', '.so', '.dll', '.exe', '.woff', '.woff2'
]);

function classifyPath(filePath) {
  const lower = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  const dot = lower.lastIndexOf('.');
  const ext = dot >= 0 ? lower.slice(dot) : '';
  if (BINARY_EXTENSIONS.has(ext)) return 'binary';
  if (GENERATED_PATTERNS.some(pattern => pattern.test(lower))) return 'generated';
  return 'source';
}

function clampBudget(value, fallback = 512 * 1024) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(4096, Math.min(8 * 1024 * 1024, Math.floor(number)))
    : fallback;
}

function splitUnifiedDiff(diff) {
  const text = String(diff || '');
  if (!text.trim()) return [];
  const starts = [];
  const pattern = /^diff --git /gm;
  let match;
  while ((match = pattern.exec(text))) starts.push(match.index);
  if (!starts.length) return [{ path: '<diff>', text, kind: 'source' }];
  const blocks = [];
  for (let i = 0; i < starts.length; i += 1) {
    const block = text.slice(starts[i], starts[i + 1] ?? text.length);
    const first = block.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const plus = block.match(/^\+\+\+ (?:b\/)?(.+)$/m);
    let file = plus?.[1] || first?.[2] || first?.[1] || '<unknown>';
    if (file === '/dev/null') file = first?.[1] || '<deleted>';
    file = String(file).trim();
    blocks.push({ path: file, text: block, kind: classifyPath(file) });
  }
  return blocks;
}

function byteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

function trimUtf8(value, maxBytes) {
  const buffer = Buffer.from(String(value || ''), 'utf8');
  if (buffer.length <= maxBytes) return buffer.toString('utf8');
  let end = Math.max(0, maxBytes);
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end -= 1;
  return buffer.subarray(0, end).toString('utf8');
}

function boundSourceBlock(block, budget) {
  const text = String(block || '');
  if (byteLength(text) <= budget) return { text, truncated: false };
  const marker = '\n@@ ... semantic budget omitted middle of this file ... @@\n';
  const markerBytes = byteLength(marker);
  if (budget <= markerBytes + 256) return { text: trimUtf8(text, budget), truncated: true };
  const available = budget - markerBytes;
  const headBudget = Math.ceil(available * 0.6);
  const tailBudget = Math.floor(available * 0.4);
  const buffer = Buffer.from(text, 'utf8');
  const head = trimUtf8(text, headBudget);
  let start = Math.max(0, buffer.length - tailBudget);
  while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start += 1;
  const tail = buffer.subarray(start).toString('utf8');
  return { text: `${head}${marker}${tail}`, truncated: true };
}

function allocateSourceBlocks(blocks, maxBytes) {
  if (!blocks.length || maxBytes <= 0) return { text: '', truncated: blocks.length > 0, included: [], truncatedFiles: [] };
  const separator = '\n';
  const totalBytes = blocks.reduce((sum, block) => sum + byteLength(block.text) + 1, 0);
  if (totalBytes <= maxBytes) {
    return {
      text: blocks.map(block => block.text).join(separator),
      truncated: false,
      included: blocks.map(block => block.path),
      truncatedFiles: []
    };
  }

  const minimumPerFile = 2048;
  const fairShare = Math.max(512, Math.floor(maxBytes / blocks.length));
  const allocations = blocks.map(block => Math.min(byteLength(block.text), Math.max(minimumPerFile, fairShare)));
  let allocated = allocations.reduce((a, b) => a + b, 0);
  if (allocated > maxBytes) {
    const ratio = maxBytes / allocated;
    for (let i = 0; i < allocations.length; i += 1) allocations[i] = Math.max(256, Math.floor(allocations[i] * ratio));
    allocated = allocations.reduce((a, b) => a + b, 0);
  }
  let spare = Math.max(0, maxBytes - allocated);
  for (let i = 0; i < blocks.length && spare > 0; i += 1) {
    const missing = Math.max(0, byteLength(blocks[i].text) - allocations[i]);
    const extra = Math.min(missing, spare);
    allocations[i] += extra;
    spare -= extra;
  }

  const output = [];
  const truncatedFiles = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const bounded = boundSourceBlock(blocks[i].text, allocations[i]);
    output.push(bounded.text);
    if (bounded.truncated) truncatedFiles.push(blocks[i].path);
  }
  return {
    text: output.join(separator),
    truncated: true,
    included: blocks.map(block => block.path),
    truncatedFiles
  };
}

function buildSemanticContext({ files = [], diff = '', commits = [], maxBytes = 512 * 1024 } = {}) {
  const budget = clampBudget(maxBytes);
  const diffBlocks = splitUnifiedDiff(diff);
  const paths = files.length ? files : diffBlocks.map(block => block.path).filter(path => !path.startsWith('<'));
  const normalizedFiles = Array.from(new Set(paths)).map(file => ({ path: file, kind: classifyPath(file) }));
  const source = normalizedFiles.filter(file => file.kind === 'source');
  const generated = normalizedFiles.filter(file => file.kind === 'generated');
  const binary = normalizedFiles.filter(file => file.kind === 'binary');

  const header = [
    `Changed files: ${normalizedFiles.length}`,
    source.length ? `Source files (${source.length}):\n${source.map(file => `- ${file.path}`).join('\n')}` : '',
    generated.length ? `Generated/lock files (${generated.length}, metadata only):\n${generated.map(file => `- ${file.path}`).join('\n')}` : '',
    binary.length ? `Binary files (${binary.length}, metadata only):\n${binary.map(file => `- ${file.path}`).join('\n')}` : '',
    commits.length ? `Commits (${Math.min(commits.length, 50)} shown):\n${commits.slice(0, 50).map(value => `- ${value}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  const sourceBlocks = diffBlocks.filter(block => block.kind === 'source');
  const separator = '\n\n--- SOURCE DIFFS ---\n';
  const reserved = byteLength(header + separator);
  const remaining = Math.max(0, budget - reserved);
  const bounded = allocateSourceBlocks(sourceBlocks, remaining);
  const suffix = bounded.truncatedFiles.length
    ? `\n\n[semantic budget truncated source files: ${bounded.truncatedFiles.join(', ')}]`
    : '';

  return Object.freeze({
    text: `${header}${separator}${bounded.text}${suffix}`,
    truncated: bounded.truncated,
    budgetBytes: budget,
    inputDiffBytes: byteLength(diff),
    sourceFiles: source.map(file => file.path),
    generatedFiles: generated.map(file => file.path),
    binaryFiles: binary.map(file => file.path),
    includedSourceFiles: bounded.included,
    truncatedSourceFiles: bounded.truncatedFiles
  });
}

module.exports = {
  classifyPath,
  clampBudget,
  splitUnifiedDiff,
  boundSourceBlock,
  allocateSourceBlocks,
  buildSemanticContext
};
