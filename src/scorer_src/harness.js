// Offline replay of the scoring branch. Fakes just enough of the n8n Code
// node runtime to run each node against fixtures, so filter/parse changes can
// be tested before they reach n8n.  Run: node scorer_src/harness.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = __dirname;
let FAIL = 0;
const ok = (label, cond, detail) => {
  if (!cond) { FAIL++; console.log('  FAIL ' + label + (detail ? ' :: ' + detail : '')); }
  else console.log('  ok   ' + label);
};

function run(file, ctx) {
  const code = fs.readFileSync(path.join(SRC, file), 'utf8');
  const sandbox = Object.assign({ console, RegExp, JSON, Math, Date, String, Array, Object, isFinite }, ctx);
  return vm.runInNewContext('(function(){' + code + '})()', sandbox);
}

// ── fixtures ───────────────────────────────────────────────────────────────
const page = (over = {}) => Object.assign({
  id: 'page-abc', url: 'https://notion.so/page-abc',
  parent: { database_id: 'YOUR_NOTION_DB_MAIN' },
  properties: {
    'Job Title': { title: [{ text: { content: 'Senior Network Engineer' } }] },
    'Company':   { rich_text: [{ text: { content: 'Cloudflare' } }] },
    'Apply URL': { url: 'https://example.com/jobs/1' },
    'Location':  { rich_text: [] },
    'Status':    { select: { name: 'Score Me' } },
    'Score':     { number: null },
  },
}, over);

console.log('\n1. Build Score Queue');
{
  const out = run('build_score_queue.js', {});
  ok('emits one item per board', out.length === 3, JSON.stringify(out.length));
  ok('no duplicate db ids', new Set(out.map(o => o.json.db_id)).size === 3);
}

console.log('\n2. Pick One Page');
{
  const state = {};
  const ctx = {
    $input: { all: () => [
      { json: { results: [page()] } },
      { json: { results: [] } },
      { json: { results: [page({ id: 'page-def' })] } },
    ] },
    $getWorkflowStaticData: () => state,
  };
  const a = run('pick_one_page.js', ctx);
  ok('picks exactly one page', a.length === 1);
  ok('takes the lock', !!state.scoring['page-abc']);
  const b = run('pick_one_page.js', ctx);
  ok('second poll skips the locked page', b[0].json.id === 'page-def');
  const c = run('pick_one_page.js', ctx);
  ok('third poll has nothing left', c.length === 0);

  const empty = run('pick_one_page.js', {
    $input: { all: () => [{ json: { results: [] } }] },
    $getWorkflowStaticData: () => ({}),
  });
  ok('empty queue stops cleanly', empty.length === 0);

  // stale lock release
  const stale = { scoring: { 'page-abc': Date.now() - 31 * 60 * 1000 } };
  const d = run('pick_one_page.js', {
    $input: { all: () => [{ json: { results: [page()] } }] },
    $getWorkflowStaticData: () => stale,
  });
  ok('releases a >30min stale lock', d.length === 1 && d[0].json.id === 'page-abc');
}

console.log('\n3. Resolve Description');
const blocksOf = txt => ({ results: txt
  ? [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: txt }] } }] : [] });
{
  const r1 = run('resolve_description.js', {
    $: () => ({ first: () => ({ json: page() }) }), $json: blocksOf(''),
  })[0].json;
  ok('bare row -> needs_fetch', r1.needs_fetch === true && r1.pasted_description === '');
  ok('carries page id + url', r1.page_id === 'page-abc' && r1.apply_url.includes('example.com'));
  ok('notices blank Location', r1.location === '');
  ok('notices missing Source', r1.has_source === false);
  ok('records the triggering status', r1.origin_status === 'Score Me');

  const applying = page();
  applying.properties['Status'] = { select: { name: 'Applying' } };
  const rA = run('resolve_description.js', {
    $: () => ({ first: () => ({ json: applying }) }), $json: blocksOf(''),
  })[0].json;
  ok('records an Applying trigger', rA.origin_status === 'Applying');

  const long = 'Responsibilities include BGP and anycast edge routing. '.repeat(12);
  const r2 = run('resolve_description.js', {
    $: () => ({ first: () => ({ json: page() }) }), $json: blocksOf(long),
  })[0].json;
  ok('pasted JD wins over scraping', r2.needs_fetch === false && r2.pasted_description.length > 400);

  const r3 = run('resolve_description.js', {
    $: () => ({ first: () => ({ json: page() }) }), $json: blocksOf('short note'),
  })[0].json;
  ok('a short note is not treated as a JD', r3.needs_fetch === true);

  const noUrl = page();
  noUrl.properties['Apply URL'] = { url: null };
  const r4 = run('resolve_description.js', {
    $: () => ({ first: () => ({ json: noUrl }) }), $json: blocksOf(''),
  })[0].json;
  ok('no URL and no text -> no fetch attempted', r4.needs_fetch === false);
}

console.log('\n4. Build Score Prompt');
const resolved = (over = {}) => Object.assign({
  page_id: 'page-abc', db_id: 'db', page_url: 'https://notion.so/page-abc',
  title: 'Senior Network Engineer', company: 'Cloudflare', location: '',
  apply_url: 'https://example.com/jobs/1', has_source: false, has_date_found: false,
  pasted_description: '', needs_fetch: true, origin_status: 'Score Me',
}, over);
{
  const scraped = '# Senior Network Engineer\n\nWe need BGP and anycast expertise. '.repeat(20);
  const p1 = run('build_score_prompt.js', {
    $: () => ({ first: () => ({ json: resolved() }) }),
    $json: { data: scraped },
  })[0].json;
  ok('uses the scraped text', p1.have_description === true);
  const body = JSON.parse(p1.claude_body);
  ok('model is sonnet-4-6', body.model === 'claude-sonnet-4-6');
  ok('prompt carries the rubric', body.messages[0].content.includes('AUTOMATIC DISQUALIFIERS'));
  ok('prompt asks for extraction', body.messages[0].content.includes('"extracted"'));

  const p2 = run('build_score_prompt.js', {
    $: () => ({ first: () => ({ json: resolved() }) }),
    $json: { error: { message: 'timeout' } },      // Jina failed, onError passed it through
  })[0].json;
  ok('Jina failure degrades, does not throw', p2.have_description === false);
  ok('says description unavailable', p2.description_used.includes('No job description'));
  ok('still caps at 75 in prompt', JSON.parse(p2.claude_body).messages[0].content.includes('CAP THE SCORE AT 75'));

  const long = 'BGP anycast peering edge routing observability. '.repeat(40);
  const p3 = run('build_score_prompt.js', {
    $: () => ({ first: () => ({ json: resolved({ pasted_description: long, needs_fetch: false }) }) }),
    $json: {},                                      // fed straight from Resolve Description
  })[0].json;
  ok('pasted path needs no Jina output', p3.have_description === true);
}

console.log('\n5. Parse Score');
const claudeResp = obj => ({ content: [{ text: JSON.stringify(obj) }] });
const verdict = (over = {}) => Object.assign({
  score: 84, fit_summary: 'Strong overlap on BGP and edge routing. Remote US role.',
  missing_skills: 'Terraform', red_flags: 'None',
  tags: ['BGP', 'Anycast', 'Grafana'], role_type: 'Network Engineer',
  resume_tips: ['Lead with BGP/MPLS', 'Add Meraki', 'Mention n8n automation'],
  cover_letter_hook: 'Cloudflare runs one of the largest anycast networks...',
  extracted: { title: 'Senior Network Engineer', company: 'Cloudflare',
               location: 'Remote (US)', salary_min: 145000, salary_max: 180000,
               posted_date: '2026-09-18', is_remote: true },
}, over);

function parse(resp, d) {
  return run('parse_score.js', {
    $input: { first: () => ({ json: resp }) },
    $: () => ({ first: () => ({ json: d }) }),
  })[0].json;
}
{
  const d = resolved({ have_description: true, description_used: 'BGP anycast edge routing.' });
  const r = parse(claudeResp(verdict()), d);
  const props = JSON.parse(r.props_patch).properties;
  ok('writes the score', props['Score'].number === 84);
  ok('Priority High at 84', props['Priority'].select.name === 'High');
  ok('hands back to review as New', props['Status'].select.name === 'New');
  ok('fills Fit Summary', props['Fit Summary'].rich_text[0].text.content.length > 10);
  ok('fills Missing Skills', props['Missing Skills'].rich_text[0].text.content === 'Terraform');
  ok('fills Resume Tips', props['Resume Tips'].rich_text[0].text.content.includes('BGP'));
  ok('fills Cover Letter Draft', !!props['Cover Letter Draft']);
  ok('fills Salary Min/Max', props['Salary Min'].number === 145000 && props['Salary Max'].number === 180000);
  ok('fills Posted Date', props['Posted Date'].rich_text[0].text.content === '2026-09-18');
  ok('sets Source=Manual when blank', props['Source'].select.name === 'Manual');
  ok('sets Date Found when blank', !!props['Date Found'].date.start);
  ok('fills blank Location from extraction', props['Location'].rich_text[0].text.content === 'Remote (US)');
  ok('does NOT overwrite a typed Job Title', props['Job Title'] === undefined);
  ok('does NOT overwrite a typed Company', props['Company'] === undefined);
  ok('tags become multi_select', props['Tags'].multi_select.length === 3);

  const kids = JSON.parse(r.blocks_body).children;
  const heads = kids.filter(b => b.type === 'heading_2')
                    .map(b => b.heading_2.rich_text[0].text.content);
  ok('writes the Full Job Description heading the docs branch scans for',
     heads.some(h => h.includes('Full Job Description')), heads.join(' | '));
  ok('writes resume tips + cover letter sections', heads.length === 3, heads.join(' | '));
  ok('discord names the percentage', r.discord_msg.includes('84%'));

  // priority bands
  ok('Priority Medium at 70', JSON.parse(parse(claudeResp(verdict({ score: 70 })), d).props_patch)
       .properties['Priority'].select.name === 'Medium');
  ok('Priority Low at 40', JSON.parse(parse(claudeResp(verdict({ score: 40 })), d).props_patch)
       .properties['Priority'].select.name === 'Low');

  // nulls must not become zeros
  const rn = parse(claudeResp(verdict({ extracted: { title: null, company: null, location: null,
    salary_min: null, salary_max: null, posted_date: null } })), d);
  const pn = JSON.parse(rn.props_patch).properties;
  ok('null salary is omitted, not zeroed', pn['Salary Min'] === undefined && pn['Salary Max'] === undefined);
  ok('null posted_date omitted', pn['Posted Date'] === undefined);

  // fenced output
  const fenced = { content: [{ text: '```json\n' + JSON.stringify(verdict()) + '\n```' }] };
  ok('survives markdown fences', JSON.parse(parse(fenced, d).props_patch).properties['Score'].number === 84);
  const chatty = { content: [{ text: 'Here you go:\n' + JSON.stringify(verdict()) + '\nHope that helps.' }] };
  ok('survives chatter around the JSON', JSON.parse(parse(chatty, d).props_patch).properties['Score'].number === 84);

  // failure path - the runaway-loop guard
  const bad = parse({ content: [{ text: 'I cannot help with that.' }] }, d);
  const bp = JSON.parse(bad.props_patch).properties;
  ok('failure moves Status off "Score Me"', bp['Status'].select.name === 'Score Failed');
  ok('failure writes NO score (stays empty)', bp['Score'] === undefined);
  ok('failure explains itself in Red Flags', bp['Red Flags'].rich_text[0].text.content.includes('Scoring failed'));
  ok('failure still emits a valid blocks body', Array.isArray(JSON.parse(bad.blocks_body).children));

  // status hand-back - the whole point of triggering from "Applying"
  const dApply = resolved({ have_description: true, description_used: 'x',
                            origin_status: 'Applying' });
  ok('an Applying row stays Applying so docs can run',
     JSON.parse(parse(claudeResp(verdict()), dApply).props_patch)
       .properties['Status'].select.name === 'Applying');
  ok('a Score Me row still lands in New',
     JSON.parse(parse(claudeResp(verdict()), d).props_patch)
       .properties['Status'].select.name === 'New');
  ok('an Applying row that fails scoring does NOT stay Applying',
     JSON.parse(parse({ content: [{ text: 'nope' }] }, dApply).props_patch)
       .properties['Status'].select.name === 'Score Failed');

  // out-of-range score
  ok('clamps a >100 score', JSON.parse(parse(claudeResp(verdict({ score: 130 })), d).props_patch)
       .properties['Score'].number === 100);
}

console.log('\n6. Cost line');
{
  const out = run('build_score_cost_line.js', {
    $input: { first: () => ({ json: { model: 'claude-sonnet-4-6',
      usage: { input_tokens: 4000, output_tokens: 800 } } }) },
  })[0].json;
  ok('sonnet priced at 3/15 per 1M', out.micro === 4000 * 3 + 800 * 15, String(out.micro));
  ok('tagged to this branch', out.line.includes('workflow=job-scorer-on-demand'));
}

console.log(FAIL ? `\n${FAIL} FAILURE(S)\n` : '\nAll checks passed.\n');
process.exit(FAIL ? 1 : 0);
