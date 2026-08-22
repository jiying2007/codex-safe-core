'use strict';

const { spawnSync } = require('node:child_process');
const {
  REQUIRED_CODEX_TOP_LEVEL_FLAGS,
  REQUIRED_CODEX_EXEC_FLAGS,
  missingHelpFlags
} = require('../safe-contract');

function run(args) {
  const result = spawnSync('codex', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
    shell: process.platform === 'win32'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`codex ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout || ''}`);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

const version = run(['--version']).trim();
const topHelp = run(['--help']);
const execHelp = run(['exec', '--help']);
const missing = [
  ...missingHelpFlags(topHelp, REQUIRED_CODEX_TOP_LEVEL_FLAGS).map(flag => `top-level ${flag}`),
  ...missingHelpFlags(execHelp, REQUIRED_CODEX_EXEC_FLAGS).map(flag => `exec ${flag}`)
];

if (missing.length) {
  console.error(JSON.stringify({ ok: false, version, missing }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  version,
  requiredTopLevelFlags: REQUIRED_CODEX_TOP_LEVEL_FLAGS,
  requiredExecFlags: REQUIRED_CODEX_EXEC_FLAGS
}, null, 2));
