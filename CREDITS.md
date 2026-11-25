# Credits

readrfc stands on other people's work. Where we use it, we say so. Nothing here implies endorsement: readrfc is not affiliated
with or endorsed by the IETF, the IETF Trust, the RFC Editor, the Wikimedia Foundation, Wikipedia or Wikidata.

## Data and documents

- **RFC Editor** (https://www.rfc-editor.org). The RFC index (`rfc-index.xml`: titles, dates, status, working groups, areas,
  keywords, authors, obsoletes and updates links) is reduced at build time into `data/index.json` and `data/graph.json`. The
  text and metadata of each RFC are fetched from the RFC Editor when someone opens it; nothing is stored here. RFCs are
  published under the IETF Trust's legal provisions: https://trustee.ietf.org/license-info
- **Wikidata** (https://www.wikidata.org), CC0 1.0. At build time we read each RFC's "main subject" (the protocol it is about),
  its authors who have a Wikipedia article, and the English Wikipedia article and Commons category names of those items. The
  result is `data/topics.json` and `data/people.json`. Authors are linked to a person only where Wikidata lists them as an
  author of that RFC and exactly one author name in the RFC Editor's index matches; anything uncertain is left out.
- **Wikipedia** (https://en.wikipedia.org), text under CC BY-SA 4.0. When someone opens "About", one summary (a short extract,
  a one-line description and the lead picture) is requested from Wikipedia's public API and shown with a link to the article.
  Pictures keep their own licences and authors, shown on the Wikipedia and Commons pages we link to.
- **Wikimedia Commons** (https://commons.wikimedia.org). "Photos on Commoner" opens our sibling app on the topic's Commons
  category; each photo keeps its own licence there.

## Design

- **letsimpl.fyi brand** (https://brand.letsimpl.fyi): tokens, CSS, components and fonts, vendored unedited into `brand/`.
  Code AGPL-3.0-or-later; design values and docs CC BY-SA 4.0. See the brand repo's `CREDITS.md` for its own lineage
  (Paul Tol's status colours, the Atkinson Hyperlegible fonts and more).
- **readrfc identity kit** (the mark, icons and share image in `icons/`): created at the founder's direction on 2026-11-25
  with an AI assistant, as a documented exception to the brand's "agents create zero brand material" rule. Copied from
  `assets/readrfc/` in the brand repo; never redrawn here.
- **Atkinson Hyperlegible Mono and Next**, by the Braille Institute of America, SIL Open Font License 1.1. Self-hosted through
  the brand; the licence notices ship in `brand/fonts/`.
- **Commoner** (https://commoner.letsimpl.fyi), our sibling app, whose architecture this app follows (static site, service
  worker with safe updates, URL as state) and whose update code in `js/update.js` is reused. AGPL-3.0-or-later.

## Libraries (vendored in `vendor/`, no build step)

- **Preact**, by Jason Miller and contributors, MIT. https://preactjs.com
- **htm**, by Jason Miller and contributors, Apache-2.0. https://github.com/developit/htm

The licence texts sit beside each file (`vendor/preact.LICENSE`, `vendor/htm.LICENSE`).

## Ideas

- **rfcreader.com** showed what an RFC reader should do (search by title or acronym, lower case ignores case, a capital makes
  it case-sensitive). We took the idea of the search rules, no code and no design.
