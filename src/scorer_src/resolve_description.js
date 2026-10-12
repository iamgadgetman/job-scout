// Decide what text we will score against, and pull whatever the row already
// has so Parse Score knows which cells are blank and safe to fill.
const page   = $('Pick One Page').first().json;
const props  = page.properties || {};
const blocks = $json.results || [];

const rt  = p => (p && p.rich_text && p.rich_text[0] && p.rich_text[0].text
                    ? p.rich_text[0].text.content : '').trim();
const sel = p => (p && p.select ? p.select.name : '') || '';

const title    = (props['Job Title'] && props['Job Title'].title
                  && props['Job Title'].title[0] && props['Job Title'].title[0].text
                  ? props['Job Title'].title[0].text.content : '').trim();
const company  = rt(props['Company']);
const location = rt(props['Location']);
const applyUrl = (props['Apply URL'] && props['Apply URL'].url) || '';

// Any prose already sitting on the page. If he pasted the job description in
// by hand, use that and skip the scrape entirely - Jina returns navigation
// junk for Workday/LinkedIn postings behind a login, so a hand-paste is the
// reliable escape hatch when scraping fails.
const parts = [];
for (const b of blocks) {
  const rich = b[b.type] && b[b.type].rich_text;
  if (Array.isArray(rich) && rich.length) {
    const s = rich.map(x => x.plain_text || (x.text && x.text.content) || '').join('');
    if (s.trim()) parts.push(s.trim());
  }
}
const pasted = parts.join('\n').trim();

const MIN_USABLE = 400;              // shorter than this is a note, not a JD
const usePasted  = pasted.length >= MIN_USABLE;

return [{ json: {
  page_id:  page.id,
  db_id:    (page.parent && page.parent.database_id) || '',
  page_url: page.url || '',
  // Which cells are already populated - Parse Score fills only the blanks so
  // anything typed by hand wins over anything Claude infers.
  title, company, location, apply_url: applyUrl,
  // Which status triggered this. "Applying" means he wants documents, so
  // Parse Score must hand the row back as "Applying", not "New", or the docs
  // branch would never see it.
  origin_status:   sel(props['Status']),
  has_source:      !!sel(props['Source']),
  has_date_found:  !!(props['Date Found'] && props['Date Found'].date),
  pasted_description: usePasted ? pasted.substring(0, 6000) : '',
  needs_fetch: !usePasted && !!applyUrl,
}}];
