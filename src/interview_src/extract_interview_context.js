// Gather everything the prep sheet needs: the job description from the page
// body, plus the analysis columns the scorer already wrote. Missing Skills is
// the valuable one - those are the gaps he will actually be probed on.
const page   = $('Pick One Interview').first().json;
const props  = page.properties || {};
const blocks = $json.results || [];

const rt  = p => (p && p.rich_text && p.rich_text[0] && p.rich_text[0].text
                    ? p.rich_text[0].text.content : '').trim();
const sel = p => (p && p.select ? p.select.name : '') || '';

const title   = (props['Job Title'] && props['Job Title'].title
                 && props['Job Title'].title[0] && props['Job Title'].title[0].text
                 ? props['Job Title'].title[0].text.content : 'Unknown Role').trim();
const company = rt(props['Company']) || 'Unknown Company';

// Prefer the text under the "Full Job Description" heading; fall back to all
// prose on the page, because rows created by the old apply-url path never got
// that heading written.
const under = [];
const all   = [];
let inDesc = false;
for (const b of blocks) {
  const t = b.type;
  if (t === 'heading_2') {
    const h = (b.heading_2.rich_text[0] || {}).plain_text || '';
    if (/Full Job Description/i.test(h)) { inDesc = true; continue; }
    if (inDesc) break;            // next heading ends the description
  }
  if (t === 'divider' && inDesc) break;
  const rich = b[t] && b[t].rich_text;
  if (Array.isArray(rich) && rich.length) {
    const s = rich.map(x => x.plain_text || '').join('').trim();
    if (!s) continue;
    all.push(s);
    if (inDesc) under.push(s);
  }
}
const description = (under.length ? under : all).join('\n').substring(0, 6000);

const folderUrl = (props['Drive Folder'] && props['Drive Folder'].url) || '';
const m = folderUrl.match(/folders\/([A-Za-z0-9_-]+)/);

const safe = (s, n) => (s || '').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim().substring(0, n);

return [{ json: {
  page_id:   page.id,
  page_url:  page.url || '',
  title, company,
  score:     (props['Score'] && props['Score'].number) || null,
  role_type: sel(props['Role Type']),
  location:  rt(props['Location']),
  salary_min: (props['Salary Min'] && props['Salary Min'].number) || null,
  salary_max: (props['Salary Max'] && props['Salary Max'].number) || null,
  apply_url: (props['Apply URL'] && props['Apply URL'].url) || '',
  tags:      (props['Tags'] && props['Tags'].multi_select || []).map(t => t.name),
  fit_summary:    rt(props['Fit Summary']),
  missing_skills: rt(props['Missing Skills']),
  red_flags:      rt(props['Red Flags']),
  description,
  have_description: description.length >= 200,
  // No Drive Folder means documents were never generated for this job (he
  // jumped straight to Interviewing). Fall back to the applications root so
  // the sheet still lands somewhere sane instead of failing the Drive move.
  folder_id: m ? m[1] : 'YOUR_DRIVE_FOLDER_ID',
  folder_is_fallback: !m,
  folder_url: folderUrl,
  doc_title: `Interview Prep - ${safe(title, 45)} - ${safe(company, 25)} ${new Date().toISOString().split('T')[0]}`,
}}];
