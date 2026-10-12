// ── Detail pass, stage 1 ─────────────────────────────────────────────────
// Two boards publish job pages that are richer than their feed, and both serve a
// JSON-LD JobPosting:
//   HAProxy - publishes no machine-readable board at all; the careers index is
//             plain HTML, so titles come from there and everything else from the
//             per-role page.
//   Breezy  - its feed carries no description AND an empty salary field. Vantage
//             Point's Network Engineer posts "$85,000 to $100,000" on the page and
//             nothing at all in the feed, so it sailed past the salary floor as
//             "unknown". Fetching the page is the only way to see the number.
//
// Equinix is deliberately NOT fetched here. Its job pages carry the same
// JSON-LD, but careers.equinix.com answers a burst of requests from the n8n VPS
// with a 2.4 KB JavaScript challenge stub instead of the page (verified in
// execution 57246: the first run succeeded, the next returned stubs for all
// seven). Rather than hammer a host that is asking us not to, Equinix is read
// from its sitemap in Normalize - the slug carries the title and the country,
// which is enough to filter on, and it costs zero extra requests.
//
// n8n Code nodes cannot make HTTP calls, which is why this is split across two
// nodes rather than done inline. Normalize ATS reads the board payloads back
// out of $('Fetch ATS Board'), so all the parsing and filtering still lives in
// exactly one place.

// Cheap pre-filter on the URL slug. Deliberately looser than the title filter
// in Normalize - this only decides what is worth one HTTP request.
const SLUG_HINTS = [
  'network-engineer', 'network-reliability', 'cloud-network', 'network-security',
  'network-architect', 'network-operations', 'network-automation',
  'infrastructure-engineer', 'platform-engineer',
  'systems-engineer', 'firewall-engineer',
];
const SLUG_BLOCK = [
  'software-engineer', 'sales', 'account-executive', 'recruiter', 'intern',
  'technician', 'manutentore', 'customer-success', 'marketing', 'counsel',
];
// Cap the fan-out so one target cannot dominate the run's HTTP budget.
const MAX_PER_TARGET = 12;

const out = [];
const seen = new Set();

for (const item of $input.all()) {
  const d = item.json;
  if (!d) continue;
  if (typeof d.data !== 'string') {
    // Breezy postings arrive as individual JSON items, not an HTML blob.
    if (d.friendly_id && typeof d.url === 'string' && /breezy\.hr/i.test(d.url)) {
      const slug = (d.url.split('/p/')[1] || '').toLowerCase();
      if (slug && !seen.has(d.url)
          && !SLUG_BLOCK.some(k => slug.includes(k))
          && SLUG_HINTS.some(k => slug.includes(k))) {
        seen.add(d.url);
        // NB: Breezy's `company` field is an object, not a string - the
        // employer is derived from the URL token in Normalize instead.
        out.push({ json: { detail_url: d.url, slug, company: '',
                           priority: null, ats_provider: 'Breezy', url: d.url } });
      }
    }
    continue;
  }
  const body = d.data;

  // ── HAProxy: careers index, one <a> per open role ──────────────────────
  if (/haproxy/i.test(body) && /\/company\/careers\//.test(body)) {
    const re = /href="(\/company\/careers\/([a-z0-9-]+))"/gi;
    let m, n = 0;
    while ((m = re.exec(body)) !== null && n < MAX_PER_TARGET) {
      const slug = m[2];
      const url = 'https://www.haproxy.com/company/careers/' + slug;
      if (seen.has(url)) continue;
      // Same slug filter as Equinix: no point spending a request on a Golang
      // or QA role that the title filter will drop a moment later.
      if (SLUG_BLOCK.some(k => slug.includes(k))) continue;
      if (!SLUG_HINTS.some(k => slug.includes(k))) continue;
      seen.add(url); n++;
      out.push({ json: { detail_url: url, slug, company: 'HAProxy Technologies',
                         priority: 1, ats_provider: 'Careers Page', url } });
    }
  }

}

// An n8n node with zero input items does not execute, which would stall the
// rest of the chain on any day where no detail page needs fetching. Emit one
// harmless keep-alive request instead; Normalize discards it by its noop flag.
if (!out.length) {
  return [{ json: { noop: true, url: 'https://www.haproxy.com/robots.txt' } }];
}
return out;
