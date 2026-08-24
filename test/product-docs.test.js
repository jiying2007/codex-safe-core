'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

for (const name of ['README.md', 'README.zh-CN.md', 'docs/CONSUMER_GUIDE.md', 'docs/CONSUMER_GUIDE.zh-CN.md', 'SUPPORT.md']) {
  test(`${name} is a permanent product entry`, () => assert.ok(fs.existsSync(path.join(root, name))));
}

test('Core README directs end users to products rather than pretending Core is standalone', () => {
  const text = `${read('README.md')}\n${read('README.zh-CN.md')}`;
  assert.match(text, /not a standalone end-user application|不是面向最终用户独立安装使用的应用/);
  for (const product of ['Codex Review Safe', 'Codex Commit Safe', 'Codex PR Safe', 'Codex Review Service']) assert.match(text, new RegExp(product));
});

test('current product docs stay on Family v4 semantics', () => {
  const text = [read('README.md'), read('README.zh-CN.md'), read('docs/CONSUMER_GUIDE.md'), read('docs/CONSUMER_GUIDE.zh-CN.md')].join('\n');
  assert.match(text, /Safe Core v4/);
  assert.match(text, /Safe Contract v2/);
  assert.match(text, /Policy Schema v3/);
  assert.match(text, /Review Receipt v4/);
  assert.doesNotMatch(text, /Safe Core v[123]\b|Review Receipt v[123]\b|Commit Receipt v[123]\b/);
});
