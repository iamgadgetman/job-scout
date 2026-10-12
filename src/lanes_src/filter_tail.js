// ── 2026-10-10 local + remote filter (patch_lanes_local.py) ─────────────────
// Everything above this line is the live per-source parsing, unchanged except
// that JSearch and Adzuna now carry city/state. Below: work mode, location
// allowlist, exclusions, dedup. Every drop is counted in filter_stats so a run
// shows exactly where jobs went.
const __stats = { in: allJobs.length, kept_remote: 0, kept_local: 0, dropped: {} };
const __drop = (why) => { __stats.dropped[why] = (__stats.dropped[why] || 0) + 1; return false; };

// Remote anywhere in the US, or on-site/hybrid in Your County, the
// Metro Area, or ~50 miles of Your City. Each city is pinned to its state so
// Nearby Town 5 OH, Nearby Town 6 CA, Nearby City C MS, Nearby Town 2 AZ do not pass. Nearby Town 8 and
// Nearby Town 12 are additions to the requested list (both inside the commute area).
const CITY_STATE = {
  'your city': 'WA', 'nearby town 1': 'WA', 'nearby town 2': 'WA', 'nearby town 3': 'WA',
  'nearby town 4': 'WA', 'nearby town 5': 'WA', 'nearby town 6': 'WA', 'nearby town 7': 'WA',
  'nearby city c': 'WA', 'nearby town 9': 'WA', 'nearby city a': 'WA', 'nearby city b': 'WA',
  'nearby town 8': 'WA', 'metro area': 'WA', 'metro area': 'WA',
  'nearby town 10': 'OR', 'nearby town 10': 'OR', 'nearby town 11': 'OR', 'nearby town 12': 'OR',
};
const STATE_RE = { WA: /\b(wa|washington)\b/i, OR: /\b(or|oregon)\b/i };
// JSearch labels Washington D.C. jobs "Nearby City B, Washington" (measured 2026-10-04).
const DC_HINT = /washington,?\s*d\.?\s*c\b|\bd\.c\.|\bdc metro|\bdmv area\b/i;

function localCity(j) {
  // Structured city/state first (JSearch, Adzuna), then the free-text location.
  const tryPair = (city, stateText) => {
    const c = (city || '').toLowerCase().trim();
    const st = CITY_STATE[c];
    return st && STATE_RE[st].test(stateText || '') ? c : null;
  };
  let c = tryPair(j.city, j.state);
  if (!c) {
    const loc = (j.location || '').toLowerCase();
    for (const name of Object.keys(CITY_STATE).sort((a, b) => b.length - a.length)) {
      if (new RegExp('(^|[^a-z])' + name + '([^a-z]|$)').test(loc) && STATE_RE[CITY_STATE[name]].test(loc)) { c = name; break; }
    }
  }
  if (!c) return null;
  if (DC_HINT.test(j.title + ' ' + (j.description || '').substring(0, 2500))) return null;
  return c.replace(/\b\w/g, ch => ch.toUpperCase());
}

// Whole-word match (plural allowed): 'saic' does not hit Mosaic, 'rtx' not Artex.
const kwHit = (txt, k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(e?s)?([^a-z0-9]|$)').test(txt);

const DEV_TITLES = [
  'software engineer','software developer','software development',
  'web developer','web engineer','frontend','front-end','back-end','backend',
  'full stack','fullstack','full-stack',
  'mobile developer','ios developer','android developer',
  'data engineer','data scientist','ml engineer','machine learning',
  'application developer','application engineer',
  'java developer','python developer','ruby developer','rails developer',
  'react engineer','angular engineer','ui engineer','ux engineer',
  'staff engineer','principal software',
];
// Network / infrastructure / sysadmin / network-security first. SRE, platform
// and observability titles still pass (growth path) and are scored on substance.
const TITLE_OK = [
  'network engineer','network administrator','network operations','network analyst',
  'network specialist','network technician','network security','network and systems',
  'systems and network','network/systems','network architect','firewall engineer',
  'infrastructure engineer','infrastructure administrator','infrastructure operations',
  'it infrastructure','infrastructure architect',
  'systems engineer','systems administrator','system administrator','sysadmin','it systems',
  'virtualization engineer','vmware engineer','server engineer','server administrator',
  'data center engineer','wireless engineer','noc engineer','security engineer',
  'it engineer','it administrator','senior engineer','security operations',
  'hybrid cloud','cloud engineer','cloud network','cloud operations','operations engineer',
  'platform engineer','devops','dev ops','sre','site reliability','reliability engineer',
  'monitoring engineer','observability engineer','monitoring administrator',
];
const CODE_PRIMARY = [
  'building scalable web application','develop backend service',
  'full-stack development','experience with react is required',
  'ruby on rails','django framework','.net development','java spring boot',
  'mobile application development','design and develop software product',
  'software development lifecycle is your','you will write and maintain code',
];
// Clearance: title always; body only on "must hold/obtain" phrasings, so
// "no clearance required" does not trip it.
const CLEARANCE_BODY = [
  'clearance required','requires clearance','must have clearance','active secret',
  'top secret','ts/sci','secret clearance','security clearance is required',
  'clearance is required','active clearance','maintain a security clearance',
  'maintain a clearance','obtain a security clearance','eligible for a security clearance',
  'public trust clearance','public trust position','dod 8570','dod 8140',
  'iat level ii','iat level iii',
];
// DoD/defense primes, federal contractors (regional federal site, national labs) and the VA.
// State and local government is fine.
const FED_EMPLOYERS = [
  'lockheed martin','raytheon','rtx','northrop grumman','booz allen','general dynamics',
  'l3harris','bae systems','leidos','saic','caci','mantech','peraton','gdit',
  'huntington ingalls','textron','anduril','shield ai','palantir','parsons',
  'amentum','federal reserve','apogee','feditc',
  'federal it consulting','department of veterans affairs','veterans affairs',
  'veterans health administration',
];
// Narrow on purpose: "As a federal contractor..." sits in most large employers' EEO text.
const FED_BODY = [
  'department of energy','doe contract','national laboratory',
  'dod customer','support of the dod','support of dod','department of defense',
  'federal customer','federal government client','federal agency client',
  'supporting federal agencies','va medical center','veterans affairs medical',
];
// National backbone / MPLS carriers. Regional ISPs are left to the scorer.
const CARRIERS = [
  'lumen','centurylink','level 3','verizon','at&t','zayo','cogent','windstream',
  'frontier communications','gtt communications','crown castle',
];
const DRUG = ['drug test','drug screen','drug-free workplace','drug free workplace',
  'pre-employment drug','background and drug','controlled substance test'];

const DAY = 86400000;
const NOW = Date.now();
const STALE_DAYS = 14;

allJobs = allJobs.filter(j => {
  const t = (j.title || '').toLowerCase();
  const co = (j.company || '').toLowerCase();
  const body = (j.description || '').toLowerCase();

  // Work mode + location. Boards geotag remote jobs to a city ("Remote Business
  // Systems Administrator", JSearch: on-site Nearby City B), so a remote title wins.
  if (!j.is_remote && /\bremote\b/.test(t) && !/\bnot remote\b|\bnon-remote\b/.test(t)) j.is_remote = true;
  const city = j.is_remote ? '' : localCity(j);
  if (!j.is_remote && !city) return __drop('on-site outside area');
  j.city = city || '';
  j.work_mode = j.is_remote ? 'Remote' : (/\bhybrid\b/.test(t + ' ' + body) ? 'Hybrid' : 'On-site');

  if (DEV_TITLES.some(k => t.includes(k))) return __drop('dev title');
  if (!TITLE_OK.some(k => t.includes(k))) return __drop('title not infra/network');
  if (CODE_PRIMARY.some(k => body.substring(0, 1000).includes(k))) return __drop('coding-primary');

  j.clearance_flag = t.includes('clearance') || /\bts\/sci\b|\bsecret\b/.test(t)
    || CLEARANCE_BODY.some(k => body.includes(k));
  if (j.clearance_flag) return __drop('clearance');
  if (FED_EMPLOYERS.some(k => kwHit(co, k)) || FED_BODY.some(k => body.includes(k))) return __drop('federal/defense/VA');
  if (CARRIERS.some(k => kwHit(co, k))) return __drop('carrier');

  // Boards without a date filter (Remotive, RemoteOK, Muse) keep serving old
  // postings; past the dedup window they would be re-scored as new.
  if (j.posted_date) {
    const age = (NOW - Date.parse(j.posted_date)) / DAY;
    if (age > STALE_DAYS) return __drop('posted > 14 days ago');
  }

  // Drug testing is a flag, never a filter.
  j.drug_test_flag = DRUG.some(k => body.includes(k));
  return true;
});

// Dedup: job_id and company+title+city, both for 14 days.
const sd = $getWorkflowStaticData('global');
sd.seenJobIds = sd.seenJobIds || {};
sd.seenKeys = sd.seenKeys || {};
sd.companyRemote = sd.companyRemote || {};
sd.remoteLookup = sd.remoteLookup || {};
for (const m of [sd.seenJobIds, sd.seenKeys]) for (const k of Object.keys(m)) if (m[k] < NOW - 14 * DAY) delete m[k];
for (const m of [sd.companyRemote, sd.remoteLookup]) for (const k of Object.keys(m)) if ((m[k].at || 0) < NOW - 90 * DAY) delete m[k];

const normCo = s => (s || '').toLowerCase().replace(/[.,]/g, ' ')
  .replace(/\b(inc|llc|ltd|corp|corporation|co|company|the)\b/g, ' ').replace(/\s+/g, ' ').trim();

// Passive remote evidence: any remote posting seen from an employer counts.
for (const j of allJobs) if (j.work_mode === 'Remote' && j.company) {
  sd.companyRemote[normCo(j.company)] = { at: NOW };
}

const fresh = [];
for (const j of allJobs) {
  const key = (j.company + '|' + j.title + '|' + j.city).toLowerCase();
  if (sd.seenJobIds[j.job_id] || sd.seenKeys[key]) { __drop('already seen (14d)'); continue; }
  sd.seenJobIds[j.job_id] = NOW;
  sd.seenKeys[key] = NOW;
  fresh.push(j);
}

// Local jobs are rare, so they go first and are never cut by the cap.
fresh.sort((a, b) => (a.work_mode === 'Remote') - (b.work_mode === 'Remote'));
const CAP = 20;
const limited = fresh.slice(0, CAP);
if (fresh.length > CAP) __stats.dropped['over cap (20)'] = fresh.length - CAP;
for (const j of limited) j.work_mode === 'Remote' ? __stats.kept_remote++ : __stats.kept_local++;

// On-site/hybrid employers with no cached answer get one remote-history lookup.
const lookups = [];
for (const j of limited) {
  if (j.work_mode === 'Remote' || !j.company) continue;
  const k = normCo(j.company);
  if (sd.companyRemote[k] || sd.remoteLookup[k]) continue;
  if (!lookups.includes(j.company)) lookups.push(j.company);
}

return [{ json: { jobs: limited, count: limited.length, lookups: lookups.slice(0, 8), filter_stats: __stats } }];
