'use strict';

const { spawn } = require('child_process');
const path = require('path');

function createProcessRunner(ui = (_zh, en) => en) {
  function isWindowsScript(command) { return process.platform === 'win32' && /\.(cmd|bat)$/i.test(command); }
  function quoteWindowsCmdArg(value) { return `"${String(value).replace(/"/g, '""')}"`; }
  function prepareCommand(command, args) {
    if (!isWindowsScript(command)) return { command, args, shell: false };
    const commandLine = '"' + [quoteWindowsCmdArg(command), ...args.map(quoteWindowsCmdArg)].join(' ') + '"';
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d','/v:off','/s','/c',commandLine], shell: false, windowsVerbatimArguments: true };
  }
  function runPreparedProcess(command, args, options = {}, stdinText = '', cancellationToken) {
    const prepared = prepareCommand(command, args);
    return runProcess(prepared.command, prepared.args, { ...options, shell: false, windowsVerbatimArguments: prepared.windowsVerbatimArguments === true }, stdinText, cancellationToken);
  }
  function runProcess(command, args, options = {}, stdinText = '', cancellationToken) {
    return new Promise((resolve, reject) => {
      let child; let settled = false; let timeoutHandle; let forceKillHandle; let cancellationDisposable; let terminationError; let terminating = false;
      const cleanup = () => { if (timeoutHandle) clearTimeout(timeoutHandle); if (forceKillHandle) clearTimeout(forceKillHandle); cancellationDisposable?.dispose?.(); };
      const settle = (fn, value) => { if (settled) return; settled = true; cleanup(); fn(value); };
      const terminate = error => {
        if (terminating) return; terminating = true; terminationError = error;
        if (!child || child.killed) return settle(reject, error);
        if (process.platform === 'win32' && child.pid) {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
          killer.once('close', () => settle(reject, error)); killer.once('error', () => { try { child?.kill(); } catch {} settle(reject, error); }); return;
        }
        try { if (child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
        forceKillHandle = setTimeout(() => { try { if (child?.pid) process.kill(-child.pid, 'SIGKILL'); else child?.kill('SIGKILL'); } catch { try { child?.kill('SIGKILL'); } catch {} } settle(reject, error); }, 1500);
      };
      try {
        child = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, windowsHide: true, shell: options.shell === true, windowsVerbatimArguments: options.windowsVerbatimArguments === true, detached: process.platform !== 'win32' });
      } catch (error) { return settle(reject, error); }
      let stdout = ''; let stderr = ''; let stdoutBytes = 0; let stderrBytes = 0;
      const maxStdoutBytes = options.maxStdoutBytes ?? 4 * 1024 * 1024; const maxStderrBytes = options.maxStderrBytes ?? 1024 * 1024;
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { const text = String(chunk); stdoutBytes += Buffer.byteLength(text); if (stdoutBytes > maxStdoutBytes) { const e = new Error(ui(`子进程 stdout 超过限制（${maxStdoutBytes} bytes）`,`Child process stdout exceeded the limit (${maxStdoutBytes} bytes)`)); e.code='EOUTPUTLIMIT'; return terminate(e); } stdout += text; });
      child.stderr.on('data', chunk => { const text = String(chunk); stderrBytes += Buffer.byteLength(text); if (stderrBytes > maxStderrBytes) { const e = new Error(ui(`子进程 stderr 超过限制（${maxStderrBytes} bytes）`,`Child process stderr exceeded the limit (${maxStderrBytes} bytes)`)); e.code='EOUTPUTLIMIT'; return terminate(e); } stderr += text; });
      child.once('error', error => settle(reject, error));
      child.once('close', code => { if (settled) return; if (terminationError) { if (process.platform === 'win32') settle(reject, terminationError); return; } if (code === 0) settle(resolve, { stdout, stderr }); else { const e = new Error(`${path.basename(command)} exited with code ${code}\n${stderr || stdout}`.trim()); e.code=code ?? -1; e.stdout=stdout; e.stderr=stderr; settle(reject,e); } });
      if ((options.timeoutMs || 0) > 0) timeoutHandle = setTimeout(() => { const e = new Error(ui(`进程执行超时（${Math.round(options.timeoutMs/1000)} 秒）`,`Process timed out after ${Math.round(options.timeoutMs/1000)} seconds`)); e.code='ETIMEDOUT'; terminate(e); }, options.timeoutMs);
      if (cancellationToken) {
        if (cancellationToken.isCancellationRequested) { const e = new Error(ui('操作已取消。','Operation cancelled.')); e.code='ECANCELLED'; terminate(e); return; }
        cancellationDisposable = cancellationToken.onCancellationRequested(() => { const e = new Error(ui('操作已取消。','Operation cancelled.')); e.code='ECANCELLED'; terminate(e); });
      }
      if (stdinText) child.stdin.write(stdinText, 'utf8'); child.stdin.end();
    });
  }
  function runProcessBuffer(command, args, options = {}, cancellationToken) {
    return runProcess(command, args, { ...options, maxStdoutBytes: options.maxStdoutBytes ?? 16 * 1024 * 1024 }, '', cancellationToken).then(({stdout,stderr}) => ({ stdout: Buffer.from(stdout), stderr: Buffer.from(stderr) }));
  }
  return Object.freeze({ isWindowsScript, quoteWindowsCmdArg, prepareCommand, runPreparedProcess, runProcess, runProcessBuffer });
}
module.exports = { createProcessRunner };
