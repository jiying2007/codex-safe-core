'use strict';
const fs = require('node:fs');

process.on('SIGTERM', () => {});
fs.writeFileSync(process.argv[2], String(process.pid));
setInterval(() => {}, 1000);
