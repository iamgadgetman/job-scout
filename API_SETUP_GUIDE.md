# API Setup Guide

This guide walks through obtaining all required API keys and tokens for the n8n Job Scout workflows.

## 1. Google Cloud (Gemini AI)

The workflows use Google's Gemini AI for job scoring.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the "Generative Language API"
4. Go to "APIs & Services" → "Credentials"
5. Click "Create Credentials" → "API Key"
6. Copy your API key

**Note**: New accounts get $300 free credits. Gemini 2.5 Flash is very affordable (~$0.10/day for job scoring).

## 2. Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Name it (e.g., "Job Scout")
4. Select your workspace
5. Under Capabilities, enable:
   - Read content
   - Update content
   - Insert content
6. Copy the Internal Integration Token

### Creating the Job Database

1. Create a new Notion page
2. Add a Database - Full page
3. Add all properties from the README schema
4. Share the database with your integration:
   - Click "..." menu → "Add connections"
   - Select your integration
5. Copy the database ID from the URL:
   - `https://notion.so/YOUR_WORKSPACE/YOUR_DATABASE_ID?v=...`

## 3. RapidAPI Setup

Several job sources use RapidAPI. You need one account with subscriptions to:

1. Go to [RapidAPI](https://rapidapi.com)
2. Create account
3. Subscribe to these APIs (most have free tiers):
   - [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch/)
   - [LinkedIn Job Search](https://rapidapi.com/jaypat87/api/linkedin-job-search/) (optional)
   - [Indeed API](https://rapidapi.com/nubela/api/indeed-api/) (optional)
4. Find your API key in Dashboard → Security → API Keys

## 4. Adzuna API

1. Go to [Adzuna API](https://developer.adzuna.com/)
2. Register for free account
3. Create an app
4. Note your App ID and App Key

## 5. Discord Webhook (Optional)

1. In your Discord server, go to Server Settings
2. Integrations → Webhooks
3. Create New Webhook
4. Copy the webhook URL

## 6. Gmail SMTP

### Option A: App Password (Recommended)
1. Enable 2-factor authentication on your Google account
2. Go to [Google Account Settings](https://myaccount.google.com/security)
3. Security → 2-Step Verification → App passwords
4. Create new app password for "Mail"
5. Use in n8n SMTP credentials:
   - Email: your.email@gmail.com
   - Password: the app password
   - Host: smtp.gmail.com
   - Port: 587
   - Secure: ON

### Option B: Less Secure Apps (Not Recommended)
Only if your account doesn't support app passwords.

## 7. Google Workspace APIs (For Doc Generation)

### Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable these APIs:
   - Google Docs API
   - Google Drive API

### Create OAuth2 Credentials
1. APIs & Services → Credentials
2. Create Credentials → OAuth client ID
3. Application type: Web application
4. Add authorized redirect URI:
   - `https://YOUR-N8N-INSTANCE.com/rest/oauth2-credential/callback`
5. Save Client ID and Client Secret

### Configure in n8n
1. Add new credential → Google Docs OAuth2
2. Enter Client ID and Secret
3. Click "Connect my account"
4. Authorize access

## Free Tier Limits

- **Gemini**: $200/month free (more than enough)
- **RapidAPI JSearch**: 10 requests/month free (need paid plan)
- **Adzuna**: 250 requests/month free
- **Remote OK**: Free, no auth required
- **Remotive**: Free, no auth required
- **The Muse**: Free, rate limited

## Recommended Paid Tiers

For active job searching:
- **JSearch**: Basic plan ($12/month for 1,000 requests)
- **Gemini**: Pay-as-you-go after free credits

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** in n8n when possible
3. **Rotate keys regularly**
4. **Set usage alerts** on paid services
5. **Use separate Google account** for automation

## Testing Your Setup

After configuring all credentials:

1. Test each job source individually:
   - Disable all but one source
   - Run the workflow manually
   - Check for results

2. Test AI scoring:
   - Use the webhook with a small batch
   - Verify scores are reasonable

3. Test Notion integration:
   - Check pages are created
   - Verify all fields populate

4. Test notifications:
   - Confirm emails arrive
   - Check Discord webhooks fire