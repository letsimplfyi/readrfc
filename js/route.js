// The URL is the state. Hash routes, so a static host needs no rewrite rules.
//   #/                  home          #/?q=http          search
//   #/rfc/9110          reader        #/rfc/9110/section-5.1   reader at a heading
//   #/graph             pick a way in #/graph/rfc/9110?hops=2&sel=2616   around one RFC
//   #/graph/tag/area:sec  one tag (area, wg, stream, kw, topic)   #/graph/year/1998-2003   a range of years
// Unknown or malformed routes fall back to home, never to an error page.
export const TAGS = ['area', 'wg', 'stream', 'kw', 'topic'];
const num = s => (/^\d{1,5}$/.test(s) && Number(s) > 0 ? Number(s) : null);

export function parseRoute(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return ''; } });
  const params = new URLSearchParams(query);
  if (parts[0] === 'rfc') {
    const n = num(parts[1] || '');
    if (n) {
      const section = /^section-[A-Za-z0-9.\-]+$/.test(parts[2] || '') ? parts[2] : '';
      return { view: 'rfc', n, section };
    }
  }
  if (parts[0] === 'graph') {
    const sel = num(params.get('sel') || '');
    const base = { view: 'graph', kind: 'choose', sel };
    if (parts[1] === 'rfc' && num(parts[2] || '')) return { ...base, kind: 'rfc', n: num(parts[2]), hops: params.get('hops') === '2' ? 2 : 1 };
    if (parts[1] === 'tag') {
      const [tag, ...rest] = (parts[2] || '').split(':'), value = rest.join(':');
      if (TAGS.includes(tag) && /^[A-Za-z0-9.\-/ ]{1,40}$/.test(value)) return { ...base, kind: 'tag', tag, value };
    }
    if (parts[1] === 'year') {
      const m = (parts[2] || '').match(/^(\d{4})-(\d{4})$/);
      if (m && +m[1] >= 1960 && +m[1] <= +m[2] && +m[2] <= 2100) return { ...base, kind: 'year', from: +m[1], to: +m[2] };
    }
    return base;
  }
  return { view: 'home', q: (params.get('q') || '').slice(0, 200) };
}

export const homeHref = q => (q ? `#/?q=${encodeURIComponent(q)}` : '#/');
export const rfcHref = (n, section = '') => `#/rfc/${n}${section ? `/${encodeURIComponent(section)}` : ''}`;
export const routeKey = r => (r.view === 'rfc' ? `rfc:${r.n}` : r.view === 'graph' ? graphHref(r) : `home:${r.q}`);

// Graph hrefs. `sel` is the selected node, kept in the address so a view can be shared.
export const graphHref = (r, sel = null) => {
  let path = '#/graph', query = new URLSearchParams();
  if (r.kind === 'rfc') { path += `/rfc/${r.n}`; if (r.hops === 2) query.set('hops', '2'); }
  else if (r.kind === 'tag') path += `/tag/${encodeURIComponent(`${r.tag}:${r.value}`)}`;
  else if (r.kind === 'year') path += `/year/${r.from}-${r.to}`;
  if (sel) query.set('sel', String(sel));
  const q = query.toString();
  return q ? `${path}?${q}` : path;
};
export const tagHref = (tag, value) => graphHref({ kind: 'tag', tag, value });
