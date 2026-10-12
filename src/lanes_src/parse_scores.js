const resp = $input.first().json;
const { jobs } = $('Format Claude Prompt').first().json;

if (!jobs || jobs.length === 0) {
  return [{ json: { noJobs: true, message: 'No new jobs this run.' } }];
}

let scores = [];
try {
  const raw = ((resp.content || []).find(b => b.type === 'text') || {}).text || '';
  let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const arrStart = cleaned.indexOf('[');
  const arrEnd   = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    cleaned = cleaned.substring(arrStart, arrEnd + 1);
  }
  scores = JSON.parse(cleaned);
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
    size_estimate:     s.size_estimate || 'Unknown',
    clearance_flag:    job.clearance_flag === true || s.clearance_flag === true,
    drug_test_flag:    job.drug_test_flag === true || s.drug_test_flag === true,
    resume_tips:       Array.isArray(s.resume_tips) ? s.resume_tips : [s.resume_tips || ''],
    cover_letter_hook: s.cover_letter_hook || ''
  }};
});
