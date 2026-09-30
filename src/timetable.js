// Timetable columns use JavaScript weekday numbers: Monday (1) through Saturday (6).
export const TIMETABLE_DAYS = [1, 2, 3, 4, 5, 6];

export function timetableRows(blocks) {
  const ranges = new Map();
  for (const block of blocks) ranges.set(`${block.start}|${block.end}`, { start: block.start, end: block.end });
  return [...ranges.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export function blocksAt(blocks, range, day) {
  return blocks.filter(block => block.start === range.start && block.end === range.end && block.days.includes(day));
}
