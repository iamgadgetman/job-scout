#!/bin/bash
mkdir -p fixtures
set -e
gh(){ curl -s --max-time 30 "https://boards-api.greenhouse.io/v1/boards/$1/jobs?content=true" -o "fixtures/gh_$1.json"; }
for t in tailscale grafanalabs cloudflare fastly gitlab datadog elastic coinbase netbrain aviatrix nebius guidepointsecurity coreweave; do gh $t; echo "gh_$t $(stat -c%s fixtures/gh_$t.json)"; done
curl -s --max-time 30 "https://api.ashbyhq.com/posting-api/job-board/WorkOS?includeCompensation=true" -o fixtures/ashby_WorkOS.json; echo "ashby $(stat -c%s fixtures/ashby_WorkOS.json)"
for t in vultr cerebras meter lambda fluidstack snowflake openai; do curl -s --max-time 30 "https://api.ashbyhq.com/posting-api/job-board/$t?includeCompensation=true" -o fixtures/ashby_$t.json; echo "ashby_$t $(stat -c%s fixtures/ashby_$t.json)"; done
curl -s --max-time 30 "https://api.lever.co/v0/postings/wealthfront?mode=json" -o fixtures/lever_wealthfront.json; echo "lever $(stat -c%s fixtures/lever_wealthfront.json)"
curl -s --max-time 30 "https://vantage-point-solutions-inc.breezy.hr/json" -o fixtures/breezy_vps.json; echo "breezy $(stat -c%s fixtures/breezy_vps.json)"
curl -sL --max-time 30 -A "Mozilla/5.0" "https://www.haproxy.com/company/careers" -o fixtures/haproxy.html; echo "haproxy $(stat -c%s fixtures/haproxy.html)"
curl -sL --max-time 30 "https://careers.equinix.com/sitemap.xml" -o fixtures/equinix_sitemap.xml; echo "equinix $(stat -c%s fixtures/equinix_sitemap.xml)"
