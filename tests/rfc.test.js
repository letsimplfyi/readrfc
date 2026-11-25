import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumber, cleanText, chunks, headingOf, linkify, paragraphs, tidyFront, textUrl, metaUrl, officialUrl } from '../js/rfc.js';
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

test('paragraphs: prose is joined into one paragraph, the double space after a full stop is kept as text', () => {
  const out = paragraphs('   Two sentences.  Joined here, across a long line of words that is\n   filled out to the usual width, and then it ends.\n');
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].kind, out[0].pre], ['p', false]);
  assert.match(out[0].text, /^Two sentences\.  Joined here, across a long line of words that is filled out/);
});

test('paragraphs: lists become items with their markers, continuation lines join their item', () => {
  const [list] = paragraphs('   o  First item that continues\n      onto a second line.\n   o  Second item.\n');
  assert.equal(list.kind, 'list');
  assert.deepEqual(list.items, [{ marker: 'o', text: 'First item that continues onto a second line.' }, { marker: 'o', text: 'Second item.' }]);
  assert.deepEqual(paragraphs('   1.  One\n   2.  Two\n')[0].items.map(i => i.marker), ['1.', '2.']);
  assert.deepEqual(paragraphs('   [RFC2119]  Bradner, S., "Key words for use in RFCs".\n')[0].items.map(i => i.marker), ['[RFC2119]']);
});

test('paragraphs: tables, ABNF, code, figures and dotted leaders stay as published, never joined', () => {
  for (const block of ['   Name      Value\n   a         1', '   field-name     = token\n   field-value    = *( field-content )', '   rule = a / b ;\n   other = c', '   +-------+-------+\n   | one   | two   |\n   +-------+-------+', '   1.  Introduction ............ 4', '   int main() {\n      return 0;\n   }', '   short\n   lines\n   only']) {
    const out = paragraphs(block + '\n');
    assert.equal(out.length, 1); assert.equal(out[0].kind, 'pre', block); assert.equal(out[0].text, block);
  }
});

test('tidyFront: no padding blank lines, no fake centring, two-column header lines split, every word kept', () => {
  const raw = '\n\nRFC: 793\n                                    \n                                    \n                     TRANSMISSION CONTROL PROTOCOL\n\n\n                         DARPA INTERNET PROGRAM\n\n\n\n                             September 1981\n';
  assert.equal(tidyFront(raw), 'RFC: 793\n\nTRANSMISSION CONTROL PROTOCOL\n\nDARPA INTERNET PROGRAM\n\nSeptember 1981\n');
  assert.equal(tidyFront('Network Working Group                                   Steve Crocker\nRequest for Comments: 1                                          UCLA\n'), 'Network Working Group\nSteve Crocker\nRequest for Comments: 1\nUCLA\n');
  assert.equal(tidyFront('Internet Engineering Task Force (IETF)                  R. Fielding, Ed.\n').split('\n').length, 3);
});

test('cleanText: whitespace-only lines become empty, and the old two-line page header goes with its page footer', () => {
  const old = 'RFC: 793\n      \n      \n   Last line of page one.\n\nPostel                                              [Page 3]\n\f\n\fSeptember 1981   \n                                           Transmission Control Protocol\n\n\n\n   Page two starts here.\n';
  const out = cleanText(old);
  assert.ok(!/ +\n/.test(out), 'no trailing spaces');
  assert.ok(!out.includes('[Page 3]') && !out.includes('September 1981') && !out.includes('Transmission Control Protocol'));
  assert.match(out, /Last line of page one\.\n\n   Page two starts here\./);
  assert.equal(paragraphs('   One paragraph that has a long first line of prose, filled out\n   and another.\n      \n   Second paragraph here, which is long enough to count.\n').length, 2);
});

test('paragraphs: the text after a heading starts with a blank line, and its first paragraph is still prose', () => {
  const rest = '\n   Tokens are short textual identifiers that do not include whitespace\n   or delimiters.\n\n   token          = 1*tchar\n\n   Many HTTP field values are defined using common syntax components,\n   separated by whitespace or specific delimiting characters.\n';
  const out = paragraphs(rest);
  assert.deepEqual(out.map(p => p.kind), ['p', 'pre', 'p']);
  assert.equal(out[0].text, 'Tokens are short textual identifiers that do not include whitespace or delimiters.');
});

test('chunks and paragraphs together: a real section body flows', () => {
  const body = chunks(cleanText('5.6.2.  Tokens\n\n   Tokens are short textual identifiers that do not include whitespace\n   or delimiters.\n\n   token = 1*tchar\n')).find(c => c.id === 'section-5.6.2').text;
  const rest = body.split('\n').slice(1).join('\n');
  assert.deepEqual(paragraphs(rest).map(p => p.kind), ['p', 'pre']);
});
