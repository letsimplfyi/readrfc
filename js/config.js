// APP_VERSION and the cache name in sw.js are stamped together by the deploy workflow on every release.
export const APP_VERSION = 'dev';
export const REPO_URL = 'https://github.com/letsimplfyi/readrfc';
export const LETSIMPL_URL = 'https://letsimpl.fyi';
export const RFC_HOST = 'https://www.rfc-editor.org';
export const FETCH_TIMEOUT_MS = 20000;
export const RECENT_KEEP = 10, FAVOURITES_MAX = 200, READ_MAX = 2000, POSITIONS_MAX = 200;
export const RESULTS_PAGE = 50;
export const GRAPH_MAX_NODES = 150;
// Characters of RFC text rendered at first and per scroll step, so a 500 KB RFC never blocks the page.
export const CHUNK_CHARS = 40000;

export const STATUS_NAMES = {
  IS: 'Internet Standard', DS: 'Draft Standard', PS: 'Proposed Standard', BCP: 'Best Current Practice',
  INF: 'Informational', EXP: 'Experimental', HIS: 'Historic', UNK: 'Unknown',
};
export const STREAM_NAMES = { ietf: 'IETF', legacy: 'Legacy', independent: 'Independent', iab: 'IAB', irtf: 'IRTF', editorial: 'Editorial' };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Interface labels. Neutral nouns until the founder writes better ones; change them here and nowhere else.
export const LABELS = {
  search: 'Search', read: 'Read', recent: 'Recent', favourites: 'Favourites', graph: 'Graph', details: 'Details', contents: 'Contents', list: 'List',
};
