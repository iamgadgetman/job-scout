// Assemble the Notion patch and the Discord message now that the doc exists.
// Pre-built as strings so the HTTP nodes carry no complex inline expressions.
const p   = $('Parse Interview Sheet').first().json;
const doc = $('Create Prep Doc').first().json;

const docUrl = 'https://docs.google.com/document/d/' + doc.documentId + '/edit';
const c = p.counts || {};

const discordMsg = [
  '🎤 **Interview prep ready!**',
  '**' + p.title + '** @ ' + p.company,
  `${c.required || 0} required-skill questions • ${c.nice || 0} nice-to-have • ` +
  `${c.gaps || 0} gap • ${c.ask || 0} to ask them`,
  '',
  '📝 [Interview Prep Sheet](' + docUrl + ')',
  p.page_url || '',
].filter(Boolean).join('\n');

return [{ json: {
  page_id: p.page_id,
  doc_url: docUrl,
  discord_msg: discordMsg,
  notion_patch: JSON.stringify({
    properties: { 'Interview Prep': { url: docUrl } },
  }),
}}];
