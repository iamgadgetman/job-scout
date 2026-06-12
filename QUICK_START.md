# Quick Start Guide

Get the job scout workflows running in under 30 minutes.

## Prerequisites Checklist

- [ ] n8n instance running (cloud or self-hosted)
- [ ] Google account (for Gemini AI)
- [ ] Notion account with workspace
- [ ] Email account with SMTP access

## Step 1: Minimal Setup (15 min)

### 1.1 Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API key"
3. Copy the key

### 1.2 Create Notion Integration
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. New integration → Name it "Job Scout"
3. Copy the token

### 1.3 Create Job Database
1. Duplicate [this template](https://www.notion.so/) OR
2. Create new database with these minimum fields:
   - Job Title (Title)
   - Company (Text)
   - Score (Number)
   - Status (Select: New, Reviewing, Applied)
   - Apply URL (URL)

### 1.4 Setup Email
Use your existing email's app password:
- Gmail: Settings → Security → App passwords
- Outlook: Similar process

## Step 2: Import Workflows (5 min)

1. Download the workflow files
2. In n8n: Workflows → Import
3. Import only: `job-search-daily-scout.json`
4. Don't activate yet!

## Step 3: Quick Configuration (10 min)

### 3.1 Replace Placeholders

In the imported workflow, find and replace:
1. `YOUR_GOOGLE_API_KEY` → Your Gemini key
2. `YOUR_NOTION_TOKEN` → Your Notion token
3. `YOUR_NOTION_DATABASE_ID` → Your database ID
4. `your.email@example.com` → Your email

### 3.2 Disable Extra Sources

For quick start, disable all but one job source:
1. Keep only "JSearch - SRE" node active
2. Disconnect other search nodes from merge
3. This limits API requirements

### 3.3 Update Your Profile

In "Format Claude Prompt" node, quick profile:
```javascript
CANDIDATE PROFILE — [Your Name]
- Location: Remote-only, [Your State/Country]
- Experience: [X] years in [Your Field]
- Current Role: [Your Title]
- Skills: [List 5-10 key skills]
- Salary: $[XXX]k minimum
- Hard dealbreakers: [List 2-3]

TARGET ROLES:
[List 3-5 job titles you want]
```

## Step 4: Test Run (5 min)

### 4.1 Manual Test
1. Activate the workflow
2. Open webhook URL: `https://your-n8n.com/webhook/job-search`
3. Should complete in 30-60 seconds

### 4.2 Check Results
1. Execution history → See if green
2. Notion database → See if jobs added
3. Email → Check for summary

## Step 5: Full Setup (Optional)

Once basic flow works:

### Add More Job Sources
1. Get free APIs:
   - Remotive: No auth needed
   - Remote OK: No auth needed
   - Adzuna: Free tier available

2. Get paid APIs (if needed):
   - RapidAPI for JSearch
   - Others as desired

### Add Other Workflows
1. Dream Scout: For senior roles
2. Apply Nudge: Daily reminders
3. Doc Generator: Auto-generate applications

### Enable Notifications
1. Discord webhook for instant alerts
2. Adjust email templates
3. Set scheduling (after testing)

## Minimal Cost Operation

Run everything for <$5/month:

1. **Gemini**: ~$3/month for daily searches
2. **n8n**: Self-host on $5 VPS or use free tier
3. **APIs**: Use only free sources
4. **Notion**: Free plan works

## Common First-Run Issues

### "No jobs found"
- Normal if searches are specific
- Try broader search terms
- Check API responses in execution

### "All scores are 50"
- AI parsing failed
- Check Parse Scores node output
- Verify prompt format intact

### "No Notion pages"
- Check database is shared with integration
- Verify all required properties exist
- Look for errors in execution

### "Email not received"
- Check SMTP settings
- Try port 465 instead of 587
- Check spam folder

## Next Steps

1. **Day 1**: Run manually, tune searches
2. **Day 2**: Adjust profile based on results
3. **Day 3**: Enable scheduling
4. **Week 1**: Add more sources
5. **Week 2**: Enable doc generation

## Quick Wins

- Start with broad searches
- Filter in Notion (not in search)
- Review scores weekly
- Adjust profile based on results
- Track which sources work best

## Support Resources

- n8n Community: https://community.n8n.io
- n8n Docs: https://docs.n8n.io
- This repo's issues: [GitHub Issues]

## Ready for Production?

Once running smoothly:
- [ ] Enable all job sources
- [ ] Set up scheduled runs
- [ ] Add Dream Scout workflow
- [ ] Configure doc generation
- [ ] Set up monitoring alerts

Remember: Start simple, expand gradually!