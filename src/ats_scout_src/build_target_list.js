// ── Single source of truth for which boards get polled ────────────────────
// Adding a company is ONE line here; nothing else in the workflow changes.
// Derived from career/job-search/scout-targets.yaml.yml. Every token below was
// verified 2026-09-10 by fetching the endpoint and counting returned postings.
//
// NOT wired:
//   DigitalOcean - still unresolved as of 2026-09-10. 404 on Greenhouse
//                  (digitalocean, digitaloceanholdings, digitalocean1,
//                  docareers), Lever and Ashby; 21 Workday tenant/site
//                  combinations tried; no board URL in the page HTML, its JS
//                  bundles, or the careers sitemap. The open-roles page renders
//                  its list client-side ("Loading roles...").
//                  RECOVERY, one minute by hand: open
//                  digitalocean.com/careers/open-roles in a browser, click any
//                  role, and read the domain of the URL it lands on. That
//                  domain plus the first path segment is the token - add it
//                  here and to scout-targets.yaml.yml.
const TARGETS = [
  // Tier 1 - networking is the product, remote is the default
  { name: 'Tailscale',                ats: 'greenhouse', token: 'tailscale',   priority: 1 },
  { name: 'Grafana Labs',             ats: 'greenhouse', token: 'grafanalabs', priority: 1 },
  { name: 'Cloudflare',               ats: 'greenhouse', token: 'cloudflare',  priority: 1 },
  { name: 'HAProxy Technologies',     ats: 'html',       token: 'haproxy',     priority: 1 },
  // Tier 2 - remote-friendly at scale
  { name: 'Fastly',                   ats: 'greenhouse', token: 'fastly',      priority: 2 },
  { name: 'GitLab',                   ats: 'greenhouse', token: 'gitlab',      priority: 2 },
  { name: 'Datadog',                  ats: 'greenhouse', token: 'datadog',     priority: 2 },
  { name: 'WorkOS',                   ats: 'ashby',      token: 'WorkOS',      priority: 2 },
  { name: 'Vantage Point Solutions',  ats: 'breezy',     token: 'vantage-point-solutions-inc', priority: 2 },
  // Added 2026-10-01 - each had a remote-US network role open on the day it
  // was probed (Coinbase Sr Network Engineer, NetBrain Sr Network Automation
  // Engineer, Vultr Network Operations Engineer, Cerebras Network Security
  // Engineer, Aviatrix Sr/Staff Cloud Network Engineer).
  { name: 'Coinbase',                 ats: 'greenhouse', token: 'coinbase',    priority: 2 },
  { name: 'NetBrain',                 ats: 'greenhouse', token: 'netbrain',    priority: 1 },
  { name: 'Vultr',                    ats: 'ashby',      token: 'vultr',       priority: 1 },
  { name: 'Cerebras',                 ats: 'ashby',      token: 'cerebras',    priority: 2 },
  { name: 'Aviatrix',                 ats: 'greenhouse', token: 'aviatrix',    priority: 1 },
  // Added 2026-10-11 - probed live; each had a US or remote-flagged network
  // role open that day (Meter Network Engineer, Lambda Sr Network Engineer,
  // Fluidstack Network Engineer x3, Snowflake Staff Network Engineer, Nebius
  // Sr Network Engineer US, OpenAI Network Engineer, GuidePoint Sr Security
  // Engineer (Firewall) Remote). CoreWeave posts network roles often.
  // Arista/Juniper/Palo Alto/Fortinet/Akamai are Workday-only - not pollable.
  // Lambda, Fluidstack, OpenAI removed same day: Ashby flags their network
  // roles remote but every one is 4 days/week onsite SF/NY (scored 15-45).
  { name: 'Meter',                    ats: 'ashby',      token: 'meter',       priority: 1 },
  { name: 'Nebius',                   ats: 'greenhouse', token: 'nebius',      priority: 2 },
  { name: 'Snowflake',                ats: 'ashby',      token: 'snowflake',   priority: 2 },
  { name: 'GuidePoint Security',      ats: 'greenhouse', token: 'guidepointsecurity', priority: 2 },
  { name: 'CoreWeave',                ats: 'greenhouse', token: 'coreweave',   priority: 2 },
  // Tier 3
  { name: 'Equinix',                  ats: 'sitemap',    token: 'equinix',     priority: 2 },
  { name: 'Elastic',                  ats: 'greenhouse', token: 'elastic',     priority: 3 },
  { name: 'Wealthfront',              ats: 'lever',      token: 'wealthfront', priority: 3 },
];

// ── Roles already been through, compiled from scout-targets.yaml.yml ──────
// build_ats_scout.py replaces the marker below at deploy time from the
// `applied:` blocks in that file. Edit the YAML, not this line.
// Entries are { company, role|null, reopen_after: 'YYYY-MM', outcome }.
// A null role suppresses the whole employer. Suppression is time-boxed - the
// role returns on its own once reopen_after passes.
const SUPPRESSIONS = /*@@SUPPRESSIONS@@*/[];

const ENDPOINTS = {
  greenhouse: t => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`,
  lever:      t => `https://api.lever.co/v0/postings/${t}?mode=json`,
  ashby:      t => `https://api.ashbyhq.com/posting-api/job-board/${t}?includeCompensation=true`,
  breezy:     t => `https://${t}.breezy.hr/json`,
  // HAProxy publishes no board API - the careers index is plain HTML with one
  // link per open role. Brittle by nature; a layout change degrades this target
  // to zero jobs rather than failing the run, and shows up in source health.
  // Its per-role pages DO carry a JSON-LD JobPosting, so the detail pass picks
  // up real descriptions.
  html:       () => 'https://www.haproxy.com/company/careers',
  // Equinix's careers site is client-rendered with no board API, but its
  // sitemap lists every job URL and each job page carries a JSON-LD
  // JobPosting. Index here, filter by slug, then fetch only the matches.
  sitemap:    () => 'https://careers.equinix.com/sitemap.xml',
};

// Record what we expect back, so Normalize can report boards that went silent.
const sd = $getWorkflowStaticData('global');
sd.expectedTargets = TARGETS.map(t => t.name);

// Suppressions ride along on each item so Normalize can read them back from
// this node - same pattern as the priority lookup, one source of truth.
return TARGETS.map(t => ({
  json: { ...t, url: ENDPOINTS[t.ats](t.token), suppressions: SUPPRESSIONS },
}));
