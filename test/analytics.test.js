import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dateKey, weekDates } from '../src/date.js';
import { activityConsistency, dayStats, scheduleOn, streak, weekStats } from '../src/analytics.js';

const activity = (createdOn, schedule) => ({ id:'habit-1', name:'Read', createdOn, deletedOn:'', schedule });
const state = (activities=[], todos=[], activityHistory={}) => ({ activities, todos, activityHistory });

test('local date arithmetic and Monday-first weeks cross month boundaries', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(weekDates('2026-09-30'), ['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04']);
  assert.equal(dateKey(new Date(2026, 8, 30)), '2026-09-30');
});

test('activity history uses the schedule effective on each date', () => {
  const item = activity('2026-09-28', [{from:'2026-09-28',days:[1,3,5],paused:false},{from:'2026-10-01',days:[2,4],paused:false}]);
  assert.equal(scheduleOn(item,'2026-09-30'),true);
  assert.equal(scheduleOn(item,'2026-10-02'),false);
  assert.equal(scheduleOn(item,'2026-10-01'),true);
  item.deletedOn='2026-10-03';
  assert.equal(scheduleOn(item,'2026-10-08'),false);
  assert.equal(scheduleOn(item,'2026-10-01'),true);
});

test('streak skips unscheduled days and holds while today is incomplete', () => {
  const item=activity('2026-09-21',[{from:'2026-09-21',days:[1,3,5],paused:false}]);
  const data=state([item],[],{'habit-1':{'2026-09-25':true,'2026-09-28':true}});
  assert.equal(streak(data,item,'2026-09-30'),2);
  data.activityHistory['habit-1']['2026-09-30']=true;
  assert.equal(streak(data,item,'2026-09-30'),3);
});

test('daily and weekly rates count due todos and scheduled habits', () => {
  const item=activity('2026-09-28',[{from:'2026-09-28',days:[1,2,3,4,5],paused:false}]);
  const todos=[{id:'todo-1',createdOn:'2026-09-29',dueDate:'2026-09-30',completedOn:'2026-09-30',deletedOn:''},{id:'todo-2',createdOn:'2026-09-29',dueDate:'2026-09-30',completedOn:'',deletedOn:''}];
  const data=state([item],todos,{'habit-1':{'2026-09-30':true}});
  assert.deepEqual(dayStats(data,'2026-09-30'),{day:'2026-09-30',activityTotal:1,activityDone:1,todoTotal:2,todoDone:1,total:3,done:2,rate:67});
  assert.equal(weekStats(data,'2026-09-30').total,7);
  assert.equal(activityConsistency(data,item,'2026-09-30',3).rate,33);
});
