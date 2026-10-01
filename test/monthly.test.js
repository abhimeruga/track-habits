import test from 'node:test';
import assert from 'node:assert/strict';
import { monthReport, previousMonth, reportableMonths } from '../src/monthly.js';
import { emptyState, normalize } from '../src/store.js';

test('month boundaries and current-month totals exclude future days', () => {
  assert.equal(previousMonth('2026-01'), '2025-12');
  const state = emptyState();
  state.activities.push({ id: 'a', name: 'Read', createdOn: '2026-09-29', deletedOn: '', schedule: [{ from: '2026-09-29', days: [0,1,2,3,4,5,6], paused: false }] });
  state.activityHistory.a = { '2026-09-29': true, '2026-10-01': true };
  state.todos.push({ id: 't', title: 'Submit', createdOn: '2026-09-29', dueDate: '2026-09-30', completedOn: '2026-09-30', deletedOn: '' });
  const september = monthReport(state, '2026-09', '2026-10-01');
  assert.equal(september.days.length, 30);
  assert.deepEqual([september.done, september.total, september.activityDone, september.todoDone], [2, 3, 1, 1]);
  assert.equal(september.habits[0].missed, 1);
  assert.equal(september.todos[0].completed, true);
  const october = monthReport(state, '2026-10', '2026-10-01');
  assert.equal(october.days.length, 1);
  assert.equal(october.rate, 100);
  assert.equal(october.closed, false);
  assert.deepEqual(reportableMonths(state, '2026-10-01').map(item => item.month), ['2026-09']);
});

test('month report handles leap day and keeps report metadata in backups', () => {
  const state = emptyState();
  state.activities.push({ id:'a', name:'Walk', createdOn:'2024-02-29', deletedOn:'', schedule:[{ from:'2024-02-29', days:[4], paused:false }] });
  const report = monthReport(state, '2024-02', '2024-03-01');
  assert.equal(report.days.length, 29);
  assert.equal(report.total, 1);
  state.monthlyReports['2024-02'] = { attemptedOn:'2024-03-01', requestedOn:'', notifiedOn:'' };
  assert.equal(normalize(state).monthlyReports['2024-02'].attemptedOn, '2024-03-01');
});
