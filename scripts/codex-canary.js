'use strict';

const { spawnSync } = require('node:child_process');
const {
  REQUIRED_CODEX_TOP_LEVEL_FLAGS,
  REQUIRED_CODEX_EXEC_FLAGS,
  SAFE_CODEX_CONFIG_OVERRIDES,
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

const strictConfigArgs = ['--ask-for-approval', 'never', 'exec', '--strict-config', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--sandbox', 'read-only'];
for (const value of SAFE_CODEX_CONFIG_OVERRIDES) strictConfigArgs.push('--config', value);
strictConfigArgs.push('--help');
run(strictConfigArgs);

console.log(JSON.stringify({
  ok: true,
  version,
  requiredTopLevelFlags: REQUIRED_CODEX_TOP_LEVEL_FLAGS,
  requiredExecFlags: REQUIRED_CODEX_EXEC_FLAGS,
  strictConfigOverridesVerified: SAFE_CODEX_CONFIG_OVERRIDES
}, null, 2));
