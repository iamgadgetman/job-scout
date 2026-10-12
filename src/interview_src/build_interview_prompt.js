// Builds the interview-prep prompt.
//
// The CANDIDATE PROFILE block below is NOT written here - build_interview.py
// lifts it out of scorer_src/build_score_prompt.js at deploy time and splices
// it in where the placeholder sits. That keeps one source of truth for the
// profile instead of a third copy drifting away from the other two.
const d = $('Extract Interview Context').first().json;

const CANDIDATE_PROFILE = `__CANDIDATE_PROFILE__`;

const money = n => (typeof n === 'number' ? '$' + n.toLocaleString() : null);
const sal = d.salary_min || d.salary_max
  ? [money(d.salary_min), money(d.salary_max)].filter(Boolean).join(' - ')
  : 'not stated';

const analysis = [
  d.fit_summary    ? `Fit summary (from the automated scoring): ${d.fit_summary}` : null,
  d.missing_skills && d.missing_skills !== 'None'
    ? `Skills the scorer flagged as MISSING from his background: ${d.missing_skills}` : null,
  d.red_flags && d.red_flags !== 'None'
    ? `Concerns the scorer raised about this role: ${d.red_flags}` : null,
  d.tags && d.tags.length ? `Technologies tagged on this posting: ${d.tags.join(', ')}` : null,
].filter(Boolean).join('\n');

const jd = d.have_description
  ? d.description
  : 'No job description is stored for this posting. Build the sheet from the title, company and tagged technologies alone, and say so at the top of role_snapshot.';

const prompt = `You are an interview coach preparing a senior network/infrastructure engineer for a specific interview. Produce a focused prep sheet.

${CANDIDATE_PROFILE}

THE INTERVIEW:
Role: ${d.title}
Company: ${d.company}
Role type: ${d.role_type || 'unspecified'}
Location: ${d.location || 'unspecified'}
Posted salary: ${sal}

WHAT THE AUTOMATED SCORING ALREADY FOUND:
${analysis || '(no prior analysis on file)'}

JOB DESCRIPTION:
${jd}

TASK: Write a practical prep sheet. Focus on the TECHNOLOGIES AND SKILLS THIS
JOB ACTUALLY REQUIRES, and separately on the "nice to have" / "preferred" /
"bonus" items the posting mentions — those are where interviews are won or
lost, and where he most needs a prepared answer.

Rules:
- Draw every question from THIS posting. No generic "tell me about yourself".
- For each question, say which of HIS REAL experiences to reach for. Use only
  things in the candidate profile above. Never invent experience.
- Where a required skill is one of his gaps, say plainly how to answer
  honestly without overclaiming — what he HAS done that is adjacent, and what
  he is actively learning. Do not coach him to bluff.
- Keep each field tight. This is a one-page sheet he reads before a call, not
  an essay.

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "role_snapshot": "Two sentences: what this role actually is day to day, and the single thing they most want to verify he can do.",
  "required_tech": [
    {
      "question": "A question they are likely to ask about a REQUIRED technology or skill",
      "why": "One short line on why this comes up for this role",
      "answer_with": "Which specific experience of his to lead with, and the concrete detail or metric to cite"
    }
  ],
  "nice_to_haves": [
    {
      "question": "A question about a 'preferred' / 'nice to have' / 'bonus' item in the posting",
      "why": "One short line",
      "answer_with": "What he has that is closest, framed honestly"
    }
  ],
  "gap_questions": [
    {
      "question": "A question about something the posting requires that he genuinely lacks",
      "why": "One short line naming the gap",
      "answer_with": "An honest answer: the adjacent thing he HAS done, plus what he is actively learning. No bluffing."
    }
  ],
  "ask_them": [
    "A sharp question for HIM to ask the interviewer, specific to this company or role"
  ]
}

Counts: exactly 5 required_tech, 3 nice_to_haves, 2 gap_questions, 4 ask_them.
If the posting genuinely lists no preferred/bonus items, still produce 3
nice_to_haves drawn from secondary skills the description implies, and say so
in the "why" line.`;

// Pre-built so the HTTP node carries no inline expression - an n8n expression
// containing an adjacent "}}" terminates early and fails with "invalid syntax".
const claude_body = JSON.stringify({
  model: 'claude-sonnet-4-6',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }],
});

return [{ json: { ...d, claude_body } }];
