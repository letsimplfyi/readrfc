// The Wikipedia summary of a topic, fetched only when someone opens "About" (never in the background).
// Anonymous: no cookies, no referrer. Only Wikimedia image hosts are accepted for the picture.
import { FETCH_TIMEOUT_MS } from './config.js';

const WIKI = 'https://en.wikipedia.org';
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);

export const summaryUrl = title => `${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
export const pageUrl = title => `${WIKI}/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
// Our own sibling app shows the topic's photos; nothing is fetched from it here.
export const commonerUrl = category => `https://commoner.letsimpl.fyi/?c=${encodeURIComponent(category)}`;

const safeImage = src => { try { const u = new URL(src); return u.protocol === 'https:' && IMAGE_HOSTS.has(u.hostname) ? u.href : ''; } catch { return ''; } };

// Reduces the API answer to what is shown. Returns null when there is nothing to show.
export function parseSummary(json) {
  if (!json || typeof json !== 'object' || json.type === 'disambiguation' || typeof json.extract !== 'string' || !json.extract.trim()) return null;
  const image = json.thumbnail && typeof json.thumbnail === 'object' ? safeImage(json.thumbnail.source) : '';
  return {
    title: typeof json.title === 'string' ? json.title : '',
    description: typeof json.description === 'string' ? json.description : '',
    extract: json.extract.replace(/\s+/g, ' ').trim(),
    image, width: image ? Number(json.thumbnail.width) || 0 : 0, height: image ? Number(json.thumbnail.height) || 0 : 0,
  };
}

export async function fetchSummary(title, signal) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeout.abort());
  try {
    const res = await fetch(summaryUrl(title), { credentials: 'omit', referrerPolicy: 'no-referrer', signal: timeout.signal, headers: { accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSummary(await res.json());
  } finally { clearTimeout(timer); }
}
