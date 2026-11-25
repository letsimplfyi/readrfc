import { h, Component } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
import { fetchSummary, pageUrl, commonerUrl } from './wiki.js';
import { Icon } from './icons.js';
const html = htm.bind(h);

// One topic or person, closed until someone opens it: only then is Wikipedia asked, once. topic: { q, label, wiki, cat }.
// `more` is the link to the graph of everything related: { href, label }.
export class About extends Component {
  state = { status: 'idle', summary: null, imageFailed: false };
  abort = null;
  componentWillUnmount() { this.abort?.abort(); }
  onToggle = event => {
    if (!event.target.open || this.state.status !== 'idle') return;
    if (!this.props.topic.wiki) { this.setState({ status: 'none' }); return; }
    this.load();
  };
  async load() {
    this.abort?.abort();
    const ac = this.abort = new AbortController();
    this.setState({ status: 'loading' });
    try {
      const summary = await fetchSummary(this.props.topic.wiki, ac.signal);
      if (!ac.signal.aborted) this.setState({ status: summary ? 'ready' : 'none', summary });
    } catch { if (!ac.signal.aborted) this.setState({ status: 'error' }); }
  }
  render({ topic, more }, { status, summary, imageFailed }) {
    return html`<details class="about" onToggle=${this.onToggle}><summary><span class="ls-tag ls-tag--info about-tag"><${Icon} name="info" small /><span class="about-label">${topic.label}</span><span class="about-mark" aria-hidden="true"></span></span></summary>
      <div class="about-body">
        ${status === 'loading' && html`<p class="status" role="status">Loading</p>`}
        ${status === 'error' && html`<p class="status" role="alert">Could not load. <button class="quiet" type="button" onClick=${() => this.load()}><${Icon} name="retry" small /> Retry</button></p>`}
        ${status === 'ready' && html`${summary.image && !imageFailed && html`<img class="about-img" src=${summary.image} alt=${topic.label} width=${summary.width || undefined} height=${summary.height || undefined} decoding="async" referrerpolicy="no-referrer" onError=${() => this.setState({ imageFailed: true })} />`}
          ${summary.description && html`<p class="about-desc">${summary.description}</p>`}
          <p class="about-text">${summary.extract.length > 420 ? `${summary.extract.slice(0, 420).replace(/\s+\S*$/, '')}…` : summary.extract}</p>
          <p class="meta">Text from Wikipedia, CC BY-SA 4.0.${summary.image && !imageFailed ? ' The picture has its own licence, shown on the Wikipedia page.' : ''}</p>`}
        <div class="actions">
          ${topic.wiki && html`<a class="ls-out" href=${pageUrl(topic.wiki)} target="_blank" rel="noopener noreferrer">Wikipedia</a>`}
          ${topic.cat && html`<a class="ls-out" href=${commonerUrl(topic.cat)} target="_blank" rel="noopener noreferrer">Photos on Commoner</a>`}
          ${more && html`<a class="ls-btn ls-btn--small" href=${more.href}><${Icon} name="graph" small /> ${more.label}</a>`}
        </div>
      </div></details>`;
  }
}
