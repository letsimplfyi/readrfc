# readrfc brand kit

readrfc (readrfc.letsimpl.fyi) is an RFC reader and explorer. This folder is its identity kit.
Source of truth is this repo; apps copy from here (`https://brand.letsimpl.fyi/assets/readrfc/...`).

Status: **created at the founder's direction on 2026-11-25**. The visual assets are ready. There is no tagline: the
founder writes it.

## Identity

| | |
|---|---|
| Name | **readrfc** (lower case, one word) |
| Tagline | none yet (the founder's to write) |
| Descriptor | **Free. Free Software. Simple and Stupid.** (same line as Chaikadi and Commoner) |
| Licence line | AGPL-3.0-or-later |
| Site | readrfc.letsimpl.fyi |

## The mark

A heavy, slightly slanted, angular **R** inside an outlined square, with one solid dot at the top right where a star would
sit on a stamp. The dot is a node: the app is also a graph. Direction from the founder, 2026-11-25: a bold letter mark in a
box, in the spirit of a stamp-style game-studio badge. Nothing is copied from any existing logo, and nothing else is
added: no star, text, texture or shadow. Black on white by default; white on black as the inverse. Same family as the chai
glass and the Commoner camera: an outlined body with solid details, no strokes beyond that.

Geometry (64-unit grid): box x 4..60, y 4..60, with a 1.5-unit wall, the same weight as the band on the chai glass. The R
is one polygon (square, chamfered corners, no curves) skewed by 0.18 about y = 32, with its counter cut as a hole. The dot
is centred at (51.5, 12.5), radius 3.2. Box corners are square, as the brand requires; only the dot is round. The mark is
one path filled with the even-odd rule, so the counter is a clean hole and nothing drifts with scale.

Small sizes: `favicon.svg` is a chunkier version (wall 3.6, larger dot), because 1.5 units disappear at 16 px. Use the
favicon geometry for anything under 32 px.

The wordmark is "readrfc" in Atkinson Hyperlegible Mono Bold (SIL OFL 1.1), converted to outlines so no file needs the
font. In the lockup the box is 80% of the type size tall and sits on the baseline. Gap between box and word: a third of the
type size.

## Use

- Default: black on white (`logo-primary.svg`). On black use `logo-primary-inverse.svg`.
- Clear space: at least the width of the dot on every side.
- Minimum size: the favicon version 16 px; the full mark 32 px; the lockup 120 px wide.
- On a photo or any busy background use the one-colour logo on a solid white or black block.

Do not: add a star, shadow, texture, text or any other detail; round the corners; thicken or thin the lines (use the
favicon version for small sizes); change the slant; rotate, outline, colour or stretch it; redraw the wordmark in another
font; put the box inside a circle or a rounded shape; copy or imitate another studio's mark.

## Files

| File | Use |
|---|---|
| `logo-mark.svg`, `logo-mark-inverse.svg` | Symbol only, transparent |
| `logo-primary.svg`, `logo-primary-inverse.svg` | Lockup (mark + wordmark), 16:9, on page / on ink |
| `logo-mono.svg`, `logo-mono-inverse.svg` | One-colour lockup, transparent |
| `favicon.svg` | Browser tab; follows the device light/dark scheme |
| `app-icon.svg`, `app-icon-192.png`, `app-icon-512.png`, `apple-touch-icon-180.png` | App icons, full bleed, black on white |
| `app-icon-maskable.svg`, `app-icon-maskable-512.png` | Maskable icon (mark inside the 80% safe zone) |
| `splash.svg`, `splash-1080x1920.png` | PWA splash, 9:16 |
| `loading.svg`, `loading-1080x1920.png` | Loading screen, 9:16 (word "Loading") |
| `og-image.svg`, `og-image.png` | Social share image, 1200 x 630 |
| `github-social.svg`, `github-social.png` | GitHub social preview, 1280 x 640 |
| `avatar-400.png` | Profile picture |
| `empty-results.svg`, `not-found.svg`, `offline.svg` | Empty states, 4:3, line glyphs only: a page with lines, a page with a cross, a dashed page |

## Regenerating

`tools/readrfc-kit.py` writes every file here from code (geometry plus outlined text) and rasterises the PNGs with resvg.
The command is in the script header. The output is committed; the script is not part of CI.

## Licence

Design assets: CC BY-SA 4.0 (see `../../LICENSING.md`). The Atkinson Hyperlegible Mono outlines keep the OFL notice in `../../fonts/`.

## Provenance

Created at the founder's direction on 2026-11-25 with an AI assistant, authored in code (polygon geometry plus outlined
text), as a third documented exception to the "agents create zero brand material" rule. See `../../CREDITS.md`.
