// Everything kept on the device, under one prefix. Stored values are untrusted: cleaned on read, capped on write.
import { RECENT_KEEP, FAVOURITES_MAX, READ_MAX, POSITIONS_MAX } from './config.js';

const PREFIX = 'readrfc:';
const raw = {
  get(key) { try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage blocked or full: nothing is saved */ } },
};

export const cleanNumbers = (value, max) => [...new Set((Array.isArray(value) ? value : []).filter(n => Number.isInteger(n) && n > 0 && n < 100000))].slice(0, max);
export const cleanPositions = value => {
  const out = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (Object.keys(out).length >= POSITIONS_MAX) break;
      if (/^\d{1,5}$/.test(k) && typeof v === 'string' && /^[A-Za-z0-9.\-]{1,60}$/.test(v)) out[k] = v;
    }
  }
  return out;
};
// New first, no duplicates, capped.
export const pushFront = (list, n, max) => [n, ...list.filter(x => x !== n)].slice(0, max);
export const toggle = (list, n, max) => (list.includes(n) ? list.filter(x => x !== n) : [n, ...list].slice(0, max));

export const store = {
  recent: () => cleanNumbers(raw.get('recent'), RECENT_KEEP),
  favourites: () => cleanNumbers(raw.get('favourites'), FAVOURITES_MAX),
  read: () => cleanNumbers(raw.get('read'), READ_MAX),
  positions: () => cleanPositions(raw.get('positions')),
  theme: () => { const t = raw.get('theme'); return t === 'dark' || t === 'light' ? t : null; },
  textMode: () => { const m = raw.get('textMode'); return m === 'prose' || m === 'mono' ? m : null; },
  save: (key, value) => raw.set(key, value),
};
