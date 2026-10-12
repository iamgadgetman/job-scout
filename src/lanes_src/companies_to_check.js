// One item per on-site/hybrid employer that needs a remote-history lookup.
const { lookups } = $input.first().json;
return lookups.map(company => ({ json: { company, query: `${company} remote` } }));
