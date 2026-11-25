# readrfc design · v0.1 (draft for approval)

**Branding source of truth: https://brand.letsimpl.fyi.** readrfc defines no colour, font, size or component of its own.
Tokens, fonts, base CSS and `ls-` components are vendored into `brand/` and load before `styles.css`. Black and white only,
square corners, 2px ink borders, no shadows or gradients, 44px touch targets, 3px focus ring. No logo, favicon or icon exists
yet; they stay placeholders until the founder supplies them.

This file contains no product copy. All words shown to users are the founder's; until supplied, labels are the neutral nouns
below.

**Quiet by default.** The text is the interface. Every screen is a few controls and almost no prose: no intros, no hints that
repeat a label, no popups, no motion, no pressure to read. Optional things are folded away.

## What it is for

Two jobs, one app:

1. **Read** an RFC comfortably: plain text made readable, with a contents list, working cross-references and the metadata
   that matters.
2. **Explore** how RFCs relate: a still, local graph of what replaced or updated what, over time, under which group, and
   gently lead the visitor into reading one.

It improves on rfcreader.com by dropping accounts, tags-by-login, donation and feedback widgets and the dated layout, and by
adding the graph. Everything personal (favourites, recent, read marks) stays on the device.

## Screens

| Screen | What is on it |
| --- | --- |
| Home | A search box. Below it, Recent and Favourites (only when there are any). One entry to the graph. Footer |
| Search | The same box, a list of results: number, title, year, status. Tap to read |
| Reader | Back, number and title, icon actions (favourite, copy link, graph, official page), a folded Details block, a folded Contents, the text, previous and next section |
| Details | Authors, date, status, stream, area and group, page count, abstract, obsoletes / obsoleted by, updates / updated by, errata link. Folded in the reader, always present |
| Graph | Back, what it is centred on, hop and cap controls, the picture, a **List** switch for the same relations as a table, a Read action for the selected node |
| Footer | One line: unofficial, source, version (tap to check for updates) |

Labels used until the founder writes better ones: Search, Read, Recent, Favourites, Graph, Details, Contents, List. These are
interface nouns, not brand copy, and may be changed by the founder at any time in one place (`js/config.js`).

## Product decisions

| Decision | Selected |
| --- | --- |
| Address | Hash routes; the URL is the state (see AGENTS.md). Back closes things instead of leaving the app |
| Data | RFC Editor only: `rfc-index.xml` reduced at build time to `data/index.json` and `data/graph.json`; each RFC's `.txt` and `.json` fetched on demand |
| Accounts | None. Favourites, recent, read marks and reading position live in `localStorage` |
| Search | Offline against `index.json`: AND words, title substring, lowercase = case-insensitive, any capital = case-sensitive, number or `RFC nnnn` jumps to the RFC |
| Reader type | Brand Mono, 72-column text as published; an optional switch to Atkinson Hyperlegible Next with reflowed paragraphs |
| Page furniture | Page breaks, running headers and `[Page n]` footers are removed; the words are never changed |
| Cross-references | `RFC nnnn` and `[RFCnnnn]` link to the reader when the RFC exists in the index |
| Offline | The app and the index work offline; RFC texts are not stored in v1 |
| Updates | Service worker with per-deploy cache busting and safe restarts (same as Commoner) |
| Third parties | `www.rfc-editor.org` only |
| Support / donation | Not in v1. If wanted, Commoner's prompt is reused verbatim |

## The graph

### What the data allows

From the RFC Editor index (9,869 RFCs, 1968 to 2026): obsoletes (1,546 links) and updates (2,172 links), and per RFC the year,
month, status, stream, area, working group and keywords. **There are no citation links in the index.** Only about 40 % of RFCs
have any obsoletes/updates link, so the graph is honest about being sparse and never invents edges.

### Always local

A graph is one RFC's neighbourhood or one tag's set, never the whole corpus. 9,869 nodes is a hairball, and a hairball is
noise for a neuro-atypical reader. Cap: **150 nodes**. Past the cap the focus is kept, then the most connected, then the
newest, and a plain "more" step reveals the rest.

| Entry | Shows |
| --- | --- |
| From an RFC | The RFC, what it obsoletes and updates, and what obsoleted or updated it, 1 hop (default) or 2 |
| From a tag | Every RFC with one tag: `area:`, `wg:`, `stream:` or one of about 50 curated keywords |
| From a year range | Every RFC published in the range, with the links among them |

An RFC with no links shows alone, with its tag neighbours offered in a list below. It is never an empty screen.

### Layout: a timeline, not a physics toy

- **x is time.** Publish year, with the month as a tie-break. The reader sees at once that a 1999 spec was replaced by a 2022
  one. Year ticks are drawn as hairlines with a text label.
- **y separates, it does not mean.** Nodes are laid out in horizontal lanes by area (or by group inside a single area; one lane
  when a tag already fixes it). Within a lane an overlap-avoidance pass moves nodes just enough to clear each other.
- **Deterministic and still.** The picture is computed once and drawn once. Same input, same image. No force simulation, no
  wobble, no dragging, no animation, no random seeds. This is the main difference from Obsidian's graph and it is deliberate:
  motion is the opposite of low sensory load.
- **Native pan and zoom only.** The SVG sits in a scroll container; the browser scrolls it. Text zoom works. No custom gestures.

### Encoding without colour

The brand allows colour for the four status states only, and never as decoration or as the only cue. Meaning in the graph is
carried by shape, fill, stroke and text. All of this works in greyscale and with `data-colour="reduced"`.

| Data | Encoded as |
| --- | --- |
| Time | Position on x |
| Area / group | Lane (labelled), not colour |
| Number of links | Node size, in three steps (not a continuous scale) |
| Status: Internet Standard | Solid ink fill |
| Status: Draft or Proposed Standard | Page fill, 2px ink outline |
| Status: Best Current Practice | Page fill, double outline |
| Status: Informational, Experimental, other | Page fill, 1px outline |
| Status: Historic | Dashed outline |
| Obsoleted (replaced by a newer RFC) | The node is struck with a short bar and its label is muted, in addition to its status outline |
| Obsoletes link | Solid line, arrowhead at the newer RFC's end |
| Updates link | Dashed line, open arrowhead |
| The centre | 3px outline and a leading marker in its label |
| Read on this device | A small check mark inside the node; unread nodes are plain |
| Favourite | A small star mark beside the label |

Status strings, outlines and marks are chosen so no two statuses differ only by weight; that is checked by eye in greyscale.
Danger, warning, success and info fills are **not used** here: "Historic" is not an error, and a standard is not a success.

Every node carries its number as text. Titles show for nodes in view at the default size and on focus or hover for the rest;
labels never overlap (the layout drops a label before it overlaps another).

### Reading is the destination

The graph exists to lead someone into an RFC, quietly:

- Selecting a node (click, tap, Enter) shows a small panel: number, title, year, status, area/group and the first lines of the
  abstract (fetched on demand from the RFC's `.json`), and a single **Read** button, the one primary action on the screen.
- A **Read newest in this chain** link jumps to the most recent RFC in the connected set, because that is usually the one
  worth reading.
- Unread nodes are simply the plain ones; read ones carry a check. No counters, no streaks, no "you have read 3 of 12".
- A **Random** link opens one unread RFC chosen from the current graph. If all are read it is hidden.
- Nothing prompts, interrupts or celebrates.

### Accessibility

- Each node is a real link (`<a>`) with an accessible name: "RFC 9110, HTTP Semantics, 2022, Internet Standard, obsoletes 7 RFCs".
  Tab order follows year, then number. Focus uses the brand's 3px outline.
- The **List** switch shows the same graph as a table: RFC, title, year, status, obsoletes, updates, obsoleted by, updated by,
  each a link. This is the screen-reader equivalent and is complete, not a summary. It is also the 320px-friendly view.
- The picture has a text title and description (`<title>`, `<desc>`) summarising what it centres on and how many nodes.
- Works at 200 % text, at 320px width (scroll container), with reduced motion (there is none), in light and dark, with high
  contrast, and keyboard only.

## Reader details

- A column at the brand's measure, left-aligned. Section headings are recognised from the numbering and get anchors; **Contents**
  is a folded list of them. Previous and next section buttons are at the foot.
- The title block (header lines, authors, dates) is shown as published, in Mono, above the text.
- The official page link is outbound (`.ls-out`), opening the RFC Editor's page, as is the errata link when there are errata.
- A banner uses the brand callout when an RFC is obsoleted ("info": an icon, a word, a hairline border, never colour alone),
  with a link to what replaced it.
- A missing or unreadable text shows the metadata and the official link, with the brand's error callout (cross icon and bar)
  only for a network failure.

## Data and size

| File | Content | Budget |
| --- | --- | --- |
| `data/index.json` | One compact record per RFC (number, title, year, month, status, stream, area, group, up to 5 keywords, pages) | under 1.5 MB raw, about 400 KB compressed |
| `data/graph.json` | Obsoletes and updates edges as number pairs | under 100 KB |
| App code | Preact, htm, about a dozen small modules, brand CSS, fonts | fonts stay under the brand's 150 KB |

The index is rebuilt weekly in CI and shipped with a new version number, so an update arrives through the same safe-restart
path as a code change. The reader never needs the full 13.7 MB XML.

## Storage

Theme, favourites (max 200), recent (max 10), read marks (max 2000), reading position per RFC: on the device only, cleaned on
read. Nothing is sent anywhere.

## Networking

`www.rfc-editor.org` only: `/rfc/rfcNNNN.txt` and `/rfc/rfcNNNN.json`, anonymous, no cookies, no referrer. Nothing else leaves
the device. The CSP in `_headers` allows exactly that.

## Not in v1

Accounts, sync, notes, highlights, tags of your own, feedback forms, donation prompt, citation edges, BCP/STD/FYI sets,
Internet-Drafts, full-text search across RFC bodies, offline copies of RFC texts, a whole-corpus graph, a map or any physics
layout. Citation edges are the most valuable next step; they need a build-time crawl and a founder decision (see AGENTS.md,
"Add citation edges").

## Open questions for the founder

1. Final interface labels and any home-page words (all copy is yours to write).
2. Logo mark, favicon and app icons (none exist; placeholders until supplied).
3. Whether the donation prompt belongs in this app, and if so the same wording as Commoner.
4. The curated keyword list for `kw:` tags (a first list will be proposed from the data for review).
5. Whether v1 should ship with a hand-picked "start here" set of RFCs, which is editorial and so needs your words and picks.
