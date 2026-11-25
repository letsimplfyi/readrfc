// Writes one small static page per RFC: dist/r/rfc<n>.html (served at /r/rfc<n>), plus dist/r/404.html for unknown numbers. Link-preview crawlers (chat apps, social sites) do not read the part of
// an address after "#", so the app's own routes cannot carry a preview. These pages can: each has that RFC's own OpenGraph and
// Twitter tags, then sends a person on to the app with a plain redirect. Data only: title, authors, date, status, pages.
// Run by the deploy workflow: `node tools/build-share.mjs dist/r`. Nothing here is brand copy.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export const ORIGIN = 'https://readrfc.letsimpl.fyi';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS = { IS: 'Internet Standard', DS: 'Draft Standard', PS: 'Proposed Standard', BCP: 'Best Current Practice', INF: 'Informational', EXP: 'Experimental', HIS: 'Historic', UNK: '' };

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// rec: { n, title, year, month, status, pages, authors: [names] }
export function describe(rec) {
  const when = rec.month ? `${MONTHS[rec.month - 1]} ${rec.year}` : String(rec.year || '');
  return [rec.authors.join(', '), when, STATUS[rec.status], rec.pages ? `${rec.pages} pages` : ''].filter(Boolean).join(' · ');
}

export function sharePage(rec) {
  const title = `RFC ${rec.n}: ${rec.title}`, description = describe(rec), url = `${ORIGIN}/r/rfc${rec.n}`, target = `/#/rfc/${rec.n}`, image = `${ORIGIN}/icons/og-image.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)} · readrfc</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url=${target}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="readrfc">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="readrfc">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${image}">
</head>
<body>
<p><a href="${target}">${esc(title)}</a></p>
</body>
</html>
`;
}

// Cloudflare Pages answers an unknown path with the nearest 404.html: here, one that just sends the person to the app.
export function notFoundPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>readrfc</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=/">
</head>
<body>
<p><a href="/">readrfc</a></p>
</body>
</html>
`;
}

export function records(index) {
  return index.rfcs.map(([n, t, y, m, s, , , , , p, u]) => ({ n, title: t, year: y, month: m, status: s, pages: p, authors: u.map(i => index.authors[i]) }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'dist/r';
  const index = JSON.parse(await readFile(new URL('../data/index.json', import.meta.url), 'utf8'));
  await mkdir(out, { recursive: true });
  const list = records(index);
  for (const rec of list) await writeFile(`${out}/rfc${rec.n}.html`, sharePage(rec));
  await writeFile(`${out}/404.html`, notFoundPage());
  console.log(`wrote ${list.length} share pages and a not-found page to ${out}`);
}
