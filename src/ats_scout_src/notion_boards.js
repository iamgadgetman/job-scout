// The three Notion databases Prepare Notion Body routes into. Listing them as
// items fans the next node out into one query per board.
// Kept in sync with routeDb() in prepare_notion_body.js.
return [
  { json: { db: 'YOUR_NOTION_DB_MAIN', label: 'Jobs (default)' } },
  { json: { db: 'YOUR_NOTION_DB_SECURITY', label: 'Network Security' } },
  { json: { db: 'YOUR_NOTION_DB_CLOUD', label: 'Cloud Networking' } },
];
