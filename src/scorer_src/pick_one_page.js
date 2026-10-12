// The three board queries land here as three separate items. Flatten them,
// then take a single page per poll - the same one-at-a-time discipline the
// docs branch uses. It keeps Notion under its ~3 req/s limit and keeps every
// Claude call scoped to one job.
const pages = [];
for (const item of $input.all()) {
  const r = item.json.results;
  if (Array.isArray(r)) pages.push(...r);
}
if (!pages.length) return [];   // nothing queued - branch stops cleanly

// Same static-data lock the docs branch uses, under its own key so the two
// can never collide.
const state = $getWorkflowStaticData('global');
const now = Date.now();
const STALE_MS = 30 * 60 * 1000;   // safety release if a run dies mid-flight

const locks = state.scoring || {};
for (const [pid, ts] of Object.entries(locks)) {
  if (now - ts > STALE_MS) delete locks[pid];
}

const page = pages.find(p => !locks[p.id]);
if (!page) { state.scoring = locks; return []; }

locks[page.id] = now;
state.scoring = locks;

return [{ json: page }];
