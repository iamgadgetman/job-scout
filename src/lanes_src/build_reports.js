const THRESHOLD = 70;
const items = $input.all().filter(it => it && it.json && !it.json.noJobs && typeof it.json.score === 'number' && it.json.score >= THRESHOLD);
if (!items.length) {
  return []; // no qualifying (score >= 70) jobs — stay silent, no ping
}

const sorted = [...items].sort((a,b) => b.json.score - a.json.score);
const top5  = sorted.slice(0, 5);
const top20 = sorted.slice(0, 20);
const today = new Date().toLocaleDateString('en-US',
  {weekday:'long',year:'numeric',month:'long',day:'numeric'});
const NOTION = 'https://www.notion.so/__DB_ID__';

function cleanUrl(url) {
  try { return url.split('?')[0]; } catch(e) { return url; }
}
const where = j => j.work_mode === 'Remote' ? 'Remote' : `${j.work_mode} · ${j.city || '?'}`;
const salary = j => j.salary_min
  ? '$' + Math.round(j.salary_min/1000) + 'k-' + Math.round((j.salary_max||j.salary_min)/1000) + 'k'
  : (j.salary_text || 'salary not listed');
const flags = j => [
  j.drug_test_flag ? '💊 drug test' : '',
  j.work_mode !== 'Remote' && /^Yes/.test(j.remote_history || '') ? '🏠 has remote roles' : '',
  /over 10,?000/i.test(j.size_estimate || '') ? '🏢 10k+ employees' : '',
].filter(Boolean);

const srcEmoji = {
  JSearch:'🔷', Adzuna:'🟢', Remotive:'🟣', Indeed:'🔶',
  RemoteOK:'⚫', TheMuse:'🌸', LinkedIn:'🔵'
};

// ── Discord ───────────────────────────────────────────────────────────────────
let discord = `**🔍 Job Scout (__LANE_LABEL__) — ${today}** | ${items.length} match(es) ≥${THRESHOLD}

`;
for (const item of top5) {
  const j = item.json;
  const badge = srcEmoji[j.source] || '⚪';
  const summary = (j.fit_summary || '').length > 100 ? j.fit_summary.substring(0,97) + '...' : (j.fit_summary || '');
  const f = flags(j);
  const line = `**${j.score}** — **${j.title}** @ ${j.company} ${badge}
📍 ${where(j)} · \`${salary(j)}\`${f.length ? ' · ' + f.join(' · ') : ''}
${summary}
${cleanUrl(j.apply_url)}

`;
  if ((discord + line).length < 1800) discord += line;
}
discord += `📋 Email has full report | [Notion](<${NOTION}>)\n👉 **Open Notion → change Status to Applied when you apply!**`;

// ── Email ─────────────────────────────────────────────────────────────────────
let emailRows = '';
for (const item of top20) {
  const j = item.json;
  const sal = j.salary_min
    ? '$' + j.salary_min.toLocaleString() + (j.salary_max ? '-$' + j.salary_max.toLocaleString() : '+')
    : (j.salary_text || 'Not listed');
  const c = j.score >= 80 ? '#2d8a4e' : '#d4940a';
  const modeColor = j.work_mode === 'Remote' ? '#2980b9' : '#8e44ad';
  const tagHtml = j.tags && j.tags.length
    ? '<span style="margin-top:4px;display:block">'
      + j.tags.slice(0,6).map(t => `<span style="background:#e8f4f8;color:#2980b9;padding:2px 6px;border-radius:10px;font-size:11px;margin-right:3px">${t}</span>`).join('')
      + '</span>'
    : '';
  const f = flags(j);
  emailRows += '<tr style="border-bottom:1px solid #eee">'
    + `<td style="padding:12px;width:60px;text-align:center"><span style="background:${c};color:white;padding:4px 8px;border-radius:12px;font-weight:bold">${j.score}</span>`
    + `<br><span style="font-size:11px;color:#999">${j.source}</span></td>`
    + `<td style="padding:12px"><strong><a href="${j.apply_url}" style="color:#2c3e50;text-decoration:none">${j.title}</a></strong><br>`
    + `<span style="color:#666">${j.company}</span> &nbsp;|&nbsp; `
    + `<span style="color:${modeColor};font-size:13px;font-weight:bold">${where(j)}</span> &nbsp;|&nbsp; `
    + `<span style="color:#27ae60;font-size:13px">${sal}</span><br>`
    + `<span style="color:#888;font-size:12px">Size: ${j.size_estimate || 'Unknown'} &nbsp;|&nbsp; Remote history: ${j.remote_history || 'n/a'} &nbsp;|&nbsp; Drug test: ${j.drug_test_flag ? '<b style="color:#c0392b">mentioned</b>' : 'not mentioned'}</span>`
    + (f.length ? `<br><span style="font-size:12px">${f.join(' &nbsp; ')}</span>` : '')
    + `<span style="color:#555;font-size:13px;display:block;margin-top:4px">${j.fit_summary}</span>`
    + tagHtml
    + `<span style="color:#e67e22;font-size:12px;display:block;margin-top:3px">`
    + (j.resume_tips && j.resume_tips.length ? '📝 ' + (j.resume_tips[0]||'') : '') + '</span>'
    + (j.missing_skills && j.missing_skills !== 'None' ? `<span style="color:#e67e22;font-size:12px">⚠ Missing: ${j.missing_skills}</span>` : '')
    + (j.red_flags && j.red_flags !== 'None' ? `<span style="color:#e74c3c;font-size:12px;display:block">🚩 ${j.red_flags}</span>` : '')
    + `<span style="color:#aaa;font-size:12px"> Posted: ${j.posted_date||'Unknown'}</span>`
    + '</td></tr>';
}

// Filter counts for this run, so it is visible that local jobs get through.
let statsHtml = '';
try {
  const s = $('Normalize + Filter + Dedup').first().json.filter_stats;
  const d = Object.entries(s.dropped || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';
  statsHtml = `<p style="color:#888;font-size:12px">This run: ${s.in} jobs in → ${s.kept_remote} remote + ${s.kept_local} local sent to scoring. Dropped — ${d}.</p>`;
} catch (e) {}

const emailHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:850px;margin:0 auto;color:#333">
<h2 style="color:#2c3e50;border-bottom:3px solid #3498db;padding-bottom:10px">🔍 Job Scout (__LANE_LABEL__) — ${today}</h2>
<p>Found <strong>${items.length} job(s) scoring ${THRESHOLD}+</strong>. Showing top ${Math.min(20,items.length)}. <a href="${NOTION}">View all in Notion →</a></p>
<table style="width:100%;border-collapse:collapse">
<thead><tr style="background:#3498db;color:white"><th style="padding:10px">Score</th><th style="padding:10px;text-align:left">Job Details</th></tr></thead>
<tbody>${emailRows}</tbody></table>
${statsHtml}
<p style="margin-top:20px;color:#888;font-size:13px">
  <strong>Tip:</strong> Jobs scoring 80+ are high priority — open their Notion page for tailored resume tips and cover letter draft.
</p>
</body></html>`;

return [{ json: {
  discord_content: discord,
  email_html:      emailHtml,
  email_subject:   `Job Scout (__LANE_LABEL__): ${items.length} match(es) — ${today}`,
  has_jobs: true
} }];
