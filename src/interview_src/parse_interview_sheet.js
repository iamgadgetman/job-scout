// Render Claude's prep sheet into a formatted Google Doc batchUpdate body.
// Same index-tracking approach as the docs branch's Parse Docs: text is
// accumulated while character offsets are recorded, then style requests are
// appended referencing those ranges.
const resp = $input.first().json;
const d    = $('Build Interview Prompt').first().json;

const raw = (resp.content && resp.content[0] && resp.content[0].text) || '';
let r = null;
try {
  const BT = String.fromCharCode(96);
  let c = raw.replace(new RegExp(BT + BT + BT + '(json)?', 'g'), '').trim();
  const s = c.indexOf('{'), e = c.lastIndexOf('}');
  if (s >= 0 && e > s) c = c.substring(s, e + 1);
  r = JSON.parse(c);
} catch (err) { r = null; }

if (!r || !Array.isArray(r.required_tech)) {
  // Fail loudly in Notion rather than leaving a blank doc behind. Status is
  // untouched: the row stays "Interviewing" but Interview Prep gets no URL,
  // so the next poll retries once the lock releases.
  return [{ json: {
    page_id: d.page_id, ok: false,
    discord_msg: ':warning: **Interview prep failed** for **' + d.title +
                 '** @ ' + d.company + ' - Claude returned no usable JSON.\n' +
                 (d.page_url || ''),
  }}];
}

const DARK_BLUE = { color: { rgbColor: { red: 0.110, green: 0.239, blue: 0.376 } } };
const MED_GRAY  = { color: { rgbColor: { red: 0.40, green: 0.40, blue: 0.40 } } };

let text = '';
let pos = 1;
const fmt = [];

function add(t, style, align) {
  if (!t) return;
  const start = pos;
  text += t; pos += t.length;
  const end = pos;
  if (style) {
    let se = end;
    for (let i = t.length - 1; i >= 0 && t[i] === '\n'; i--) se--;
    if (se > start) {
      const ts = {}, f = [];
      if (style.bold     !== undefined) { ts.bold = style.bold; f.push('bold'); }
      if (style.italic   !== undefined) { ts.italic = style.italic; f.push('italic'); }
      if (style.fontSize !== undefined) { ts.fontSize = { magnitude: style.fontSize, unit: 'PT' }; f.push('fontSize'); }
      if (style.foregroundColor) { ts.foregroundColor = style.foregroundColor; f.push('foregroundColor'); }
      if (f.length) fmt.push({ updateTextStyle: {
        range: { startIndex: start, endIndex: se }, textStyle: ts, fields: f.join(',') } });
    }
  }
  if (align) fmt.push({ updateParagraphStyle: {
    range: { startIndex: start, endIndex: end },
    paragraphStyle: { alignment: align }, fields: 'alignment' } });
}
const header = t => add(t + '\n', { bold: true, fontSize: 12, foregroundColor: DARK_BLUE });

const money = n => (typeof n === 'number' ? '$' + n.toLocaleString() : null);
const sal = d.salary_min || d.salary_max
  ? [money(d.salary_min), money(d.salary_max)].filter(Boolean).join(' - ') : null;

add('INTERVIEW PREP\n', { bold: true, fontSize: 18 }, 'CENTER');
add(d.title + '  —  ' + d.company + '\n', { fontSize: 12 }, 'CENTER');
const meta = [
  d.role_type || null,
  d.location || null,
  sal,
  typeof d.score === 'number' ? 'Fit score ' + d.score + '%' : null,
].filter(Boolean).join('  •  ');
if (meta) add(meta + '\n', { fontSize: 9, italic: true, foregroundColor: MED_GRAY }, 'CENTER');
add('\n');

if (r.role_snapshot) {
  header('THE ROLE');
  add(r.role_snapshot + '\n\n', { fontSize: 10 });
}

function section(titleText, items, note) {
  if (!Array.isArray(items) || !items.length) return;
  header(titleText);
  if (note) add(note + '\n', { fontSize: 9, italic: true, foregroundColor: MED_GRAY });
  items.forEach((q, i) => {
    add((i + 1) + '.  ' + (q.question || '') + '\n', { bold: true, fontSize: 10 });
    if (q.why)         add('     Why: ' + q.why + '\n', { fontSize: 9, italic: true, foregroundColor: MED_GRAY });
    if (q.answer_with) add('     Answer with: ' + q.answer_with + '\n', { fontSize: 10 });
    add('\n');
  });
}

section('REQUIRED SKILLS — EXPECT THESE', r.required_tech);
section('NICE-TO-HAVES — WHERE THE JOB IS WON', r.nice_to_haves,
        'Preferred/bonus items from the posting. Fewer candidates prepare for these.');
section('YOUR GAPS — ANSWER HONESTLY', r.gap_questions,
        'Do not bluff. Lead with the adjacent experience, then what you are learning.');

if (Array.isArray(r.ask_them) && r.ask_them.length) {
  header('QUESTIONS TO ASK THEM');
  r.ask_them.forEach(q => add('  •  ' + q + '\n', { fontSize: 10 }));
  add('\n');
}

add('\n');
add('Generated ' + new Date().toISOString().split('T')[0] +
    ' from the job description on file. Verify against the live posting before the call.\n',
    { fontSize: 8, italic: true, foregroundColor: MED_GRAY });

const counts = {
  required: (r.required_tech || []).length,
  nice: (r.nice_to_haves || []).length,
  gaps: (r.gap_questions || []).length,
  ask: (r.ask_them || []).length,
};

return [{ json: {
  page_id: d.page_id, ok: true,
  doc_title: d.doc_title,
  folder_id: d.folder_id,
  counts,
  doc_batch_body: JSON.stringify({
    requests: [{ insertText: { location: { index: 1 }, text } }, ...fmt] }),
  title: d.title, company: d.company, page_url: d.page_url,
}}];
