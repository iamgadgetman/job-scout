// Builds the scoring prompt. Mirrors the Daily Scout's prompt so both scouts
// score on the same rubric, with the differences this lane actually has:
// every employer here was hand-picked, and some boards ship no description.
const { jobs, count } = $input.first().json;

if (!count || count === 0) {
  return [{ json: { jobs: [], count: 0, prompt: null } }];
}

const jobsList = jobs.map((j, i) => {
  const sal = j.salary_min
    ? (j.salary_currency && j.salary_currency !== 'USD'
        ? `${j.salary_currency} ${j.salary_min.toLocaleString()}-${(j.salary_max || 0).toLocaleString()} (NOT USD)`
        : '$' + j.salary_min.toLocaleString() + '-$' + (j.salary_max ? j.salary_max.toLocaleString() : '?'))
    : (j.salary_text || 'Not listed');
  return `${i+1}. Title: "${j.title}" | Company: "${j.company}" (target tier ${j.priority})`
       + ` | Location: ${j.location} | Salary: ${sal}\n`
       + `Title tier: ${j.title_tier || 'other'} | Skill overlap: ${j.skill_overlap ?? '?'}/100 (${j.skill_clusters || 'no stack keywords'})\n`
       + `Description: ${j.description.substring(0, 1800)}`;
}).join('\n\n');

const prompt = `You are an expert technical recruiter and career coach acting as a strict job-match scorer for a specific candidate. Analyze each job and return structured JSON.

CANDIDATE PROFILE — Your Name
- Location: Remote strongly preferred. Hybrid/onsite acceptable ONLY in Your City or the Metro Area (Nearby City A/B/C), ST. Remote-Only City counts ONLY if the role is remote. Onsite/hybrid anywhere else, or relocation, is a dealbreaker. Max 10% travel.
- Experience: [N] years in [networking / security / infrastructure] — NOT a software developer
- Current Role: [Title], [Employer] ([year]–present)
  • [Scope: number of sites, users, devices]
  • [Key platform or responsibility]
  • [Current project]

- STRONG / EXPERT skills:
  • Routing: [e.g. BGP, OSPF, MPLS]
  • Switching: [e.g. VLANs, QoS, vendor platforms]
  • Wireless: [platforms]
  • Firewalls: [vendors — config, rule lifecycle, hardening]
  • Monitoring: [e.g. Prometheus, Grafana, SolarWinds]
  • Systems: [OSes, hypervisors, containers]
  • Automation: [tools — and how deep]
  • Vendors: [list]

- LIMITED / DEVELOPING:
  • [Skill]: [honest depth — conceptual only / end-user / in training]
  • [Skill]: [honest depth]

- Certifications: [certs and degrees]
- Salary: target ~$[N]k — a posted range that reaches $[N]k at either end is on target. More is welcome.
- Hard dealbreakers: [e.g. onsite outside your area, relocation, clearance, drug testing, travel >10%]
- Employer size: [preference, e.g. prefers organizations under 10,000 employees — soft flag]

ABOUT THIS BATCH — read carefully, it differs from the general job feed:
- Every employer here was hand-picked for this candidate and polled directly from
  its own applicant-tracking system. There are no reposts, no staffing agencies
  and no aggregator spam. Do NOT penalise a role for being from an unknown source.
- "target tier 1" employers are ones where networking IS the product and remote is
  the default. Tier 2 and 3 are remote-friendly but less directly aligned.
- Some boards publish no job description. Where the description says so explicitly,
  score on title, company and location, cap the score at 75 because the evidence is
  thin, and say plainly in fit_summary that the description was unavailable.
- Salary marked "(NOT USD)" is quoted in another currency — convert roughly before
  judging it against the $120k USD floor, and note the currency in red_flags.

TARGET ROLES (good fit):
PRIMARY: Network Engineer (senior), Network Reliability Engineer, Cloud Network Engineer,
Network Automation Engineer, Network Security Engineer, Network Architect.
SECONDARY: Infrastructure Engineer, Systems Engineer, Systems Administrator (senior), Platform Engineer (ops-heavy).
GROWTH DIRECTION: he wants to move beyond pure networking into server, virtualization, cloud and
container work (VMware, Proxmox, Docker, Kubernetes) — a network role that adds those is ideal.
ESPECIALLY desirable: roles centred on networking, routing, observability/monitoring, or
that blend infrastructure with AI/automation.

NOT A FIT FOR:
Software engineering, web/application development, data engineering, ML/AI engineering,
sales/solutions engineering, or any role where writing production code is the PRIMARY
responsibility.
Site Reliability Engineer (SRE), Production Engineer and DevOps roles — he does NOT qualify for these.
Score any role that is SRE/DevOps in substance (on-call for software services, SLOs/error budgets,
CI/CD pipelines as the core job) at 40 or below, whatever its title.

JOBS TO EVALUATE:
${jobsList}

SCORING RULES — apply strictly:

AUTOMATIC DISQUALIFIERS (score 20 or below):
- Role is primarily software/application/web development
- Requires 3+ years of programming as the primary skill (Go/Rust/Java as the main job function)
- Requires clearance or drug testing
- Onsite/hybrid outside Your City / Metro Area (onsite Remote-Only City included), or requires relocation
- Federal government agency or federal contractor role (DOE/DoD/national-lab work, regional federal contractors)
- Remote but restricted to a country other than the US

PENALTIES:
- Minus 25: heavy coding requirements ("you will build software", Go/Rust/Java required)
- Minus 25: posted salary range tops out below $120k USD
- Minus 15: requires a CS degree or software engineering background specifically
- Minus 10: scripting/automation required (Python OK as secondary — note as a gap)
- Minus 10: Skill overlap below 20 (little of his stack appears in the posting)
- Minus 8: employer very likely exceeds 10,000 employees (estimate if unstated; note in red_flags)

BONUSES:
- Plus 12: networking is central to the role (BGP/routing/anycast/edge/peering)
- Plus 10: Title tier primary (Network Engineer family); Plus 5: Title tier secondary (Infrastructure/Systems)
- Plus 10: Skill overlap 60 or higher; Plus 5: Skill overlap 40-59
- Plus 5: networking role that also involves virtualization/containers/cloud (VMware, Proxmox, Docker, Kubernetes) — his growth direction
- Plus 10: network reliability/operations focus — routing observability, firewall automation
- Plus 8: mentions Cisco/Juniper/Palo Alto/Fortinet or specific network protocols
- Plus 8: role blends networking/infrastructure with AI/ML ops or values AI-driven automation
- Plus 5: Grafana/Prometheus/observability stack prominent in requirements
- Plus 5: ops-heavy infrastructure/platform role rather than dev-heavy
- Plus 5: PCI-DSS or compliance-focused network security

Return ONLY a valid JSON array — no markdown fences, no extra text:
[{
  "index": 1,
  "score": 85,
  "fit_summary": "Exactly two sentences explaining match quality and key alignment.",
  "missing_skills": "comma-separated required skills not in profile, or None",
  "red_flags": "salary below target, travel, clearance, heavy coding, large employer — or None",
  "tags": ["BGP", "Palo Alto", "Kubernetes", "Grafana"],
  "role_type": "Network Engineer",
  "resume_tips": [
    "Emphasize BGP/MPLS experience in the summary",
    "Lead with Docker/Kubernetes hands-on work",
    "Add Ansible learning progress to skills"
  ],
  "cover_letter_hook": "Two to three sentences opening a cover letter, specific to this company and role."
}]

Scoring guide: 90-100=perfect fit, 80-89=strong match, 65-79=good candidate, 50-64=stretch, <50=poor fit.
IMPORTANT: only jobs scoring 70 or higher reach the candidate's queue — be honest, do not inflate to clear the bar.
role_type must be one of: SRE, Network Engineer, DevOps, Platform Engineer, Cloud Engineer, Infrastructure Engineer, Other
tags: up to 8 technology/skill tags taken from the job description
resume_tips: 3-5 specific bullets referencing his actual network/infra experience — include confirmed skills not yet on the resume (Meraki, Avaya VoIP, OSPF/MPLS, PCI-DSS, Palo Alto, Fortinet, n8n/Claude AI automation, SolarWinds/Elasticsearch) where they fit
cover_letter_hook: reference the company or role specifically, never generic`;

return [{ json: { jobs, prompt } }];
