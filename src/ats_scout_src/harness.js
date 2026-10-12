// Offline harness: runs the two n8n Code nodes against real board payloads
// with stubs for the n8n globals, so filter changes can be checked without
// touching the live workflow.
const fs = require('fs');
const STATIC = {};
global.$getWorkflowStaticData = () => STATIC;

function run(file, inputItems, nodeOutputs) {
  global.$input = {
    all:   () => inputItems,
    first: () => inputItems[0],
  };
  global.$ = (name) => ({
    all:   () => nodeOutputs[name],
    first: () => nodeOutputs[name][0],
  });
  let src = fs.readFileSync(file, 'utf8');
  // Mirror what build_ats_scout.py does at deploy time, so the offline run
  // exercises the real suppression list rather than an empty one.
  if (src.includes('/*@@SUPPRESSIONS@@*/')) {
    src = src.replace('/*@@SUPPRESSIONS@@*/[]',
      JSON.stringify(JSON.parse(
        require('child_process').execFileSync('python3',
          ['-c', `import yaml,json;d=yaml.safe_load(open("../../scout-targets.yml"));`
               + `print(json.dumps([{"company":t["name"],"role":a.get("role"),`
               + `"applied_on":str(a.get("applied_on") or ""),`
               + `"outcome":a.get("outcome") or "applied",`
               + `"reopen_after":str(a.get("reopen_after") or "")}`
               + ` for t in d["targets"] for a in (t.get("applied") or [])]))`],
          { encoding: 'utf8' })), null, 2));
  }
  return new Function(src)();
}

// ── 0. Notion acted-on lookup (stubbed; pass --live-notion to hit the API) ─
const actedOn = fs.existsSync('fixtures/notion_acted_on.json')
  ? JSON.parse(fs.readFileSync('fixtures/notion_acted_on.json'))
  : [{ json: { results: [] } }];
console.log(`Fetch Acted-On Roles -> ${actedOn.reduce((n, p) => n + (p.json.results || []).length, 0)} acted-on role(s)`);

// ── 1. Build Target List ─────────────────────────────────────────────────
const targets = run('build_target_list.js', [{ json: {} }], {});
console.log(`Build Target List -> ${targets.length} targets`);

// ── 2. Fetch (replayed from fixtures, mimicking how n8n splits payloads) ──
const raw = [];
const push = o => raw.push({ json: o });
for (const t of targets) {
  const { ats, token } = t.json;
  try {
    if (ats === 'greenhouse') push(JSON.parse(fs.readFileSync(`fixtures/gh_${token}.json`)));
    else if (ats === 'ashby') push(JSON.parse(fs.readFileSync(`fixtures/ashby_${token}.json`)));
    // n8n splits a top-level JSON array into one item per element:
    else if (ats === 'lever') JSON.parse(fs.readFileSync('fixtures/lever_wealthfront.json')).forEach(push);
    else if (ats === 'breezy') JSON.parse(fs.readFileSync('fixtures/breezy_vps.json')).forEach(push);
    else if (ats === 'html') push({ data: fs.readFileSync('fixtures/haproxy.html', 'utf8') });
    else if (ats === 'sitemap') push({ data: fs.readFileSync('fixtures/equinix_sitemap.xml', 'utf8') });
  } catch (e) { console.log(`  !! ${token}: ${e.message}`); }
}
console.log(`Fetch -> ${raw.length} raw items`);

// ── 3. Detail pass: index -> per-job URLs -> fetch -> JSON-LD ────────────
const detailTargets = run('extract_detail_urls.js', raw, {});
console.log(`Extract Detail URLs -> ${detailTargets.length} page(s)`
  + (detailTargets[0] && detailTargets[0].json.noop ? ' (keep-alive only)' : ''));

const detailPages = [];
for (const t of detailTargets) {
  if (t.json.noop) { detailPages.push({ json: { noop: true } }); continue; }
  const cache = 'fixtures/detail_' + require('crypto').createHash('sha1')
    .update(t.json.url).digest('hex').slice(0, 16) + '.html';
  if (!fs.existsSync(cache)) {
    try {
      require('child_process').execFileSync('curl',
        ['-sL', '--max-time', '30', '-A', 'Mozilla/5.0', t.json.url, '-o', cache]);
    } catch (e) { console.log(`  !! fetch ${t.json.url}: ${e.message}`); continue; }
  }
  detailPages.push({ json: { data: fs.readFileSync(cache, 'utf8') } });
}

// ── 4. Normalize + Filter + Dedup ────────────────────────────────────────
const out = run('normalize_ats.js', detailPages, {
  'Build Target List': targets,
  'Fetch ATS Board': raw,
  'Extract Detail URLs': detailTargets,
  'Fetch Acted-On Roles': actedOn,
});
const { jobs, count } = out[0].json;

console.log(`\nBoards that returned postings:`, STATIC.lastRunStats.ok);
console.log(`Deferred: ${STATIC.lastRunStats.deferred} · acted-on excluded: ${STATIC.lastRunStats.actedOn} · applied this week: ${STATIC.lastRunStats.appliedThisWeek}`);
console.log(`\n=== QUEUE (${count}) ===`);
for (const j of jobs) {
  const sal = j.salary_min ? `$${j.salary_min/1000}k-${j.salary_max ? j.salary_max/1000+'k' : '?'}` : (j.salary_text || '—');
  console.log(`P${j.priority} [${j.posted_date||'??'}] ${j.title}`);
  console.log(`     ${j.company} | ${j.location} | ${sal} | ${j.location_verdict}`);
}
console.log(`\n--- source health (${STATIC.lastRunStats.bad.length} notes) ---`);
STATIC.lastRunStats.bad.slice(0, 12).forEach(b => console.log('  ' + b));
