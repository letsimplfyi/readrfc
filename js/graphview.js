import { h, Component } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
import { GRAPH_MAX_NODES, GRAPH_MORE_NODES, STATUS_NAMES, NARROW } from './config.js';
import { graphHref, tagHref, rfcHref } from './route.js';
import { neighbourhood, tagSet, yearSet, newestInChain, chooser, layout, layoutVertical, relations } from './graph.js';
import { statusName, streamName } from './index.js';
import { fetchMeta } from './rfc.js';
import { Icon } from './icons.js';
import { About } from './about.js';
const html = htm.bind(h);

const TAG_LABEL = { area: 'Area', wg: 'Group', stream: 'Stream', kw: 'Tag', topic: 'Topic' };
const KEY_STATUSES = ['IS', 'PS', 'BCP', 'INF', 'HIS'];
const STAR = 'M0 -5L1.5 -1.5L5 -1.5L2.2 .8L3.2 4.5L0 2.4L-3.2 4.5L-2.2 .8L-5 -1.5L-1.5 -1.5Z';

export const graphTitle = (r, data) => (r.kind === 'rfc' ? `RFC ${r.n}` : r.kind === 'tag' ? `${TAG_LABEL[r.tag]} ${r.tag === 'stream' ? streamName(r.value) : r.tag === 'topic' ? data?.topicByQ.get(r.value)?.label || r.value : r.value}` : r.kind === 'year' ? `${r.from}–${r.to}` : 'Graph');

function buildGraph(data, route, limit) {
  if (route.kind === 'rfc') return neighbourhood(data, route.n, route.hops, limit);
  if (route.kind === 'tag') return tagSet(data, route.tag, route.value, limit);
  if (route.kind === 'year') return yearSet(data, route.from, route.to, limit);
  return null;
}

// One mini node, drawn with the same classes as the picture, for the key.
const KeyNode = ({ status }) => html`<svg class="key-node" viewBox="0 0 24 24" aria-hidden="true"><g class=${`node node--${status}`}><rect class="node-box" x="4" y="4" width="16" height="16" />${status === 'BCP' ? html`<rect class="node-inner" x="7" y="7" width="10" height="10" />` : ''}</g></svg>`;

export class GraphView extends Component {
  state = { sel: this.props.route.sel, limit: GRAPH_MAX_NODES, list: false, abstracts: {}, keyOpen: false, narrow: matchMedia(NARROW).matches };
  mq = matchMedia(NARROW);
  onMq = () => this.setState({ narrow: this.mq.matches });
  cacheKey = ''; cached = null; scroller = null; centred = '';

  componentDidMount() { if (this.state.sel) this.loadAbstract(this.state.sel); this.mq.addEventListener('change', this.onMq); }
  componentWillUnmount() { this.mq.removeEventListener('change', this.onMq); }
  componentDidUpdate() { this.centre(); }

  compute() {
    const { data, route } = this.props, { narrow } = this.state, key = `${graphHref(route)}|${this.state.limit}|${narrow ? 'v' : 'h'}`;
    if (key !== this.cacheKey) {
      const graph = buildGraph(data, route, this.state.limit);
      this.cached = graph && { graph, view: narrow ? layoutVertical(data, graph) : layout(data, graph, { lanes: route.kind === 'year' || (route.kind === 'tag' && route.tag === 'stream') }), newest: newestInChain(data, graph.records) };
      this.cacheKey = key;
    }
    return this.cached;
  }

  // Start with the interesting node in the middle of the scrolling area, once per graph.
  centre() {
    const c = this.cached, el = this.scroller;
    if (!c || this.centred === this.cacheKey) return;
    if (c.view.orientation === 'v') {
      this.centred = this.cacheKey;
      if (this.state.sel) this.base?.querySelector(`[data-n="${this.state.sel}"]`)?.scrollIntoView({ block: 'center' });
      return;
    }
    if (!el) return;
    const target = c.view.nodes.find(n => n.n === (this.state.sel || c.graph.focus || c.newest?.n));
    if (!target) return;
    this.centred = this.cacheKey;
    el.scrollLeft = Math.max(0, target.x - el.clientWidth / 2);
    el.scrollTop = Math.max(0, target.y - el.clientHeight / 2);
  }
  setScroller = el => { this.scroller = el; };

  select = n => {
    if (this.state.sel === n) n = null;
    history.replaceState(null, '', graphHref(this.props.route, n));
    this.setState({ sel: n });
    if (n) { this.loadAbstract(n); this.scroller?.querySelector(`[data-n="${n}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  };
  async loadAbstract(n) {
    if (n in this.state.abstracts) return;
    this.setState(s => ({ abstracts: { ...s.abstracts, [n]: null } }));
    try { const meta = await fetchMeta(n); this.setState(s => ({ abstracts: { ...s.abstracts, [n]: meta?.abstract ? meta.abstract.replace(/\s+/g, ' ') : '' } })); }
    catch { this.setState(s => ({ abstracts: { ...s.abstracts, [n]: '' } })); }
  }
  random = () => {
    const { read } = this.props, pool = this.cached.graph.records.filter(r => !read.includes(r.n));
    if (pool.length) location.hash = rfcHref(pool[Math.floor(Math.random() * pool.length)].n);
  };

  // ---- the pick-a-way-in screen
  renderChooser() {
    const c = chooser(this.props.data);
    const chip = (tag, { value, n }) => html`<li><a class="ls-tag" href=${tagHref(tag, value)}>${tag === 'stream' ? streamName(value) : value} <span class="count">${n}</span></a></li>`;
    return html`<section>
      <div class="titlebar"><a class="back" href="#/" aria-label="Back to search"><${Icon} name="back" /></a><h1>Graph</h1></div>
      <h2>Areas</h2><ul class="ls-tags">${c.areas.map(a => chip('area', a))}</ul>
      <h2>Streams</h2><ul class="ls-tags">${c.streams.map(a => chip('stream', a))}</ul>
      <h2>Years</h2><ul class="ls-tags">${c.decades.map(d => html`<li><a class="ls-tag" href=${graphHref({ kind: 'year', from: d, to: d + 9 })}>${d}s</a></li>`)}</ul>
      ${c.topics.length > 0 && html`<h2>Topics</h2><ul class="ls-tags">${c.topics.slice(0, 40).map(t => html`<li><a class="ls-tag" href=${tagHref('topic', t.value)}>${t.label} <span class="count">${t.n}</span></a></li>`)}</ul>
      <details class="details-fold"><summary>More topics</summary><ul class="ls-tags">${c.topics.slice(40).map(t => html`<li><a class="ls-tag" href=${tagHref('topic', t.value)}>${t.label} <span class="count">${t.n}</span></a></li>`)}</ul></details>`}
      <h2>Tags</h2><ul class="ls-tags">${c.keywords.map(a => chip('kw', a))}</ul>
      <details class="details-fold"><summary>Groups</summary><ul class="ls-tags">${c.groups.slice(0, 60).map(a => chip('wg', a))}</ul></details>
    </section>`;
  }

  // ---- the picture
  renderEdges(view, sel) {
    const size = new Map(view.nodes.map(n => [n.n, n.size]));
    return view.edges.map(e => {
      const dx = e.x2 - e.x1, dy = e.y2 - e.y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const x1 = e.x1 + ux * (size.get(e.to) / 2), y1 = e.y1 + uy * (size.get(e.to) / 2), x2 = e.x2 - ux * (size.get(e.from) / 2 + 3), y2 = e.y2 - uy * (size.get(e.from) / 2 + 3);
      const on = sel && (e.from === sel || e.to === sel);
      return html`<line class=${`edge edge--${e.kind}${on ? ' edge--on' : sel ? ' edge--off' : ''}`} x1=${x1} y1=${y1} x2=${x2} y2=${y2} marker-end=${e.kind === 'o' ? 'url(#arrow-o)' : 'url(#arrow-u)'} />`;
    });
  }

  nodeName(r, read, fav) {
    const { data } = this.props, out = (data.obsoletes.get(r.n) || []).length, replaced = (data.obsoletedBy.get(r.n) || []).length;
    return [`RFC ${r.n}`, r.title, r.year, statusName(r.status), out ? `obsoletes ${out} ${out === 1 ? 'RFC' : 'RFCs'}` : '', replaced ? 'obsoleted' : '', read ? 'read' : '', fav ? 'favourite' : ''].filter(Boolean).join(', ');
  }

  renderNode(pos, graph) {
    const { data, read, favourites } = this.props, r = data.byNumber.get(pos.n), s = pos.size, half = s / 2;
    const isRead = read.includes(r.n), isFav = favourites.includes(r.n), replaced = (data.obsoletedBy.get(r.n) || []).length > 0, centre = graph.focus === r.n, selected = this.state.sel === r.n;
    return html`<a class=${`node node--${r.status}${selected ? ' node--sel' : ''}${centre ? ' node--centre' : ''}${replaced ? ' node--replaced' : ''}`} data-n=${r.n} href=${graphHref(this.props.route, r.n)} aria-label=${this.nodeName(r, isRead, isFav)} aria-current=${selected ? 'true' : undefined} onClick=${event => { event.preventDefault(); this.select(r.n); }}>
      <title>${`RFC ${r.n}: ${r.title}`}</title>
      ${(centre || selected) && html`<rect class="node-ring" x=${pos.x - half - 5} y=${pos.y - half - 5} width=${s + 10} height=${s + 10} />`}
      <rect class="node-hit" x=${pos.x - 25} y=${pos.y - 25} width="50" height="50" />
      <rect class="node-box" x=${pos.x - half} y=${pos.y - half} width=${s} height=${s} />
      ${r.status === 'BCP' && html`<rect class="node-inner" x=${pos.x - half + 4} y=${pos.y - half + 4} width=${s - 8} height=${s - 8} />`}
      ${replaced && html`<line class="node-strike" x1=${pos.x - half} y1=${pos.y + half} x2=${pos.x + half} y2=${pos.y - half} />`}
      ${isRead && html`<path class="node-check" d=${`M${pos.x - 5} ${pos.y} L${pos.x - 1.5} ${pos.y + 4} L${pos.x + 5} ${pos.y - 4}`} />`}
      <text class=${`node-label${centre ? ' node-label--centre' : ''}${replaced ? ' node-label--replaced' : ''}`} x=${pos.x} y=${pos.y + half + 17} text-anchor="middle">RFC ${r.n}</text>
      ${isFav && html`<path class="node-fav" transform=${`translate(${pos.x + half + 7} ${pos.y - half + 5})`} d=${STAR} />`}
    </a>`;
  }

  renderPicture(c) {
    const { view, graph } = c, { sel } = this.state, vertical = view.orientation === 'v';
    const description = `${graph.records.length} RFCs, time runs ${this.state.narrow ? 'top to bottom' : 'left to right'}, each RFC is a link.`;
    return html`<div class=${vertical ? 'graph-flow' : 'graph-scroll'} ref=${this.setScroller} tabindex=${vertical ? undefined : '0'} role=${vertical ? undefined : 'region'} aria-label=${vertical ? undefined : 'Graph, scrolls sideways'}>
      <svg class=${vertical ? 'graph graph--v' : 'graph'} width=${vertical ? undefined : view.width} height=${vertical ? undefined : view.height} viewBox=${`0 0 ${view.width} ${view.height}`} role="group" aria-labelledby="graph-title graph-desc">
        <title id="graph-title">${graphTitle(this.props.route, this.props.data)}</title><desc id="graph-desc">${description}</desc>
        <defs>
          <marker id="arrow-o" class="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" class="arrow-solid" /></marker>
          <marker id="arrow-u" class="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10" class="arrow-open" /></marker>
        </defs>
        ${view.ticks.map(t => (vertical
          ? html`<g class="tick"><line x1="0" y1=${t.y} x2=${view.width} y2=${t.y} /><text x="6" y=${t.y + 16}>${t.label}</text></g>`
          : html`<g class="tick"><line x1=${t.x} y1="24" x2=${t.x} y2=${view.height} /><text x=${t.x} y="16" text-anchor="middle">${t.label}</text></g>`))}
        ${view.lanes.map(l => html`<g class="lane"><line x1="0" y1=${l.y + l.height + 12} x2=${view.width} y2=${l.y + l.height + 12} /><text x="8" y=${l.y + 18}>${l.label}</text></g>`)}
        ${this.renderEdges(view, sel)}
        ${view.nodes.map(pos => this.renderNode(pos, graph))}
      </svg></div>`;
  }

  // ---- the same graph as a table: the complete, accessible equivalent
  renderList(c) {
    const { data } = this.props;
    const links = (n, kind, dir) => relations(data, n).filter(x => x.kind === kind && x.dir === dir).map((x, i) => html`${i ? ', ' : ''}<a href=${rfcHref(x.n)}>${x.n}</a>`);
    return html`<div class="table-wrap"><table class="graph-table"><thead><tr><th>RFC</th><th>Title</th><th>Year</th><th>Status</th><th>Obsoletes</th><th>Obsoleted by</th><th>Updates</th><th>Updated by</th></tr></thead>
      <tbody>${[...c.graph.records].sort((a, b) => a.year - b.year || a.n - b.n).map(r => html`<tr><th scope="row"><a href=${rfcHref(r.n)}>${r.n}</a></th><td>${r.title}</td><td>${r.year}</td><td>${statusName(r.status)}</td>
        <td>${links(r.n, 'o', 'out')}</td><td>${links(r.n, 'o', 'in')}</td><td>${links(r.n, 'u', 'out')}</td><td>${links(r.n, 'u', 'in')}</td></tr>`)}</tbody></table></div>`;
  }

  renderPanel(c) {
    const { data, read, favourites } = this.props, n = this.state.sel, r = n && data.byNumber.get(n);
    if (!r) return null;
    const abstract = this.state.abstracts[n], newest = c.newest && c.newest.n !== n ? c.newest : null;
    const chips = [r.area && ['area', r.area], r.group && ['wg', r.group], r.stream && ['stream', r.stream], ...r.keywords.map(k => ['kw', k])].filter(Boolean);
    return html`<aside class="ls-card panel" aria-label=${`RFC ${n}`}>
      <h2>RFC ${n} <span class="panel-title">${r.title}</span></h2>
      <p class="meta">${r.year} · ${statusName(r.status)}${read.includes(n) ? ' · read' : ''}${favourites.includes(n) ? ' · favourite' : ''}</p>
      <div class="actions">
        <a class="ls-btn ls-btn--primary" href=${rfcHref(n)}>Read</a>
        <a class="ls-btn" href=${graphHref({ kind: 'rfc', n, hops: 1 })}><${Icon} name="graph" small /> Explore</a>
        ${newest && html`<a class="ls-btn" href=${rfcHref(newest.n)}>Newest: RFC ${newest.n}</a>`}
      </div>
      ${abstract === null ? html`<p class="status" role="status">Loading</p>` : abstract ? html`<p class="abstract">${abstract.length > 360 ? `${abstract.slice(0, 360).replace(/\s+\S*$/, '')}…` : abstract}</p>` : null}
      ${r.topics.map(t => html`<${About} key=${t.q} topic=${t} />`)}
      ${chips.length > 0 && html`<ul class="ls-tags">${chips.map(([tag, value]) => html`<li><a class="ls-tag" href=${tagHref(tag, value)}>${tag === 'stream' ? streamName(value) : value}</a></li>`)}</ul>`}
    </aside>`;
  }

  renderKey() {
    return html`<details class="details-fold" open=${this.state.keyOpen} onToggle=${e => this.setState({ keyOpen: e.target.open })}><summary>Key</summary>
      <ul class="key">
        ${KEY_STATUSES.map(s => html`<li><${KeyNode} status=${s} /> ${STATUS_NAMES[s]}</li>`)}
        <li><svg class="key-node" viewBox="0 0 48 24" aria-hidden="true"><line class="edge edge--o" x1="4" y1="12" x2="40" y2="12" marker-end="url(#arrow-o)" /></svg> Obsoletes, pointing at the newer RFC</li>
        <li><svg class="key-node" viewBox="0 0 48 24" aria-hidden="true"><line class="edge edge--u" x1="4" y1="12" x2="40" y2="12" marker-end="url(#arrow-u)" /></svg> Updates, pointing at the newer RFC</li>
        <li><svg class="key-node" viewBox="0 0 24 24" aria-hidden="true"><g class="node node--PS node--replaced"><rect class="node-box" x="4" y="4" width="16" height="16" /><line class="node-strike" x1="4" y1="20" x2="20" y2="4" /></g></svg> Replaced by a newer RFC</li>
        <li><svg class="key-node" viewBox="0 0 24 24" aria-hidden="true"><g class="node node--PS"><rect class="node-box" x="4" y="4" width="16" height="16" /><path class="node-check" d="M8 12 L11 15 L16 9" /></g></svg> Read on this device</li>
        <li>Size shows how many links an RFC has</li>
      </ul></details>`;
  }

  render() {
    const { route, data, read } = this.props;
    if (route.kind === 'choose') return this.renderChooser();
    const c = this.compute(), { graph } = c, { limit, list } = this.state;
    const back = route.kind === 'rfc' ? rfcHref(route.n) : '#/graph';
    const unread = graph.records.some(r => !read.includes(r.n));
    return html`<section>
      <div class="titlebar"><a class="back" href=${back} aria-label="Back"><${Icon} name="back" /></a>
        <h1>${graphTitle(route, data)}${route.kind === 'rfc' && data.byNumber.get(route.n) ? html`<span class="subtitle">${data.byNumber.get(route.n).title}</span>` : ''}</h1></div>
      <p class="status" role="status">${graph.records.length} ${graph.records.length === 1 ? 'RFC' : 'RFCs'}${graph.capped ? ` of ${graph.total}` : ''}</p>
      <div class="actions">
        ${route.kind === 'rfc' && html`<div class="segmented" role="group" aria-label="Distance">
          <a class="ls-btn ls-btn--small" aria-current=${route.hops === 1 ? 'true' : undefined} href=${graphHref({ ...route, hops: 1 }, this.state.sel)}>1 link</a>
          <a class="ls-btn ls-btn--small" aria-current=${route.hops === 2 ? 'true' : undefined} href=${graphHref({ ...route, hops: 2 }, this.state.sel)}>2 links</a></div>`}
        <button class="ls-btn ls-btn--small" type="button" aria-pressed=${list} onClick=${() => this.setState({ list: !list })}><${Icon} name="list" small /> List</button>
      </div>
      ${graph.records.length === 0 && html`<p class="status">No RFCs.</p>`}
      ${graph.records.length > 0 && (list ? this.renderList(c) : this.renderPicture(c))}
      ${graph.records.length > 1 && html`<div class="actions">
        ${c.newest && html`<a class="ls-btn ls-btn--small" href=${rfcHref(c.newest.n)}>Newest: RFC ${c.newest.n}</a>`}
        ${unread && html`<button class="ls-btn ls-btn--small" type="button" onClick=${this.random}>Random</button>`}
      </div>`}
      ${graph.capped && limit < GRAPH_MORE_NODES && html`<div class="more"><button class="ls-btn" type="button" onClick=${() => this.setState({ limit: GRAPH_MORE_NODES })}>More</button></div>`}
      ${this.renderPanel(c)}
      ${graph.records.length > 0 && !list && this.renderKey()}
    </section>`;
  }
}
