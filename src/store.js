import { dateKey, isValidDateKey } from './date.js';
import { TIMETABLE_DAYS } from './timetable.js';

export const STORAGE_KEY = 'daymark:data:v1';
export const emptyState = () => ({ version: 1, activities: [], todos: [], timetable: [], activityHistory: {}, settings: { theme: 'light', notificationsEnabled: false }, reminderLog: {} });
const listeners = new Set();
let state = emptyState();
let persistenceError = '';
let unreadableSavedData = false;

export function getState() { return state; }
export function getPersistenceError() { return persistenceError; }
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function announce() { for (const listener of listeners) listener(); }
export function id() { return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function load() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = normalize(JSON.parse(raw));
    unreadableSavedData = false;
    persistenceError = '';
  } catch (error) {
    unreadableSavedData = Boolean(raw);
    persistenceError = unreadableSavedData ? 'Saved data could not be read and has been left untouched. Import a backup or clear the planner before making changes.' : error.message;
  }
  announce();
}

export function save() {
  if (unreadableSavedData) { announce(); return false; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    persistenceError = '';
    announce();
    return true;
  } catch {
    persistenceError = 'Your changes are only in this tab because browser storage is unavailable or full. Export a backup now.';
    announce();
    return false;
  }
}

export function update(change) { change(state); save(); }
export function replace(next) { state = normalize(next); unreadableSavedData = false; save(); }

// Import is intentionally strict. Unknown schema versions are kept out of the current store.
export function normalize(input) {
  if (!input || typeof input !== 'object' || input.version !== 1 || !Array.isArray(input.activities) || !Array.isArray(input.todos) || !Array.isArray(input.timetable)) throw new Error('This is not a Daymark version 1 backup.');
  const base = emptyState();
  const cleanText = value => typeof value === 'string' ? value.slice(0, 2000) : '';
  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
  const validDate = value => isValidDateKey(value) ? value : '';
  base.activities = input.activities.filter(item => item && typeof item.id === 'string').map(item => ({
    id: item.id, name: cleanText(item.name).slice(0, 100), description: cleanText(item.description), category: cleanText(item.category).slice(0, 50), icon: ['spark', 'book', 'heart', 'move', 'focus', 'art'].includes(item.icon) ? item.icon : 'spark', color: ['mint', 'blue', 'peach', 'lilac', 'gold'].includes(item.color) ? item.color : 'mint', preferredTime: validTime(item.preferredTime), createdOn: validDate(item.createdOn) || dateKey(), deletedOn: validDate(item.deletedOn), reminderEnabled: Boolean(item.reminderEnabled), reminderTime: validTime(item.reminderTime), alarmEnabled: Boolean(item.alarmEnabled), schedule: Array.isArray(item.schedule) ? item.schedule.filter(rev => validDate(rev.from)).map(rev => ({ from: rev.from, days: Array.isArray(rev.days) ? [...new Set(rev.days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))] : [], paused: Boolean(rev.paused) })).sort((a, b) => a.from.localeCompare(b.from)) : []
  })).filter(item => item.name);
  base.todos = input.todos.filter(item => item && typeof item.id === 'string').map(item => ({
    id: item.id, title: cleanText(item.title).slice(0, 120), notes: cleanText(item.notes), bucket: item.bucket === 'week' ? 'week' : 'today', priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium', dueDate: validDate(item.dueDate), time: validTime(item.time), createdOn: validDate(item.createdOn) || dateKey(), completedOn: validDate(item.completedOn), deletedOn: validDate(item.deletedOn), reminderEnabled: Boolean(item.reminderEnabled), reminderTime: validTime(item.reminderTime), alarmEnabled: Boolean(item.alarmEnabled)
  })).filter(item => item.title);
  // Blocks saved before weekday selection repeated every day; keep them across all grid columns.
  base.timetable = input.timetable.filter(item => item && typeof item.id === 'string' && validTime(item.start) && validTime(item.end)).map(item => ({ id: item.id, title: cleanText(item.title).slice(0, 120), notes: cleanText(item.notes), start: item.start, end: item.end, days: Array.isArray(item.days) ? [...new Set(item.days.filter(day => TIMETABLE_DAYS.includes(day)))].sort() : [...TIMETABLE_DAYS], linkType: ['activity', 'todo'].includes(item.linkType) ? item.linkType : '', linkId: cleanText(item.linkId).slice(0, 100) })).filter(item => item.title && item.start < item.end && item.days.length);
  if (input.activityHistory && typeof input.activityHistory === 'object') for (const [activityId, dates] of Object.entries(input.activityHistory)) {
    if (!dates || typeof dates !== 'object') continue;
    base.activityHistory[activityId] = Object.fromEntries(Object.entries(dates).filter(([day, done]) => isValidDateKey(day) && done === true));
  }
  base.settings.theme = ['system', 'light', 'dark'].includes(input.settings?.theme) ? input.settings.theme : 'light';
  base.settings.notificationsEnabled = Boolean(input.settings?.notificationsEnabled);
  if (input.reminderLog && typeof input.reminderLog === 'object') base.reminderLog = Object.fromEntries(Object.entries(input.reminderLog).filter(([key, value]) => typeof key === 'string' && key.length < 200 && value === true));
  return base;
}

export function exportData() { return JSON.stringify(state, null, 2); }
