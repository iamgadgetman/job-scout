# Troubleshooting

**Start with the failed execution, not a guess.** In n8n, open
**Executions**, pick the red run, and read the error on the node that
failed. Most "the scout is broken" reports turn out to be the email step.

## Run failed

| Symptom | Cause | Fix |
|---|---|---|
| Failed on **Send Gmail** | Gmail rejected the login | Use an app password (not your account password) and port 465 with SSL. Regenerate it if you changed your Google password. |
| Anthropic node: **400** | n8n's Anthropic credential sending the key twice | In the credential, make sure the custom-header option is **off** (`"header": false` in the credential JSON). |
| Anthropic node: **401** | Key revoked or out of credit | Check console.anthropic.com. |
| Anthropic node: **404 model** | Model retired | Update the `model` field in the Claude HTTP nodes and the pricing in *Build Cost Line*. |
| Notion: **400 validation_error** | A property name or type doesn't match | Compare against the table in SETUP.md. Names are case-sensitive. |
| Notion: **404 object_not_found** | Database not shared with the integration | Database `•••` → Connections → add your integration. |
| **Log AI Cost** red | InfluxDB not reachable | The node continues on error, so scoring still worked. Fix the URL/token, or delete the branch. |

## Run succeeded but found nothing

| Symptom | Cause | Fix |
|---|---|---|
| JSearch nodes return 0 jobs every run | The old `/search` endpoint is dead | Use `/search-v2`. It returns `data.jobs` (not `data`), ignores `remote_jobs_only` (use `work_from_home=true`), and takes `radius` in km. Check the `parameters` echo in the response to see which arguments it accepted. A dead endpoint looks like a healthy run that found nothing. |
| Everything filtered out | A hard filter is too tight | Read `filter_stats` on *Normalize + Filter + Dedup*. It counts rejections per reason. |
| Same jobs never come back | Dedup is working | Seen-job keys live in the workflow's static data for 30 days. |
| Local jobs missing | Location string doesn't match your city list | Add the variants you see in the source data to `WA_OK` / `CITY_STATE`. Each entry is pinned to a state. |
| Washington-state jobs that are really in D.C. | JSearch labels some Washington D.C. postings with a Washington-state city | The local filter drops onsite jobs whose text mentions D.C. Keep that guard. |
| ATS target returns 0 | Board token wrong, or company moved ATS | Open its `verify_url` from `scout-targets.yml`. A source-health line in the report flags targets that went quiet. |
| An HTML/sitemap target returns stubs | The careers site served a bot challenge | Don't add per-job fetches for that target; titles from the index or sitemap are enough to filter on. |

## Scores look wrong

- **Every score is high**: the profile still has bracketed placeholders, or
  it claims depth you don't have. The rubric only works if the profile is honest.
- **Scouts and the on-demand scorer disagree**: the profile, rubric or
  tier/skill block has drifted between nodes. See SETUP.md §6.
- **Dev/SRE roles scoring well**: extend `DEV_TITLES` in the Normalize node
  and the "NOT A FIT FOR" section of the prompt.

## Documents / interview prep never appear

- These workflows poll every 10 minutes, and `Applying` scores first, so
  expect about 20 minutes.
- A row stuck in `Applying`: a run died while holding the lock. The lock
  clears itself after 30 minutes.
- `Score Failed`: the scoring call failed or its reply couldn't be parsed.
  The status change stops it retrying forever. Postings behind a login
  (Workday, LinkedIn) scrape badly; paste the job description into the
  Notion page body, since page text takes priority over the scrape. Then
  set `Score Me` again.

## Editing safely

The `src/` copies are the readable source of the Code nodes. Edit there, run
the harness, then paste into n8n. If you change a node in the n8n UI, copy the
change back to `src/`, or the next paste will overwrite it.
