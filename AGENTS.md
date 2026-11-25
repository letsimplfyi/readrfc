# AGENTS.md

Instructions for AI agents working in this repository. Humans: read this too.

## What this repo is

**readrfc** (https://readrfc.letsimpl.fyi) is a reader and explorer for IETF RFCs. It has two halves: a clean reader for
the plain text of an RFC, and a quiet graph that shows how RFCs connect (which replaced which, which updated which, when,
and under which working group). It is an app of the **letsimpl.fyi** org, beside `commoner`, `chaikadi.fyi` and `eatsights`.
Source: https://github.com/letsimplfyi/readrfc (AGPL-3.0-or-later; design and docs CC BY-SA 4.0, see the brand repo's LICENSING.md).

It is a **static site**. No backend, no database, no accounts, no analytics. The only build step is a tool that makes the
search index, and it runs in CI, not in the browser. Everything below follows from that.

Sibling repos live beside this one in the org working directory (`../brand`, `../commoner`, `../letsimpl.fyi`), each with its
own git repo under https://github.com/letsimplfyi. Read `../brand/AGENTS.md` and `../commoner/AGENTS.md`: this repo copies
Commoner's architecture on purpose, and where this file is silent, Commoner's rule applies.

## The rules that cannot bend

1. **The brand is the source of truth: https://brand.letsimpl.fyi.** readrfc invents no colour, font, size, spacing or
   component. Tokens, fonts, base CSS and `ls-` components are vendored in `brand/` and load before `styles.css`. Never edit
   `brand/` by hand: run `npm run brand`. Black and white only, square corners, 2px ink borders, no shadows, gradients or
   hatch, text at least 16px (14px for short optional labels), 44px touch targets, 3px focus outline. Colour is for the four
   status states only and never carries meaning alone. **No hex values in `styles.css` or `js/`**; `tests/design.test.js`
   enforces this. See DESIGN.md for how the graph encodes meaning without colour.
2. **Agents create no brand material.** No logo, mark, favicon, app icon, splash, social image or illustration. Missing assets
   stay missing and show as placeholders; list them in the brand's `assets/manifest.json` request to the founder, do not draw
   stand-ins. The wordmark is live text from the brand. Graph nodes and edges are data drawn in SVG, not illustration.
3. **The founder's words are the founder's.** Agents write no taglines, descriptions, empty-state sentences, onboarding, meta
   descriptions, `og:` text, manifest description, 404 text or button copy for real UI. Until the founder supplies the words,
   UI labels are the neutral nouns in DESIGN.md ("Search", "Read", "Recent", "Graph") and anything else is left empty and
   asked about. Documentation about the code (this file, DESIGN.md, README) is allowed. If unsure, it is copy: ask.
   If the founder wants the donation prompt, it is copied verbatim from Commoner (`../commoner/js/support.js`); it is not in v1.
4. **No third-party requests beyond the RFC Editor.** The only host the app may contact is `www.rfc-editor.org`
   (`/rfc/rfcNNNN.txt` and `.json`, open CORS). The CSP in `_headers` allows exactly that, and `tests/design.test.js` fails
   if any other host appears in the source. No CDNs, remote fonts, trackers, analytics, cookie banners or datatracker calls
   at runtime. The index build tool may contact `www.rfc-editor.org` in CI only.
5. **No inline scripts, styles or event-handler attributes** in `index.html` (the CSP forbids them). The pre-paint theme
   script is the separate file `js/theme.js`. In SVG use classes and attributes (`x`, `y`, `d`), not `style=""`.
6. **Never commit secrets.** The Cloudflare token lives in GitHub repo secrets.
7. **Keep it small.** No framework swap, no bundler, no new dependencies, no TypeScript, no CSS preprocessor, no graph or
   physics library. Vendored libraries are Preact and htm only (copied from `../commoner/vendor/` with their licences).
   Ask before adding anything.
8. **Credit what you use.** Anything borrowed (data, algorithm, library, idea) goes in `CREDITS.md` in the same change. RFC
   text is published by the IETF Trust under its own terms; readrfc is **not affiliated with or endorsed by the IETF, the
   IETF Trust or the RFC Editor**. Never use their logos or imitate their marks.

## Principles (inherited from the org)

- **Simple, stupid.** One concern per file. Fewer files, fewer lines, fewer ideas.
- **Quiet UI.** The text is the interface. No intros, no hints that repeat a label, no popups, no autoplay, no motion by
  default, no streaks, no badges, no nagging to read. Optional things are folded away. Obvious actions (copy link, back) are
  icon buttons with `aria-label`.
- **Neuro-atypical first.** Low sensory load, predictable layout, short lines, one idea per screen. The graph is drawn once
  and stays still. Honour `prefers-reduced-motion`, `prefers-color-scheme` and the brand's `data-text`, `data-contrast`,
  `data-colour` settings.
- **Privacy.** Requests to the RFC Editor are anonymous: `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`. Only these
  things are stored, on the device: theme, favourites, recent RFCs, which RFCs were read, reading position, and the service
  worker's app cache. Nothing is sent anywhere.
- **Open data.** The data is the RFC Editor's public index and documents. Link back to the official page of every RFC.

## Layout

```
index.html           the shell: head, brand CSS, one <div id="app"></div>. No inline script or style.
styles.css           layout only, from brand tokens. Keep it small.
manifest.json        PWA manifest (no icons until the founder supplies them)
sw.js                service worker: versioned precache + safe update path (same design as Commoner)
_headers             Cloudflare Pages headers: cache-control, the CSP, referrer policy
robots.txt, sitemap.xml
data/
  index.json         GENERATED search index: one compact record per RFC (see "The index")
  graph.json         GENERATED edges (obsoletes, updates) as number pairs
js/
  main.js            clears #app, renders <App/>, starts the update machinery
  ui.js              the interface: App, Home, Reader, GraphView, Recent (class components, htm)
  rfc.js             pure RFC logic: number parsing, URLs, text fetch, text -> blocks, headings, cross-reference links
  index.js           loads data/*.json once; search (acronym, AND keywords, case rule); lookups by number
  graph.js           pure graph logic: neighbourhood (hops, cap), tag sets, chains, the deterministic layout
  graphview.js       the graph screens: pick a way in, the SVG picture, the list equivalent, the selected-RFC panel
  route.js           the URL is the state: parse and build routes (pure)
  store.js           localStorage: favourites, recent, read marks, reading position (pure + guarded access)
  update.js          registers the service worker; the safe-restart logic (from Commoner)
  icons.js           inline SVG line icons (24 grid, square caps)
  config.js          constants: APP_VERSION, host, graph caps, size limits
  theme.js           sets data-theme before first paint
brand/               VENDORED brand (do not edit; npm run brand)
vendor/              preact.module.js, htm.module.js (+ licences). Do not edit.
tests/
  rfc.test.js        parsing, cross-references, headings, URLs
  index.test.js      search rules, lookups
  graph.test.js      neighbourhoods, caps, chains, layout determinism
  route.test.js      round-trips
  store.test.js      cleaning untrusted stored data
  design.test.js     brand rules, CSP, hosts, no hex colours, no placeholders
  shell.test.js      manifest, precache list, deploy workflow, index freshness
  fixtures.js        tiny index and RFC text builders
  e2e/app.e2e.mjs    real Chromium under the production CSP, RFC Editor faked
tools/
  build-index.mjs    rfc-index.xml -> data/index.json + data/graph.json (CI and `npm run index`)
  sync-brand.mjs     vendors the brand (npm run brand / brand:check), from Commoner
  serve.py           local static server
.github/workflows/
  deploy.yml         tests, stamp the version, deploy to Cloudflare Pages
  index.yml          weekly: rebuild the index, open a commit if it changed
flake.nix, flake.lock, treefmt.toml   dev shell (Node 22, Chromium, Playwright) and formatting
README.md            what it is, URL scheme, run, deploy
DESIGN.md            product and design decisions (keep in step with the code)
```

`tests/shell.test.js` fails if a file in `js/` is missing from this layout or from the service worker's precache list.

## How it works

### State lives in the URL

Hash routes, so Cloudflare Pages needs no rewrite rules and every view is shareable. Back works.

| Route | Meaning |
| --- | --- |
| `#/` | Home: search box, Recent, Favourites |
| `#/?q=...` | Search results |
| `#/rfc/9110` | Reader. `#/rfc/9110/section-5.1` opens at a heading |
| `#/graph` | Pick a way in: areas, streams, decades, tags, groups |
| `#/graph/rfc/9110` | Graph around one RFC. `?hops=1\|2` (default 1). `&sel=N` is the selected node |
| `#/graph/tag/area:sec` | Graph of one tag: `area:`, `wg:`, `stream:` or `kw:` |
| `#/graph/year/1998-2003` | Graph of a year range |

`route.js` owns parsing and building. **Always go through it**; never build these URLs by hand. Unknown or malformed routes
fall back to Home, never to an error page.

### The index (`tools/build-index.mjs`, `data/`)

`https://www.rfc-editor.org/rfc-index.xml` is 13.7 MB (2.3 MB gzip): far too heavy for a phone, so it is reduced at build
time. `index.json` holds, per RFC, only: `n` (number), `t` (title), `y` (year), `m` (month), `s` (status code), `x`
(stream code), `a` (area), `w` (working group), `k` (up to 5 normalised keywords), `p` (pages). Abstracts are **not** in the
index (the per-RFC `.json` has them and is fetched on demand). `graph.json` holds `[from, to, kind]` for obsoletes and
updates. Codes map to words in `js/config.js`. Measure the output: if `index.json` passes **1.5 MB raw**, cut fields, not
corners. The tool must be deterministic (sorted output, no timestamps inside the data) so an unchanged index produces no diff.

Facts about the data that cost time to learn, so do not relearn them:

- The index has **no citation edges**. "A cites B" is not available without crawling all RFC texts or the datatracker. v1 has
  only `obsoletes` and `updates`. Do not fake citations from in-text mentions in the graph.
- Only about 40 % of RFCs (3,951 of 9,869) have any obsoletes/updates link. The graph must work and look right for an RFC with
  no links at all.
- Keywords are noisy (10,636 distinct). Only a curated list of about 50 (frequent and meaningful) becomes `kw:` tags. The list
  lives in `tools/build-index.mjs`. `area` is missing for ~3,500 and `wg` for ~2,600 RFCs (mostly pre-2000): no tag, not an
  error.
- Status strings are uppercase words ("PROPOSED STANDARD", "UNKNOWN"). Map them to short codes once, in the tool.
- Obsoleted-by and updated-by are the **reverse** of the stored edges; compute them in `graph.js`, do not store both ways.
- `rfc-index.xml` also lists `bcp-entry`, `std-entry` and `fyi-entry` records; v1 ignores them.

### Search (`js/index.js`)

Rules copied from rfcreader.com because users expect them: several words mean AND; a title match is a substring; an
all-lowercase query is case-insensitive, any uppercase letter makes it case-sensitive (so `NAT` is not `format`); an acronym
or RFC number typed alone (`9110`, `rfc 9110`, `RFC9110`) goes straight to that RFC. Pure and tested.

### The reader (`js/rfc.js`, `ui.js`)

- Fetches `rfcNNNN.txt` and `rfcNNNN.json` (metadata: authors, status, abstract, obsoletes/updates, errata URL) from
  `www.rfc-editor.org`. Pre-RFC-8650 text may be missing: show the metadata and a link to the official page, not an error.
- The text is plain 72-column ASCII with form feeds and page headers/footers. Strip page furniture (`\f`, the repeated
  "RFC nnnn ... Month Year" lines and `[Page n]` footers) so the text flows. **Never alter the words.**
- Headings are recognised by the numbered pattern (`1.`, `5.1.`, `Appendix A.`) at column 0. They become the contents and
  the `#/rfc/N/section-X` anchors. If none are found there is no contents, no error.
- `RFC 1234`, `RFC1234` and `[RFC1234]` become links to `#/rfc/1234`. Only link numbers that exist in the index. Never
  link inside the title block.
- Default is the brand's Mono font in a `pre-wrap` column with the brand's measure; a toggle switches the body to Atkinson
  Hyperlegible Next with paragraphs reflowed (blank-line separated, code/ASCII-art blocks left as they are).
- Text is built with `textContent`/Preact text nodes only: **never `innerHTML`** for RFC content.
- The reading position is saved per RFC; opening an RFC marks it read.
- Large texts (RFC 9110 is ~500 KB) render in chunks as you scroll; do not block the main thread.

### The graph (`js/graph.js`, `GraphView` in `ui.js`)

See DESIGN.md for what it shows and why. Rules for the code:

- **Local only.** A graph is always a neighbourhood, never the whole corpus. Hard cap `GRAPH_MAX_NODES` (150) in
  `config.js`; when more would match, keep the focus, then the most-connected, then the newest, and show a plain "more" step.
- **Deterministic and still.** Same input, same picture, every time. x = publish year (months break ties); y = relaxation
  that only separates overlapping nodes within a lane; no random seeds, no animation, no dragging. Compute it once, render once.
  `graph.test.js` asserts identical output for identical input.
- **SVG with real links.** Each node is an `<a>` with an accessible name ("RFC 9110, HTTP Semantics, 2022, Internet
  Standard"). Tab order follows year then number. Every graph has the **same data as a list** (a table of the relations)
  reachable from the graph screen; this is the accessible equivalent, not an extra.
- No colour for meaning. Status is shape/fill/stroke (DESIGN.md), arrows are drawn with marker shapes plus dash patterns.

### Favourites, recent, read marks (`js/store.js`)

All in `localStorage` under one `readrfc:` prefix. Stored values are **untrusted**: clean them on read (numbers only, caps,
types), as Commoner does for its support preference. Storage access is wrapped so a blocked or full storage degrades to
"nothing saved", never an error. Caps: 10 recent, 200 favourites, 2000 read marks.

## Updates

Same design as Commoner and it **requires** `sw.js`. Read Commoner's "Updates" section; the rules are identical:
`readrfc-shell-<version>` cache, atomic `addAll` with `cache: 'reload'`, `skipWaiting`, old caches deleted on activate,
`register('./sw.js', { updateViaCache: 'none' })`, safe restart when hidden or idle, version in the footer as a manual check.
Differences: `data/*.json` is part of the precache **and** is stamped into the cache name, so a new index ships with a new
version; RFC texts from `www.rfc-editor.org` are cross-origin and are **never intercepted** by the worker (the RFC Editor
sets its own caching; the app does not build an offline library of RFCs in v1). Never hand-edit a version number; the deploy
stamps `sw.js` and `config.js` with the same value.

## CSP and headers (`_headers`)

```
default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; manifest-src 'self'; img-src 'self' data:;
connect-src 'self' https://www.rfc-editor.org; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

Plus `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(),
geolocation=()`, `Cache-Control: public, no-cache, no-transform`. No `unsafe-*`. To contact a new host: justify it, add it to
`_headers`, to `ALLOWED_HOSTS` in `tests/design.test.js` and to the README, and ask first.

## Testing

```sh
nix develop --command npm test            # unit + design + shell tests (fast, no network)
nix develop --command npm run test:e2e    # real Chromium under the production CSP
npm run index                             # needs the network; rebuilds data/*.json
```

CI runs `npm test` before every deploy. **Run the e2e suite before pushing UI changes.** The e2e suite serves the repo with the
production CSP, fakes `www.rfc-editor.org` with `page.route`, fails on any other outbound request, and covers: search rules,
opening an RFC, contents and section anchors, cross-reference links, the graph (nodes are links, the list equivalent matches
the picture, caps), a no-links RFC, a missing-text RFC, favourites and read marks, theme, a release 1 to 2 update and an
offline start. Beware vacuous waits (`[].every(...)` is `true` on empty). Add a unit test for every new pure function.

Check by eye before handing over: a Playwright screenshot at 390px and at desktop width, light and dark, 200% text, 320px
width, keyboard only, reduced motion, and the graph with 1 node, 20 nodes and the 150-node cap.

## Deploying

Pushes to `main` run `.github/workflows/deploy.yml`: tests, stage the runtime files (`index.html styles.css manifest.json sw.js
_headers robots.txt sitemap.xml LICENSE js vendor brand data`), stamp the version, verify every precached file exists, and
`wrangler pages deploy dist` to the Cloudflare Pages project **`readrfc`** (https://readrfc.letsimpl.fyi, custom domain on the
project). Secrets (repo or org level): `CLOUDFLARE_API_TOKEN` (Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID`. Only runtime files are
published; tests, tools and docs stay private. Output directory is `dist`; there is no Cloudflare build command.

`index.yml` runs weekly (and on demand), runs `tools/build-index.mjs`, and commits `data/` only if it changed. That commit
triggers a deploy. Docs-only commits take `[skip ci]`.

One-time setup (needs the founder's Cloudflare account; agents have no access): `npx wrangler pages project create readrfc
--production-branch=main`, the two secrets, then the custom domain. After a deploy, **verify production, not just CI**: fetch
`/sw.js` and `/js/config.js` and confirm the stamped version, load the site in a real browser and watch the console for CSP
violations, open an RFC, a search and a graph.

## Working agreements

- **Do not push, force-push or rewrite history unless asked.** When you do push, say what changed and what you verified.
- Small, focused commits with plain messages that say why. Never leave the tree half-converted.
- Never commit secrets. Keep `README.md`, `DESIGN.md` and this file in step with the code in the same change.
- Ask when in doubt. Prefer fewer files, fewer lines, fewer ideas.

## Recipes

**Add a tag kind.** Add it to the build tool and `index.json` codes, to `route.js` (round-trip test), to `graph.js` as a
set builder, then the UI. Keep the cap.

**Add a JS file.** Add it to `sw.js` `SHELL` and to the layout above; the tests tell you if you forget. ES module, relative
imports, no build.

**Update the brand.** `npm run brand` (never hand-edit `brand/`); run all tests.

**Add citation edges (later, needs approval).** A separate build-time tool producing `data/cites.json`; the runtime stays
offline of the datatracker. Update this file, DESIGN.md and `ALLOWED_HOSTS` (build tool only) first.

## Known gotchas (expected; confirm and keep this list honest)

- `rfc-index.xml` is large and its namespace is `https://www.rfc-editor.org/rfc-index`; parse with a streaming or regex
  pass, not by loading a DOM in the browser.
- Cloudflare's zone cache setting can override `Cache-Control` on scripts: rely on `cache: 'reload'` and `updateViaCache: 'none'`.
- Cloudflare Pages `_redirects` does not substitute placeholders in query strings. Use hash routes; do not add redirects.
- RFC texts begin with a BOM and blank lines; strip before parsing the title block.
- Old RFCs are not all available as text with the same layout; never assume headings exist.

## Pointers

`README.md` · `DESIGN.md` · `../commoner/AGENTS.md` (architecture this copies) · `../brand/AGENTS.md` and
https://brand.letsimpl.fyi/llms.txt (the brand's rules) · `../letsimpl.fyi/AGENTS.md` (the org site; its project list and
description of readrfc are the founder's to write).
