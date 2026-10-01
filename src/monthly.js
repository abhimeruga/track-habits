import { addDays, dateKey, fromKey, isValidDateKey } from './date.js';
import { completedActivity, dayStats, scheduleOn } from './analytics.js';

export const monthKey = day => day.slice(0, 7);
export function previousMonth(month) {
  const date = fromKey(`${month}-01`);
  date.setMonth(date.getMonth() - 1);
  return dateKey(date).slice(0, 7);
}
export function monthLabel(month) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(fromKey(`${month}-01`));
}

// Current-month totals stop today; a closed month always includes every calendar day.
export function monthReport(state, month, asOf = dateKey()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid report month.');
  const first = `${month}-01`;
  const next = dateKey(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  const last = addDays(next, -1);
  const through = month === monthKey(asOf) ? asOf : last;
  const days = [];
  for (let day = first; day <= through && day <= last; day = addDays(day, 1)) days.push(dayStats(state, day));
  const sum = key => days.reduce((total, day) => total + day[key], 0);
  const activityTotal = sum('activityTotal'), activityDone = sum('activityDone');
  const todoTotal = sum('todoTotal'), todoDone = sum('todoDone');
  const total = activityTotal + todoTotal, done = activityDone + todoDone;
  const habits = state.activities.map(item => {
    let scheduled = 0, completed = 0;
    for (const { day } of days) if (scheduleOn(item, day)) {
      scheduled++;
      if (completedActivity(state, item.id, day)) completed++;
    }
    return { id: item.id, name: item.name, scheduled, completed, missed: scheduled - completed, rate: scheduled ? Math.round(completed / scheduled * 100) : 0 };
  }).filter(item => item.scheduled).sort((a, b) => b.rate - a.rate || b.completed - a.completed || a.name.localeCompare(b.name));
  const todos = state.todos.filter(item => item.dueDate >= first && item.dueDate <= through && item.createdOn <= item.dueDate && (!item.deletedOn || item.deletedOn > item.dueDate)).map(item => ({
    title: item.title, dueDate: item.dueDate, completedOn: item.completedOn || '',
    completed: Boolean(item.completedOn && item.completedOn <= item.dueDate)
  })).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return { month, label: monthLabel(month), first, last, through, closed: month < monthKey(asOf), days, activityTotal, activityDone, todoTotal, todoDone, total, done, rate: total ? Math.round(done / total * 100) : 0, habits, todos };
}

// Include earlier months after a long absence so their PDFs remain available on return.
export function reportableMonths(state, asOf = dateKey()) {
  const dates = [
    ...state.activities.map(item => item.createdOn),
    ...state.todos.map(item => item.dueDate || item.createdOn),
    ...Object.values(state.activityHistory).flatMap(history => Object.keys(history || {}))
  ].filter(isValidDateKey);
  if (!dates.length) return [];
  const first = monthKey(dates.sort()[0]);
  const last = previousMonth(monthKey(asOf));
  const months = [];
  for (let month = last, scanned = 0; month >= first && scanned < 600; month = previousMonth(month), scanned++) {
    const report = monthReport(state, month, asOf);
    if (report.total) months.push(report);
  }
  return months;
}
