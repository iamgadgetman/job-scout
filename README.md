# n8n Job Scout Workflow Suite

A comprehensive job search automation system built with n8n that automatically finds, scores, and tracks job opportunities. This suite includes AI-powered job matching, automated application document generation, and integration with Notion for tracking.

## Overview

This system consists of 5 interconnected workflows:

1. **Job Search - Daily Scout**: Runs daily at 7AM, searches multiple job boards, AI-scores matches, and saves to Notion
2. **Job Search - Dream Scout**: Runs daily at 8AM, targets senior/staff-level positions with stricter filtering
3. **Job Apply From URL**: On-demand workflow to generate application documents from a job URL
4. **Job Application Doc Generator**: Monitors Notion for jobs marked "Applying" and auto-generates resumes/cover letters
5. **Job Scout - Apply Nudge**: Daily reminder of new high-scoring jobs to review

## Features

- **Multi-source job aggregation** from 8+ job boards (LinkedIn, Indeed, JSearch, Adzuna, Remote OK, Remotive, The Muse)
- **AI-powered scoring** using Gemini AI to evaluate job fit (0-100 score)
- **Personalized matching** based on your skills, experience, and preferences
- **Automatic document generation** with tailored resumes and cover letters
- **Notion database integration** for comprehensive job tracking
- **Discord notifications** for high-priority matches
- **Email summaries** with daily job reports

## Prerequisites

### Required Accounts & API Keys

1. **n8n instance** (self-hosted or cloud)
2. **Notion account** with:
   - Integration token with database access
   - A job tracking database (schema provided below)
3. **Google Cloud account** with:
   - Gemini API enabled (`generativelanguage.googleapis.com`)
   - API key with Gemini access
4. **RapidAPI account** with subscriptions to:
   - JSearch API
   - LinkedIn Job Search API (optional)
   - Indeed API (optional)
5. **Adzuna account** for their job API (free tier available)
6. **Gmail account** with SMTP access (for email notifications)
7. **Discord webhook** (optional, for instant notifications)
8. **Google Workspace** (optional, for doc generation):
   - Google Docs API access
   - Google Drive API access

### Notion Database Schema

Create a Notion database with these properties:

| Property Name | Type | Configuration |
|--------------|------|---------------|
| Job Title | Title | Primary field |
| Company | Text | |
| Source | Select | Options: JSearch, LinkedIn, Indeed, Adzuna, Remote OK, Remotive, The Muse |
| Apply URL | URL | |
| Location | Text | |
| Salary Min | Number | |
| Salary Max | Number | |
| Score | Number | 0-100 |
| Fit Summary | Text | |
| Missing Skills | Text | |
| Red Flags | Text | |
| Tags | Multi-select | Auto-populated with tech stack |
| Role Type | Select | Options: SRE, Network Engineer, DevOps, Platform Engineer, Cloud Engineer, Infrastructure Engineer, Other |
| Priority | Select | Options: Low, Medium, High |
| Resume Tips | Text | |
| Cover Letter Draft | Text | |
| Status | Select | Options: New, Reviewing, Applying, Applied, Rejected |
| Date Found | Date | |
| Posted Date | Text | |
| Job ID | Text | |

## Installation

### 1. Import Workflows

1. In your n8n instance, go to Workflows → Import
2. Import each JSON file in order:
   - `job-search-daily-scout.json`
   - `job-search-dream-scout.json`
   - `job-apply-from-url.json`
   - `job-application-doc-generator.json`
   - `job-scout-apply-nudge.json`

### 2. Configure Credentials

Each workflow requires credentials to be configured in n8n:

#### Required for Job Search workflows:
- **Gemini API**: Create HTTP Header Auth credential
  - Header Name: `x-goog-api-key`
  - Header Value: Your Google API key
- **Notion API**: Create Notion API credential with your integration token
- **Gmail SMTP**: Configure with your Gmail app password
- **RapidAPI**: Create HTTP Header Auth credential
  - Header Name: `X-RapidAPI-Key`
  - Header Value: Your RapidAPI key

#### Additional for Doc Generation:
- **Google Docs OAuth2**: For creating documents
- **Google Drive OAuth2**: For organizing documents
- **Anthropic API** (optional): If using Claude instead of Gemini

### 3. Update Configuration

Replace these placeholders in the workflows:

1. **API Keys & Tokens**:
   - `YOUR_GOOGLE_API_KEY` → Your Gemini API key
   - `YOUR_RAPIDAPI_KEY` → Your RapidAPI key
   - `YOUR_NOTION_TOKEN` → Your Notion integration token
   - `YOUR_ADZUNA_APP_ID` → Your Adzuna app ID
   - `YOUR_ADZUNA_APP_KEY` → Your Adzuna app key
   - `YOUR_DISCORD_WEBHOOK_ID/YOUR_DISCORD_WEBHOOK_TOKEN` → Your Discord webhook URL

2. **Database & Emails**:
   - `YOUR_NOTION_DATABASE_ID` → Your Notion job tracking database ID
   - `your.email@example.com` → Your email address

### 4. Customize Your Profile

The most important customization is in the **Format Claude Prompt** node of both Scout workflows. Update the CANDIDATE PROFILE section with your:

- Location and remote preferences
- Years of experience
- Current role and company
- Skills (expert, strong, developing)
- Certifications
- Salary requirements
- Deal breakers

Example profile structure:
```javascript
const prompt = `You are a job match scorer for a specific candidate. Analyze each job and return structured JSON.

CANDIDATE PROFILE — [Your Name]
- Location: [Your location/remote preferences]
- Experience: [Years] in [domains]
- Current Role: [Title] at [Company]
  • [Key responsibility 1]
  • [Key responsibility 2]

- STRONG / EXPERT skills:
  • [Skill category]: [specific skills]
  • [Another category]: [specific skills]

- LIMITED / DEVELOPING:
  • [Skills you're learning]

- Certifications: [Your certs]
- Salary: $[XXX]k minimum
- Hard dealbreakers: [Your dealbreakers]

TARGET ROLES (good fit):
[List roles that match your goals]

NOT A FIT FOR:
[List roles to filter out]
`;
```

### 5. Adjust Search Queries

Modify the search queries in each job source node to match your target roles:

- **Daily Scout**: Broader searches for your general field
- **Dream Scout**: Narrow searches for senior/staff positions

## Usage

### Daily Operation

1. **Automatic Runs**:
   - Daily Scout runs at 7AM (cron: `0 14 * * *` UTC)
   - Dream Scout runs at 8AM (cron: `0 15 * * *` UTC)
   - Apply Nudge runs at 5PM (cron: `0 0 * * *` UTC)

2. **Manual Triggers**:
   - Daily Scout: `GET https://your-n8n.com/webhook/job-search`
   - Dream Scout: `GET https://your-n8n.com/webhook/dream-job-search`
   - Apply from URL: `POST https://your-n8n.com/webhook/apply-url` with `{"url": "job-link"}`

### Workflow Details

#### Job Search - Daily Scout
- Searches 8 job boards with network/infrastructure/SRE queries
- Normalizes and deduplicates results
- Sends batch to AI for scoring (0-100)
- Filters out jobs scoring <45
- Creates Notion pages for matches
- Sends email summary and Discord alerts

#### Job Search - Dream Scout
- Targets senior/staff/lead positions
- More selective queries and filtering
- Only creates Notion pages if high-quality matches found
- Separate email report for dream jobs

#### Job Application Doc Generator
- Polls Notion every 10 minutes for jobs marked "Applying"
- Fetches full job description
- Generates tailored resume and cover letter
- Creates Google Docs and organizes in Drive
- Updates Notion with doc links and status

## Customization

### Adding Job Sources

To add a new job board:
1. Add an HTTP Request node with the API call
2. Connect it to the appropriate Merge node
3. Update the Normalize node to handle the new format

### Adjusting AI Scoring

The scoring logic is in the Format Prompt nodes. You can adjust:
- Automatic disqualifiers (score ≤20)
- Penalties for missing requirements
- Bonuses for preferred skills
- Score thresholds

### Notification Preferences

- **Email**: Configure in Send Gmail nodes
- **Discord**: Update webhook URLs or remove Discord nodes
- **Notion only**: Remove email/Discord nodes entirely

## Architecture

See [WORKFLOW_DIAGRAMS.md](WORKFLOW_DIAGRAMS.md) for detailed visual representations of each workflow.

### Quick Overview

- **Job Sources**: 8+ APIs (LinkedIn, Indeed, JSearch, Adzuna, Remote OK, Remotive, The Muse)
- **Daily Scout**: Runs at 7AM, broad search, scores all jobs, filters >45
- **Dream Scout**: Runs at 8AM, targeted senior roles, filters >80
- **Doc Generator**: Every 10 min, monitors for "Applying" status
- **Apply Nudge**: Daily 5PM reminder of new high-scoring jobs
- **Central Storage**: Notion database tracks all jobs and applications

## Troubleshooting

### Common Issues

1. **No jobs found**:
   - Check API keys are valid
   - Verify search queries aren't too restrictive
   - Some sources may have rate limits

2. **AI scoring fails**:
   - Verify Gemini API key and quota
   - Check the prompt format hasn't been corrupted
   - Fallback: scores default to 50 if parsing fails

3. **Notion pages not created**:
   - Verify Notion token permissions
   - Check database ID is correct
   - Ensure all required properties exist

4. **Duplicate jobs**:
   - The dedup logic uses title+company
   - Adjust in the Normalize node if needed

### Monitoring

- Check n8n execution history for failures
- Monitor email reports for quality
- Review Notion database weekly
- Track API usage and costs

## Cost Estimates

Based on typical usage:
- **Gemini API**: ~$0.10-0.50/day (depending on job volume)
- **RapidAPI**: Varies by subscription
- **Adzuna**: Free tier usually sufficient
- **Other services**: Minimal/free

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is provided as-is for educational and personal use.

## Acknowledgments

Built with n8n, powered by various job APIs and AI services.