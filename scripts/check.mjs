// Fast static checks that run before the browser tests:
// every inline <script> in index.html and sw.js must parse, the manifest must be valid JSON,
// and the page must not load scripts from outside (kids' app: no third-party code).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let failed = false;
const fail = (msg) => { console.error('✗ ' + msg); failed = true; };

const html = readFileSync('app/index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
scripts.forEach((m, i) => {
  if (/\ssrc=/.test(m[0].slice(0, m[0].indexOf('>')))) fail(`index.html script #${i + 1} loads an external file`);
  try { new vm.Script(m[1], { filename: `index.html#script${i + 1}` }); } catch (e) { fail(`index.html script #${i + 1}: ${e.message}`); }
});
try { new vm.Script(readFileSync('app/sw.js', 'utf8'), { filename: 'sw.js' }); } catch (e) { fail(`sw.js: ${e.message}`); }
try { JSON.parse(readFileSync('app/manifest.webmanifest', 'utf8')); } catch (e) { fail(`manifest.webmanifest: ${e.message}`); }
if (!html.includes('<title>')) fail('index.html has no <title>');

if (failed) process.exit(1);
console.log(`✓ ${scripts.length} inline scripts, sw.js and manifest look good`);
