// Regression tests for the location filter. Each case here is a real shape seen
// on a real board, and several are bugs that were shipped and then fixed -
// keep them.  Run: node test_filters.js
const fs = require('fs');

function normalize(jobs) {
  const STATIC = {};
  global.$getWorkflowStaticData = () => STATIC;
  global.$input = { all: () => [], first: () => undefined };
  const targets = [{ json: { name: 'T', token: 't', priority: 1, ats: 'greenhouse' } }];
  global.$ = (n) => ({
    all: () => n === 'Build Target List' ? targets
             : n === 'Fetch ATS Board' ? jobs.map(j => ({ json: wrap(j) }))
             : [],
    first: () => undefined,
  });
  const out = new Function(fs.readFileSync('normalize_ats.js', 'utf8'))();
  return out[0].json.jobs;
}
// Present each case as a one-job Greenhouse board.
function wrap(c) {
  return { jobs: [{
    id: c.id, title: c.title, company_name: 'T',
    absolute_url: 'https://job-boards.greenhouse.io/t/jobs/' + c.id,
    location: { name: c.location },
    offices: (c.offices || []).map(o => ({ name: o })),
    first_published: '2026-09-01T00:00:00Z',
    content: c.content || 'Infrastructure role. Salary $150,000 - $190,000.',
  }] };
}

const CASES = [
  // [id, title, location, expect kept?, why]
  [1, 'Network Engineer', 'Remote (United States)', true,  'plain US remote'],
  [2, 'Network Engineer', 'Hybrid',                 false, 'hybrid, no remote option'],
  [3, 'Network Engineer', 'In-Office',              false, 'onsite'],
  [4, 'Network Engineer', 'Hybrid or Remote',       true,  'FIXED: offers remote as well as hybrid'],
  [5, 'Network Engineer', 'Distributed; Hybrid',    true,  'FIXED: distributed option on offer'],
  [6, 'Network Engineer', 'United States',          true,  'FIXED: bare country means distributed'],
  [7, 'Network Engineer', 'Remote (Canada)',        false, 'remote, but not in the US'],
  [8, 'Systems Engineer EMEA', 'Remote',            false, 'FIXED: region is only in the title'],
  [9, 'Distributed Systems Engineer', 'Hybrid',     false, 'FIXED: "distributed" in a title is not a work arrangement'],
  [10,'Network Engineer', 'Remote-Only City, WA',            false, 'Remote-Only City is remote-only since 2026-10-04'],
  [19,'Network Engineer', 'Remote - Remote-Only City, WA',   true,  'remote Remote-Only City is fine'],
  [20,'Network Engineer', 'Your City, WA',        true,  'Your City onsite allowed'],
  [11,'Network Engineer', 'Nearby City A, WA',          true,  'Metro Area'],
  [12,'Network Engineer', 'Austin, TX',             false, 'onsite outside the allowed metros'],
  [13,'Network Engineer', 'Remote (United Kingdom)', true, 'UK-primary but also open in the US',
      ['Remote (United Kingdom)', 'Remote (United States)']],
  // SRE / DevOps dropped 2026-10-01 - he does not qualify for them.
  [14,'Senior Site Reliability Engineer', 'Remote (United States)', false, 'SRE title'],
  [15,'SRE, Infrastructure', 'Remote (United States)', false, 'SRE abbreviation'],
  [16,'Production Engineer', 'Remote (United States)', false, 'SRE under another name'],
  [17,'Platform Reliability Engineer', 'Remote (United States)', false, 'non-network reliability title'],
  [18,'Staff Network Reliability Engineer', 'Remote (United States)', true, 'network reliability is network work'],
];

let pass = 0, fail = 0;
for (const [id, title, location, expect, why, offices] of CASES) {
  const kept = normalize([{ id, title, location, offices }]).length === 1;
  const ok = kept === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(id).padStart(2)}. ${(title + ' @ ' + location).padEnd(46)} ${why}`);
}

// Salary handling is a hard filter, so pin its edge cases too.
const SALARY = [
  // The rule (2026-10-04): a RANGE must reach $120k at the top; the bottom may sit below it.
  ['drops the Vantage Point range ($85-100k)',
   'Compensation and Benefits: This position offers a salary range of $85,000 to $100,000.', false],
  ['drops a range that tops out under $120k', 'Pay range $80,000 - $95,000.', false],
  ['KEEPS $90-125k - low bottom, but the top clears $120k',
   'Salary range $90,000 - $125,000.', true],
  ['keeps a range exactly at $120k top',      'Salary $100,000 - $120,000.', true],
  ['drops a range topping out at $119k',      'Salary $100,000 - $119,000.', false],
  ['keeps a range well clear of the floor',   'Salary $150,000 - $190,000.', true],
  // A LONE figure has to reach the same $120k - and is only trusted when it
  // sits next to compensation wording.
  ['drops a lone $85k quoted as the salary',  'The salary for this role is $85,000.', false],
  ['drops a lone $110k quoted as the salary', 'The salary for this role is $110,000.', false],
  ['keeps a lone $50k signing bonus - not a base salary',
   'We offer a $50,000 signing bonus to the right candidate.', true],
  ['keeps a lone $140k quoted as the salary', 'Base salary of $140,000.', true],
  ['keeps a lone $120k quoted as the salary', 'Base salary of $120,000.', true],
  ['keeps unlisted comp entirely',            'Competitive compensation and equity.', true],
  ['keeps a non-USD range rather than misjudging it',
   'CAN Pay Range $100,000 - $110,000 CAD.', true],
];
// Federal / federal-contractor work is out (2026-10-04) - but EEO boilerplate
// that merely says "federal contractor" must not trip it.
SALARY.push(
  ['drops DOE national-lab work', 'Support network operations for a Department of Energy national laboratory. Salary $150,000 - $190,000.', false],
  ['drops regional federal site site work',     'Onsite support at the regional federal site Site. Salary $150,000 - $190,000.', false],
  ['KEEPS EEO "federal contractor" boilerplate',
   'Salary $150,000 - $190,000. As a federal contractor, we comply with U.S. Department of Labor EEO rules.', true],
);
for (const [why, content, expect] of SALARY) {
  const kept = normalize([{ id: 99, title: 'Network Engineer',
                            location: 'Remote (United States)', content }]).length === 1;
  const ok = kept === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  salary: ${why}`);
}

// ── JSON-LD detail path: structured country codes must beat prose ────────
function normalizeDetail(jp, meta) {
  const STATIC = {};
  global.$getWorkflowStaticData = () => STATIC;
  global.$input = { all: () => [{ json: { data:
    `<html><script type="application/ld+json">${JSON.stringify(jp)}</script>`
    + `<body>${meta.slug}</body></html>` } }] };
  const targets = [{ json: { name: 'T', token: 't', priority: 1, ats: 'greenhouse' } }];
  global.$ = (n) => ({
    all: () => n === 'Build Target List' ? targets
             : n === 'Extract Detail URLs' ? [{ json: meta }]
             : [],
    first: () => undefined,
  });
  return new Function(fs.readFileSync('normalize_ats.js', 'utf8'))()[0].json.jobs;
}
const LD = [
  ['TELECOMMUTE in Poland is rejected on addressCountry', false,
   { '@type': 'JobPosting', title: 'Platform Engineer', jobLocationType: 'TELECOMMUTE',
     datePosted: '2026-09-01', description: 'Infra. Salary $150,000 - $190,000.',
     jobLocation: [{ address: { addressLocality: 'Warsaw', addressCountry: 'PL' } }] },
   { slug: 'platform-engineer-warsaw-poland', company: 'Equinix', priority: 2, detail_url: 'u' }],
  ['TELECOMMUTE in the US is kept', true,
   { '@type': 'JobPosting', title: 'Network Engineer', jobLocationType: 'TELECOMMUTE',
     datePosted: '2026-09-01', description: 'Infra. Salary $150,000 - $190,000.',
     jobLocation: [{ address: { addressLocality: 'Dallas', addressCountry: 'US' } }] },
   { slug: 'network-engineer-dallas-texas-united-states', company: 'Equinix', priority: 2, detail_url: 'u' }],
  ['TELECOMMUTE with no country at all is kept', true,
   { '@type': 'JobPosting', title: 'Network Engineer', jobLocationType: 'TELECOMMUTE',
     datePosted: '2026-09-01', description: 'Infra. Salary $150,000 - $190,000.' },
   { slug: 'network-engineer', company: 'HAProxy Technologies', priority: 1, detail_url: 'u' }],
];
for (const [why, expect, jp, meta] of LD) {
  const kept = normalizeDetail(jp, meta).length === 1;
  const ok = kept === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  json-ld: ${why}`);
}

// ── Suppression: roles already been through must not come back round ─────
function normalizeSupp(job, rules) {
  const STATIC = {};
  global.$getWorkflowStaticData = () => STATIC;
  global.$input = { all: () => [], first: () => undefined };
  const targets = [{ json: { name: 'T', token: 't', priority: 1,
                             ats: 'greenhouse', suppressions: rules } }];
  global.$ = (n) => ({
    all: () => n === 'Build Target List' ? targets
             : n === 'Fetch ATS Board' ? [{ json: wrap(job) }]
             : [],
    first: () => undefined,
  });
  return new Function(fs.readFileSync('normalize_ats.js', 'utf8'))()[0].json.jobs;
}
const FUTURE = '2099-01', PAST = '2000-01';
const SUPP = [
  ['exact role is held until the window expires', false,
   { id: 1, title: 'Infrastructure Engineer', location: 'Remote (United States)' },
   [{ company: 'T', role: 'Infrastructure Engineer', reopen_after: FUTURE, outcome: 'declined' }]],
  ['a DIFFERENT role at the same employer still comes through', true,
   { id: 2, title: 'Network Engineer', location: 'Remote (United States)' },
   [{ company: 'T', role: 'Infrastructure Engineer', reopen_after: FUTURE, outcome: 'declined' }]],
  ['a null role holds the whole employer', false,
   { id: 3, title: 'Network Engineer', location: 'Remote (United States)' },
   [{ company: 'T', role: null, reopen_after: FUTURE, outcome: 'declined' }]],
  ['an expired window lets the role back', true,
   { id: 4, title: 'Infrastructure Engineer', location: 'Remote (United States)' },
   [{ company: 'T', role: 'Infrastructure Engineer', reopen_after: PAST, outcome: 'declined' }]],
  ['a suppression for another employer does not apply', true,
   { id: 5, title: 'Infrastructure Engineer', location: 'Remote (United States)' },
   [{ company: 'Someone Else', role: 'Infrastructure Engineer', reopen_after: FUTURE }]],
  ['seniority prefix still matches the suppressed role', false,
   { id: 6, title: 'Senior Infrastructure Engineer', location: 'Remote (United States)' },
   [{ company: 'T', role: 'Infrastructure Engineer', reopen_after: FUTURE, outcome: 'declined' }]],
];
for (const [why, expect, job, rules] of SUPP) {
  const kept = normalizeSupp(job, rules).length === 1;
  const ok = kept === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  suppress: ${why}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
