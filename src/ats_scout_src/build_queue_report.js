// ── Output as a work queue, not a newsletter ─────────────────────────────
// scout-targets.yaml.yml asks for format: queue — a short numbered list that
// can actually be finished in a sitting, ordered by target tier then recency,
// with the apply URL on every row.
const MIN_SCORE = 70;
const WEEKLY_TARGET = 5;

const items = $input.all().filter(it =>
  it && it.json && !it.json.noJobs &&
  typeof it.json.score === 'number' && it.json.score >= MIN_SCORE);

const sd  = $getWorkflowStaticData('global');
const st  = sd.lastRunStats || { ok: {}, bad: [], deferred: 0, boards: 0 };
const bad = st.bad || [];

// Applications actually sent, read back from Notion: roles whose Status he set
// to "Applied" in the last 7 days. Normalize counts these while it is already
// reading Notion to exclude acted-on roles.
const appliedThisWeek = st.appliedThisWeek || 0;
const actedOnTotal = st.actedOn || 0;
const shortfall = Math.max(0, WEEKLY_TARGET - appliedThisWeek);

// Roles surfaced, tracked separately - queueing is not applying, and conflating
// the two would flatter the number.
if (!Array.isArray(sd.queuedLog)) sd.queuedLog = [];
const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
sd.queuedLog = sd.queuedLog.filter(t => t > weekAgo);
for (let i = 0; i < items.length; i++) sd.queuedLog.push(Date.now());
const queuedThisWeek = sd.queuedLog.length;

const pace = appliedThisWeek >= WEEKLY_TARGET
  ? `✅ ${appliedThisWeek}/${WEEKLY_TARGET} applications sent this week`
  : `${appliedThisWeek}/${WEEKLY_TARGET} applications sent this week — ${shortfall} to go`;

const today = new Date().toLocaleDateString('en-US',
  { weekday: 'long', month: 'long', day: 'numeric' });

// Boards that returned nothing are the failure mode that matters here: a board
// token going stale is silent otherwise.
const boardsPolled = Object.keys(st.ok || {}).length;
const silent = bad.filter(b => /returned no postings|layout changed|fetch failed/.test(b));
const health = [
  silent.length ? `⚠️ ${silent.length} board(s) silent: ${silent.slice(0, 4).join('; ')}` : '',
  st.deferred ? `ℹ️ ${st.deferred} more qualifying role(s) held for the next run` : '',
].filter(Boolean).join('\n');

if (!items.length) {
  // Stay silent on a genuinely quiet day; speak up only if a board broke.
  if (!silent.length) return [];
  return [{ json: {
    has_jobs: false,
    discord_content: `**🎯 ATS Scout** — nothing new, and boards are failing.\n${health}`,
    email_subject: 'ATS Scout — no new roles, boards failing',
    email_html: `<p>Polled ${boardsPolled} board(s), nothing cleared the bar.</p><p>${health.replace(/\n/g, '<br>')}</p>`,
  } }];
}

const sorted = [...items].sort((a, b) =>
  (a.json.priority - b.json.priority) ||
  String(b.json.posted_date || '').localeCompare(String(a.json.posted_date || '')) ||
  (b.json.score - a.json.score));

const salaryOf = j => {
  if (!j.salary_min) return j.salary_text || 'Not listed';
  if (j.salary_currency && j.salary_currency !== 'USD') return j.salary_text;
  const k = n => '$' + Math.round(n / 1000) + 'k';
  return j.salary_max ? `${k(j.salary_min)}–${k(j.salary_max)}` : `${k(j.salary_min)}+`;
};
const tierLabel = p => p === 1 ? 'Tier 1' : p === 2 ? 'Tier 2' : 'Tier 3';

// ── Discord: the whole queue, short lines ────────────────────────────────
let discord = `**🎯 ATS Scout — ${today}**\n`
  + `${sorted.length} role(s) to work through · ${boardsPolled} boards polled\n`
  + `${pace} · ${queuedThisWeek} queued this week\n\n`;
sorted.forEach((it, i) => {
  const j = it.json;
  const line = `**${i + 1}. ${j.title}** — ${j.company} · ${tierLabel(j.priority)}\n`
    + `\`${j.score}\` · ${j.location} · ${salaryOf(j)}\n`
    + `${j.apply_url}\n\n`;
  if ((discord + line).length < 1850) discord += line;
});
if (health) discord += health + '\n';
discord += `📋 Mark **Status → Applied** in Notion as you go — applied roles never resurface.`;

// ── Email: same queue, with the reasoning attached to each row ────────────
const rows = sorted.map((it, i) => {
  const j = it.json;
  const c = j.score >= 80 ? '#2d8a4e' : '#d4940a';
  const tags = (j.tags || []).slice(0, 6)
    .map(t => `<span style="background:#eef4f8;color:#2980b9;padding:2px 7px;border-radius:10px;font-size:11px;margin-right:4px">${t}</span>`)
    .join('');
  return `<tr style="border-bottom:1px solid #eaeaea">
  <td style="padding:14px 10px;vertical-align:top;width:52px;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#888">${i + 1}</div>
    <div style="background:${c};color:#fff;padding:3px 8px;border-radius:11px;font-weight:700;font-size:13px;margin-top:6px">${j.score}</div>
  </td>
  <td style="padding:14px 10px;vertical-align:top">
    <div style="font-size:15px;font-weight:700;color:#1f2d3d">${j.title}</div>
    <div style="color:#555;margin:3px 0 6px">
      ${j.company} <span style="color:#aaa">·</span> ${tierLabel(j.priority)}
      <span style="color:#aaa">·</span> ${j.location}
      <span style="color:#aaa">·</span> <span style="color:#27ae60">${salaryOf(j)}</span>
      ${j.posted_date ? `<span style="color:#aaa"> · posted ${j.posted_date}</span>` : ''}
    </div>
    <div style="color:#444;font-size:13px;margin-bottom:6px">${j.fit_summary || ''}</div>
    ${tags ? `<div style="margin-bottom:6px">${tags}</div>` : ''}
    ${j.missing_skills && j.missing_skills !== 'None' ? `<div style="color:#e67e22;font-size:12px">⚠ Missing: ${j.missing_skills}</div>` : ''}
    ${j.red_flags && j.red_flags !== 'None' ? `<div style="color:#e74c3c;font-size:12px">🚩 ${j.red_flags}</div>` : ''}
    <div style="margin-top:8px">
      <a href="${j.apply_url}" style="background:#2c6fbb;color:#fff;padding:7px 14px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600">Apply →</a>
    </div>
  </td></tr>`;
}).join('');

const email_html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:760px;margin:0 auto;color:#222;background:#fff">
<h2 style="color:#1f2d3d;border-bottom:3px solid #2c6fbb;padding-bottom:10px;margin-bottom:6px">🎯 ATS Scout — ${today}</h2>
<p style="color:#666;font-size:13px;margin-top:0">
  Polled <strong>${boardsPolled}</strong> company boards directly — no aggregators, no reposts.
  <strong>${sorted.length}</strong> role(s) in today's queue ·
  <strong>${queuedThisWeek}</strong> queued in the last 7 days.
</p>
<p style="background:${appliedThisWeek >= WEEKLY_TARGET ? '#eaf7ee' : '#f4f7fb'};border-left:3px solid ${appliedThisWeek >= WEEKLY_TARGET ? '#2d8a4e' : '#2c6fbb'};padding:9px 12px;font-size:13px;margin-top:0">
  <strong>${pace}</strong><br>
  <span style="color:#666">Counted from Notion — ${actedOnTotal} role(s) marked applied or closed overall, and none of them will resurface here.</span>
</p>
${health ? `<p style="background:#fff8e1;border-left:3px solid #e6a700;padding:9px 12px;font-size:13px;color:#6b5200">${health.replace(/\n/g, '<br>')}</p>` : ''}
<table style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>
<p style="margin-top:22px;color:#666;font-size:13px">
  Each role has a Notion page with tailored resume tips and a cover-letter opener.
  <a href="https://www.notion.so/YOUR_NOTION_DB_URL">Open the board →</a><br>
  <strong>Set Status → Applied</strong> as you go — that is what the weekly count reads,
  and what permanently removes a role from this queue.
</p>
</body></html>`;

return [{ json: {
  has_jobs: true,
  discord_content: discord,
  email_html,
  email_subject: `ATS Scout: ${sorted.length} role(s) to work — ${today}`,
} }];
