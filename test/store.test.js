import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, load, normalize, replace, STORAGE_KEY, update } from '../src/store.js';

test('backup normalization keeps completion dates, schedule revisions, and settings', () => {
  const backup=emptyState();
  backup.activities.push({id:'a',name:'Read',createdOn:'2026-09-01',deletedOn:'',schedule:[{from:'2026-09-01',days:[1,3,5],paused:false}],reminderEnabled:true,reminderTime:'09:30'});
  backup.activityHistory.a={'2026-09-30':true,'bad-date':true};
  backup.todos.push({id:'t',title:'Call',createdOn:'2026-09-30',dueDate:'2026-09-30',completedOn:'2026-09-30',deletedOn:'',priority:'high'});
  backup.settings.theme='dark';
  const restored=normalize(backup);
  assert.deepEqual(restored.activityHistory.a,{'2026-09-30':true});
  assert.deepEqual(restored.activities[0].schedule[0].days,[1,3,5]);
  assert.equal(restored.todos[0].completedOn,'2026-09-30');
  assert.equal(restored.settings.theme,'dark');
});

test('unsupported backup schema is rejected', () => {
  assert.throws(()=>normalize({version:2,activities:[],todos:[],timetable:[]}),/not a Daymark version 1 backup/);
});

test('older weekday time blocks become repeating daily blocks without losing content', () => {
  const backup = emptyState();
  backup.timetable.push({id:'block-1',title:'Deep work',notes:'Project work',day:2,start:'09:00',end:'10:30',linkType:'activity',linkId:'a'});
  const [block] = normalize(backup).timetable;
  assert.deepEqual(block,{id:'block-1',title:'Deep work',notes:'Project work',start:'09:00',end:'10:30',linkType:'activity',linkId:'a'});
});

test('unreadable saved data is not overwritten by routine edits', () => {
  const records=new Map([[STORAGE_KEY,'{broken']]);
  globalThis.localStorage={getItem:key=>records.get(key) ?? null,setItem:(key,value)=>records.set(key,value)};
  load();
  update(state=>{state.settings.theme='dark';});
  assert.equal(records.get(STORAGE_KEY),'{broken');
  replace(emptyState());
  assert.equal(JSON.parse(records.get(STORAGE_KEY)).version,1);
  delete globalThis.localStorage;
});
