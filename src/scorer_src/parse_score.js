// Turn Claude's verdict into a Notion PATCH. Two bodies are pre-built as
// strings so the HTTP nodes carry no inline expressions (the "}}" trap).
const resp = $input.first().json;
const d    = $('Build Score Prompt').first().json;

const raw = (resp.content && resp.content[0] && resp.content[0].text) || '';

let r = null;
try {
  const BT = String.fromCharCode(96);
  let cleaned = raw.replace(new RegExp(BT + BT + BT + '(json)?', 'g'), '').trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s >= 0 && e > s) cleaned = cleaned.substring(s, e + 1);
  r = JSON.parse(cleaned);
} catch (e) { r = null; }

const today = new Date().toISOString().split('T')[0];
const props = {};

// ── Failure path ───────────────────────────────────────────────────────────
// Never leave the row with an empty Score in a status the filter matches: it
// would be re-selected every 10 minutes and bill a Sonnet call each time.
// Moving Status to "Score Failed" breaks the filter and stops the loop. This
// does interrupt an "Applying" request on purpose - generating a tailored
// resume against a job description we failed to read is worse than stopping.
if (!r || typeof r.score !== 'number') {
  props['Status']    = { select: { name: 'Score Failed' } };
  props['Red Flags'] = { rich_text: [{ text: { content:
    ('Scoring failed - Claude returned no usable JSON. First 300 chars: ' +
     (raw || '(empty response)').substring(0, 300)).substring(0, 500) } }] };

  return [{ json: {
    page_id: d.page_id,
    ok: false,
    score: null,
    props_patch: JSON.stringify({ properties: props }),
    // Still a valid body: the append node runs unconditionally, so leaving a
    // note on the page beats failing the node and losing the reason.
    blocks_body: JSON.stringify({ children: [{ object: 'block', type: 'callout',
      callout: { icon: { emoji: '\u26A0\uFE0F' }, rich_text: [{ type: 'text', text: { content:
        ('Automatic scoring failed. Claude returned no usable JSON. Paste the job ' +
         'description into this page and set Status back to "Score Me" to retry.')
        .substring(0, 1900) } }] } }] }),
    discord_msg: [
      ':warning: **Scoring failed** - manual job left for review',
      '**' + (d.title || '(untitled row)') + '**' + (d.company ? ' @ ' + d.company : ''),
      d.page_url || '',
    ].filter(Boolean).join('\n'),
  }}];
}

// ── Success path ───────────────────────────────────────────────────────────
const score = Math.max(0, Math.min(100, Math.round(r.score)));
const ex    = r.extracted || {};
const tips  = Array.isArray(r.resume_tips) ? r.resume_tips.filter(t => t && t !== 'None') : [];

const txt = (v, max) => ({ rich_text: [{ text: { content: String(v == null ? '' : v).substring(0, max) } }] });
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

// Analysis columns - always written, this is what the run is for.
props['Score']              = { number: score };
props['Priority']           = { select: { name: score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low' } };
props['Fit Summary']        = txt(r.fit_summary, 2000);
props['Missing Skills']     = txt(r.missing_skills || 'None', 500);
props['Red Flags']          = txt(r.red_flags || 'None', 500);
props['Resume Tips']        = txt(tips.slice(0, 3).join(' | ') || 'None', 500);
props['Cover Letter Draft'] = txt(r.cover_letter_hook || 'None', 500);
props['Role Type']          = { select: { name: r.role_type || 'Other' } };
props['Tags']               = { multi_select: (r.tags || []).slice(0, 10)
                                  .map(t => ({ name: String(t).substring(0, 100) })) };
// Hand back to whichever flow he asked for. A row he set to "Applying" stays
// "Applying" so the docs branch picks it up on the next poll now that Score is
// populated; a "Score Me" row lands in "New" for review.
props['Status']             = { select: { name: d.origin_status === 'Applying' ? 'Applying' : 'New' } };

// Descriptive columns - only fill what he left blank, so anything typed by
// hand always beats anything Claude inferred.
if (!d.title    && ex.title)    props['Job Title'] = { title: [{ text: { content: String(ex.title).substring(0, 200) } }] };
if (!d.company  && ex.company)  props['Company']   = txt(ex.company, 200);
if (!d.location && ex.location) props['Location']  = txt(ex.location, 200);
if (!d.has_source)              props['Source']    = { select: { name: 'Manual' } };
if (!d.has_date_found)          props['Date Found'] = { date: { start: today } };
if (num(ex.salary_min) !== null) props['Salary Min'] = { number: num(ex.salary_min) };
if (num(ex.salary_max) !== null) props['Salary Max'] = { number: num(ex.salary_max) };
if (ex.posted_date)              props['Posted Date'] = txt(ex.posted_date, 200);

// ── Page body ──────────────────────────────────────────────────────────────
// The "Full Job Description" heading is load-bearing: the docs branch's
// Extract Description node scans for exactly that string, and without it a
// tailored resume gets generated against an empty JD.
const para = t => ({ object: 'block', type: 'paragraph',
  paragraph: { rich_text: [{ type: 'text', text: { content: String(t || '').substring(0, 1900) } }] } });
const h2 = t => ({ object: 'block', type: 'heading_2',
  heading_2: { rich_text: [{ type: 'text', text: { content: t } }] } });
const bullet = t => ({ object: 'block', type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: [{ type: 'text', text: { content: String(t).substring(0, 1900) } }] } });

const descChunks = [];
if (d.have_description) {
  const safe = String(d.description_used).substring(0, 9500);
  for (let i = 0; i < safe.length; i += 1900) descChunks.push(para(safe.substring(i, i + 1900)));
} else {
  descChunks.push(para('(no description could be retrieved - scored on title and company alone, capped at 75)'));
}

const children = [
  h2('📋 Full Job Description'),
  ...descChunks,
  { object: 'block', type: 'divider', divider: {} },
  h2('🎯 Resume Customization Tips'),
  ...(tips.length ? tips.slice(0, 8).map(bullet) : [para('No specific tips generated.')]),
  { object: 'block', type: 'divider', divider: {} },
  h2('✉️ Cover Letter Hook'),
  para(r.cover_letter_hook || 'Not generated.'),
];

const discordMsg = [
  ':dart: **Scored ' + score + '%** - ' + (score >= 80 ? 'strong match' : score >= 65 ? 'worth a look' : score >= 50 ? 'a stretch' : 'poor fit'),
  '**' + (props['Job Title'] ? String(ex.title) : d.title || '?') + '** @ ' + (d.company || ex.company || '?'),
  r.fit_summary || '',
  d.page_url ? '\n' + d.page_url : '',
].filter(Boolean).join('\n');

return [{ json: {
  page_id: d.page_id,
  ok: true,
  score,
  props_patch: JSON.stringify({ properties: props }),
  blocks_body: JSON.stringify({ children }),
  discord_msg: discordMsg,
}}];
