// Reduces https://www.rfc-editor.org/rfc-index.xml (13.7 MB) to data/index.json and data/graph.json.
// Runs in CI (weekly) and by hand: `npm run index`. `node tools/build-index.mjs file.xml` reads a local copy.
// Output is deterministic (sorted, no timestamps) so an unchanged index produces no diff.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SOURCE = 'https://www.rfc-editor.org/rfc-index.xml';
const OUT = new URL('../data/', import.meta.url);
const MAX_INDEX_BYTES = 1.5 * 1024 * 1024;

const STATUS = {
  'INTERNET STANDARD': 'IS', 'DRAFT STANDARD': 'DS', 'PROPOSED STANDARD': 'PS', 'BEST CURRENT PRACTICE': 'BCP',
  INFORMATIONAL: 'INF', EXPERIMENTAL: 'EXP', HISTORIC: 'HIS', UNKNOWN: 'UNK',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// The tag list is curated: frequent, meaningful, and not a stop word. Kept lower case; anything else is dropped.
const KEYWORDS = new Set(['dns', 'dnssec', 'ipv6', 'ipv4', 'sip', 'bgp', 'http', 'tls', 'tcp', 'udp', 'quic', 'ipsec', 'ike', 'mpls', 'rtp', 'sdp',
  'snmp', 'mib', 'yang', 'netconf', 'mime', 'smtp', 'imap', 'email', 'dhcp', 'dhcpv6', 'ospf', 'is-is', 'nat', 'json', 'xml', 'x.509', 'pki', 'ldap',
  'radius', 'ntp', 'uri', 'multicast', 'routing', 'security', 'authentication', 'encryption', 'cryptography', 'privacy', 'congestion control', 'qos',
  'iot', 'ppp', 'atm', 'gmpls', 'rsvp', 'ftp', 'oauth', 'jose', 'webrtc', 'websocket', 'cbor', 'coap', 'tunneling', 'vpn', 'tcp/ip']);

const text = (block, tag) => (block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1];
const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const ids = (block, tag) => [...(text(block, tag) || '').matchAll(/<doc-id>RFC(\d+)<\/doc-id>/g)].map(m => Number(m[1]));
const table = () => { const list = []; return { list, at: v => { let i = list.indexOf(v); if (i < 0) { i = list.length; list.push(v); } return i; } }; };

export function build(xml) {
  const streams = table(), groups = table(), areas = table(), keywords = table();
  const rfcs = [], edges = [];
  for (const chunk of xml.split('<rfc-entry>').slice(1)) {
    const block = chunk.split('</rfc-entry>')[0];
    const n = Number((text(block, 'doc-id') || '').replace('RFC', ''));
    if (!n) continue;
    const date = text(block, 'date') || '';
    const year = Number((date.match(/<year>(\d+)/) || [])[1]) || 0;
    const month = MONTHS.indexOf((date.match(/<month>(\w+)/) || [])[1]) + 1;
    const status = STATUS[text(block, 'current-status')] || 'UNK';
    const stream = text(block, 'stream');
    const area = text(block, 'area'), wg = text(block, 'wg_acronym');
    const kws = [...new Set([...(text(block, 'keywords') || '').matchAll(/<kw>(.*?)<\/kw>/g)].map(m => decode(m[1]).toLowerCase()).filter(k => KEYWORDS.has(k)))].sort().slice(0, 5);
    const pages = Number(text(block, 'page-count')) || 0;
    rfcs.push([n, decode(text(block, 'title') || ''), year, month, status, stream ? streams.at(stream.toLowerCase()) : -1,
      area ? areas.at(area) : -1, wg && wg !== 'NON WORKING GROUP' ? groups.at(wg) : -1, kws.map(keywords.at), pages]);
    for (const to of ids(block, 'obsoletes')) edges.push([n, to, 'o']);
    for (const to of ids(block, 'updates')) edges.push([n, to, 'u']);
  }
  rfcs.sort((a, b) => a[0] - b[0]);
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1));
  return {
    index: { v: 1, streams: streams.list, areas: areas.list, groups: groups.list, keywords: keywords.list, fields: ['n', 't', 'y', 'm', 's', 'x', 'a', 'w', 'k', 'p'], rfcs },
    graph: { v: 1, kinds: { o: 'obsoletes', u: 'updates' }, edges },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const xml = process.argv[2] ? await readFile(process.argv[2], 'utf8') : await (async () => {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`${SOURCE}: HTTP ${res.status}`);
    return res.text();
  })();
  const { index, graph } = build(xml);
  const a = JSON.stringify(index), b = JSON.stringify(graph);
  if (a.length > MAX_INDEX_BYTES) throw new Error(`index.json is ${a.length} bytes, over the ${MAX_INDEX_BYTES} budget: cut fields`);
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('index.json', OUT), a + '\n');
  await writeFile(new URL('graph.json', OUT), b + '\n');
  console.log(`index.json ${a.length} bytes (${index.rfcs.length} RFCs), graph.json ${b.length} bytes (${graph.edges.length} edges)`);
}
