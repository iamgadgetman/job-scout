// Release the lock so clearing the Interview Prep cell can regenerate later.
const state  = $getWorkflowStaticData('global');
const pageId = $('Pick One Interview').first().json.id;
const locks  = state.prepping || {};
delete locks[pageId];
state.prepping = locks;
return [{ json: { cleared: pageId } }];
