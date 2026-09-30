import { dateKey } from './date.js';
import { activeActivity, activeTodo, completedActivity, scheduleOn } from './analytics.js';
import { getState, update } from './store.js';

let audioContext;
export function unlockAlarm() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch { /* Audio is optional. */ }
}

function chime() {
  if (!audioContext || audioContext.state !== 'running') return;
  [0, 0.15].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = index ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + 0.25);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + offset); oscillator.stop(audioContext.currentTime + offset + 0.27);
  });
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'error'; }
}

export function checkReminders(onMessage) {
  const state = getState();
  const now = new Date();
  const day = dateKey(now);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const candidates = [
    ...state.activities.filter(item => activeActivity(item) && scheduleOn(item, day) && !completedActivity(state, item.id, day)).map(item => ({ ...item, label: item.name, kind: 'activity' })),
    ...state.todos.filter(item => activeTodo(item) && !item.completedOn && item.dueDate === day).map(item => ({ ...item, label: item.title, kind: 'todo' }))
  ];
  for (const item of candidates) {
    if ((!item.reminderEnabled && !item.alarmEnabled) || !item.reminderTime || item.reminderTime > time) continue;
    const key = `${item.kind}:${item.id}:${day}:${item.reminderTime}`;
    if (state.reminderLog[key]) continue;
    update(next => { next.reminderLog[key] = true; });
    if (item.alarmEnabled) chime();
    onMessage(`Reminder: ${item.label}`);
    if (item.reminderEnabled && state.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(`Daymark: ${item.label}`, { body: item.kind === 'activity' ? 'Time for your activity.' : 'Your todo is due.', icon: './icons/icon-192.png', tag: key }); } catch { /* In-app message still works. */ }
    }
  }
}
