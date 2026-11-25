import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ALLOWED_HOSTS = new Set(['www.rfc-editor.org', 'en.wikipedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org', 'commoner.letsimpl.fyi', 'readrfc.letsimpl.fyi', 'letsimpl.fyi', 'github.com', 'brand.letsimpl.fyi', 'www.w3.org', 'example.org']);
const jsFiles = readdirSync(new URL('../js/', import.meta.url)).map(f => `js/${f}`);

test('branding is the vendored letsimpl.fyi brand, loaded before the app styles', () => {
  assert.equal(JSON.parse(read('brand/brand.json')).source, 'https://brand.letsimpl.fyi');
  const html = read('index.html');
  const order = ['brand/tokens/tokens.css', 'brand/css/base.css', 'brand/css/components.css', 'styles.css'].map(f => html.indexOf(f));
  assert.ok(order.every(i => i > 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'load order');
});

test('app styles follow the brand rules: no colours, shadows, gradients, rounded corners or fonts of their own', () => {
  const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(css.match(/#[\da-fA-F]{3,8}\b/g) || [], [], 'no hex colours');
  assert.ok(!/box-shadow|drop-shadow|text-shadow/.test(css), 'no shadows');
  assert.ok(!/(linear|radial|conic)-gradient/.test(css), 'no gradients');
  assert.ok(!/border-radius:\s*[1-9]/.test(css), 'square corners');
  assert.ok(!/@font-face|font-family:(?!\s*var\()/.test(css), 'fonts come from the brand');
  assert.ok(!/font-size:\s*(\d|1[0-3])px/.test(css), 'no tiny fixed font sizes');
});

test('no hex colours in the scripts', () => {
  for (const file of jsFiles) assert.deepEqual(read(file).match(/#[\da-fA-F]{6}\b/g) || [], [], file);
});

test('no inline scripts, styles or event handlers; the CSP allows only the RFC Editor', () => {
  const html = read('index.html');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>[^<]/.test(html), 'no inline script');
  assert.ok(!/<style[\s>]/.test(html) && !/\sstyle="/.test(html) && !/\son[a-z]+="/.test(html));
  const csp = read('_headers').match(/Content-Security-Policy: (.*)/)[1];
  assert.match(csp, /default-src 'self'/); assert.match(csp, /script-src 'self'(;|$)/); assert.match(csp, /style-src 'self'(;|$)/);
  assert.match(csp, /connect-src 'self' https:\/\/www\.rfc-editor\.org https:\/\/en\.wikipedia\.org(;|$)/); assert.match(csp, /img-src 'self' data: https:\/\/upload\.wikimedia\.org https:\/\/thumb\.wikimedia\.org(;|$)/);
  assert.ok(!/unsafe-/.test(csp));
  for (const file of jsFiles) assert.ok(!/\.style\.|innerHTML|insertAdjacentHTML|\bstyle:/.test(read(file)), `${file} sets styles or HTML directly`);
});

test('the page ships an empty app root that main.js clears first', () => {
  assert.match(read('index.html'), /<div id="app"><\/div>/);
  assert.match(read('js/main.js'), /replaceChildren\(\)/);
});

test('the only hosts the app talks to are the RFC Editor, Wikipedia and its own links', () => {
  for (const file of ['index.html', 'styles.css', 'manifest.json', ...jsFiles]) for (const [, host] of read(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) assert.ok(ALLOWED_HOSTS.has(host), `${file} mentions ${host}`);
});

test('requests are anonymous', () => { for (const f of ['js/rfc.js', 'js/wiki.js']) assert.match(read(f), /credentials: 'omit', referrerPolicy: 'no-referrer'/, f); });

test('Wikipedia is asked only when someone opens About, never on load', () => {
  assert.match(read('js/about.js'), /onToggle/); assert.ok(!/fetchSummary/.test(read('js/ui.js')) && !/fetchSummary/.test(read('js/graphview.js')));
});

test('OpenGraph: the page and the deploy are set up for link previews, and the worker leaves share pages to the network', () => {
  const html = read('index.html');
  for (const tag of ['og:type', 'og:site_name', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:image']) assert.ok(html.includes(`"${tag}"`), tag);
  assert.match(html, /og:image" content="https:\/\/readrfc\.letsimpl\.fyi\/icons\/og-image\.png"/);
  assert.match(read('.github/workflows/deploy.yml'), /node tools\/build-share\.mjs dist\/r/);
  assert.match(read('sw.js'), /pathname\.startsWith\('\/r\/'\)\) return/);
  assert.match(read('js/ui.js'), /\/r\/\$\{this\.state\.doc\.n\}/);
});
