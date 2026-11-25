// The URL is the state. Hash routes, so a static host needs no rewrite rules.
//   #/                  home          #/?q=http          search
//   #/rfc/9110          reader        #/rfc/9110/section-5.1   reader at a heading
// Unknown or malformed routes fall back to home, never to an error page.
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
  return { view: 'home', q: (params.get('q') || '').slice(0, 200) };
}

export const homeHref = q => (q ? `#/?q=${encodeURIComponent(q)}` : '#/');
export const rfcHref = (n, section = '') => `#/rfc/${n}${section ? `/${encodeURIComponent(section)}` : ''}`;
export const routeKey = r => (r.view === 'rfc' ? `rfc:${r.n}` : `home:${r.q}`);
