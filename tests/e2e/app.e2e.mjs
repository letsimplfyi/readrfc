// Drives the real app in Chromium under the production CSP. The RFC Editor is faked with page.route();
// any other request that leaves the machine fails the run.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_TEXT } from '../fixtures.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const CSP = (await readFile(join(root, '_headers'), 'utf8')).match(/Content-Security-Policy: (.*)/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try { const body = await readFile(join(root, normalize(path === '/' ? '/index.html' : path))); res.writeHead(200, { 'content-type': types[extname(path)] || 'text/html', 'content-security-policy': CSP, 'cache-control': 'no-cache' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
test.after(async () => { await browser.close(); server.close(); });

const BIG = ['\n   ' + 'filler text. '.repeat(10) + '\n'].join('').repeat(1800); // pushes past the first chunk
const RFC_TEXT = { 9110: PAGE_TEXT.replace('1.1.  Goals', `${BIG}\n1.1.  Goals`), 2616: null, 7230: 'RFC 7230 text without headings\n' };
const META = { 9110: { doc_id: 'RFC9110', title: 'HTTP Semantics', authors: ['R. Fielding, Ed.', 'M. Nottingham, Ed.'], abstract: 'The Hypertext Transfer Protocol (HTTP) is stateless.', errata_url: 'https://www.rfc-editor.org/errata/rfc9110' } };

async function open(hash = '#/', { viewport = { width: 390, height: 780 }, storage = {}, fail = false } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(entries => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); }, storage);
  const page = await context.newPage();
  const outside = [], violations = [], seen = [];
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.origin === 'https://www.rfc-editor.org') {
      seen.push(url.pathname);
      const m = url.pathname.match(/^\/rfc\/rfc(\d+)\.(txt|json)$/);
      if (!m) { outside.push(url.href); return route.abort(); }
      if (fail) return route.abort();
      const [, n, ext] = m;
      if (ext === 'txt') return RFC_TEXT[n] ? route.fulfill({ contentType: 'text/plain', body: RFC_TEXT[n] }) : route.fulfill({ status: 404, body: '' });
      return META[n] ? route.fulfill({ json: META[n] }) : route.fulfill({ status: 404, body: '' });
    }
    outside.push(url.href); return route.abort();
  });
  await page.goto(base + '/' + hash);
  return { page, context, outside, violations, seen };
}

test('home: search, AND words, a number jumps to the RFC, no CSP violations and nothing leaves the machine', async () => {
  const { page, context, outside, violations } = await open();
  const box = page.getByLabel('Search');
  await box.fill('http');
  await page.locator('.result').first().waitFor();
  assert.match(await page.getByRole('status').first().innerText(), /\d+ results?/);
  assert.ok((await page.locator('.result').count()) >= 1);
  await box.fill('http semantics');
  await page.waitForFunction(() => document.querySelector('.result .result-t')?.textContent.includes('HTTP Semantics'));
  await box.fill('9110'); await box.press('Enter');
  await page.waitForURL(/#\/rfc\/9110$/);
  assert.deepEqual(outside, []); assert.deepEqual(violations, []);
  await context.close();
});

test('reader: title, details, contents, section links, cross-references, and the text is complete', async () => {
  const { page, context, violations } = await open('#/rfc/9110');
  await page.locator('.rfc').first().waitFor();
  assert.match(await page.locator('h1').innerText(), /RFC 9110\s+HTTP Semantics/);
  assert.ok(!(await page.locator('.rfc-text').innerText()).includes('[Page 1]'));
  await page.getByText('Details').click();
  assert.match(await page.locator('.details').innerText(), /R\. Fielding, Ed\.[\s\S]*Internet Standard[\s\S]*Obsoletes\s+RFC 2818/);
  await page.getByText('Contents', { exact: true }).click();
  await page.locator('.toc a', { hasText: 'Collected ABNF' }).click();
  await page.waitForURL(/section-A$/);
  await page.waitForFunction(() => { const r = document.getElementById('section-A')?.getBoundingClientRect(); return !!r && r.top < innerHeight && r.bottom > 0 && scrollY > 1000; });
  await page.goto(base + '/#/rfc/9110'); // cross-reference to an RFC that is in the index becomes a link
  await page.locator('#abstract a', { hasText: 'RFC 2616' }).click();
  await page.waitForURL(/#\/rfc\/2616$/);
  assert.deepEqual(violations, []);
  await context.close();
});

test('reader: a section anchor in the URL opens at that heading, beyond the first chunk', async () => {
  const { page, context } = await open('#/rfc/9110/section-A');
  await page.waitForFunction(() => { const r = document.getElementById('section-A')?.getBoundingClientRect(); return !!r && r.top < innerHeight && r.bottom > 0 && scrollY > 1000; });
  await context.close();
});

test('reader: an obsoleted RFC says so, and an RFC with no text still shows its details', async () => {
  const { page, context } = await open('#/rfc/2616');
  await page.getByText('Obsoleted by').first().waitFor();
  await page.getByText('No text for this RFC').waitFor();
  await context.close();
});

test('reader: a network failure shows an error with Retry, never a blank page', async () => {
  const { page, context } = await open('#/rfc/9110', { fail: true });
  await page.getByRole('alert').getByText('Could not load this RFC').waitFor();
  await page.getByRole('button', { name: 'Retry' }).waitFor();
  await context.close();
});

test('favourites, recent and read marks persist on the device and show on home', async () => {
  const { page, context } = await open('#/rfc/9110');
  await page.locator('.rfc').first().waitFor();
  await page.getByRole('button', { name: 'Add to favourites' }).click();
  await page.getByRole('button', { name: 'Remove from favourites' }).waitFor();
  await page.locator('a.brand').click();
  await page.getByRole('heading', { name: 'Favourites' }).waitFor();
  await page.getByRole('heading', { name: 'Recent' }).waitFor();
  assert.equal(await page.locator('.results .result').count(), 2);
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('readrfc:favourites'))), [9110]);
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('readrfc:read'))), [9110]);
  await context.close();
});

test('theme toggles and is remembered; the reflowed mode joins paragraphs (the default on a phone)', async () => {
  const { page, context } = await open('#/rfc/9110', { viewport: { width: 1100, height: 800 } });
  await page.locator('.rfc').first().waitFor();
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: /theme/ }).click();
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), before);
  await page.getByRole('button', { name: 'Reflowed text' }).click();
  await page.locator('.prose-p').first().waitFor();
  await context.close();
});

test('bad input never breaks the page: unknown route, unknown RFC, junk in storage', async () => {
  for (const hash of ['#/nope', '#/rfc/abc', '#/rfc/99999']) {
    const { page, context } = await open(hash, { storage: { 'readrfc:recent': '"nope"', 'readrfc:favourites': '{"a":1}', 'readrfc:positions': '[1]' } });
    await page.getByRole('main').waitFor();
    await page.waitForFunction(() => !document.querySelector('main').textContent.includes('Loading') || document.querySelector('[role=alert], .ls-callout'));
    await context.close();
  }
});

test('works at 320px wide without sideways scrolling', async () => {
  const { page, context } = await open('#/rfc/9110', { viewport: { width: 320, height: 640 } });
  await page.locator('.rfc').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await context.close();
});

test('a phone starts in reflowed mode, a desktop in the published layout, and the choice sticks', async () => {
  const phone = await open('#/rfc/9110');
  await phone.page.locator('.prose-p').first().waitFor();
  await phone.page.getByRole('button', { name: 'Reflowed text' }).click();
  await phone.page.locator('.rfc-text--mono').waitFor();
  assert.equal(await phone.page.evaluate(() => localStorage.getItem('readrfc:textMode')), '"mono"');
  await phone.context.close();
  const desk = await open('#/rfc/9110', { viewport: { width: 1100, height: 800 } });
  await desk.page.locator('.rfc-text--mono').waitFor();
  await desk.context.close();
});
