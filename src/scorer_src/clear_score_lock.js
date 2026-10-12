// Release this page's scoring lock so a retry is possible if he ever sets
// Status back to "Score Me". Mirrors the docs branch's Clear Lock, but on
// the `scoring` key so the two never interfere.
const state  = $getWorkflowStaticData('global');
const pageId = $('Pick One Page').first().json.id;
const locks  = state.scoring || {};
delete locks[pageId];
state.scoring = locks;
return [{ json: { cleared: pageId } }];
