// Flatten the three board queries and take one page per poll. An interview
// sheet is a single Claude call plus three Google API calls, so one at a time
// keeps well clear of Notion's ~3 req/s limit.
const pages = [];
for (const item of $input.all()) {
  const r = item.json.results;
  if (Array.isArray(r)) pages.push(...r);
}
if (!pages.length) return [];

const state = $getWorkflowStaticData('global');
const now = Date.now();
const STALE_MS = 30 * 60 * 1000;

const locks = state.prepping || {};
for (const [pid, ts] of Object.entries(locks)) {
  if (now - ts > STALE_MS) delete locks[pid];
}

const page = pages.find(p => !locks[p.id]);
if (!page) { state.prepping = locks; return []; }

locks[page.id] = now;
state.prepping = locks;
return [{ json: page }];
