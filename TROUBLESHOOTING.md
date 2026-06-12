# Troubleshooting Guide

This guide helps diagnose and fix common issues with the job scout workflows.

## Diagnostic Checklist

### 1. No Jobs Found

**Symptom**: Workflows run but return 0 jobs

**Check**:
```bash
# In n8n execution history, look at each job source node
# Check the output - is it empty or error?
```

**Common Causes**:
- **API Key Issues**: Invalid or expired API keys
  - Solution: Test each API individually with curl
- **Rate Limits**: Exceeded API quotas
  - Solution: Check API dashboard for usage
- **Search Too Narrow**: Queries too specific
  - Solution: Broaden search terms temporarily
- **Geographic Limits**: Some APIs don't support all regions
  - Solution: Try without location filters

**Test Individual Sources**:
```javascript
// Disable all source nodes except one
// Run workflow manually
// Check if that source returns data
```

### 2. AI Scoring Failures

**Symptom**: Jobs found but all score 50 (fallback) or execution errors

**Check Parse Scores Output**:
- Look for `error` field in output
- Check if `raw` contains valid JSON
- Verify array length matches input

**Common Causes**:

**A. API Authentication Failed**
```
Error: "Your credit balance is too low"
Error: "Invalid API key"
```
Solution: Check API key and billing

**B. Response Format Changed**
```javascript
// Old: resp.content[0].text
// New: resp.candidates[0].content.parts[0].text
// Check actual response structure
```

**C. Prompt Too Long**
- Gemini has 32k context limit
- Reduce batch size or description length

**D. JSON Parse Errors**
- Model returned markdown fences
- Model truncated response
- Invalid JSON structure

**Debug the Scoring**:
```javascript
// Add logging in Parse Scores node:
console.log('Raw response:', raw.substring(0, 500));
console.log('Array found:', firstBracket, lastBracket);
console.log('Parsed length:', scores.length);
```

### 3. Notion Page Creation Fails

**Symptom**: Jobs scored but no Notion pages created

**Common Errors**:
- `401 Unauthorized` - Token invalid
- `403 Forbidden` - Database not shared with integration
- `400 Bad Request` - Schema mismatch

**Fixes**:

**A. Verify Token**
```bash
curl -X GET https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer YOUR_NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28"
```

**B. Check Database Permissions**
1. Open database in Notion
2. Share → Add your integration
3. Verify integration has full access

**C. Schema Validation**
Required properties:
- Title property named "Job Title"
- All Select/Multi-select options pre-created
- Number fields for Score, Salary Min/Max

### 4. Duplicate Jobs

**Symptom**: Same job appears multiple times

**Check Normalize Node**:
```javascript
// Current dedup key:
const key = `${normalizeTitle(title)}_${normalizeCompany(company)}`;
```

**Improvements**:
```javascript
// Add location to key
const key = `${normalizeTitle(title)}_${normalizeCompany(company)}_${location}`;

// Or use job ID if available
const key = job.job_id || `${title}_${company}`;
```

### 5. Email/Discord Not Working

**Email Issues**:
- Check SMTP credentials
- Verify app password (not regular password)
- Check spam folder
- Try port 465 (SSL) if 587 (TLS) fails

**Discord Issues**:
- Webhook URL must be exact (including token)
- Check server permissions
- Test with curl:
```bash
curl -X POST YOUR_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

### 6. Workflow Execution Issues

**A. Scheduled Workflows Not Running**
- Check workflow is Active
- Verify timezone (n8n uses UTC)
- Check n8n instance timezone settings

**B. Manual Trigger Not Working**
- Webhook path must be unique
- Check n8n base URL configuration
- Verify webhook is registered (restart workflow)

**C. Slow Execution**
- Normal: 30-60s for full run
- Check individual node execution times
- Biggest delays: API calls, AI scoring

### 7. Application Doc Generator Issues

**Symptom**: Jobs stuck in "Applying" status

**Common Causes**:

**A. No Jobs Match Query**
- Status filter too restrictive
- Database view filters hiding records

**B. Google Auth Failed**
- OAuth token expired
- Insufficient scopes
- Solution: Reconnect OAuth in credentials

**C. Document Creation Fails**
- Check Google API quotas
- Verify folder permissions
- Check Drive storage space

## Debug Mode Setup

Add these debug nodes for troubleshooting:

### 1. API Response Logger
```javascript
// Add after each API call
const debugNode = {
  name: "Debug API Response",
  type: "n8n-nodes-base.code",
  parameters: {
    jsCode: `
console.log('API:', $node.name);
console.log('Status:', $response.statusCode);
console.log('Headers:', JSON.stringify($response.headers));
console.log('Body sample:', JSON.stringify($json).substring(0, 500));
return $input.all();
`
  }
};
```

### 2. Execution Monitor
```javascript
// Add at workflow end
const stats = {
  total_sources: $workflow.nodes.filter(n => n.name.includes('Search')).length,
  jobs_found: $('Merge All').first().json.jobs?.length || 0,
  jobs_scored: $('Parse Scores').first().json.jobs?.filter(j => j.score > 0).length || 0,
  notion_created: $('Create Notion Page').first().json.results?.length || 0,
  execution_time: new Date() - $execution.startedAt
};
console.log('Execution Stats:', stats);
```

### 3. Error Catcher
Use n8n's error handling:
1. Add Error Trigger node
2. Connect to notification node
3. Get alerts on failures

## Performance Optimization

### 1. Reduce API Calls
- Cache recurring searches
- Dedupe before API calls
- Batch similar requests

### 2. Optimize AI Scoring
- Batch jobs (5-10 per request)
- Use lighter model for pre-filtering
- Cache scores for duplicate posts

### 3. Parallel Execution
- Source nodes run in parallel
- Use merge nodes efficiently
- Avoid sequential dependencies

## Getting Help

### Logs Location
- n8n logs: Check your instance logs
- Execution data: Workflow → Executions
- Node output: Click node → Output data

### Debug Commands
```bash
# Test n8n connectivity
curl https://YOUR-N8N-INSTANCE/healthz

# Check API endpoints
curl -I https://api.notion.com/v1/users/me
curl -I https://generativelanguage.googleapis.com/v1beta/models

# Verify webhook registration
curl https://YOUR-N8N-INSTANCE/webhook/job-search
```

### Common Log Patterns
```
"Execution started" → "Node started" → "Node finished" → "Execution finished"

Look for:
- "ERROR" - Critical failures
- "TimeoutError" - API timeouts
- "StatusCodeError" - HTTP errors
- "SyntaxError" - JSON parse issues
```