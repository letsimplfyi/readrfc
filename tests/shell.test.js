import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = path => existsSync(new URL(`../${path}`, import.meta.url));

test('manifest icons exist and the page links its icons and scripts', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(exists(icon.src), icon.src);
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable') && manifest.icons.some(i => i.sizes === '512x512'));
  for (const [, href] of read('index.html').matchAll(/(?:href|src)="\.\/([^"]+)"/g)) assert.ok(exists(href), href);
});

test('icons are the brand kit copies (never redrawn here)', () => {
  assert.match(read('icons/BRAND-README.md'), /readrfc brand kit/);
  assert.match(read('icons/favicon.svg'), /readrfc/);
});

test('the generated index exists, is within budget and matches the shape the app reads', () => {
  const index = JSON.parse(read('data/index.json')), graph = JSON.parse(read('data/graph.json'));
  assert.ok(read('data/index.json').length < 1.5 * 1024 * 1024, 'index.json over budget');
  assert.ok(read('data/graph.json').length < 100 * 1024, 'graph.json over budget');
  assert.ok(index.rfcs.length > 9000 && graph.edges.length > 3000);
  assert.equal(index.rfcs[0].length, 10);
  assert.ok(index.rfcs.every((r, i) => i === 0 || r[0] > index.rfcs[i - 1][0]), 'sorted by number');
});

test('service worker: precaches every runtime file, versions its cache with the app, leaves the RFC Editor on the network', () => {
  const sw = read('sw.js');
  const shell = [...sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];')).matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  for (const file of shell) assert.ok(exists(file), `precached but missing: ${file}`);
  for (const [, file] of read('index.html').matchAll(/(?:href|src)="\.\/([^"]+)"/g)) assert.ok(shell.includes(file), `index.html loads ${file} but sw.js does not precache it`);
  for (const file of readdirSync(new URL('../js/', import.meta.url))) assert.ok(shell.includes(`js/${file}`), `js/${file} is not precached`);
  for (const file of ['data/index.json', 'data/graph.json']) assert.ok(shell.includes(file), file);
  for (const icon of JSON.parse(read('manifest.json')).icons) assert.ok(shell.includes(icon.src), icon.src);
  assert.equal(sw.match(/const CACHE = 'readrfc-shell-([^']+)'/)[1], read('js/config.js').match(/APP_VERSION = '([^']+)'/)[1], 'CACHE and APP_VERSION must carry the same version');
  assert.match(sw, /cache: 'reload'/); assert.match(sw, /skipWaiting/); assert.match(sw, /SKIP_WAITING/); assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(read('js/main.js'), /startUpdates/); assert.match(read('js/update.js'), /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
});

test('the deploy workflow publishes every runtime file and stamps the version', () => {
  const workflow = read('.github/workflows/deploy.yml');
  for (const item of ['index.html', 'styles.css', 'manifest.json', 'sw.js', '_headers', 'js', 'vendor', 'brand', 'icons', 'data']) assert.ok(workflow.includes(item), item);
  assert.match(workflow, /--project-name=readrfc/); assert.match(workflow, /readrfc-shell-dev/); assert.match(workflow, /APP_VERSION = 'dev'/); assert.match(workflow, /GITHUB_RUN_NUMBER/);
});

test('AGENTS.md lists every file in js/', () => {
  const agents = read('AGENTS.md');
  for (const file of readdirSync(new URL('../js/', import.meta.url))) assert.ok(agents.includes(file), `AGENTS.md does not mention js/${file}`);
});
