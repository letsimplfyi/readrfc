// Pure graph logic: which RFCs to show, and where to put them. No DOM, no randomness: the same input always gives
// the same picture (the graph is drawn once and stays still).
import { GRAPH_MAX_NODES, GRAPH, GRAPH_V, AREA_NONE } from './config.js';

const time = r => (r.year || 0) + (r.month ? (r.month - 1) / 12 : 0.5);
const newer = (a, b) => time(b) - time(a) || b.n - a.n; // sort: newest first

// All relations of one RFC: [{ n, kind: 'o' | 'u', dir: 'out' | 'in' }]. 'out': this RFC obsoletes/updates n. 'in': n does it to this one.
export function relations(data, n) {
  const list = [];
  for (const to of data.obsoletes.get(n) || []) list.push({ n: to, kind: 'o', dir: 'out' });
  for (const to of data.updates.get(n) || []) list.push({ n: to, kind: 'u', dir: 'out' });
  for (const from of data.obsoletedBy.get(n) || []) list.push({ n: from, kind: 'o', dir: 'in' });
  for (const from of data.updatedBy.get(n) || []) list.push({ n: from, kind: 'u', dir: 'in' });
  return list;
}
export const degree = (data, n) => relations(data, n).length;

// Keeps the focus first, then the most connected, then the newest, up to `max`.
function cap(data, numbers, max, focus = null) {
  const records = [...new Set(numbers)].map(n => data.byNumber.get(n)).filter(Boolean);
  if (records.length <= max) return { records, capped: false, total: records.length };
  const ranked = records.filter(r => r.n !== focus).sort((a, b) => degree(data, b.n) - degree(data, a.n) || newer(a, b));
  const keep = (focus && data.byNumber.has(focus) ? [data.byNumber.get(focus)] : []).concat(ranked).slice(0, max);
  return { records: keep, capped: true, total: records.length };
}

// The edges between the chosen RFCs, as { from, to, kind }: `from` obsoletes or updates `to`, so `from` is the newer one.
export function edgesAmong(data, records) {
  const inside = new Set(records.map(r => r.n)), edges = [];
  for (const r of records) {
    for (const to of data.obsoletes.get(r.n) || []) if (inside.has(to)) edges.push({ from: r.n, to, kind: 'o' });
    for (const to of data.updates.get(r.n) || []) if (inside.has(to)) edges.push({ from: r.n, to, kind: 'u' });
  }
  return edges.sort((a, b) => a.from - b.from || a.to - b.to || (a.kind < b.kind ? -1 : 1));
}

const finish = (data, picked, extra = {}) => ({ records: picked.records, edges: edgesAmong(data, picked.records), capped: picked.capped, total: picked.total, ...extra });

// Everything within `hops` links of one RFC (any direction).
export function neighbourhood(data, n, hops = 1, max = GRAPH_MAX_NODES) {
  if (!data.byNumber.has(n)) return finish(data, { records: [], capped: false, total: 0 }, { focus: n });
  const seen = new Set([n]);
  let edge = [n];
  for (let i = 0; i < hops; i++) {
    const next = [];
    for (const m of edge) for (const { n: other } of relations(data, m)) if (!seen.has(other) && data.byNumber.has(other)) { seen.add(other); next.push(other); }
    edge = next;
  }
  return finish(data, cap(data, [...seen], max, n), { focus: n });
}

// Tags: area, wg (working group), stream, kw (keyword).
export function withTag(data, tag, value) {
  const out = [];
  for (const r of data.byNumber.values()) {
    if (tag === 'area' ? r.area === value : tag === 'wg' ? r.group === value : tag === 'stream' ? r.stream === value : r.keywords.includes(value)) out.push(r.n);
  }
  return out;
}
export const tagSet = (data, tag, value, max = GRAPH_MAX_NODES) => finish(data, cap(data, withTag(data, tag, value), max), { focus: null });
export function yearSet(data, from, to, max = GRAPH_MAX_NODES) {
  const out = [];
  for (const r of data.byNumber.values()) if (r.year >= from && r.year <= to) out.push(r.n);
  return finish(data, cap(data, out, max), { focus: null });
}

// The newest RFC that nothing in the set has replaced; the one most worth reading. Falls back to the newest overall.
export function newestInChain(data, records) {
  const inside = new Set(records.map(r => r.n));
  const current = records.filter(r => !(data.obsoletedBy.get(r.n) || []).some(n => inside.has(n)));
  return [...(current.length ? current : records)].sort(newer)[0] || null;
}

// What to offer on the "pick a way in" screen: tag counts, most frequent first, and the decades with RFCs.
export function chooser(data) {
  const count = map => [...map].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n || (a.value < b.value ? -1 : 1));
  const areas = new Map(), streams = new Map(), groups = new Map(), keywords = new Map(), decades = new Map();
  const bump = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const r of data.byNumber.values()) {
    bump(areas, r.area); bump(streams, r.stream); bump(groups, r.group); r.keywords.forEach(k => bump(keywords, k));
    if (r.year) bump(decades, Math.floor(r.year / 10) * 10);
  }
  return { areas: count(areas), streams: count(streams), groups: count(groups), keywords: count(keywords), decades: [...decades.keys()].sort((a, b) => a - b) };
}

// ---- layout ---------------------------------------------------------------------------------------
// x is time. With `lanes`, rows are grouped by area; otherwise there is one timeline. A node takes the free row nearest the
// rows of the RFCs it is linked to (so links stay short), else the first free row. Nothing overlaps.
// Returns plain numbers for the view to draw: { width, height, nodes, edges, lanes, ticks }.
export function layout(data, graph, { lanes: useLanes = false, ...overrides } = {}) {
  const opts = { ...GRAPH, ...overrides };
  const { records } = graph;
  if (!records.length) return { width: opts.minWidth, height: opts.padTop + opts.row, nodes: [], edges: [], lanes: [], ticks: [] };
  const times = records.map(time), lo = Math.min(...times), hi = Math.max(...times), span = hi - lo;
  const ordered = [...records].sort((a, b) => time(a) - time(b) || a.n - b.n);
  const xs = new Map();
  if (span < 1) ordered.forEach((r, i) => xs.set(r.n, opts.padLeft + i * opts.spread));      // a short span: one after another
  else ordered.forEach(r => xs.set(r.n, opts.padLeft + (time(r) - lo) * opts.pxPerYear));
  const right = Math.max(...xs.values());
  const width = Math.max(opts.minWidth, right + opts.padRight + opts.labelGap / 2);

  const laneOf = r => (useLanes ? r.area || '' : '');
  const linked = new Map(records.map(r => [r.n, []]));
  for (const e of graph.edges) { linked.get(e.from)?.push(e.to); linked.get(e.to)?.push(e.from); }
  const laneKeys = [...new Set(records.map(laneOf))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : a > b ? 1 : 0));
  let top = opts.padTop;
  const lanes = [], nodes = new Map();
  for (const key of laneKeys) {
    const rows = [];
    for (const r of ordered.filter(r => laneOf(r) === key)) {
      const x = xs.get(r.n);
      const near = linked.get(r.n).map(m => nodes.get(m)?.row).filter(v => v !== undefined);
      const target = near.length ? Math.round(near.reduce((a, b) => a + b, 0) / near.length) : 0;
      let row = -1;
      for (let i = 0; i <= rows.length; i++) {
        const free = i === rows.length || x - rows[i] >= opts.labelGap;
        if (free && (row < 0 || Math.abs(i - target) < Math.abs(row - target))) row = i;
      }
      if (row === rows.length) rows.push(-Infinity);
      rows[row] = x;
      nodes.set(r.n, { n: r.n, x, y: top + row * opts.row + opts.row / 2, row });
    }
    const height = Math.max(1, rows.length) * opts.row;
    if (useLanes) lanes.push({ key, label: key || AREA_NONE, y: top, height });
    top += height + opts.laneGap;
  }
  const deg = new Map(records.map(r => [r.n, degree(data, r.n)]));
  const placed = records.map(r => ({ ...nodes.get(r.n), size: deg.get(r.n) > 6 ? 36 : deg.get(r.n) > 2 ? 28 : 20, degree: deg.get(r.n) }));
  // Year ticks: every year, 5 years or 10 years, depending on the span.
  const step = span <= 12 ? 1 : span <= 40 ? 5 : 10;
  const ticks = [];
  if (span >= 1) for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) ticks.push({ x: opts.padLeft + (y - lo) * opts.pxPerYear, label: String(y) });
  const edges = graph.edges.map(e => ({ ...e, x1: nodes.get(e.to)?.x, y1: nodes.get(e.to)?.y, x2: nodes.get(e.from)?.x, y2: nodes.get(e.from)?.y })).filter(e => e.x1 !== undefined && e.x2 !== undefined);
  return { width, height: top, nodes: placed, edges, lanes, ticks };
}

// The phone layout. Time runs top to bottom, never backwards: a node is never above an older one. Each node takes the column
// that lets it sit highest, nearest the columns of the RFCs it links to. Years are labelled where they start, so the spacing
// is by order, not by amount of time. Same input, same picture.
export function layoutVertical(data, graph, overrides = {}) {
  const o = { ...GRAPH_V, ...overrides };
  const { records } = graph;
  const colW = (o.width - o.gutter - o.padRight) / o.columns;
  if (!records.length) return { orientation: 'v', width: o.width, height: o.padTop + o.row, nodes: [], edges: [], lanes: [], ticks: [] };
  const ordered = [...records].sort((a, b) => time(a) - time(b) || a.n - b.n);
  const linked = new Map(records.map(r => [r.n, []]));
  for (const e of graph.edges) { linked.get(e.from)?.push(e.to); linked.get(e.to)?.push(e.from); }
  const last = Array(o.columns).fill(-Infinity), placed = new Map();
  let prev = o.padTop + o.row / 2;
  for (const r of ordered) {
    const near = linked.get(r.n).map(m => placed.get(m)?.col).filter(v => v !== undefined);
    const target = near.length ? Math.round(near.reduce((a, b) => a + b, 0) / near.length) : Math.floor(o.columns / 2);
    let best = -1, bestY = Infinity;
    for (let c = 0; c < o.columns; c++) {
      const y = Math.max(prev, last[c] + o.row);
      if (y < bestY || (y === bestY && Math.abs(c - target) < Math.abs(best - target))) { best = c; bestY = y; }
    }
    last[best] = bestY; prev = bestY;
    placed.set(r.n, { n: r.n, col: best, x: o.gutter + (best + 0.5) * colW, y: bestY });
  }
  const deg = new Map(records.map(r => [r.n, degree(data, r.n)]));
  const nodes = records.map(r => ({ ...placed.get(r.n), size: deg.get(r.n) > 6 ? 36 : deg.get(r.n) > 2 ? 28 : 20, degree: deg.get(r.n) }));
  const years = ordered.map(r => r.year), span = Math.max(...years) - Math.min(...years);
  const step = span <= 12 ? 1 : span <= 40 ? 5 : 10;
  const ticks = [];
  let bucket = null;
  for (const r of ordered) {
    const b = Math.floor(r.year / step);
    if (b !== bucket && r.year) { bucket = b; ticks.push({ y: placed.get(r.n).y - o.row / 2, label: String(r.year) }); }
  }
  const edges = graph.edges.map(e => ({ ...e, x1: placed.get(e.to)?.x, y1: placed.get(e.to)?.y, x2: placed.get(e.from)?.x, y2: placed.get(e.from)?.y })).filter(e => e.x1 !== undefined && e.x2 !== undefined);
  return { orientation: 'v', width: o.width, height: Math.max(...last) + o.row / 2 + 24, nodes, edges, lanes: [], ticks };
}
