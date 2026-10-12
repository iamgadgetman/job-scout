// Fan out one item per Notion board so a single credentialed HTTP node can
// query all three. A Code node cannot use n8n credentials - that is why the
// legacy "Query Applying Jobs" node hardcodes a Notion token. This branch
// does not, and must not.
//
// Deliberately NOT a Merge: n8n Merge v3 silently ignores input ports past
// idx 1, which has cost this pipeline a 10-day silent outage before.
const DBS = [
  { db_id: 'YOUR_NOTION_DB_MAIN', board: 'Jobs' },
  { db_id: 'YOUR_NOTION_DB_CLOUD', board: 'Cloud Networking' },
  { db_id: 'YOUR_NOTION_DB_SECURITY', board: 'Network Security' },
];

return DBS.map(d => ({ json: d }));
