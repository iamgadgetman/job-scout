# Migration Guide: Anthropic to Gemini

This guide documents the migration from Anthropic's Claude API to Google's Gemini API for the job scoring nodes. This change was implemented to reduce costs and avoid API credit exhaustion.

## Why Migrate?

- **Cost**: Gemini 2.5 Flash is significantly cheaper than Claude Haiku
- **Reliability**: No risk of account credits running out
- **Performance**: Similar quality for structured JSON tasks
- **Latency**: Comparable response times (5-8s per batch)

## What Changed

### API Endpoint
- **Old**: `https://api.anthropic.com/v1/messages`
- **New**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`

### Authentication
- **Old**: Header `x-api-key: sk-ant-...`
- **New**: Header `x-goog-api-key: AIza...`

### Request Body Format
- **Old**: Anthropic messages format
  ```json
  {
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 8096,
    "messages": [{"role": "user", "content": "..."}]
  }
  ```
- **New**: Gemini contents format
  ```json
  {
    "contents": [{
      "parts": [{
        "text": "..."
      }]
    }],
    "generationConfig": {
      "temperature": 0.2,
      "responseMimeType": "application/json"
    }
  }
  ```

### Response Parsing
- **Old**: `response.content[0].text`
- **New**: `response.candidates[0].content.parts[0].text`

## Step-by-Step Migration

### 1. Update the HTTP Request Node

In both Daily Scout and Dream Scout workflows:

1. Find the "Claude AI Score" node
2. Change URL to Gemini endpoint
3. Update headers:
   - Remove: `anthropic-version`
   - Remove: `x-api-key`
   - Add: `x-goog-api-key` with your Google API key
4. Change body expression to:
   ```javascript
   {{
     JSON.stringify({
       contents: [{
         parts: [{
           text: ($json.prompt || 'Score 0 jobs: []')
         }]
       }],
       generationConfig: {
         temperature: 0.2,
         responseMimeType: 'application/json'
       }
     })
   }}
   ```

### 2. Update Parse Scores Node

Change the response extraction line:
```javascript
// Old
const raw = resp.content[0].text;

// New
const raw = resp.candidates[0].content.parts[0].text;
```

### 3. Clean Up Authentication

Remove these fields from the node if present:
- `parameters.authentication`
- `parameters.nodeCredentialType`
- `credentials` block

## Model Selection

Tested models and results:

| Model | Cost | Quality | Speed | Recommendation |
|-------|------|---------|--------|----------------|
| gemini-2.5-flash-lite | Lowest | Good | Fast | ✅ Recommended |
| gemini-2.5-flash | Low | Excellent | Fast | For higher accuracy |
| gemini-2.5-pro | High | Best | Slower | Overkill for this use |
| qwen2.5:7b (local) | Free | Poor | Fast | ❌ Failed quality tests |

## Validation Testing

Before deploying, test the migration:

### 1. Single Job Test
```javascript
// Test payload
const testPrompt = `[Your full prompt template here]

JOBS TO EVALUATE:
1. Title: "Senior Network Engineer" | Company: "TechCorp" | Salary: $150,000-$180,000 | Source: JSearch
Description: Seeking experienced network engineer with BGP, MPLS, firewall experience...`;

// Expected output structure
[{
  "index": 1,
  "score": 85,
  "fit_summary": "...",
  "missing_skills": "...",
  "red_flags": "None",
  "tags": ["BGP", "MPLS", "Firewalls"],
  "role_type": "Network Engineer",
  "resume_tips": ["..."],
  "cover_letter_hook": "..."
}]
```

### 2. Batch Test
Include 3+ jobs with mixed fit levels:
- One perfect match (expect 80+)
- One partial match (expect 50-70)
- One poor match (expect <45)

### 3. Quality Gates
Verify:
- ✅ Returns all jobs (no truncation)
- ✅ Correctly identifies poor matches
- ✅ Follows scoring rules
- ✅ Generates valid JSON

## Rollback Plan

If issues occur:

1. **Immediate**: Change endpoint back to Anthropic
2. **Fix parse node**: Revert to `resp.content[0].text`
3. **Re-add auth**: Add back the Anthropic credential

Keep the original workflow exported as backup before changes.

## Common Issues

### "Invalid API key"
- Verify Google Cloud project has API enabled
- Check key restrictions match your IP/referrer

### "Quota exceeded"
- Enable billing on Google Cloud project
- Check daily quotas in console

### Parse errors
- Gemini sometimes wraps output as `{"jobs": [...]}`
- The slice logic `substring(firstBracket, lastBracket+1)` handles this

### Different scores than Claude
- Adjust temperature (lower = more consistent)
- Test prompt variations if needed
- Consider gemini-2.5-flash for higher quality

## Cost Comparison

For ~100 jobs/day:

| Provider | Model | Cost/day | Cost/month |
|----------|-------|----------|------------|
| Anthropic | Claude Haiku | ~$0.40 | ~$12 |
| Google | Gemini Flash Lite | ~$0.10 | ~$3 |
| Google | Gemini Flash | ~$0.20 | ~$6 |

## Future Considerations

1. **Local Models**: When stronger open models arrive (14B+ with good JSON), revisit local hosting
2. **Other Providers**: OpenAI GPT-4o-mini is comparable in cost/quality
3. **Caching**: Implement result caching for duplicate job posts