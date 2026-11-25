import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, cleanText, chunks, headingOf, linkify, paragraphs, textUrl, metaUrl, officialUrl } from '../js/rfc.js';
import { PAGE_TEXT } from './fixtures.js';

test('numbers: 9110, rfc 9110, RFC9110 and rfc-9110 all mean the same RFC; nothing else does', () => {
  for (const s of ['9110', 'rfc 9110', 'RFC9110', 'rfc-9110', ' RFC 09110 ']) assert.equal(parseNumber(s), 9110, s);
  for (const s of ['', 'http', '0', 'rfc', '9110 http', '123456']) assert.equal(parseNumber(s), null, s);
});

test('urls point only at the RFC Editor', () => {
  assert.equal(textUrl(9110), 'https://www.rfc-editor.org/rfc/rfc9110.txt');
  assert.equal(metaUrl(9110), 'https://www.rfc-editor.org/rfc/rfc9110.json');
  assert.equal(officialUrl(9110), 'https://www.rfc-editor.org/info/rfc9110');
});

test('cleanText drops the BOM, form feeds, running headers and page footers, and keeps every word', () => {
  const out = cleanText(PAGE_TEXT);
  assert.ok(!out.includes('\f') && !out.includes('\uFEFF'));
  assert.ok(!/\[Page \d+\]/.test(out));
  assert.ok(!/RFC 9110 +HTTP Semantics +June 2022/.test(out));
  const words = s => s.split(/\s+/).filter(Boolean);
  const kept = new Set(words(out));
  for (const w of words(PAGE_TEXT.replace(/\[Page \d+\]|Fielding, et al\.|Standards Track|RFC 9110 +HTTP Semantics +June 2022|\uFEFF/g, ''))) assert.ok(kept.has(w), `lost the word ${w}`);
});

test('cleanText joins a paragraph that continues across a page break, and keeps the blank line after a finished sentence', () => {
  const out = cleanText(PAGE_TEXT);
  assert.match(out, /not finished at the page\n   break, so it continues/);
  const ended = cleanText('   One sentence ends here.\n\nPostel                                    [Page 1]\n\f\nRFC 1                Title                  May 1990\n\n   Next page.\n');
  assert.match(ended, /here\.\n\n   Next page\./);
});

test('headings: numbered, appendix and named headings at column 0; never indented lines, contents leaders or list items', () => {
  assert.equal(headingOf('1.  Introduction', 0).id, 'section-1');
  assert.equal(headingOf('5.1.  Methods', 0).id, 'section-5.1');
  assert.equal(headingOf('Appendix A.  Collected ABNF', 0).id, 'section-A');
  assert.equal(headingOf('A.1.  Details', 0).id, 'section-A.1');
  assert.equal(headingOf('Abstract', 0).id, 'abstract');
  assert.equal(headingOf('Status of This Memo', 0).id, 'status-of-this-memo');
  assert.equal(headingOf('   1.  Introduction', 0), null);
  assert.equal(headingOf('1.  Introduction ............ 4', 0), null);
  assert.equal(headingOf('2 apples, and', 0), null);
  assert.equal(headingOf('', 0), null);
});

test('chunks: a title block first, then one chunk per heading, ids unique, text complete', () => {
  const list = chunks(cleanText(PAGE_TEXT));
  assert.deepEqual(list.map(c => c.id), ['', 'abstract', 'section-1', 'section-1.1', 'section-A']);
  assert.match(list[0].text, /Request for Comments: 9110/);
  assert.equal(new Set(list.map(c => c.id)).size, list.length);
  assert.equal(list.map(c => c.text).join('').replace(/\s+/g, ''), cleanText(PAGE_TEXT).replace(/\s+/g, ''));
  assert.deepEqual(chunks('Just text\nwith no headings\n').map(c => c.id), ['']);
});

test('linkify: only RFCs that exist become links, the words are unchanged', () => {
  const exists = n => n === 2616 || n === 2818;
  const parts = linkify('See RFC 2616, [RFC2818] and RFC 9999.', exists);
  assert.deepEqual(parts.filter(p => typeof p !== 'string'), [{ n: 2616, text: 'RFC 2616' }, { n: 2818, text: '[RFC2818]' }]);
  assert.equal(parts.map(p => (typeof p === 'string' ? p : p.text)).join(''), 'See RFC 2616, [RFC2818] and RFC 9999.');
  assert.deepEqual(linkify('nothing here', exists), ['nothing here']);
});

test('paragraphs: prose is joined, tables, lists and figures stay as published', () => {
  const text = '   First line of a paragraph\n   and its second line.\n\n   Name      Value\n   a         1\n\n   o  one\n   o  two\n\n      indented code\n';
  const out = paragraphs(text);
  assert.deepEqual(out[0], { pre: false, text: 'First line of a paragraph and its second line.' });
  assert.ok(out.slice(1).every(p => p.pre));
  assert.deepEqual(paragraphs('   Two sentences.  Joined here,\n   across lines.\n')[0], { pre: false, text: 'Two sentences.  Joined here, across lines.' });
});
