import test from 'node:test';
import assert from 'node:assert/strict';
import { blocksForColumn, TIMETABLE_COLUMNS, timetableRows } from '../src/timetable.js';

test('timetable rows group weekdays and keep Saturday and Sunday separate', () => {
  const blocks = [
    { id: 'b', start: '10:00', end: '11:00', days: [2, 4] },
    { id: 'a', start: '09:00', end: '10:00', days: [1, 2, 3, 4, 5] },
    { id: 'c', start: '09:00', end: '10:00', days: [6] },
    { id: 'd', start: '09:00', end: '10:00', days: [0] }
  ];
  const rows = timetableRows(blocks);
  assert.deepEqual(rows, [{ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }]);
  assert.deepEqual(TIMETABLE_COLUMNS.map(column => column.label), ['Mon–Fri', 'Sat', 'Sun']);
  assert.deepEqual(TIMETABLE_COLUMNS.map(column => blocksForColumn(blocks, rows[0], column.days).map(item => item.id)), [['a'], ['c'], ['d']]);
  assert.deepEqual(blocksForColumn(blocks, rows[1], TIMETABLE_COLUMNS[0].days).map(item => item.id), ['b']);
});
