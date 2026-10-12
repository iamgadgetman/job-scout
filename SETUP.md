# Setup

Allow about an hour. Start with one scout end to end (step 7), then turn the
rest on.

## 1. Accounts and keys

| Service | What you need | Used by |
|---|---|---|
| [Anthropic](https://console.anthropic.com) | API key | every workflow that scores or writes |
| [Notion](https://www.notion.so/my-integrations) | Internal integration token, shared with each job database | all |
| [RapidAPI](https://rapidapi.com) | Key subscribed to **JSearch**; optional: LinkedIn Job Search, Indeed | Daily, Dream, Cloud, Security |
| [Adzuna](https://developer.adzuna.com) | App ID + app key | Daily, Dream, Cloud, Security |
| Gmail | An [app password](https://myaccount.google.com/apppasswords) for SMTP | scout email reports |
| Discord | A channel webhook URL | alerts (optional) |
| Google Cloud | OAuth client with the Docs and Drive APIs enabled | Doc Generator, Apply From URL, Interview Prep |
| InfluxDB 2.x | Write token for an `ai_cost` bucket | cost logging (optional) |

## 2. Notion databases

Create one database for the main feed. The Cloud and Security lanes each
write to their own database with the same columns; if you don't want them,
point all three placeholders at the one database.

Property names must match **exactly**, including case. Select options are created automatically the first time a workflow writes them.

| Property | Type | Notes |
|---|---|---|
| Job Title | Title | |
| Company | Text | |
| Status | Select | `New`, `Score Me`, `Applying`, `Docs Ready`, `Applied`, `Interviewing`, `Rejected`, `Score Failed` |
| Score | Number | 0-100 |
| Apply URL | URL | |
| Source | Select | |
| Location | Text | |
| City | Text | |
| Work Mode | Select | `Remote`, `Hybrid`, `On-site` |
| Salary Min | Number | |
| Salary Max | Number | |
| Fit Summary | Text | |
| Missing Skills | Text | |
| Red Flags | Text | |
| Tags | Multi-select | |
| Role Type | Select | |
| Priority | Select | `High`, `Medium`, `Low` |
| Resume Tips | Text | |
| Cover Letter Draft | Text | |
| Employer Size | Text | |
| Remote History | Text | |
| Drug Test Flag | Select | `Yes`, `No` |
| Dream Job | Checkbox | |
| Date Found | Date | |
| Posted Date | Text | |
| Job ID | Text | |
| Drive Folder | URL | set by the Doc Generator |
| Interview Prep | URL | set by Interview Prep |

Share each database with your integration (`•••` → **Connections**). The
database ID is the 32-character hex string in its URL.

## 3. Import the workflows

In n8n: **Workflows → Import from File**, once for each file in `workflows/`.
They import **inactive**. Leave them that way until step 6.

## 4. Credentials

Create these in n8n (**Credentials → New**), then open each workflow and
select them on any node showing a credential warning. The names below are what
the exports reference; matching them saves some clicking.

| Credential name | Type | Settings |
|---|---|---|
| Anthropic (Claude) | Anthropic | API key. If requests fail with HTTP 400, see TROUBLESHOOTING. |
| Notion (Job Scout) | Notion API | integration token |
| RapidAPI Key (job scouts) | Header Auth | name `X-RapidAPI-Key`, value your key |
| Adzuna app_key (job scouts) | Query Auth | name `app_key`, value your key |
| Discord Webhook - Job Scout | Discord Webhook | webhook URL |
| Gmail SMTP | SMTP | `smtp.gmail.com`, port 465, SSL, your address + app password |
| Google Docs account | Google Docs OAuth2 | |
| Google Drive account | Google Drive OAuth2 | |
| InfluxDB ai_cost writer | Header Auth | name `Authorization`, value `Token <your token>` |

## 5. Replace the placeholders

The Cloud and Security lanes read every key from credentials. The older
workflows still have a few values inline. Search each workflow for `YOUR_`;
here is everything that needs a value:

| Placeholder | Replace with | Where |
|---|---|---|
| `YOUR_NOTION_DB_MAIN` / `_CLOUD` / `_SECURITY` | database IDs from step 2 | Prepare Notion Body, Query nodes, List Notion Boards |
| `YOUR_NOTION_DB_URL` | full URL of the database, for report links | Build Reports, Format Nudge Message |
| `YOUR_NOTION_TOKEN` | Notion integration token | Code nodes in Doc Generator and Apply Nudge that query Notion directly |
| `YOUR_RAPIDAPI_KEY` | RapidAPI key | HTTP header on Daily and Dream source nodes |
| `YOUR_ADZUNA_APP_ID` / `YOUR_ADZUNA_APP_KEY` | Adzuna values | Adzuna Search nodes |
| `YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN` | the two parts of your Discord webhook URL | Discord HTTP nodes |
| `YOUR_DRIVE_FOLDER_ID` | Drive folder that holds application folders | Create App Folder, Extract Interview Context |
| `YOUR_INFLUXDB_HOST`, `YOUR_ORG` | InfluxDB host and org | Log AI Cost nodes. To skip cost logging, delete the Build Cost Line → Log AI Cost branch. |
| `you@example.com` | your address | Send Gmail nodes |

Placeholders inside Code nodes are plain string constants near the top of
the node.

## 6. Make it yours

Every scoring prompt contains a `CANDIDATE PROFILE — Your Name` block with
bracketed fields. Fill it in honestly: say what you know only conceptually as
well as what you are expert in. The rubric relies on that to keep scores
realistic.

| What | Workflow → node |
|---|---|
| Candidate profile + rubric | Daily, ATS, Cloud, Security → **Format Claude Prompt**; Doc Generator → **Build Score Prompt**; Interview Prep → **Build Interview Prompt** |
| Dream-job definition | Dream Scout → **Format Dream Prompt** |
| Base resume | Doc Generator → **Resume Content**; Apply From URL → **Build Apply Prompt** |
| Resume header / signature | Doc Generator → **Parse Docs**; Apply From URL → **Parse Apply Docs** |
| Title tiers + skill clusters (pre-score) | Daily → **Normalize + Filter + Dedup**; ATS → **Normalize ATS**; Doc Generator → **Build Score Prompt** (`PRIMARY_T`, `SECONDARY_T`, `SKILLS`) |
| Local cities | `WA_OK` / `CITY_STATE` in each Normalize node; Daily → **Local WA Queries**; Cloud → **Local Search Queries** |
| Search queries | the source HTTP nodes on each scout |
| ATS companies | ATS Scout → **Build Target List** (`TARGETS`), mirrored in `scout-targets.yml` |
| Score threshold | `THRESHOLD` in Prepare Notion Body / Build Reports (default 70) |

The location filter ships with placeholder names: `Your City`,
`Nearby City A/B/C`, `Nearby Town 1-12`, and the state code. Each city is
pinned to a state, so that a same-named city elsewhere doesn't pass.

**The profile, rubric and tier/skill blocks are copied into several nodes.**
Keep the copies in step: a change in one scout and not the others puts them on
different score scales.

## 7. First run

1. Open **Job Search - Daily Scout** and click **Execute Workflow**.
2. Read each node's output. Check the source nodes return jobs, and that
   *Normalize + Filter + Dedup* reports sensible `filter_stats`.
3. Confirm *Parse Scores* produced JSON and that rows appear in Notion.
4. Fix anything red, then toggle the workflow **Active**.
5. Repeat for the other scouts. Then activate Doc Generator and Interview
   Prep, and test them by setting a row's Status to `Score Me`,
   `Applying` or `Interviewing`. Each polls every 10 minutes.

## Using it day to day

- **Scouted jobs** arrive in Notion as `New` and in the email/Discord report.
- **A job you found yourself**: create a row, paste the link into
  *Apply URL*, and set Status to `Score Me` (score only) or `Applying`
  (score, then documents). A row that already has a Score is never re-scored;
  clear the Score cell to force a re-score.
- **Documents**: `Applying` → about 20 minutes later the row is
  `Docs Ready` with a *Drive Folder* link.
- **Interviews**: `Interviewing` → a prep sheet appears in the same folder and
  is linked in *Interview Prep*. Clear that cell to regenerate it.
- **Straight from a URL**:
  `https://<your-n8n>/webhook/apply-url?url=<job posting URL>`.
- **ATS Scout suppressions**: record roles you have applied to under
  `applied:` in `scout-targets.yml` (format in the file header), then add
  them to `SUPPRESSIONS` in *Build Target List*.
