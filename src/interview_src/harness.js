// Offline replay of the interview-prep nodes. Run: node interview_src/harness.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = __dirname;
let FAIL = 0;
const ok = (l, c, d) => { if (!c) { FAIL++; console.log('  FAIL ' + l + (d ? ' :: ' + d : '')); }
                          else console.log('  ok   ' + l); };
function run(file, ctx, subs) {
  let code = fs.readFileSync(path.join(SRC, file), 'utf8');
  for (const [k, v] of Object.entries(subs || {})) code = code.split(k).join(v);
  return vm.runInNewContext('(function(){' + code + '})()',
    Object.assign({ console, RegExp, JSON, Math, Date, String, Array, Object, isFinite }, ctx));
}

const page = (over = {}) => Object.assign({
  id: 'pg1', url: 'https://notion.so/pg1',
  properties: {
    'Job Title': { title: [{ text: { content: 'Network Administrator' } }] },
    'Company':   { rich_text: [{ text: { content: 'Acme Co' } }] },
    'Score':     { number: 62 },
    'Role Type': { select: { name: 'Network Engineer' } },
    'Location':  { rich_text: [{ text: { content: 'Remote' } }] },
    'Salary Min': { number: 120000 }, 'Salary Max': { number: 150000 },
    'Tags': { multi_select: [{ name: 'BGP' }, { name: 'Fortinet' }] },
    'Fit Summary':    { rich_text: [{ text: { content: 'Solid routing overlap.' } }] },
    'Missing Skills': { rich_text: [{ text: { content: 'Terraform, Ansible' } }] },
    'Red Flags':      { rich_text: [{ text: { content: 'Salary below target' } }] },
    'Drive Folder':   { url: 'https://drive.google.com/drive/folders/FOLDER123' },
    'Apply URL':      { url: 'https://example.com/j/1' },
  },
}, over);
const blocks = arr => ({ results: arr });
const h2 = t => ({ type: 'heading_2', heading_2: { rich_text: [{ plain_text: t }] } });
const para = t => ({ type: 'paragraph', paragraph: { rich_text: [{ plain_text: t }] } });

console.log('\n1. Queue + lock');
{
  ok('three boards', run('build_interview_queue.js', {}).length === 3);
  const st = {};
  const ctx = { $input: { all: () => [{ json: { results: [page()] } }, { json: { results: [] } }] },
                $getWorkflowStaticData: () => st };
  ok('picks one', run('pick_one_interview.js', ctx).length === 1);
  ok('locks it', !!st.prepping['pg1']);
  ok('skips locked on next poll', run('pick_one_interview.js', ctx).length === 0);
  ok('uses its own lock key (not the scorer\'s)', st.scoring === undefined);
  const cl = run('clear_interview_lock.js', {
    $getWorkflowStaticData: () => st, $: () => ({ first: () => ({ json: { id: 'pg1' } }) }) });
  ok('lock released', !st.prepping['pg1'] && cl[0].json.cleared === 'pg1');
}

console.log('\n2. Extract context');
const ctxOf = (pg, bl) => run('extract_interview_context.js', {
  $: () => ({ first: () => ({ json: pg }) }), $json: bl })[0].json;
{
  const long = 'Manage BGP and Fortinet firewalls across sites. '.repeat(12);
  const c = ctxOf(page(), blocks([h2('📋 Full Job Description'), para(long),
                                  h2('🎯 Resume Customization Tips'), para('tip text')]));
  ok('JD taken from under the heading', c.have_description && c.description.includes('Fortinet'));
  ok('stops at the next heading', !c.description.includes('tip text'));
  ok('folder id parsed from url', c.folder_id === 'FOLDER123' && c.folder_is_fallback === false);
  ok('carries Missing Skills', c.missing_skills === 'Terraform, Ansible');
  ok('doc title names role + company',
     c.doc_title.startsWith('Interview Prep - Network Administrator - Acme Co'));

  const c2 = ctxOf(page(), blocks([para(long)]));
  ok('falls back to all prose when no heading', c2.have_description === true);

  const noFolder = page();
  noFolder.properties['Drive Folder'] = { url: null };
  const c3 = ctxOf(noFolder, blocks([para(long)]));
  ok('falls back to applications root', c3.folder_is_fallback === true && c3.folder_id.length > 10);

  const c4 = ctxOf(page(), blocks([]));
  ok('no blocks -> have_description false', c4.have_description === false);
}

console.log('\n3. Prompt');
{
  const c = ctxOf(page(), blocks([h2('📋 Full Job Description'),
                                  para('BGP Fortinet routing. '.repeat(20))]));
  const out = run('build_interview_prompt.js',
    { $: () => ({ first: () => ({ json: c }) }) },
    { '__CANDIDATE_PROFILE__': 'CANDIDATE PROFILE — Your Name\n- STRONG / EXPERT: BGP' })[0].json;
  const body = JSON.parse(out.claude_body);
  const pr = body.messages[0].content;
  ok('profile spliced in', pr.includes('STRONG / EXPERT'));
  ok('placeholder consumed', !pr.includes('__CANDIDATE_PROFILE__'));
  ok('asks for nice-to-haves', pr.includes('nice_to_haves'));
  ok('feeds Missing Skills to the coach', pr.includes('Terraform, Ansible'));
  ok('forbids bluffing', /[Dd]o not coach him to bluff/.test(pr));
  ok('model is sonnet-4-6', body.model === 'claude-sonnet-4-6');

  const c2 = ctxOf(page(), blocks([]));
  const out2 = run('build_interview_prompt.js',
    { $: () => ({ first: () => ({ json: c2 }) }) }, { '__CANDIDATE_PROFILE__': 'P' })[0].json;
  ok('no-JD case says so', JSON.parse(out2.claude_body).messages[0].content
       .includes('No job description is stored'));
}

console.log('\n4. Render sheet');
const sheet = (over = {}) => Object.assign({
  role_snapshot: 'Keeps the network up. They want routing depth.',
  required_tech: [1,2,3,4,5].map(i => ({ question: 'Q' + i, why: 'w', answer_with: 'a' })),
  nice_to_haves: [1,2,3].map(i => ({ question: 'N' + i, why: 'w', answer_with: 'a' })),
  gap_questions: [1,2].map(i => ({ question: 'G' + i, why: 'w', answer_with: 'a' })),
  ask_them: ['A1','A2','A3','A4'],
}, over);
function render(resp, d) {
  return run('parse_interview_sheet.js', {
    $input: { first: () => ({ json: resp }) },
    $: () => ({ first: () => ({ json: d }) }) })[0].json;
}
{
  const d = ctxOf(page(), blocks([para('BGP. '.repeat(80))]));
  const r = render({ content: [{ text: JSON.stringify(sheet()) }] }, d);
  ok('ok flag set', r.ok === true);
  const reqs = JSON.parse(r.doc_batch_body).requests;
  const text = reqs[0].insertText.text;
  ok('all four sections present',
     ['REQUIRED SKILLS','NICE-TO-HAVES','YOUR GAPS','QUESTIONS TO ASK THEM']
       .every(s => text.includes(s)), text.substring(0,120));
  ok('counts recorded', r.counts.required === 5 && r.counts.nice === 3 &&
                        r.counts.gaps === 2 && r.counts.ask === 4);
  ok('carries folder id', r.folder_id === 'FOLDER123');
  ok('has formatting requests', reqs.length > 5);
  const maxIdx = Math.max(...reqs.slice(1).map(x =>
    (x.updateTextStyle || x.updateParagraphStyle).range.endIndex));
  ok('no style range past end of text', maxIdx <= text.length + 1,
     `max=${maxIdx} len=${text.length}`);
  ok('score shown in header', text.includes('62%'));
  ok('salary shown', text.includes('$120,000'));

  const fenced = { content: [{ text: '```json\n' + JSON.stringify(sheet()) + '\n```' }] };
  ok('survives fences', render(fenced, d).ok === true);

  const bad = render({ content: [{ text: 'sorry' }] }, d);
  ok('bad JSON -> ok false', bad.ok === false);
  ok('bad JSON -> no doc body', bad.doc_batch_body === undefined);
  ok('bad JSON -> discord explains', /Interview prep failed/.test(bad.discord_msg));
}

console.log('\n5. Result assembly');
{
  const r = run('build_prep_result.js', {
    $: (n) => ({ first: () => ({ json: n === 'Create Prep Doc'
      ? { documentId: 'DOC9' }
      : { page_id: 'pg1', title: 'Network Administrator', company: 'Acme Co',
          page_url: 'https://notion.so/pg1',
          counts: { required: 5, nice: 3, gaps: 2, ask: 4 } } }) }),
  })[0].json;
  ok('doc url built', r.doc_url === 'https://docs.google.com/document/d/DOC9/edit');
  const patch = JSON.parse(r.notion_patch).properties;
  ok('patches Interview Prep only', Object.keys(patch).length === 1 &&
     patch['Interview Prep'].url.includes('DOC9'));
  ok('discord names counts', r.discord_msg.includes('5 required-skill'));
}

console.log('\n6. Cost');
{
  const o = run('build_prep_cost_line.js', { $input: { first: () => ({ json:
    { model: 'claude-sonnet-4-6', usage: { input_tokens: 3000, output_tokens: 1500 } } }) } })[0].json;
  ok('sonnet 3/15', o.micro === 3000 * 3 + 1500 * 15, String(o.micro));
  ok('tagged job-interview-prep', o.line.includes('workflow=job-interview-prep'));
}

console.log(FAIL ? `\n${FAIL} FAILURE(S)\n` : '\nAll checks passed.\n');
process.exit(FAIL ? 1 : 0);
