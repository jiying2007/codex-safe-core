'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ready = process.argv[2];
spawn(process.execPath, [path.join(__dirname, 'term-resistant-child.cjs'), ready], { stdio: 'ignore' });
const timer = setInterval(() => {
  let child;
  try { child = Number(fs.readFileSync(ready, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!Number.isSafeInteger(child) || child <= 0) return;
  console.log(JSON.stringify({ parent: process.pid, child }));
  clearInterval(timer);
}, 10);
setInterval(() => {}, 1000);
