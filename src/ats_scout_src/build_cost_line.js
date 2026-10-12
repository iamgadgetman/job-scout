
// Emit this call's token spend to InfluxDB. Runs as a side branch off the
// Claude node so the scoring pipeline is never gated on a cost write.
// Pricing mirrors scripts/log-ai-cost.sh in the NOLA repo - USD per 1M tokens,
// verified 2026-08-26.
const resp = $input.first().json;
const u = resp.usage || {};

const model        = resp.model || 'claude-haiku-4-5';
const inputTokens  = u.input_tokens  || 0;
const outputTokens = u.output_tokens || 0;
// Present only when the request used prompt caching; absent today, so 0.
const cacheRead    = u.cache_read_input_tokens     || 0;
const cacheWrite   = u.cache_creation_input_tokens || 0;

let inCpm, outCpm;
if      (model.includes('haiku'))    { inCpm =  1.00; outCpm =  5.00; }
else if (model.includes('sonnet-5')) { inCpm =  2.00; outCpm = 10.00; }
else if (model.includes('sonnet'))   { inCpm =  3.00; outCpm = 15.00; }
else if (model.includes('opus'))     { inCpm =  5.00; outCpm = 25.00; }
else if (model.includes('fable'))    { inCpm = 10.00; outCpm = 50.00; }
else                                 { inCpm =  1.00; outCpm =  5.00; }

// tokens * (USD per 1M) lands directly in micro-dollars, which is what the
// dashboard expects - it keeps the field an integer in InfluxDB.
// Cache reads bill at 0.1x the input rate, writes at 1.25x (5-minute TTL).
const micro = Math.round(
  inputTokens  * inCpm  +
  outputTokens * outCpm +
  cacheRead    * inCpm * 0.10 +
  cacheWrite   * inCpm * 1.25
);

// Escape the characters line protocol treats as structure.
const esc = s => String(s).replace(/[ ,=]/g, '\\$&');

const line =
  `ai_cost,workflow=${esc('job-search-ats-scout')},model=${esc(model)} ` +
  `input_tokens=${inputTokens}i,output_tokens=${outputTokens}i,` +
  `cache_read_tokens=${cacheRead}i,cache_write_tokens=${cacheWrite}i,` +
  `cost_microdollars=${micro}i ${Date.now() * 1000000}`;

return [{ json: { line, model, micro } }];
