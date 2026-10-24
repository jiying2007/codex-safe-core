'use strict';

const os = require('node:os');

function familyGitEnvironment(source = process.env) {
  const env = { ...source };
  const token = source.CODEX_SAFE_FAMILY_READ_TOKEN;
  // Never persist credentials in Git config or place them in argv/clone URLs.
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (/^GIT_CONFIG(?:_|$)/.test(upper) || /^GIT_TRACE/.test(upper) || ['GH_TOKEN', 'GITHUB_TOKEN', 'CODEX_SAFE_FAMILY_READ_TOKEN', 'GIT_ASKPASS', 'SSH_ASKPASS', 'GIT_CURL_VERBOSE', 'GIT_SSL_NO_VERIFY'].includes(upper)) delete env[key];
  }
  const config = [
    ['credential.helper', ''], ['core.askPass', ''], ['http.followRedirects', 'false'],
    ['protocol.file.allow', 'never'], ['protocol.ext.allow', 'never']
  ];
  if (token !== undefined && token !== '') {
    if (typeof token !== 'string' || token.length > 8192 || /[\s\0]/.test(token)) throw new Error('Invalid Family read credential.');
    config.push(['http.https://github.com/.extraheader', 'AUTHORIZATION: basic ' + Buffer.from(`x-access-token:${token}`).toString('base64')]);
  }
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = os.devNull;
  env.GIT_CONFIG_COUNT = String(config.length);
  config.forEach(([key, value], index) => { env[`GIT_CONFIG_KEY_${index}`] = key; env[`GIT_CONFIG_VALUE_${index}`] = value; });
  return env;
}
module.exports = { familyGitEnvironment };
