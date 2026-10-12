// ── Normalize + Filter + Dedup, ATS edition ──────────────────────────────
// Inputs, from two places:
//   $('Fetch ATS Board')  - raw board payloads. One item per board for the
//                           object APIs (Greenhouse/Ashby), one item per
//                           posting for the array APIs (Lever/Breezy), because
//                           n8n splits a top-level JSON array into items.
//   $input                - job DETAIL pages for the two targets that publish
//                           no board (HAProxy, Equinix). Each carries a JSON-LD
//                           JobPosting. See extract_detail_urls.js.
// Keeping both here means every filter still lives in exactly one place.
// Output: a single item { jobs, count } capped per scout-targets.yaml.yml.

const items = $('Fetch ATS Board').all();
const detailPages = $input.all();

// Priority lives in exactly one place - Build Target List. Read it back rather
// than duplicating the table here, so adding a company stays a one-line edit.
const byToken = {};
const byName = {};
for (const t of $('Build Target List').all()) {
  byToken[String(t.json.token).toLowerCase()] = t.json;
  byName[String(t.json.name).toLowerCase()] = t.json;
}

function tokenFromUrl(url) {
  const u = String(url || '');
  let m;
  if ((m = u.match(/greenhouse\.io\/([^\/?#]+)\//i)))  return m[1];
  if ((m = u.match(/lever\.co\/([^\/?#]+)\//i)))       return m[1];
  if ((m = u.match(/ashbyhq\.com\/([^\/?#]+)\//i)))    return m[1];
  if ((m = u.match(/https?:\/\/([^.\/]+)\.breezy\.hr/i))) return m[1];
  if (/haproxy\.com/i.test(u)) return 'haproxy';
  return '';
}
// Not every board serves its jobs from the ATS domain - Elastic fronts
// Greenhouse at jobs.elastic.co, so the URL carries no recognisable token. Fall
// back to matching the employer name before giving up, or the role lands at
// priority 9 and sorts below everything.
function targetFor(url, fallbackName) {
  const viaToken = byToken[tokenFromUrl(url).toLowerCase()];
  if (viaToken) return viaToken;
  const viaName = byName[String(fallbackName || '').toLowerCase().trim()];
  if (viaName) return viaName;
  return { name: fallbackName || 'Unknown', priority: 9 };
}

// Greenhouse ships HTML that has been entity-escaped once, so: decode, strip
// tags, then decode again to catch entities that were double-escaped (&amp;nbsp;).
const decode = s => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  // Pay ranges are routinely written "$218,420 &mdash; $273,360", so a dash
  // entity left undecoded means the range silently fails to parse.
  .replace(/&[mn]dash;/g, '-').replace(/&#82(11|12);/g, '-')
  .replace(/&[lr]squo;/g, "'").replace(/&[lr]dquo;/g, '"')
  .replace(/&hellip;/g, '...')
  .replace(/&#(\d{2,5});/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');
const clean = s => decode(decode(String(s || '')).replace(/<[^>]*>/g, ' '))
  .replace(/\s+/g, ' ').trim();

// Pull a salary range out of free text. Boards rarely use a structured field.
// Look in a window around compensation wording first: the first dollar figure
// in a job description is often a signing bonus or a company revenue stat, and
// treating that as base pay would drop good roles at the salary floor.
const PAY_NEAR = /(salary|compensation|base pay|pay range|annual|on-target|ote|\bcash\b)[\s\S]{0,240}/gi;
function parseSalary(text) {
  const full = String(text || '');
  const windows = full.match(PAY_NEAR);
  if (windows) {
    // Employers that hire in several countries print one range per currency
    // (Tailscale posts a CAN range above the US one). Prefer the USD range
    // rather than whichever happens to appear first.
    const hits = windows.map(matchSalary).filter(h => h[0]);
    const best = hits.find(h => h[2] === 'USD') || hits[0];
    if (best) return [best[0], best[1], best[2], true];   // true = comp context
  }
  const loose = matchSalary(full);
  return [loose[0], loose[1], loose[2], false];
}
// Returns [min, max, currency]. Boards post ranges in local currency without
// always saying so up front, and comparing a CAD range against a USD floor
// would quietly admit roles that are actually under it.
function currencyOf(text) {
  const m = String(text || '').match(/\b(CAD|GBP|EUR|AUD|USD)\b/);
  return m ? m[1] : 'USD';
}
function matchSalary(text) {
  const t = String(text || '');
  let m;
  if ((m = t.match(/\$\s?(\d{2,3})\s?[kK]\s*(?:[-–—]|to)\s*\$?\s?(\d{2,3})\s?[kK]/)))
    return [Number(m[1]) * 1000, Number(m[2]) * 1000, currencyOf(m[0] + t.slice(t.indexOf(m[0]) + m[0].length, t.indexOf(m[0]) + m[0].length + 12))];
  if ((m = t.match(/\$\s?(\d{2,3},\d{3})\s*(?:[-–—]|to)\s*\$?\s?(\d{2,3},\d{3})/)))
    return [Number(m[1].replace(/,/g, '')), Number(m[2].replace(/,/g, '')), currencyOf(t.slice(t.indexOf(m[0]), t.indexOf(m[0]) + m[0].length + 12))];
  if ((m = t.match(/\$\s?(\d{2,3})\s?[kK]\b/)))       return [Number(m[1]) * 1000, null, currencyOf(t)];
  if ((m = t.match(/\$\s?(\d{2,3},\d{3})\b/)))        return [Number(m[1].replace(/,/g, '')), null, currencyOf(t)];
  return [null, null, 'USD'];
}

const stats = { ok: {}, bad: [], seen: {} };
let allJobs = [];
const detailUrls = new Set(
  $('Extract Detail URLs').all().map(x => String((x.json || {}).detail_url || '')));

for (const item of items) {
  const d = item.json;
  if (!d || typeof d !== 'object') continue;

  // ── Greenhouse: { jobs: [ { absolute_url, content, ... } ] } ───────────
  if (Array.isArray(d.jobs) && d.jobs.length && d.jobs[0].absolute_url) {
    for (const j of d.jobs) {
      const tgt = targetFor(j.absolute_url, j.company_name);
      const desc = clean(j.content);
      const [smin, smax, scur, sconf] = parseSalary(desc);
      // Greenhouse posts one role per office but lists every office it is open
      // in. Display the US option when there is one, so a role open in the US
      // is not labelled "Remote (United Kingdom)" in the digest.
      const offices = (j.offices || []).map(o => String(o.name || '').trim());
      const primaryLoc = (j.location && j.location.name) || '';
      const usOffice = offices.find(o => /united states|\bu\.?s\.?a?\b/i.test(o));
      allJobs.push({
        job_id: 'gh_' + j.id,
        title: j.title || '',
        company: tgt.name,
        location: (usOffice && !/united states|\bu\.?s\.?a?\b/i.test(primaryLoc))
                  ? usOffice : primaryLoc,
        alt_locations: offices.join(', '),
        is_remote: /remote|distributed|anywhere/i.test((j.location && j.location.name) || ''),
        apply_url: j.absolute_url || '',
        description: desc.substring(0, 3000),
        salary_min: smin, salary_max: smax, salary_currency: scur, salary_confident: sconf, salary_text: scur === 'USD' ? '' : `${scur} range`,
        posted_date: (j.first_published || j.updated_at || '').split('T')[0],
        priority: tgt.priority,
        source: tgt.name,
        ats_provider: 'Greenhouse',
      });
    }
  }

  // ── Ashby: { jobs: [ { jobUrl, descriptionPlain, ... } ] } ─────────────
  else if (Array.isArray(d.jobs) && d.jobs.length && d.jobs[0].jobUrl) {
    for (const j of d.jobs) {
      if (j.isListed === false) continue;
      const tgt = targetFor(j.jobUrl, j.department);
      const comp = (j.compensation && (
        j.compensation.scrapeableCompensationSalarySummary ||
        j.compensation.compensationTierSummary)) || '';
      const desc = String(j.descriptionPlain || '');
      const [smin, smax, scur, sconf] = parseSalary(comp || desc);
      allJobs.push({
        job_id: 'ashby_' + j.id,
        title: j.title || '',
        company: tgt.name,
        location: j.location || '',
        alt_locations: (j.secondaryLocations || []).map(s => s.location || s).join(', '),
        is_remote: j.isRemote === true || /remote/i.test(String(j.workplaceType || '')),
        apply_url: j.applyUrl || j.jobUrl || '',
        description: desc.substring(0, 3000),
        salary_min: smin, salary_max: smax, salary_currency: scur, salary_confident: sconf, salary_text: comp,
        posted_date: String(j.publishedAt || '').split('T')[0],
        priority: tgt.priority,
        source: tgt.name,
        ats_provider: 'Ashby',
      });
    }
  }

  // ── Lever: one posting per item (n8n split the top-level array) ────────
  else if (d.hostedUrl && d.text) {
    const tgt = targetFor(d.hostedUrl);
    const cats = d.categories || {};
    const desc = String(d.descriptionPlain || '') + ' ' + String(d.additionalPlain || '');
    const [smin, smax, scur, sconf] = parseSalary(desc);
    allJobs.push({
      job_id: 'lever_' + d.id,
      title: d.text || '',
      company: tgt.name,
      location: cats.location || '',
      alt_locations: (cats.allLocations || []).join(', '),
      is_remote: String(d.workplaceType || '').toLowerCase() === 'remote',
      apply_url: d.applyUrl || d.hostedUrl || '',
      description: desc.replace(/\s+/g, ' ').trim().substring(0, 3000),
      salary_min: smin, salary_max: smax, salary_currency: scur, salary_confident: sconf, salary_text: scur === 'USD' ? '' : `${scur} range`,
      posted_date: d.createdAt ? new Date(d.createdAt).toISOString().split('T')[0] : '',
      priority: tgt.priority,
      // Lever exposes workplaceType, so an 'onsite'/'hybrid' posting is known
      // for certain rather than inferred from prose.
      workplace_type: String(d.workplaceType || '').toLowerCase(),
      source: tgt.name,
      ats_provider: 'Lever',
    });
  }

  // ── Breezy: one posting per item. The feed carries NO description. ─────
  // Anything the detail pass is fetching is skipped here - otherwise the
  // description-less feed version would win dedup over the real page.
  else if (d.friendly_id && d.url && /breezy\.hr/i.test(String(d.url))
           && !detailUrls.has(String(d.url))) {
    const tgt = targetFor(d.url);
    const loc = d.location || {};
    allJobs.push({
      job_id: 'breezy_' + d.id,
      title: d.name || '',
      company: tgt.name,
      // loc.name is the HQ street address' city. When Breezy flags the role
      // remote, showing "Mitchell, SD" would read as a dealbreaker it is not.
      location: loc.is_remote === true
        ? 'Remote' + (loc.name ? ' (HQ ' + loc.name + ')' : '')
        : (loc.name || ''),
      alt_locations: ((loc.remote_details && loc.remote_details.label) || '') + ' '
                   + (d.locations || []).map(l => l.name).join(', '),
      is_remote: loc.is_remote === true,
      apply_url: d.url || '',
      // Breezy's list endpoint omits the body; the title filter still applies
      // and the scorer is told plainly that it is judging on title alone.
      description: '(Description is not published in this board feed - open the '
                 + 'posting to read it. Score on title, company and location only.)',
      salary_min: null, salary_max: null,
      salary_text: typeof d.salary === 'string' ? d.salary : '',
      posted_date: String(d.published_date || '').split('T')[0],
      priority: tgt.priority,
      source: tgt.name,
      ats_provider: 'Breezy',
    });
  }

  // ── Equinix: read straight from the sitemap, no per-job request ────────
  // careers.equinix.com serves a JS challenge stub to bursts from the VPS, so
  // the slug is all we get - and it is enough: it carries the title and the
  // country, which is what the filters need. Descriptions are unavailable, and
  // the scorer is told so and caps those roles.
  else if (typeof d.data === 'string' && /<urlset/i.test(d.data)
           && /careers\.equinix\.com/i.test(d.data)) {
    const re = /<loc>\s*(https:\/\/careers\.equinix\.com\/jobs\/([^<\s]+))\s*<\/loc>/gi;
    const tgt = byName['equinix'] || { name: 'Equinix', priority: 2 };
    let m;
    while ((m = re.exec(d.data)) !== null) {
      const url = m[1];
      // Strip the trailing UUID some slugs carry, then split the location off
      // the tail. Imperfect by nature - there is no delimiter between title and
      // location - so the title may keep a place name. Honest and readable
      // beats clever and wrong here.
      let slug = m[2].toLowerCase()
        .replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, '');
      const words = slug.split('-');
      const PLACE = /^(united|states|america|remote|canada|singapore|india|japan|poland|philippines|germany|netherlands|ireland|spain|brazil|mexico|australia|china|korea|france|italy|sweden|turkey|dubai|emirates|kingdom|hong|kong|karnataka|masovian|warsaw|bengaluru|manila|tokyo|shinagawa|ku|national|capital|region|texas|california|virginia|york|new|dallas|ashburn|denver|seattle|atlanta|chicago|boston|frankfurt|amsterdam|london|paris|madrid|milan|osaka|sydney|toronto|ontario|quebec)$/;
      let cut = words.length;
      while (cut > 2 && PLACE.test(words[cut - 1])) cut--;
      const title = words.slice(0, cut).join(' ').replace(/\b\w/g, c => c.toUpperCase());
      const place = words.slice(cut).join(' ');
      allJobs.push({
        job_id: 'eqx_' + slug.substring(0, 60),
        title,
        company: tgt.name,
        location: place || 'Not stated',
        alt_locations: '',
        is_remote: /remote/.test(slug),
        apply_url: url,
        slug: slug.replace(/-/g, ' '),
        description: '(Equinix publishes no description in its feed and blocks '
                   + 'automated page reads - open the posting to read it. Score '
                   + 'on title, company and location only.)',
        salary_min: null, salary_max: null, salary_currency: 'USD', salary_text: '',
        posted_date: '',
        priority: tgt.priority,
        source: tgt.name,
        ats_provider: 'Careers Page',
      });
    }
  }

  // ── Anything else is a failed fetch, not a board we know ───────────────
  else if (d.error || d.message || d.status >= 400) {
    stats.bad.push('fetch failed: ' + String(d.message || d.error || d.status).substring(0, 90));
  }
}

// ── Detail pages: HAProxy and Equinix, read from JSON-LD ─────────────────
// Both render their listings client-side but embed a schema.org JobPosting in
// every job page, which is richer and far less brittle than scraping markup.
function jsonLdJobPosting(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let parsed;
    try { parsed = JSON.parse(m[1].trim()); } catch (e) { continue; }
    const candidates = Array.isArray(parsed) ? parsed
      : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
    for (const c of candidates) {
      if (c && c['@type'] === 'JobPosting') return c;
    }
  }
  return null;
}
function flattenPlace(loc) {
  const arr = Array.isArray(loc) ? loc : [loc];
  return arr.filter(Boolean).map(p => {
    const a = p.address || {};
    return [a.addressLocality, a.addressRegion, a.addressCountry]
      .filter(Boolean).join(', ');
  }).filter(Boolean).join(' | ');
}
// schema.org gives the country as an ISO code ("PL", "SG"), which no list of
// country NAMES will ever match. Read it structurally instead - Equinix posts
// a Warsaw role as TELECOMMUTE with addressCountry "PL", and matching prose
// let it through as a US remote role.
function countryCodes(jp) {
  const out = new Set();
  const take = v => {
    for (const p of (Array.isArray(v) ? v : [v])) {
      if (!p) continue;
      const c = (p.address && p.address.addressCountry) || p.name || p.addressCountry || p;
      if (typeof c === 'string' && c.trim()) out.add(c.trim().toUpperCase());
      else if (c && c.name) out.add(String(c.name).trim().toUpperCase());
    }
  };
  take(jp.jobLocation);
  // For a remote posting this is the field that says where it may be worked.
  take(jp.applicantLocationRequirements);
  return [...out];
}
const US_CODES = ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'];

// The HTTP node emits one item per input item, in order, so pair by INDEX.
// Matching on slug text instead was actively wrong: HAProxy's slug is
// "network-engineer", which appears inside Vantage Point's URL
// "5da388369be1-network-engineer" - so Vantage Point's page was read as
// HAProxy's role, and HAProxy's Tier-1 Network Engineer was rejected on
// Vantage Point's $85-100k salary.
const detailMeta = $('Extract Detail URLs').all();

for (let i = 0; i < detailPages.length; i++) {
  const d = detailPages[i].json;
  if (!d || d.noop) continue;                 // keep-alive request, not a job
  const html = typeof d.data === 'string' ? d.data : '';
  if (!html) continue;

  const meta = (detailMeta[i] || {}).json || {};
  // Index pairing is correct by construction; verify it anyway, because a
  // silent mis-pairing attributes one employer's salary to another.
  if (meta.detail_url && !html.includes(String(meta.slug || ''))) {
    stats.bad.push(`detail page ${i} did not match ${meta.company || 'its target'} - skipped`);
    continue;
  }

  const jp = jsonLdJobPosting(html);
  if (!jp) {
    stats.bad.push(`${meta.company || 'detail page'}: no JSON-LD JobPosting (layout changed?)`);
    continue;
  }
  // Derive the employer from the URL, exactly as the board handlers do. Breezy
  // feed items carry `company` as an OBJECT, so trusting that field put
  // "[object Object]" in the source stats.
  const viaUrl = targetFor(meta.detail_url || jp.url || '', '');
  const company = (viaUrl.priority !== 9 && viaUrl.name)
    || (typeof meta.company === 'string' && meta.company)
    || (jp.hiringOrganization && jp.hiringOrganization.name)
    || 'Unknown';
  const tgtByName = byName[String(company).toLowerCase()] || viaUrl || {};
  const desc = clean(jp.description);
  const remoteFlag = String(jp.jobLocationType || '') === 'TELECOMMUTE';
  const placeText = flattenPlace(jp.jobLocation);
  const [smin, smax, scur, sconf] = parseSalary(
    (jp.baseSalary && JSON.stringify(jp.baseSalary)) || desc);

  const codes = countryCodes(jp);
  allJobs.push({
    job_id: 'ld_' + String(jp.identifier && (jp.identifier.value || jp.identifier)
                           || meta.slug || jp.title).substring(0, 60),
    country_codes: codes,
    // The URL slug spells out the location on both of these boards
    // ("...-warsaw-poland-..."), so keep it as a second signal.
    slug: meta.slug || '',
    title: jp.title || '',
    company: tgtByName.name || company,
    location: remoteFlag ? 'Remote' : (placeText || 'Not stated'),
    alt_locations: placeText,
    is_remote: remoteFlag,
    apply_url: meta.detail_url || jp.url || '',
    description: desc.substring(0, 3000),
    salary_min: smin, salary_max: smax, salary_currency: scur, salary_confident: sconf,
    salary_text: scur === 'USD' ? '' : `${scur} range`,
    posted_date: String(jp.datePosted || '').split('T')[0],
    priority: meta.priority || tgtByName.priority || 2,
    source: tgtByName.name || company,
    ats_provider: meta.ats_provider || 'Careers Page',
  });
}

for (const j of allJobs) stats.seen[j.source] = (stats.seen[j.source] || 0) + 1;
for (const name of ($getWorkflowStaticData('global').expectedTargets || [])) {
  if (!stats.seen[name]) stats.bad.push(name + ': returned no postings');
}

// ══ Filters ══════════════════════════════════════════════════════════════
const lc = s => String(s || '').toLowerCase();

// ── Title must name one of the roles this lane is actually hiring for ─────
const TITLES = [
  'network engineer', 'network reliability engineer', 'cloud network engineer',
  'infrastructure engineer', 'platform engineer',
  'systems engineer', 'network automation engineer',
  'network security engineer', 'network architect', 'firewall engineer',
  'infrastructure security engineer', 'network operations',
];
const DEV_TITLES = [
  'software engineer', 'software developer', 'web developer', 'frontend',
  'front-end', 'back-end', 'backend', 'full stack', 'fullstack', 'full-stack',
  'mobile developer', 'ios developer', 'android developer', 'data engineer',
  'data scientist', 'ml engineer', 'machine learning engineer',
  'application developer', 'solutions engineer', 'sales engineer',
  'support engineer', 'forward deployed', 'security engineer, product',
];
// seniority_exclude from the YAML. seniority_include is deliberately NOT a
// gate - plenty of good postings carry no level word at all, and gating on it
// would silently drop them. Seniority is left to the scorer.
const SEN_EXCL = ['intern', 'junior', 'entry level', 'entry-level', 'apprentice',
                  'graduate', 'associate'];

allJobs = allJobs.filter(j => {
  const t = lc(j.title);
  if (DEV_TITLES.some(k => t.includes(k))) return false;
  // SRE / DevOps are out of scope (2026-10-01) - he does not qualify. Production
  // Engineer is the same job under Meta's name. "Network Reliability Engineer"
  // is network work and stays.
  if (/\bsre\b|site reliability|production engineer|\bdevops\b|\bdev ops\b/.test(t)) return false;
  if (t.includes('reliability') && !t.includes('network reliability')) return false;
  if (SEN_EXCL.some(k => t.includes(k))) return false;
  if (/\bjr\.?\b/.test(t)) return false;
  if (/\b(i|ii)\b\s*$/.test(t)) return false;        // "Network Engineer II"
  return TITLES.some(k => t.includes(k));
});

// ── Location: remote-US, or hybrid/onsite in the allowed WA metros ───────
// Remote-Only City is REMOTE ONLY since 2026-10-04: a remote Remote-Only City role passes as
// remote below, an onsite/hybrid one is rejected like any other city.
const WA_OK = ['your city', 'nearby city a', 'nearby city b', 'nearby city c', 'metro area',
               'metro area'];
const NON_US = ['canada', 'united kingdom', 'ireland', 'germany', 'france',
                'netherlands', 'poland', 'spain', 'portugal', 'india',
                'singapore', 'australia', 'japan', 'brazil', 'mexico',
                'emea', 'apac', 'latam'];
const US_HINT = ['united states', 'usa', 'u.s.', ' us ', '(us', 'us)', 'us-',
                 'americas', 'north america', 'remote us', 'anywhere in the us'];
const ONSITE_WORDS = ['hybrid', 'days per week onsite', 'days a week in office',
                      'days in office', 'days onsite', 'relocation required',
                      'in-office', 'on-site', 'onsite'];

allJobs = allJobs.filter(j => {
  // TWO haystacks, deliberately. Work arrangement is read from the location
  // fields ALONE: "Distributed Systems Engineer" is a job about distributed
  // systems, not a distributed job, and folding the title in here let every
  // Cloudflare Hybrid role through.
  const loc  = lc(j.location + ' ' + j.alt_locations);
  // Which COUNTRY a role is restricted to, though, is sometimes only in the
  // title - HAProxy posts "Systems Engineer EMEA" as TELECOMMUTE with no
  // jobLocation at all - so region matching gets the title, and the URL slug
  // where the board encodes the location there.
  const region = lc(j.title + ' ' + j.location + ' ' + j.alt_locations + ' '
                    + String(j.slug || '').replace(/-/g, ' '));
  const head = lc(j.description).substring(0, 800);   // where location terms live
  const waHit = WA_OK.some(k => loc.includes(k) || head.includes(k));
  if (waHit) { j.location_verdict = 'WA metro - allowed'; return true; }

  // A board location that names a country or region but no city ("United
  // States", "Americas") is a distributed listing, not an onsite one. Without
  // this, remote-first employers who never write the word "remote" - Elastic
  // among them - are filtered out entirely.
  const REGION_ONLY = /^(united states|usa|u\.s\.a?\.?|us|north america|americas|anywhere|global|worldwide)$/;
  const primary = lc(j.location).trim();
  const regionOnly = REGION_ONLY.test(primary);
  const remote = j.is_remote || regionOnly
              || /\bremote\b|distributed|work from anywhere/.test(loc);

  // Hybrid/onsite outside the allowed WA metros is a hard dealbreaker - but
  // ONLY when no remote option is on offer. Employers routinely post a single
  // location field holding both ("Hybrid or Remote", "Distributed; Hybrid"),
  // and rejecting on the word alone threw those away. Lever's workplaceType is
  // a single authoritative value, so it is still trusted outright.
  if (j.workplace_type === 'hybrid' || j.workplace_type === 'onsite') return false;
  if (!remote && ONSITE_WORDS.some(k => loc.includes(k) || head.includes(k))) return false;

  if (!remote) return false;                          // onsite somewhere else

  // Remote, but is it remote in a country he can work in?
  // Structured country codes win outright when the board publishes them.
  const codes = j.country_codes || [];
  if (codes.length) {
    if (!codes.some(c => US_CODES.includes(c))) return false;
  } else {
    const hasNonUs = NON_US.some(k => region.includes(k));
    const hasUs    = US_HINT.some(k => (region + ' ').includes(k)) || /\bus\b/.test(region);
    if (hasNonUs && !hasUs) return false;
  }

  // "must reside in <somewhere>" is only a dealbreaker when <somewhere> is not
  // a place he already is. A remote role that says "must reside in Washington"
  // is a match, not a reject.
  const m = lc(j.description).match(/must (?:reside|live|be located|be based) in ([^.;\n]{0,80})/);
  if (m && !/washington|\bwa\b|pacific|united states|u\.s\.|\bus\b|any state|anywhere/.test(m[1])) {
    return false;
  }
  j.location_verdict = 'Remote (US)';
  return true;
});

const norm = s => lc(s).replace(/[^a-z0-9]+/g, ' ').trim();
const key  = j => `${norm(j.company)}::${norm(j.title)}`;

// ── Hard dealbreakers: clearance, federal work, drug testing ──────────────
// "drug-free workplace" is legal boilerplate and is NOT testing - excluded
// from this list on purpose. Federal agencies and federal contractors are out
// (2026-10-04); state/local government is fine. The federal phrases are narrow
// on purpose - "As a federal contractor..." is EEO boilerplate at most large
// private employers and must not trip this.
const REJECT_TEXT = [
  'security clearance', 'secret clearance', 'top secret', 'ts/sci', 'polygraph',
  'hspd-12', 'piv credential', 'public trust', 'must be a us citizen due to',
  'drug screen', 'drug test', 'pre-employment drug',
  'department of energy', 'doe contract', 'national laboratory',
  'dod customer', 'support of the dod', 'support of dod', 'federal customer',
  'federal government client', 'federal agency client', 'supporting federal agencies',
];
allJobs = allJobs.filter(j => {
  const txt = lc(j.title + ' ' + j.description);
  const hit = REJECT_TEXT.find(k => txt.includes(k));
  if (hit) { stats.bad.push(`rejected "${j.title}" (${j.company}): ${hit}`); return false; }
  return true;
});

// ── Salary floor. salary_unknown_action: keep - never auto-drop unlisted comp.
// A posted range has to REACH $120k at the top (2026-10-04: back to $120k from the
// 2026-10-01 $125k - ~$120k is the target, anywhere in the band). The bottom may sit below it -
// $90-130k is fine, because the band is negotiable and the ceiling is what says
// whether the target is reachable. A range topping out below $120k is not: the
// Vantage Point Network Engineer posted $85-100k, and no amount of negotiating
// gets that to $140k.
const RANGE_TOP_MIN = 120000;
// And a single figure quoted in a compensation context has to clear the same
// $120k. the candidate's rule (2026-10-04) is "$120k somewhere in the band, min or max";
// a lone figure IS the band. Was a lower $100k bar until then.
const SINGLE_MIN = 120000;

allJobs = allJobs.filter(j => {
  if (j.salary_currency && j.salary_currency !== 'USD' && j.salary_min) {
    // Keep it, but make the currency visible so the range is not read as USD.
    j.salary_text = `${j.salary_currency} ${Math.round(j.salary_min/1000)}k-${Math.round(j.salary_max/1000)}k (not USD)`;
    return true;
  }
  const k = n => '$' + Math.round(n / 1000) + 'k';
  if (j.salary_min && j.salary_max) {
    if (j.salary_max >= RANGE_TOP_MIN) return true;
    stats.bad.push(`rejected "${j.title}" (${j.company}): `
      + `${k(j.salary_min)}-${k(j.salary_max)} tops out below ${k(RANGE_TOP_MIN)}`);
    return false;
  }
  // A lone number is only trusted when it sat next to compensation wording;
  // the first dollar figure in a job ad is otherwise as likely to be a bonus.
  if (j.salary_min && j.salary_confident && j.salary_min < SINGLE_MIN) {
    stats.bad.push(`rejected "${j.title}" (${j.company}): `
      + `${k(j.salary_min)} quoted, below the ${k(SINGLE_MIN)} minimum`);
    return false;
  }
  return true;   // unlisted comp is never an auto-drop
});

// ── Title tier + skill overlap (2026-10-04) ─────────────────────────────
// Same block as the Daily Scout's Normalize node and scorer_src/build_score_prompt.js
// - change all three together. Network Engineer is the primary target,
// Infrastructure Engineer secondary; overlap counts the candidate's own stack
// (candidate_profile.md) and DevOps/SRE vocabulary counts against it.
// Whole word, plural allowed: 'firewall' counts 'firewalls', 'java' skips JavaScript.
const kwHit = (txt, k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(e?s)?([^a-z0-9]|$)').test(txt);
const PRIMARY_T = /\bnetwork\b.*\b(engineer|architect|administrator|analyst|specialist)\b|\bfirewall engineer|\bwireless engineer|\bnoc engineer/;
const SECONDARY_T = /\binfrastructure\b.*\b(engineer|architect|administrator)\b|\binfrastructure operations|\bsystems? (engineer|administrator)|\bsysadmin|\bvirtualization|\bvmware|\bserver (engineer|administrator)|\bdata center engineer|\bcloud engineer|\bhybrid cloud/;
const SKILLS = {
  network:  ['bgp','ospf','mpls','dmvpn','vlan','qos','spanning tree','stp','multicast',
             'cisco','nexus','nx-os','ios-xe','juniper','junos','mist','aruba','meraki',
             'sd-wan','sdwan','routing','switching','wireless','wlc','dns','dhcp','ipam',
             'vpn','wan','lan','load balanc','f5'],
  security: ['palo alto','fortinet','fortigate','checkpoint','check point','asa',
             'firewall','intrusion prevention','ips','radius','zero trust','cloudflare',
             'pci','802.1x','nac','ise','segmentation'],
  systems:  ['vmware','vsphere','esxi','proxmox','hyper-v','virtualization','linux',
             'red hat','rhel','centos','windows server','active directory','docker',
             'kubernetes','k8s','container','backup','disaster recovery','azure','aws'],
  observability: ['solarwinds','orion','prometheus','grafana','splunk','elastic','syslog',
             'snmp','netflow','monitoring','loki','observability'],
  automation: ['ansible','python','n8n','automation','scripting','api'],
};
const DEVOPS_SIG = ['ci/cd','cicd','jenkins','github actions','gitlab ci','argocd','argo cd',
  'helm','slo','error budget','sre','site reliability','devops','microservices','golang',
  'rust','java','spring boot','software development','release engineering','build pipeline'];
for (const j of allJobs) {
  const t = lc(j.title);
  j.title_tier = PRIMARY_T.test(t) ? 'primary' : SECONDARY_T.test(t) ? 'secondary' : 'other';
  // Same 3000-char window the Daily Scout sees, so the two scales match.
  const txt = lc(j.title + ' ' + String(j.description || '').substring(0, 3000));
  const by = {};
  let hits = 0;
  for (const [cl, kws] of Object.entries(SKILLS)) {
    by[cl] = kws.filter(k => kwHit(txt, k)).length;
    hits += by[cl];
  }
  const dev = DEVOPS_SIG.filter(k => kwHit(txt, k)).length;
  j.skill_overlap = Math.max(0, Math.min(100, Math.round(hits * 100 / 12) - dev * 8));
  j.skill_clusters = Object.entries(by).filter(([, n]) => n).sort((a, b) => b[1] - a[1])
    .map(([cl, n]) => `${cl} ${n}`).join(', ') + (dev ? `; devops signals ${dev}` : '');
}

// ── Dedup ────────────────────────────────────────────────────────────────
const thisRun = new Set();
allJobs = allJobs.filter(j => {
  const k = key(j);
  if (!k || k === '::' || thisRun.has(k)) return false;
  thisRun.add(k);
  return true;
});

// Roles already acted on in Notion - applied, rejected, interviewing - are
// excluded permanently rather than for the dedup window. This is what makes
// output.track_applied real: n8n cannot observe an application being sent, but
// it can read the status he sets by hand, which is the same fact one step later.
const actedOn = new Set();
let appliedThisWeek = 0;
const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
for (const page of $('Fetch Acted-On Roles').all()) {
  for (const r of (page.json.results || [])) {
    const props = r.properties || {};
    const title = ((props['Job Title'] || {}).title || [])
      .map(t => t.plain_text || '').join('');
    const comp = ((props['Company'] || {}).rich_text || [])
      .map(t => t.plain_text || '').join('');
    if (title && comp) actedOn.add(`${norm(comp)}::${norm(title)}`);
    const status = ((props['Status'] || {}).select || {}).name || '';
    if (status === 'Applied' && Date.parse(r.last_edited_time || 0) > weekAgoMs) {
      appliedThisWeek++;
    }
  }
}

const sd = $getWorkflowStaticData('global');
if (!sd.seenAtsKeys) sd.seenAtsKeys = {};
// 180 days, not 30. An ATS posting stays live for months, so a 30-day window
// would resurface the same role three or four times before it is filled.
const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
for (const k of Object.keys(sd.seenAtsKeys)) {
  if (sd.seenAtsKeys[k] < cutoff) delete sd.seenAtsKeys[k];
}
// ── Roles already been through, from scout-targets.yaml.yml ──────────────
// The Notion exclusion above only sees roles that reached a Notion board. An
// application made before this scout existed - or outside it entirely - is
// recorded only in the YAML, which is how "Infrastructure Engineer @ WorkOS"
// kept being re-surfaced months after it was declined.
const nowYM = new Date().toISOString().slice(0, 7);        // 'YYYY-MM'
const suppressions = (($('Build Target List').all()[0] || { json: {} }).json.suppressions) || [];
let suppressedCount = 0;
function suppressed(j) {
  for (const s of suppressions) {
    if (norm(s.company) !== norm(j.company)) continue;
    // reopen_after in the past means the window has expired - let it back.
    if (s.reopen_after && String(s.reopen_after) <= nowYM) continue;
    // No role named = the whole employer is on hold.
    if (!s.role) return s;
    if (norm(j.title).includes(norm(s.role))) return s;
  }
  return null;
}

const newJobs = allJobs.filter(j => {
  if (sd.seenAtsKeys[key(j)] || actedOn.has(key(j))) return false;
  const s = suppressed(j);
  if (s) {
    suppressedCount++;
    stats.bad.push(`held "${j.title}" (${j.company}): ${s.outcome || 'applied'} `
      + `${s.applied_on || ''}, re-opens ${s.reopen_after}`);
    return false;
  }
  return true;
});

// ── Queue cap: priority, then title tier, then skill overlap, then newest ──
// (tier/overlap added 2026-10-04 so the slots go to on-target roles first)
const CAP = 25;   // was 10 until 2026-10-11 - raised for application volume
const TIER_RANK = { primary: 2, secondary: 1, other: 0 };
newJobs.sort((a, b) =>
  (a.priority - b.priority) ||
  (TIER_RANK[b.title_tier] - TIER_RANK[a.title_tier]) ||
  ((b.skill_overlap || 0) - (a.skill_overlap || 0)) ||
  String(b.posted_date || '').localeCompare(String(a.posted_date || '')));
const queued = newJobs.slice(0, CAP);

// Mark ONLY what is surfaced, so the overflow rolls into the next run instead
// of being buried unseen for 180 days.
for (const j of queued) sd.seenAtsKeys[key(j)] = Date.now();

sd.lastRunStats = {
  at: Date.now(),
  ok: stats.seen,
  bad: [...new Set(stats.bad)],
  deferred: newJobs.length - queued.length,
  boards: Object.keys(stats.seen).length,
  actedOn: actedOn.size,
  appliedThisWeek,
  suppressed: suppressedCount,
};

return [{ json: { jobs: queued, count: queued.length } }];
