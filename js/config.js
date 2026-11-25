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

// Graph: the default and the "more" cap on nodes, and the drawing grid (px).
export const GRAPH_MORE_NODES = 400;
export const GRAPH = { padLeft: 88, padRight: 48, padTop: 40, row: 60, laneGap: 24, labelGap: 100, pxPerYear: 56, minWidth: 560, spread: 96 };
export const AREA_NONE = '–';
// The phone layout: time runs top to bottom in a few columns that fit the width (drawn in a 360-wide box that scales).
export const GRAPH_V = { width: 360, gutter: 48, padRight: 8, padTop: 24, row: 64, columns: 3 };
export const NARROW = '(max-width: 700px)';
