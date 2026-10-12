// Scoring prompt, rewritten 2026-10-10 (patch_lanes_local.py). LANE placeholders
// are filled per lane (cloud / security) at deploy time.
const { jobs, count } = $input.first().json;

if (!count || count === 0) {
  return [{ json: { jobs: [], count: 0, prompt: null } }];
}

const jobsList = jobs.map((j, i) => {
  const sal = j.salary_min
    ? '$' + j.salary_min.toLocaleString() + '-$' + (j.salary_max ? j.salary_max.toLocaleString() : '?')
    : (j.salary_text || 'Not listed');
  return `${i+1}. Title: "${j.title}" | Company: "${j.company}" | Work mode: ${j.work_mode}${j.city ? ' (' + j.city + ')' : ''} | Remote history: ${j.remote_history || 'n/a'} | Drug-test text: ${j.drug_test_flag ? 'yes' : 'no'} | Salary: ${sal} | Source: ${j.source}\nDescription: ${j.description.substring(0, 600)}`;
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

TARGET ROLES, in priority order: 1. Network Engineer  2. Infrastructure Engineer  3. Systems Administrator (with networking)  4. Network Security Engineer. Growth path (score on substance, no title bonus): Cloud Engineer, Platform / SRE / Observability, Network Automation.
__LANE_ROLES__

NOT A FIT FOR:
__LANE_NOT_FIT__

JOBS TO EVALUATE:
${jobsList}

SCORING RULES — apply these strictly before assigning a score:

AUTOMATIC DISQUALIFIERS (score 20 or below):
- Requires a security clearance
- DoD / defense work, a federal contractor (regional federal contractors, national labs / national-lab operators, defense primes such as Lockheed, Raytheon, Northrop, General Dynamics, Leidos, SAIC, Booz Allen, CACI), or the VA. State and local government is FINE.
- On-site/hybrid outside the allowed area above, or requires relocation
- Role is primarily software/application/web development, or programming (Python/Go/Java) is the main job function
__LANE_DISQ__
SCORE 40 OR BELOW:
- Employer is a telecom carrier / ISP and the job is building or running its MPLS / backbone network

PENALTIES:
- Employer clearly over 10,000 employees: minus 20 AND the final score may not exceed 65 (hard cap). Roughly 1,000-10,000: minus 4. Under 1,000: no penalty.
- Minus 5: sprawling multi-site employer (many locations)
- Minus 10: architect / principal / strategy role with little hands-on work
- Minus 10: top of the posted salary range is below $120k; minus 20 instead if the top is below $95k. No penalty if the range reaches ~$120k or salary is not listed.
- Minus 10: SRE / DevOps / platform role in SUBSTANCE (on-call software reliability, SLOs, CI/CD, writing services) — growth path, not the target
- Minus 25: heavy coding requirements (Go/Rust/Java required, or "you will build software")
- Minus 10: requires a cloud/developer certification the candidate is still pursuing
- Minus 5: IPv6 is a major requirement (also list "IPv6" in missing_skills)
- Minus 10: travel over 10%
- Drug-test text: NO penalty. Just set drug_test_flag.

BONUSES:
- Plus 6: on-site/hybrid job in the allowed area whose employer HAS posted remote roles before (see "Remote history") — remote flexibility is likely
- Plus 6: duties mix networking with servers / virtualization / cloud / monitoring (VMware, Proxmox, Linux, Windows Server, Prometheus, Grafana, SolarWinds) — his growth goal
- Plus 5: small or local employer, state / local government, education, healthcare, utility, or agriculture/food employer
- Plus 5: ops-heavy, hands-on infrastructure role
- Plus 8: mentions Cisco/Juniper/Palo Alto/Fortinet/Meraki or specific network protocol experience
- Plus 8: Avaya/VoIP/UC experience valued
- Plus 5: PCI-DSS or compliance-focused network security
- Plus 6: values AI-driven automation or workflow building (n8n, Claude, Ansible)
- Plus 6: Terraform / Infrastructure-as-Code mentioned
__LANE_BONUSES__
SIZE: estimate the employer's headcount when it is not stated and return it in size_estimate (e.g. "about 400", "1,000-10,000", "over 10,000").

Return ONLY a valid JSON array — no markdown fences, no extra text:
[{
  "index": 1,
  "score": 85,
  "fit_summary": "Exactly two sentences explaining the match quality and key alignment.",
  "missing_skills": "comma-separated list of required skills not in profile, or None",
  "red_flags": "salary below $120k, travel, employer size, architect-only, drug test, etc — or None",
  "tags": ["Cisco", "Fortinet", "VMware"],
  "role_type": "Network Engineer",
  "size_estimate": "about 400",
  "clearance_flag": false,
  "drug_test_flag": false,
  "resume_tips": [
    "Lead with your BGP/OSPF and Fortinet SD-WAN work",
    "Add Proxmox/VMware homelab virtualization to skills"
  ],
  "cover_letter_hook": "Two to three sentences for an opening paragraph tailored specifically to this company and role."
}]

Scoring guide: 90-100=perfect fit, 80-89=strong match, 70-79=good candidate, 50-69=possible stretch, <50=poor fit. IMPORTANT: only jobs scoring 70 or higher are saved and reported to the candidate — be honest and do not inflate scores to clear this bar.
role_type must be one of: Network Engineer, Infrastructure Engineer, Systems Administrator, Network Security Engineer, Cloud Engineer, Platform Engineer, SRE, DevOps, Network Architect, Other
tags: up to 8 key technology/skill tags extracted directly from the job description
resume_tips: 3-5 specific actionable bullets referencing the candidate's actual network/infra experience — include relevant confirmed skills not yet on resume (Meraki, Avaya VoIP, OSPF/MPLS, PCI-DSS, Palo Alto, Fortinet, AI workflow automation with n8n/Claude/Grok, SolarWinds/Elasticsearch monitoring) where they fit
cover_letter_hook: reference the company or role specifically, not generic`;

return [{ json: { jobs, prompt } }];
