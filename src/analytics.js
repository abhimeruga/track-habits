import { addDays, dateKey, weekDates, weekday } from './date.js';

export function scheduleOn(activity, day) {
  if (day < activity.createdOn || (activity.deletedOn && day >= activity.deletedOn)) return false;
  const revision = [...(activity.schedule || [])].reverse().find(item => item.from <= day);
  return Boolean(revision && !revision.paused && revision.days.includes(weekday(day)));
}
export function activeActivity(activity) { return !activity.deletedOn; }
export function activeTodo(todo) { return !todo.deletedOn; }
export function completedActivity(state, activityId, day) { return state.activityHistory[activityId]?.[day] === true; }

export function streak(state, activity, today = dateKey()) {
  let cursor = today;
  if (scheduleOn(activity, cursor) && !completedActivity(state, activity.id, cursor)) cursor = addDays(cursor, -1);
  let count = 0;
  for (let scanned = 0; scanned < 3660 && cursor >= activity.createdOn; scanned++, cursor = addDays(cursor, -1)) {
    if (!scheduleOn(activity, cursor)) continue;
    if (!completedActivity(state, activity.id, cursor)) break;
    count++;
  }
  return count;
}

export function dayStats(state, day) {
  const activities = state.activities.filter(item => scheduleOn(item, day));
  const activityDone = activities.filter(item => completedActivity(state, item.id, day)).length;
  const todos = state.todos.filter(item => item.dueDate === day && item.createdOn <= day && (!item.deletedOn || item.deletedOn > day));
  const todoDone = todos.filter(item => item.completedOn && item.completedOn <= day).length;
  const total = activities.length + todos.length;
  const done = activityDone + todoDone;
  return { day, activityTotal: activities.length, activityDone, todoTotal: todos.length, todoDone, total, done, rate: total ? Math.round(done / total * 100) : 0 };
}

export function weekStats(state, day) {
  const days = weekDates(day).map(date => dayStats(state, date));
  const total = days.reduce((sum, item) => sum + item.total, 0);
  const done = days.reduce((sum, item) => sum + item.done, 0);
  return { days, total, done, rate: total ? Math.round(done / total * 100) : 0 };
}

export function recentDays(state, today = dateKey(), count = 14) { return Array.from({ length: count }, (_, index) => dayStats(state, addDays(today, index - count + 1))); }

export function activityConsistency(state, activity, today = dateKey(), days = 28) {
  let scheduled = 0, done = 0;
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = addDays(today, -offset);
    if (scheduleOn(activity, day)) { scheduled++; if (completedActivity(state, activity.id, day)) done++; }
  }
  return { scheduled, done, rate: scheduled ? Math.round(done / scheduled * 100) : 0 };
}
