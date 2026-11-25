import { h, Component } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
import { APP_VERSION, REPO_URL, RECENT_KEEP, FAVOURITES_MAX, READ_MAX, RESULTS_PAGE, CHUNK_CHARS, LABELS } from './config.js';
import { parseRoute, homeHref, rfcHref, graphHref, tagHref } from './route.js';
import { GraphView, graphTitle } from './graphview.js';
import { About } from './about.js';
import { loadIndex, search, statusName, streamName, dateOf } from './index.js';
import { parseNumber, fetchText, fetchMeta, cleanText, chunks, linkify, paragraphs, tidyFront, officialUrl, errataUrl } from './rfc.js';
import { store, pushFront, toggle } from './store.js';
import { Icon } from './icons.js';
import { updateState, checkForUpdate, apply, justUpdated } from './update.js';
const html = htm.bind(h);

const Notice = ({ kind = 'info', icon = 'info', children }) => html`<div class="ls-callout ls-callout--${kind}" role=${kind === 'error' ? 'alert' : 'note'}><${Icon} name=${icon} /><div>${children}</div></div>`;
const title = r => `RFC ${r.n}`;

function Result({ r, read }) {
  return html`<li><a class="result" href=${rfcHref(r.n)}>
    <span class="result-n">${title(r)}${read ? html`<span class="ls-vh"> (read)</span>` : ''}</span>
    <span class="result-t">${r.title}</span>
    <span class="result-m">${r.year || ''} · ${statusName(r.status)}</span></a></li>`;
}

function Relations({ data, label, list }) {
  if (!list?.length) return null;
  return html`<dt>${label}</dt><dd>${list.map((n, i) => {
    const r = data.byNumber.get(n);
    return html`${i ? ', ' : ''}${r ? html`<a href=${rfcHref(n)} title=${r.title}>RFC ${n}</a>` : `RFC ${n}`}`;
  })}</dd>`;
}

export class App extends Component {
  state = { route: parseRoute(location.hash), data: null, dataError: false, q: parseRoute(location.hash).q || '', shown: RESULTS_PAGE,
    doc: null, rendered: 1, recent: store.recent(), favourites: store.favourites(), read: store.read(), positions: store.positions(),
    theme: document.documentElement.dataset.theme || 'light', textMode: store.textMode() || (matchMedia('(max-width: 600px)').matches ? 'prose' : 'mono'), toast: '', checking: false, contentsOpen: false };
  abort = null; toastTimer = 0; io = null; pendingScroll = ''; scrollTimer = 0;

  componentDidMount() {
    addEventListener('hashchange', this.onHash);
    addEventListener('readrfc-update', this.refresh);
    addEventListener('scroll', this.onScroll, { passive: true });
    if (justUpdated()) this.toast(`Updated to ${APP_VERSION}`);
    loadIndex().then(data => this.setState({ data }, () => this.enter(this.state.route))).catch(() => this.setState({ dataError: true }));
  }
  componentWillUnmount() { removeEventListener('hashchange', this.onHash); removeEventListener('readrfc-update', this.refresh); removeEventListener('scroll', this.onScroll); this.io?.disconnect(); this.abort?.abort(); }
  componentDidUpdate() {
    if (this.pendingScroll !== '') {
      const el = this.pendingScroll === 'top' ? null : document.getElementById(this.pendingScroll);
      if (this.pendingScroll === 'top') scrollTo(0, 0);
      else if (el) el.scrollIntoView();
      else if (this.state.doc?.status !== 'ready') return;
      this.pendingScroll = '';
    }
  }
  refresh = () => this.forceUpdate();

  onHash = () => { const route = parseRoute(location.hash); this.setState({ route, q: route.view === 'home' ? route.q : this.state.q, shown: RESULTS_PAGE }); this.enter(route); };

  enter(route) {
    if (!this.state.data) return;
    if (route.view !== 'rfc') { this.abort?.abort(); document.title = route.view === 'graph' ? `${graphTitle(route, this.state.data)} · readrfc` : 'readrfc'; this.setState({ doc: null }); return; }
    if (this.state.doc?.n === route.n) { this.goToSection(route.section); return; }
    this.openRfc(route);
  }

  async openRfc({ n, section }) {
    this.abort?.abort();
    const ac = this.abort = new AbortController();
    const record = this.state.data.byNumber.get(n) || null;
    document.title = `RFC ${n}${record ? ` · ${record.title}` : ''} · readrfc`;
    this.setState({ doc: { n, status: 'loading', record, meta: null, chunks: [] }, rendered: 1, contentsOpen: false });
    this.pendingScroll = 'top';
    this.remember(n);
    const [text, meta] = await Promise.allSettled([fetchText(n, ac.signal), fetchMeta(n, ac.signal)]);
    if (ac.signal.aborted) return;
    const metaValue = meta.status === 'fulfilled' ? meta.value : null;
    if (text.status === 'rejected') { this.setState({ doc: { n, status: 'error', record, meta: metaValue, chunks: [] } }); return; }
    if (text.value === null) { this.setState({ doc: { n, status: record || metaValue ? 'notext' : 'missing', record, meta: metaValue, chunks: [] } }); return; }
    const list = chunks(cleanText(text.value));
    const wanted = section || this.state.positions[String(n)] || '';
    let rendered = 0, chars = 0;
    for (const c of list) { rendered++; chars += c.text.length; if (chars >= CHUNK_CHARS && (!wanted || list.slice(0, rendered).some(x => x.id === wanted))) break; }
    this.pendingScroll = wanted && list.some(c => c.id === wanted) ? wanted : 'top';
    this.setState({ doc: { n, status: 'ready', record, meta: metaValue, chunks: list }, rendered: Math.max(1, rendered) });
  }

  goToSection(section) {
    const doc = this.state.doc;
    if (!doc || doc.status !== 'ready' || !section) return;
    const index = doc.chunks.findIndex(c => c.id === section);
    if (index < 0) return;
    this.pendingScroll = section;
    this.setState({ rendered: Math.max(this.state.rendered, index + 1) });
  }

  remember(n) {
    const recent = pushFront(this.state.recent, n, RECENT_KEEP), read = pushFront(this.state.read, n, READ_MAX);
    store.save('recent', recent); store.save('read', read);
    this.setState({ recent, read });
  }
  onScroll = () => {
    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      const doc = this.state.doc;
      if (!doc || doc.status !== 'ready') return;
      let current = '';
      for (const c of doc.chunks.slice(0, this.state.rendered)) { if (!c.id) continue; const el = document.getElementById(c.id); if (el && el.getBoundingClientRect().top <= 80) current = c.id; }
      const positions = { ...this.state.positions };
      if (current) positions[String(doc.n)] = current; else delete positions[String(doc.n)];
      if (positions[String(doc.n)] !== this.state.positions[String(doc.n)]) { store.save('positions', positions); this.setState({ positions }); }
    }, 400);
  };
  observe = el => {
    this.io?.disconnect();
    if (!el) return;
    this.io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) this.more(); }, { rootMargin: '1200px' });
    this.io.observe(el);
  };
  more = () => {
    const doc = this.state.doc;
    if (!doc || doc.status !== 'ready') return;
    let rendered = this.state.rendered, chars = 0;
    while (rendered < doc.chunks.length && chars < CHUNK_CHARS) { chars += doc.chunks[rendered].text.length; rendered++; }
    if (rendered !== this.state.rendered) this.setState({ rendered });
  };

  toast(message) { clearTimeout(this.toastTimer); this.setState({ toast: message }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 3000); }
  toggleTheme = () => { const theme = this.state.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; store.save('theme', theme); this.setState({ theme }); };
  toggleMode = () => { const textMode = this.state.textMode === 'prose' ? 'mono' : 'prose'; store.save('textMode', textMode); this.setState({ textMode }); };
  toggleFavourite = n => { const favourites = toggle(this.state.favourites, n, FAVOURITES_MAX); store.save('favourites', favourites); this.setState({ favourites }); };
  copyLink = async () => { const url = this.state.doc ? `${location.origin}/r/rfc${this.state.doc.n}` : location.href; try { await navigator.clipboard.writeText(url); this.toast('Link copied'); } catch { this.toast(url); } };
  checkUpdates = async () => {
    this.setState({ checking: true });
    const result = await checkForUpdate({ force: true });
    this.setState({ checking: false });
    this.toast(result === 'ready' ? 'Update found' : result === 'offline' ? 'Offline' : result === 'skipped' ? 'Updates need HTTPS' : 'Up to date');
  };

  // ---- home and search
  onSearch = event => {
    const q = event.target.value;
    history.replaceState(null, '', homeHref(q.trim()));
    this.setState({ q, shown: RESULTS_PAGE });
  };
  onSubmit = event => {
    event.preventDefault();
    const { data, q } = this.state;
    const { jump } = search(data, q);
    if (jump) location.hash = rfcHref(jump);
    else if (parseNumber(q)) this.toast('No such RFC');
  };

  renderList(numbers) {
    const { data, read } = this.state;
    const items = numbers.map(n => data.byNumber.get(n)).filter(Boolean);
    return html`<ul class="results">${items.map(r => html`<${Result} r=${r} read=${read.includes(r.n)} />`)}</ul>`;
  }

  renderHome() {
    const { data, q, shown, recent, favourites } = this.state;
    const { results } = q.trim() ? search(data, q) : { results: [] };
    return html`<section>
      <form class="ls-field" role="search" onSubmit=${this.onSubmit}>
        <label for="q">${LABELS.search}</label>
        <input id="q" class="ls-input" type="search" value=${q} onInput=${this.onSearch} autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
      </form>
      <div class="actions"><a class="ls-btn ls-btn--small" href="#/graph"><${Icon} name="graph" small /> ${LABELS.graph}</a></div>
      ${q.trim() ? html`<p class="status" role="status">${results.length} ${results.length === 1 ? 'result' : 'results'}</p>
          <ul class="results">${results.slice(0, shown).map(r => html`<${Result} r=${r} read=${this.state.read.includes(r.n)} />`)}</ul>
          ${results.length > shown && html`<div class="more"><button class="ls-btn" type="button" onClick=${() => this.setState({ shown: shown + RESULTS_PAGE })}>More</button></div>`}`
        : html`${favourites.length > 0 && html`<h2>${LABELS.favourites}</h2>${this.renderList(favourites)}`}
          ${recent.length > 0 && html`<h2>${LABELS.recent}</h2>${this.renderList(recent)}`}`}
    </section>`;
  }

  // ---- the reader
  renderDetails(doc) {
    const { data } = this.state, r = doc.record, m = doc.meta;
    const authors = m?.authors?.join(', ');
    return html`<details class="details-fold"><summary>${LABELS.details}</summary>
      <dl class="details">
        ${r?.authors.length > 0 ? html`<dt>Authors</dt><dd>${r.authors.map((a, i) => html`${i ? ', ' : ''}<a href=${tagHref('author', a)}>${a}</a>`)}</dd>` : authors && html`<dt>Authors</dt><dd>${authors}</dd>`}
        ${r && html`<dt>Date</dt><dd>${dateOf(r)}</dd><dt>Status</dt><dd>${statusName(r.status)}</dd>`}
        ${r?.stream && html`<dt>Stream</dt><dd><a href=${tagHref('stream', r.stream)}>${streamName(r.stream)}</a></dd>`}
        ${r?.group && html`<dt>Group</dt><dd><a href=${tagHref('wg', r.group)}>${r.group}</a></dd>`}
        ${r?.area && html`<dt>Area</dt><dd><a href=${tagHref('area', r.area)}>${r.area}</a></dd>`}
        ${r?.pages > 0 && html`<dt>Pages</dt><dd>${r.pages}</dd>`}
        ${r?.keywords.length > 0 && html`<dt>Tags</dt><dd>${r.keywords.map((k, i) => html`${i ? ', ' : ''}<a href=${tagHref('kw', k)}>${k}</a>`)}</dd>`}
        ${(r?.people.length > 0 || r?.topics.length > 0) && html`<dt>About</dt><dd class="abouts">
          ${r.people.map(p => html`<${About} key=${`${p.q}-${p.name}`} topic=${p} more=${{ href: tagHref('author', p.name), label: 'Their RFCs' }} />`)}
          ${r.topics.map(t => html`<${About} key=${t.q} topic=${t} more=${{ href: tagHref('topic', t.q), label: 'Same topic' }} />`)}</dd>`}
        <${Relations} data=${data} label="Obsoletes" list=${data.obsoletes.get(doc.n)} />
        <${Relations} data=${data} label="Obsoleted by" list=${data.obsoletedBy.get(doc.n)} />
        <${Relations} data=${data} label="Updates" list=${data.updates.get(doc.n)} />
        <${Relations} data=${data} label="Updated by" list=${data.updatedBy.get(doc.n)} />
        ${m?.errata_url && html`<dt>Errata</dt><dd><a class="ls-out" href=${errataUrl(doc.n)} target="_blank" rel="noopener noreferrer">RFC Editor</a></dd>`}
      </dl>
      ${m?.abstract && html`<p class="abstract">${m.abstract.replace(/\s+/g, ' ')}</p>`}
    </details>`;
  }

  // Mono mode shows the text as published. Prose mode (the default on a phone) shows it as readable blocks: headings,
  // paragraphs, lists, and anything else in a block that scrolls sideways instead of wrapping into a jumble.
  renderChunk(c, exists) {
    const link = part => (typeof part === 'string' ? part : html`<a href=${rfcHref(part.n)}>${part.text}</a>`);
    const text = s => linkify(s, exists).map(link);
    if (this.state.textMode !== 'prose') return html`<section id=${c.id || undefined} class="chunk"><pre class="rfc">${c.id ? text(c.text) : c.text}</pre></section>`;
    if (!c.id) return html`<section class="chunk"><pre class="rfc rfc-front">${tidyFront(c.text)}</pre></section>`;
    const lines = c.text.replace(/\n$/, '').split('\n'), heading = lines.shift();
    const level = Math.min(c.level, 3), Heading = level <= 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
    const blocks = paragraphs(lines.join('\n')).map(p => (p.kind === 'list'
      ? html`<ul class="prose-list">${p.items.map(i => html`<li><span class="marker">${i.marker}</span> ${text(i.text)}</li>`)}</ul>`
      : p.kind === 'p' ? html`<p class="prose-p">${text(p.text)}</p>`
        : html`<pre class="rfc rfc-block" tabindex="0" aria-label="Preformatted text, scrolls sideways">${text(p.text)}</pre>`));
    const toc = /^(table-of-contents|contents)$/.test(c.id);
    return html`<section id=${c.id} class="chunk"><${Heading} class="rfc-h">${c.title}<//>${toc ? html`<details class="details-fold"><summary>${LABELS.contents}</summary>${blocks}</details>` : blocks}</section>`;
  }

  renderReader() {
    const { data, doc, rendered, favourites, textMode, contentsOpen } = this.state;
    if (!doc) return html`<p class="status" role="status">Loading</p>`;
    const r = doc.record, exists = n => data.byNumber.has(n);
    const newer = data.obsoletedBy.get(doc.n);
    const toc = doc.chunks.filter(c => c.id);
    const isFav = favourites.includes(doc.n);
    return html`<article>
      <div class="titlebar"><a class="back" href=${homeHref(this.state.q)} aria-label="Back to search"><${Icon} name="back" /></a>
        <h1>RFC ${doc.n}${r ? html`<span class="subtitle">${r.title}</span>` : ''}</h1></div>
      <div class="actions">
        <button class="ls-btn ls-btn--small" type="button" aria-pressed=${isFav} aria-label=${isFav ? 'Remove from favourites' : 'Add to favourites'} onClick=${() => this.toggleFavourite(doc.n)}><${Icon} name="star" small /></button>
        <button class="ls-btn ls-btn--small" type="button" aria-label="Copy link" onClick=${this.copyLink}><${Icon} name="link" small /></button>
        <button class="ls-btn ls-btn--small" type="button" aria-pressed=${textMode === 'prose'} aria-label="Reflowed text" onClick=${this.toggleMode}>Aa</button>
        <a class="ls-btn ls-btn--small" href=${graphHref({ kind: 'rfc', n: doc.n, hops: 1 })} aria-label=${LABELS.graph}><${Icon} name="graph" small /></a>
        <a class="ls-out" href=${officialUrl(doc.n)} target="_blank" rel="noopener noreferrer">RFC Editor</a>
      </div>
      ${newer?.length > 0 && html`<${Notice}>Obsoleted by ${newer.map((n, i) => html`${i ? ', ' : ''}<a href=${rfcHref(n)}>RFC ${n}</a>`)}.<//>`}
      ${this.renderDetails(doc)}
      ${toc.length > 0 && doc.status === 'ready' && html`<details class="details-fold" open=${contentsOpen} onToggle=${e => this.setState({ contentsOpen: e.target.open })}><summary>${LABELS.contents}</summary>
        <ul class="toc">${toc.map(c => html`<li class=${`toc-${Math.min(c.level, 3)}`}><a href=${rfcHref(doc.n, c.id)}>${c.title}</a></li>`)}</ul></details>`}
      ${doc.status === 'loading' && html`<p class="status" role="status">Loading</p>`}
      ${doc.status === 'error' && html`<${Notice} kind="error" icon="alert">Could not load this RFC. <button class="ls-btn ls-btn--small" type="button" onClick=${() => this.openRfc({ n: doc.n, section: '' })}><${Icon} name="retry" small /> Retry</button><//>`}
      ${doc.status === 'notext' && html`<${Notice}>No text for this RFC. <a class="ls-out" href=${officialUrl(doc.n)} target="_blank" rel="noopener noreferrer">RFC Editor</a><//>`}
      ${doc.status === 'missing' && html`<${Notice} kind="warning" icon="alert">No RFC ${doc.n}.<//>`}
      ${doc.status === 'ready' && html`<div class=${`rfc-text rfc-text--${textMode}`}>${doc.chunks.slice(0, rendered).map(c => this.renderChunk(c, exists))}</div>
        ${rendered < doc.chunks.length && html`<div class="more" ref=${this.observe}><button class="ls-btn" type="button" onClick=${this.more}>More</button></div>`}`}
    </article>`;
  }

  render() {
    const { route, data, dataError, theme } = this.state;
    return html`<a class="ls-skip" href="#main">Skip to content</a>
      <header class="app-header"><div class="header-inner">
        <a class="brand" href="#/" aria-label="readrfc, home">
          <img class="mark mark--light" src="./icons/logo-mark.svg" alt="" width="40" height="40" />
          <img class="mark mark--dark" src="./icons/logo-mark-inverse.svg" alt="" width="40" height="40" />
          <span>readrfc</span></a>
        <button class="ls-btn ls-btn--small theme" type="button" onClick=${this.toggleTheme} aria-label=${theme === 'dark' ? 'Light theme' : 'Dark theme'}><${Icon} name=${theme === 'dark' ? 'sun' : 'moon'} small /></button>
      </div></header>
      <main id="main" class="page">${dataError
        ? html`<${Notice} kind="error" icon="alert">Could not load the index. <button class="ls-btn ls-btn--small" type="button" onClick=${() => location.reload()}><${Icon} name="retry" small /> Retry</button><//>`
        : !data ? html`<p class="status" role="status">Loading</p>` : route.view === 'rfc' ? this.renderReader() : route.view === 'graph' ? html`<${GraphView} key=${graphHref(route)} data=${data} route=${route} read=${this.state.read} favourites=${this.state.favourites} />` : this.renderHome()}</main>
      <footer class="page foot">
        <p>Unofficial. <a href=${REPO_URL} target="_blank" rel="noopener noreferrer">Source</a> · ${updateState.ready
          ? html`<button class="quiet" type="button" onClick=${apply}>Update ready: restart</button>`
          : html`<button class="quiet" type="button" disabled=${this.state.checking} onClick=${this.checkUpdates} aria-label=${`Version ${APP_VERSION}, check for updates`}>${APP_VERSION}</button>`}</p>
      </footer>
      <div class="toast-wrap" role="status">${this.state.toast && html`<span class="ls-toast">${this.state.toast}</span>`}</div>`;
  }
}
