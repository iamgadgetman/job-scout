// Single-job scoring prompt. The rubric below is a verbatim port of the ATS
// Scout's format_prompt.js so a hand-added job lands on the SAME 0-100 scale
// as a scouted one - that comparability is the whole point of the column.
// If you change the rubric in one place, change it in the other.
const d = $('Resolve Description').first().json;

// On the fetch path Jina feeds this node; on the pasted path Resolve
// Description feeds it directly. Take whichever actually carries text.
let scraped = '';
if (!d.pasted_description) {
  const raw = $json.data !== undefined ? $json.data : $json.body;
  if (typeof raw === 'string') scraped = raw;
}

let content = d.pasted_description || scraped || '';

// Same boilerplate trim the Apply From URL path uses.
const simIdx = content.search(/#{2,3}\s*Similar jobs/i);
if (simIdx > 0) content = content.substring(0, simIdx);
const h1idx = content.search(/\n#\s+/);
if (h1idx > 200) content = content.substring(h1idx);
content = content.substring(0, 6000).trim();

const haveDesc = content.length >= 200;
const description = haveDesc
  ? content
  : 'No job description could be retrieved for this posting.';

// ── Title tier + skill overlap (2026-10-04) ─────────────────────────────
// Same block as ats_scout_src/normalize_ats.js and the Daily Scout's Normalize
// node - change all three together, or a hand-added job and a scouted one
// stop landing on the same scale.
// Whole word, plural allowed: 'firewall' counts 'firewalls', 'java' skips JavaScript.
const kwHit = (txt, k) => new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(e?s)?([^a-z0-9]|$)').test(txt);
const PRIMARY_T = /\bnetwork\b.*\b(engineer|architect|administrator|analyst|specialist)\b|\bfirewall engineer|\bwireless engineer|\bnoc engineer/;
const SECONDARY_T = /\binfrastructure\b.*\b(engineer|architect|administrator)\b|\binfrastructure operations|\bsystems? (engineer|administrator)|\bsysadmin|\bvirtualization|\bvmware|\bserver (engineer|administrator)|\bdata center engineer|\bcloud engineer|\bhybrid cloud/;
const SKILLS = {
  network:  ['bgp','ospf','mpls','dmvpn','vlan','qos','spanning tree','stp','multicast',
             'cisco','nexus','nx-os','ios-xe','juniper','junos','mist','aruba','meraki',
             'sd-wan','sdwan','routing','switching','wireless','wlc','dns','dhcp','ipam',
             'vpn','wan','lan','load balanc','f5'],
  security: ['palo alto','fortinet','fortigate','checkpoint','check point','asa',
             'firewall','intrusion prevention','ips','radius','zero trust','cloudflare',
             'pci','802.1x','nac','ise','segmentation'],
  systems:  ['vmware','vsphere','esxi','proxmox','hyper-v','virtualization','linux',
             'red hat','rhel','centos','windows server','active directory','docker',
             'kubernetes','k8s','container','backup','disaster recovery','azure','aws'],
  observability: ['solarwinds','orion','prometheus','grafana','splunk','elastic','syslog',
             'snmp','netflow','monitoring','loki','observability'],
  automation: ['ansible','python','n8n','automation','scripting','api'],
};
const DEVOPS_SIG = ['ci/cd','cicd','jenkins','github actions','gitlab ci','argocd','argo cd',
  'helm','slo','error budget','sre','site reliability','devops','microservices','golang',
  'rust','java','spring boot','software development','release engineering','build pipeline'];
const __t = String(d.title || '').toLowerCase();
const title_tier = !d.title ? 'unknown (no title on the row)'
  : PRIMARY_T.test(__t) ? 'primary' : SECONDARY_T.test(__t) ? 'secondary' : 'other';
const __txt = (String(d.title || '') + ' ' + (haveDesc ? description.substring(0, 3000) : '')).toLowerCase();
const __by = {};
let __hits = 0;
for (const [cl, kws] of Object.entries(SKILLS)) {
  __by[cl] = kws.filter(k => kwHit(__txt, k)).length;
  __hits += __by[cl];
}
const __dev = DEVOPS_SIG.filter(k => kwHit(__txt, k)).length;
const skill_overlap = haveDesc
  ? Math.max(0, Math.min(100, Math.round(__hits * 100 / 12) - __dev * 8)) : null;
const skill_clusters = Object.entries(__by).filter(([, n]) => n).sort((a, b) => b[1] - a[1])
  .map(([cl, n]) => `${cl} ${n}`).join(', ') + (__dev ? `; devops signals ${__dev}` : '');

const known = [
  d.title    ? `Title (from the Notion row): "${d.title}"`       : 'Title: not filled in',
  d.company  ? `Company (from the Notion row): "${d.company}"`   : 'Company: not filled in',
  d.location ? `Location (from the Notion row): "${d.location}"` : 'Location: not filled in',
  d.apply_url ? `Posting URL: ${d.apply_url}`                    : 'Posting URL: none given',
  `Title tier: ${title_tier} | Skill overlap: ${skill_overlap === null ? 'unknown (no description)' : skill_overlap + '/100'}`
    + (skill_clusters ? ` (${skill_clusters})` : ''),
].join('\n');

const prompt = `You are an expert technical recruiter and career coach acting as a strict job-match scorer for a specific candidate. Analyze this ONE job and return structured JSON.

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

ABOUT THIS ONE — read carefully, it differs from the scouted feed:
- This job was added BY HAND by the candidate, which means he already has some
  interest in it. Do not treat an unfamiliar company or an unknown source as a
  negative signal on its own.
- It is still scored on exactly the same rubric as the automated feed. Do NOT
  inflate the score because he picked it himself — an honest number is the
  entire reason this column exists.
- If the description below says none could be retrieved, score on title,
  company and location alone, CAP THE SCORE AT 75 because the evidence is
  thin, and say plainly in fit_summary that the description was unavailable.

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

WHAT THE NOTION ROW ALREADY SAYS:
${known}

JOB DESCRIPTION:
${description}

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

Return ONLY a valid JSON object — no markdown fences, no extra text:
{
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
  "cover_letter_hook": "Two to three sentences opening a cover letter, specific to this company and role.",
  "extracted": {
    "title": "the job title exactly as the posting states it, or null if unknown",
    "company": "the hiring company, or null if unknown",
    "location": "location as stated, e.g. Remote (US) or Seattle, WA (Hybrid), or null",
    "salary_min": 140000,
    "salary_max": 170000,
    "posted_date": "date the posting states it went live, as written, or null",
    "is_remote": true
  }
}

Scoring guide: 90-100=perfect fit, 80-89=strong match, 65-79=good candidate, 50-64=stretch, <50=poor fit.
role_type must be one of: SRE, Network Engineer, DevOps, Platform Engineer, Cloud Engineer, Infrastructure Engineer, Other
tags: up to 8 technology/skill tags taken from the job description
resume_tips: 3-5 specific bullets referencing his actual network/infra experience — include confirmed skills not yet on the resume (Meraki, Avaya VoIP, OSPF/MPLS, PCI-DSS, Palo Alto, Fortinet, n8n/Claude AI automation, SolarWinds/Elasticsearch) where they fit
cover_letter_hook: reference the company or role specifically, never generic
extracted: pull these from the DESCRIPTION. Use null — never a guess — for anything the posting does not state. salary_min/salary_max must be plain USD integers with no symbols or separators, or null. If salary is quoted in another currency, convert to USD roughly and note the original currency in red_flags.`;

// Pre-build the Anthropic request body here rather than as an inline
// expression. An n8n expression containing an adjacent "}}" terminates early
// and the node dies with a bare "invalid syntax" - this sidesteps it entirely.
const claude_body = JSON.stringify({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  messages: [{ role: 'user', content: prompt }],
});

return [{ json: { ...d, description_used: description, have_description: haveDesc, claude_body } }];
