
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

function routeDb(j) {
  var NETSEC   = "YOUR_NOTION_DB_SECURITY"; // Job Scout - Network Security
  var CLOUDNET = "YOUR_NOTION_DB_CLOUD"; // Job Scout - Cloud Networking
  var JOBS     = "YOUR_NOTION_DB_MAIN"; // Jobs (generic default)
  var hay = ((j.title||'') + ' ' + ((j.tags||[]).join(' ')) + ' ' + (j.role_type||'')).toLowerCase();
  var SEC = /\b(security|infosec|cyber(security)?|soc|siem|firewall|zero[ -]?trust|ids|ips|threat|vulnerabilit(y|ies)|pen[ -]?test(ing)?|pentest|security operations)\b/;
  if (SEC.test(hay)) return NETSEC;
  var NET = /\b(network engineer|network architect|cloud network(ing)?|hybrid cloud|sd[ -]?wan|netsre|noc|wan|bgp|ospf|network operations)\b/;
  if (j.role_type === 'Network Engineer' || j.role_type === 'Cloud Engineer' || NET.test(hay)) return CLOUDNET;
  return JOBS;
}

for (const item of $input.all()) {
  const j = item.json;

  if (j.noJobs || !j.title) continue;
  if (j.score < 70) continue;

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

  const priority = j.score >= 80 ? 'High' : j.score >= 60 ? 'Medium' : 'Low';
  const tagsValue = (j.tags || []).slice(0, 10).map(t => ({name: String(t).substring(0,100)}));
  const tipsShort = tips.slice(0,3).join(' | ').substring(0,500) || 'None';
  const clShort   = (j.cover_letter_hook || 'None').substring(0,500);

  const body = {
    parent: { database_id: routeDb(j) },
    properties: {
      "Job Title":          { title:        [{ text: { content: (j.title   || '').substring(0,200) } }] },
      "Company":            { rich_text:    [{ text: { content: (j.company || '').substring(0,200) } }] },
      "Source":             { select:       { name: j.ats_provider || "ATS" } },
      "Apply URL":          { url: j.apply_url || null },
      "Location":           { rich_text:    [{ text: { content: (j.location || '').substring(0,200) } }] },
      "Salary Min":         { number: j.salary_min || null },
      "Salary Max":         { number: j.salary_max || null },
      "Score":              { number: j.score || 0 },
      "Fit Summary":        { rich_text:    [{ text: { content: (j.fit_summary    || '').substring(0,2000) } }] },
      "Missing Skills":     { rich_text:    [{ text: { content: (j.missing_skills || 'None').substring(0,500) } }] },
      "Red Flags":          { rich_text:    [{ text: { content: (j.red_flags      || 'None').substring(0,500) } }] },
      "Tags":               { multi_select: tagsValue },
      "Role Type":          { select:       { name: j.role_type || 'Other' } },
      "Priority":           { select:       { name: priority } },
      "Resume Tips":        { rich_text:    [{ text: { content: tipsShort } }] },
      "Cover Letter Draft": { rich_text:    [{ text: { content: clShort   } }] },
      "Status":             { select:       { name: 'New' } },
      "Date Found":         { date:         { start: today } },
      "Posted Date":        { rich_text:    [{ text: { content: j.posted_date || '' } }] },
      "Job ID":             { rich_text:    [{ text: { content: (j.job_id || '').substring(0,200) } }] }
    },
    children: children
  };

  results.push({ json: { ...j, notionBody: JSON.stringify(body) } });
}

return results;

