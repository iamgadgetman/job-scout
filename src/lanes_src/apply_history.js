// Record each lookup's yes/no per employer (cached 90 days in static data) and
// label every job's remote history. Runs on both IF branches; when no lookup
// ran, the two node references below throw and are treated as empty.
const src = $('Normalize + Filter + Dedup').first().json;
const sd = $getWorkflowStaticData('global');
sd.remoteLookup = sd.remoteLookup || {};
sd.companyRemote = sd.companyRemote || {};
const NOW = Date.now();
const normCo = s => (s || '').toLowerCase().replace(/[.,]/g, ' ')
  .replace(/\b(inc|llc|ltd|corp|corporation|co|company|the)\b/g, ' ').replace(/\s+/g, ' ').trim();

let companies = [], results = [];
try { companies = $('Companies To Check').all().map(i => i.json.company); } catch (e) {}
try { results = $('Remote History Lookup').all(); } catch (e) {}

companies.forEach((company, i) => {
  const r = results[i] && results[i].json;
  // /search-v2 wraps results as data.jobs; /search returned a bare data array.
  const list = r && r.data && (Array.isArray(r.data) ? r.data : r.data.jobs);
  if (!Array.isArray(list)) return;   // failed/429 lookup: not cached, retried next run
  const want = normCo(company);
  // Whole normalized name must match, so "City of Nearby City C" is not "City of Nearby City B".
  const hits = list.filter(x => x.job_is_remote === true && normCo(x.employer_name) === want);
  sd.remoteLookup[want] = { at: NOW, hasRemote: hits.length > 0, count: hits.length };
});

const jobs = (src.jobs || []).map(j => {
  let remote_history;
  if (j.work_mode === 'Remote') remote_history = 'Remote role';
  else {
    const k = normCo(j.company);
    const c = sd.remoteLookup[k];
    if (sd.companyRemote[k]) remote_history = 'Yes - remote posting seen';
    else if (c && c.hasRemote) remote_history = `Yes - ${c.count} remote posting(s) found`;
    else if (c) remote_history = 'No remote postings found';
    else remote_history = 'Not checked';
  }
  return { ...j, remote_history };
});
return [{ json: { jobs, count: jobs.length, filter_stats: src.filter_stats } }];
