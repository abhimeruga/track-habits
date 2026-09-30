import test from 'node:test';
import assert from 'node:assert/strict';
import { blocksAt, timetableRows } from '../src/timetable.js';

test('timetable rows sort by start and end time and place blocks in selected weekday cells', () => {
  const blocks = [
    { id: 'b', start: '10:00', end: '11:00', days: [2, 4] },
    { id: 'a', start: '09:00', end: '10:00', days: [1, 4] },
    { id: 'c', start: '09:00', end: '10:00', days: [4] }
  ];
  const rows = timetableRows(blocks);
  assert.deepEqual(rows, [{ start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }]);
  assert.deepEqual(blocksAt(blocks, rows[0], 4).map(item => item.id), ['a', 'c']);
  assert.deepEqual(blocksAt(blocks, rows[0], 2), []);
  assert.deepEqual(blocksAt(blocks, rows[1], 2).map(item => item.id), ['b']);
});
