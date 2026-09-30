export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fromKey(key) { return new Date(`${key}T12:00:00`); }
export function addDays(key, amount) { const date = fromKey(key); date.setDate(date.getDate() + amount); return dateKey(date); }
export function weekday(key) { return fromKey(key).getDay(); }
export function startOfWeek(key) { return addDays(key, -((weekday(key) + 6) % 7)); }
export function weekDates(key) { const monday = addDays(key, -((weekday(key) + 6) % 7)); return Array.from({ length: 7 }, (_, index) => addDays(monday, index)); }
export function formatDate(key, options = { weekday: 'long', month: 'long', day: 'numeric' }) { return new Intl.DateTimeFormat(undefined, options).format(fromKey(key)); }
export function isValidDateKey(key) { return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(fromKey(key)) === key; }
export function timeLabel(time) { if (!time) return ''; const [hour, minute] = time.split(':').map(Number); return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute)); }
