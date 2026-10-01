// JavaScript weekday numbers: Sunday is 0. Keep Monday first in the editor.
export const TIMETABLE_DAYS = [1, 2, 3, 4, 5, 6, 0];
export const TIMETABLE_COLUMNS = [
  { label: 'Mon–Fri', days: [1, 2, 3, 4, 5] },
  { label: 'Sat', days: [6] },
  { label: 'Sun', days: [0] }
];

export function timetableRows(blocks) {
  const ranges = new Map();
  for (const block of blocks) ranges.set(`${block.start}|${block.end}`, { start: block.start, end: block.end });
  return [...ranges.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export function blocksForColumn(blocks, range, columnDays) {
  return blocks.filter(block => block.start === range.start && block.end === range.end && columnDays.some(day => block.days.includes(day)));
}
