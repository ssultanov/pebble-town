// Copies app/ to dist/ and stamps a build id into the page and service worker.
// Build id = short git SHA in CI (GITHUB_SHA), otherwise a timestamp.
import { cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const id = (process.env.GITHUB_SHA || '').slice(0, 7) || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
rmSync('dist', { recursive: true, force: true });
cpSync('app', 'dist', { recursive: true });
for (const f of ['dist/index.html', 'dist/sw.js']) {
  writeFileSync(f, readFileSync(f, 'utf8').replaceAll('__BUILD__', id));
}
console.log(`Built dist/ (build ${id})`);
