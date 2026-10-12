// Token spend for the prep call, mirroring the other two workflows.
const resp = $input.first().json;
const u = resp.usage || {};
const model = resp.model || 'unknown';
const i = u.input_tokens || 0, o = u.output_tokens || 0;
const cr = u.cache_read_input_tokens || 0, cw = u.cache_creation_input_tokens || 0;

let inCpm, outCpm;
if      (model.includes('haiku'))    { inCpm =  1.00; outCpm =  5.00; }
else if (model.includes('sonnet-5')) { inCpm =  2.00; outCpm = 10.00; }
else if (model.includes('sonnet'))   { inCpm =  3.00; outCpm = 15.00; }
else if (model.includes('opus'))     { inCpm =  5.00; outCpm = 25.00; }
else if (model.includes('fable'))    { inCpm = 10.00; outCpm = 50.00; }
else                                 { inCpm =  1.00; outCpm =  5.00; }

const micro = Math.round(i * inCpm + o * outCpm + cr * inCpm * 0.10);
const esc = s => String(s).replace(/[ ,=]/g, '\\$&');
const line = `ai_cost,workflow=${esc('job-interview-prep')},model=${esc(model)} ` +
  `input_tokens=${i}i,output_tokens=${o}i,cache_read_tokens=${cr}i,` +
  `cache_write_tokens=${cw}i,cost_microdollars=${micro}i ${Date.now() * 1000000}`;
return [{ json: { line, model, micro } }];
