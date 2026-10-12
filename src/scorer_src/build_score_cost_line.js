// Emit this scoring call's token spend to InfluxDB. Side branch off the
// Claude node so the pipeline is never gated on a cost write. Pricing mirrors
// the docs branch's Build Cost Line - USD per 1M tokens.
const resp = $input.first().json;
const u = resp.usage || {};

const model        = resp.model || 'unknown';
const inputTokens  = u.input_tokens  || 0;
const outputTokens = u.output_tokens || 0;
const cacheRead    = u.cache_read_input_tokens     || 0;
const cacheWrite   = u.cache_creation_input_tokens || 0;

let inCpm, outCpm;
if      (model.includes('haiku'))    { inCpm =  1.00; outCpm =  5.00; }
else if (model.includes('sonnet-5')) { inCpm =  2.00; outCpm = 10.00; }
else if (model.includes('sonnet'))   { inCpm =  3.00; outCpm = 15.00; }
else if (model.includes('opus'))     { inCpm =  5.00; outCpm = 25.00; }
else if (model.includes('fable'))    { inCpm = 10.00; outCpm = 50.00; }
else                                 { inCpm =  1.00; outCpm =  5.00; }

// This branch sends no cache_control, so the write premium is not applied.
const micro = Math.round(
  inputTokens * inCpm + outputTokens * outCpm + cacheRead * inCpm * 0.10
);

const esc = s => String(s).replace(/[ ,=]/g, '\\$&');

const line =
  `ai_cost,workflow=${esc('job-scorer-on-demand')},model=${esc(model)} ` +
  `input_tokens=${inputTokens}i,output_tokens=${outputTokens}i,` +
  `cache_read_tokens=${cacheRead}i,cache_write_tokens=${cacheWrite}i,` +
  `cost_microdollars=${micro}i ${Date.now() * 1000000}`;

return [{ json: { line, model, micro } }];
