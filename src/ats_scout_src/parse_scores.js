
const resp = $input.first().json;
const { jobs } = $('Format Claude Prompt').first().json;

if (!jobs || jobs.length === 0) {
  return [{ json: { noJobs: true, message: 'No new jobs this run.' } }];
}

let scores = [];
  // Take the FIRST complete JSON array, scanning brackets outside strings.
  // Haiku sometimes appends markdown commentary after the array (2026-10-04,
  // execution 62693): cutting at the LAST ']' swallowed that text, the parse
  // failed, and every job fell back to 50.
  const firstJsonArray = s => {
    const start = s.indexOf('[');
    if (start === -1) return s;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']' && --depth === 0) return s.substring(start, i + 1);
    }
    return s.substring(start);
  };
try {
  const raw = (resp.content.find(b => b.type === 'text') || {}).text || '';  let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  scores = JSON.parse(firstJsonArray(cleaned));
} catch(e) {
  scores = jobs.map((j, i) => ({
    index: i + 1, score: 50,
    fit_summary: 'Auto-scored (parse error).',
    missing_skills: 'Unknown', red_flags: 'None',
    tags: [], role_type: 'Other',
    resume_tips: ['Review job description manually.'],
    cover_letter_hook: 'Please review this position and customize your cover letter accordingly.'
  }));
}

return jobs.map((job, i) => {
  const s = scores.find(x => x.index === i + 1) || {
    score: 50, fit_summary: 'Not scored.',
    missing_skills: 'Unknown', red_flags: 'None',
    tags: [], role_type: 'Other',
    resume_tips: [], cover_letter_hook: ''
  };
  return { json: {
    ...job,
    score:             s.score,
    fit_summary:       s.fit_summary,
    missing_skills:    s.missing_skills,
    red_flags:         s.red_flags,
    tags:              Array.isArray(s.tags) ? s.tags : [],
    role_type:         s.role_type || 'Other',
    resume_tips:       Array.isArray(s.resume_tips) ? s.resume_tips : [s.resume_tips || ''],
    cover_letter_hook: s.cover_letter_hook || ''
  }};
});
