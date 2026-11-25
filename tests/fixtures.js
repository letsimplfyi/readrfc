import { hydrate } from '../js/index.js';
// A tiny index in the shape tools/build-index.mjs writes.
export const INDEX = { v: 1, streams: ['ietf', 'legacy'], areas: ['sec', 'art'], groups: ['httpbis', 'tls'], keywords: ['http', 'tls', 'security'], fields: [],
  rfcs: [
    [2616, 'Hypertext Transfer Protocol -- HTTP/1.1', 1999, 6, 'DS', 1, -1, -1, [0], 176],
    [2818, 'HTTP Over TLS', 2000, 5, 'INF', 0, 0, 1, [0, 1], 7],
    [8446, 'The Transport Layer Security (TLS) Protocol Version 1.3', 2018, 8, 'PS', 0, 0, 1, [1, 2], 160],
    [9110, 'HTTP Semantics', 2022, 6, 'IS', 0, 1, 0, [0], 194],
    [9112, 'HTTP/1.1', 2022, 6, 'IS', 0, 1, 0, [0], 46],
    [1234, 'Format of NAT Tables', 1991, 1, 'INF', 1, -1, -1, [], 3],
  ] };
export const GRAPH = { v: 1, kinds: { o: 'obsoletes', u: 'updates' }, edges: [[9110, 2616, 'o'], [9112, 2616, 'o'], [8446, 2818, 'u']] };
export const data = () => hydrate(INDEX, GRAPH);

export const PAGE_TEXT = [
  '\uFEFF',
  'Internet Engineering Task Force (IETF)                  R. Fielding, Ed.',
  'Request for Comments: 9110                                         Adobe',
  '',
  'Abstract',
  '',
  '   The protocol described in RFC 2616 and [RFC2818] is stateless and',
  '   continues here.',
  '',
  '1.  Introduction',
  '',
  '   This text runs on and the sentence is not finished at the page',
  '',
  'Fielding, et al.             Standards Track                  [Page 1]',
  '\f',
  'RFC 9110                      HTTP Semantics                   June 2022',
  '',
  '   break, so it continues without a blank line.',
  '',
  '1.1.  Goals',
  '',
  '   Goals.',
  '',
  'Appendix A.  Collected ABNF',
  '',
  '   More.',
  '',
  'Fielding, et al.             Standards Track                  [Page 2]',
  '',
].join('\n');
