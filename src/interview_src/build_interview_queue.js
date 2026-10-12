// One item per Notion board so a single credentialed HTTP node queries all
// three. Not a Merge - n8n Merge v3 silently drops input ports past idx 1.
const DBS = [
  { db_id: 'YOUR_NOTION_DB_MAIN', board: 'Jobs' },
  { db_id: 'YOUR_NOTION_DB_CLOUD', board: 'Cloud Networking' },
  { db_id: 'YOUR_NOTION_DB_SECURITY', board: 'Network Security' },
];
return DBS.map(d => ({ json: d }));
