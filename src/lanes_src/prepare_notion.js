// Needs these Notion properties (added 2026-10-10): Work Mode (select),
// City (text), Remote History (text), Drug Test Flag (select), Employer Size (text).
const THRESHOLD = 70;
const results = [];
const today = new Date().toISOString().split('T')[0];

function descBlocks(text) {
  const blocks = [];
  const safe = (text || '').substring(0, 9500);
  if (!safe) {
    return [{object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:'(no description available)'}}]}}];
  }
  for (let i = 0; i < safe.length; i += 1900) {
    blocks.push({
      object:'block', type:'paragraph',
      paragraph:{rich_text:[{type:'text',text:{content:safe.substring(i, i+1900)}}]}
    });
  }
  return blocks;
}

function h2(text) {
  return {object:'block',type:'heading_2',heading_2:{rich_text:[{type:'text',text:{content:text}}]}};
}
function divider() { return {object:'block',type:'divider',divider:{}}; }
function bullet(text) {
  return {object:'block',type:'bulleted_list_item',
    bulleted_list_item:{rich_text:[{type:'text',text:{content:text.substring(0,2000)}}]}};
}
function para(text) {
  return {object:'block',type:'paragraph',
    paragraph:{rich_text:[{type:'text',text:{content:(text||'').substring(0,2000)}}]}};
}
const rt = (s, n) => [{ text: { content: String(s || '').substring(0, n) } }];

for (const item of $input.all()) {
  const j = item.json;

  if (j.noJobs || !j.title) continue;
  if (j.score < THRESHOLD) continue;

  const tips = Array.isArray(j.resume_tips)
    ? j.resume_tips.filter(t => t && t !== 'None')
    : [];

  const children = [
    h2('📋 Full Job Description'),
    ...descBlocks(j.description),
    divider(),
    h2('🎯 Resume Customization Tips'),
    ...(tips.length > 0
      ? tips.slice(0,8).map(t => bullet(t))
      : [para('No specific tips generated.')]),
    divider(),
    h2('✉️ Cover Letter Hook'),
    para(j.cover_letter_hook || 'Not generated.'),
  ];

  const priority = j.score >= 80 ? 'High' : 'Medium';
  const tagsValue = [{name: '__LANE_TAG__'}].concat((j.tags || []).slice(0, 9).map(t => ({name: String(t).replace(/,/g, ' ').substring(0,100)})));
  const tipsShort = tips.slice(0,3).join(' | ').substring(0,500) || 'None';
  const clShort   = (j.cover_letter_hook || 'None').substring(0,500);

  const body = {
    parent: { database_id: "__DB_ID__" },
    properties: {
      "Job Title":          { title:        rt(j.title, 200) },
      "Company":            { rich_text:    rt(j.company, 200) },
      "Source":             { select:       { name: j.source || 'JSearch' } },
      "Apply URL":          { url: j.apply_url || null },
      "Location":           { rich_text:    rt(j.location, 200) },
      "Salary Min":         { number: j.salary_min || null },
      "Salary Max":         { number: j.salary_max || null },
      "Score":              { number: j.score || 0 },
      "Fit Summary":        { rich_text:    rt(j.fit_summary, 2000) },
      "Missing Skills":     { rich_text:    rt(j.missing_skills || 'None', 500) },
      "Red Flags":          { rich_text:    rt(j.red_flags || 'None', 500) },
      "Tags":               { multi_select: tagsValue },
      "Role Type":          { select:       { name: j.role_type || 'Other' } },
      "Priority":           { select:       { name: priority } },
      "Resume Tips":        { rich_text:    rt(tipsShort, 500) },
      "Cover Letter Draft": { rich_text:    rt(clShort, 500) },
      "Status":             { select:       { name: 'New' } },
      "Date Found":         { date:         { start: today } },
      "Posted Date":        { rich_text:    rt(j.posted_date, 50) },
      "Job ID":             { rich_text:    rt(j.job_id, 200) },
      "Work Mode":          { select:       { name: j.work_mode || 'Remote' } },
      "City":               { rich_text:    rt(j.city, 100) },
      "Remote History":     { rich_text:    rt(j.remote_history, 200) },
      "Drug Test Flag":     { select:       { name: j.drug_test_flag ? 'Yes' : 'No' } },
      "Employer Size":      { rich_text:    rt(j.size_estimate, 100) }
    },
    children: children
  };

  results.push({ json: { ...j, notionBody: JSON.stringify(body) } });
}

return results;
