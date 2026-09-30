import { addDays, dateKey, formatDate, timeLabel, WEEKDAYS, weekDates, weekday } from './date.js';
import { activeActivity, activeTodo, activityConsistency, completedActivity, dayStats, recentDays, scheduleOn, streak, weekStats } from './analytics.js';
import { emptyState, exportData, getPersistenceError, getState, id, load, normalize, replace, subscribe, update } from './store.js';
import { checkReminders, requestPermission, unlockAlarm } from './notifications.js';

const app = document.querySelector('#app');
const today = () => dateKey();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const nav = [ ['dashboard', 'Overview', '◫'], ['activities', 'Activities', '✦'], ['todos', 'Todos', '☑'], ['timetable', 'Timetable', '▦'], ['analytics', 'Insights', '▥'], ['settings', 'Settings', '⚙'] ];
const iconMap = { spark: '✦', book: '▤', heart: '♡', move: '↗', focus: '◎', art: '✳' };
const stateUI = { page: 'dashboard', todoStatus: 'all', todoPriority: 'all', todoDate: '', installPrompt: null };

function validPage() { const page = location.hash.slice(1); return nav.some(item => item[0] === page) ? page : 'dashboard'; }
function applyTheme() { document.documentElement.dataset.theme = getState().settings.theme; }
function progress(done, total, size = 'large') { const percent = total ? Math.round(done / total * 100) : 0; return `<div class="progress-ring ${size}" style="--progress:${percent}" role="img" aria-label="${done} of ${total} completed, ${percent} percent"><div><strong>${percent}%</strong><span>complete</span></div></div>`; }
function pill(text, type = '') { return `<span class="pill ${type}">${esc(text)}</span>`; }
function blank(title, detail, action = '') { return `<div class="empty"><div class="empty-mark">✳</div><strong>${esc(title)}</strong><p>${esc(detail)}</p>${action}</div>`; }
function sectionTitle(eyebrow, title, action = '') { return `<div class="section-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>${action}</div>`; }
function dots(state, activity, count = 14) { return `<div class="history-dots" aria-label="Last ${count} days of completion">${Array.from({length:count}, (_, index) => { const day = addDays(today(), index - count + 1); const scheduled = scheduleOn(activity, day); const done = completedActivity(state, activity.id, day); return `<span class="history-dot ${done ? 'done' : scheduled ? 'missed' : 'off'}" title="${esc(formatDate(day))}: ${done ? 'done' : scheduled ? 'not done' : 'not scheduled'}"></span>`; }).join('')}</div>`; }

function activityRow(item, day, compact = false) {
  const state = getState(), done = completedActivity(state, item.id, day), s = streak(state, item);
  const scheduled = scheduleOn(item, day), paused = item.schedule.at(-1)?.paused;
  const status = paused ? 'Paused' : scheduled ? 'Today' : 'Another day';
  return `<article class="item-row activity-row ${scheduled ? '' : 'off-schedule'}"><label class="check-wrap"><input type="checkbox" data-action="toggle-activity" data-id="${esc(item.id)}" data-day="${day}" ${done ? 'checked' : ''} ${scheduled ? '' : 'disabled'} aria-label="${scheduled ? `Mark ${esc(item.name)} ${done ? 'incomplete' : 'complete'}` : `${esc(item.name)} is ${paused ? 'paused' : 'not scheduled today'}`}"><span class="custom-check"></span></label><div class="item-icon ${esc(item.color)}" aria-hidden="true">${iconMap[item.icon] || '✦'}</div><div class="item-main"><div class="item-top"><strong class="${done ? 'done-text' : ''}">${esc(item.name)}</strong>${pill(status, scheduled ? 'scheduled' : 'unscheduled')}${s ? pill(`${s} day streak`, 'streak') : ''}</div><span class="item-sub">${esc(item.category || 'Activity')}${item.preferredTime ? ` · ${timeLabel(item.preferredTime)}` : ''}${item.reminderEnabled || item.alarmEnabled ? ' · ◷ Reminder' : ''}</span>${compact ? '' : dots(state, item)}</div>${compact ? '' : `<button class="icon-button" data-action="edit-activity" data-id="${esc(item.id)}" aria-label="Edit ${esc(item.name)}">⋯</button>`}</article>`;
}

function todoRow(item, compact = false) {
  const done = Boolean(item.completedOn), overdue = !done && item.dueDate && item.dueDate < today();
  return `<article class="item-row todo-row"><label class="check-wrap"><input type="checkbox" data-action="toggle-todo" data-id="${esc(item.id)}" ${done ? 'checked' : ''} aria-label="Mark ${esc(item.title)} ${done ? 'incomplete' : 'complete'}"><span class="custom-check"></span></label><div class="item-main"><div class="item-top"><strong class="${done ? 'done-text' : ''}">${esc(item.title)}</strong>${pill(item.priority, `priority-${item.priority}`)}${overdue ? pill('Overdue', 'danger') : ''}</div><span class="item-sub">${item.dueDate ? formatDate(item.dueDate, { month: 'short', day: 'numeric' }) : 'No due date'}${item.time ? ` · ${timeLabel(item.time)}` : ''}${item.notes ? ` · ${esc(item.notes.slice(0, 64))}` : ''}</span></div>${compact ? '' : `<button class="text-button" data-action="move-todo" data-id="${esc(item.id)}">Move to ${item.bucket === 'today' ? 'week' : 'today'}</button><button class="icon-button" data-action="edit-todo" data-id="${esc(item.id)}" aria-label="Edit ${esc(item.title)}">⋯</button>`}</article>`;
}

function dashboard() {
  const state = getState(), day = today(), stats = dayStats(state, day);
  const activities = state.activities.filter(activeActivity).sort((a, b) => Number(scheduleOn(b, day)) - Number(scheduleOn(a, day)) || a.name.localeCompare(b.name));
  const todos = state.todos.filter(item => activeTodo(item) && !item.completedOn && (item.bucket === 'today' || (item.dueDate && item.dueDate <= day)) || activeTodo(item) && item.completedOn === day);
  const upcoming = [...state.timetable].sort((a,b) => a.start.localeCompare(b.start)).slice(0, 4);
  return `<div class="page dashboard"><div class="hero"><div><span class="eyebrow">${esc(formatDate(day, { weekday: 'long', month: 'long', day: 'numeric' }))}</span><h1>Make today count<span class="accent-dot">.</span></h1><p>A calm place to focus on what matters, one step at a time.</p><div class="hero-actions"><button class="button primary" data-action="add-todo">＋ Add todo</button><button class="button light" data-action="add-activity">＋ Add activity</button></div></div>${progress(stats.done, stats.total)}</div>
  <div class="metric-grid"><div class="metric"><span class="metric-icon mint">✦</span><span>Activities</span><strong>${stats.activityDone}<small> / ${stats.activityTotal}</small></strong><div class="mini-track"><span style="width:${stats.activityTotal ? stats.activityDone / stats.activityTotal * 100 : 0}%"></span></div></div><div class="metric"><span class="metric-icon peach">☑</span><span>Todos due today</span><strong>${stats.todoDone}<small> / ${stats.todoTotal}</small></strong><div class="mini-track peach-track"><span style="width:${stats.todoTotal ? stats.todoDone / stats.todoTotal * 100 : 0}%"></span></div></div><div class="metric"><span class="metric-icon lilac">↗</span><span>Pending today</span><strong>${Math.max(0, stats.total - stats.done)}</strong><small>things left on the plan</small></div></div>
  <div class="dashboard-grid"><section class="card">${sectionTitle('Your rhythm', 'All activities', `<a href="#activities" class="small-link">Manage ↗</a>`)}${activities.length ? `<div class="stack">${activities.map(item => activityRow(item, day, true)).join('')}</div>` : blank('No activities yet', 'Add an activity to see it here every day.', `<button class="button small" data-action="add-activity">Add activity</button>`)}</section><section class="card">${sectionTitle('Focus list', 'Today’s todos', `<a href="#todos" class="small-link">View all ↗</a>`)}${todos.length ? `<div class="stack">${todos.slice(0, 7).map(item => todoRow(item, true)).join('')}</div>` : blank('Your list is clear', 'Add a todo whenever something comes up.', `<button class="button small" data-action="add-todo">Add todo</button>`)}</section></div>
  <section class="card agenda-card">${sectionTitle('Time, with intention', 'Everyday timetable', `<a href="#timetable" class="small-link">View timetable ↗</a>`)}${upcoming.length ? `<div class="agenda-list">${upcoming.map(item => `<div class="agenda-item"><time>${timeLabel(item.start)}</time><span></span><div><strong>${esc(item.title)}</strong><small>${timeLabel(item.start)} – ${timeLabel(item.end)}</small></div></div>`).join('')}</div>` : blank('An open day', 'Add a time block that repeats every day.', `<button class="button small" data-action="add-block">Add time block</button>`)}</section></div>`;
}

function activitiesPage() {
  const state = getState(), active = state.activities.filter(activeActivity), paused = active.filter(item => item.schedule.at(-1)?.paused), running = active.filter(item => !item.schedule.at(-1)?.paused);
  const card = item => { const consistency = activityConsistency(state, item); const days = item.schedule.at(-1)?.days || []; return `<article class="activity-card"><div class="activity-card-top"><div class="item-icon big ${esc(item.color)}">${iconMap[item.icon] || '✦'}</div><div class="card-tools"><button class="icon-button" data-action="edit-activity" data-id="${esc(item.id)}" aria-label="Edit ${esc(item.name)}">✎</button><button class="icon-button" data-action="pause-activity" data-id="${esc(item.id)}" aria-label="${item.schedule.at(-1)?.paused ? 'Reactivate' : 'Pause'} ${esc(item.name)}">${item.schedule.at(-1)?.paused ? '▶' : 'Ⅱ'}</button><button class="icon-button danger-text" data-action="delete-activity" data-id="${esc(item.id)}" aria-label="Delete ${esc(item.name)}">×</button></div></div><h3>${esc(item.name)}</h3><p>${esc(item.description || item.category || 'A little progress, often.')}</p><div class="card-tags">${pill(item.category || 'Activity')}${pill(days.length === 7 ? 'Every day' : days.map(day => WEEKDAYS[day]).join(', ') || 'No days')}${item.preferredTime ? pill(timeLabel(item.preferredTime)) : ''}</div><div class="activity-card-stats"><div><strong>${streak(state, item)}</strong><span>day streak</span></div><div><strong>${consistency.rate}%</strong><span>last 28 days</span></div></div>${dots(state, item)}<span class="subtle">${consistency.done} of ${consistency.scheduled} scheduled days completed</span></article>`; };
  return `<div class="page"><div class="page-intro"><div><span class="eyebrow">The things you return to</span><h1>Activities & habits</h1><p>Build consistency around the things that make your days better.</p></div><button class="button primary" data-action="add-activity">＋ New activity</button></div>${running.length ? `<div class="activity-grid">${running.map(card).join('')}</div>` : blank('Start with one small ritual', 'Add an activity, choose its days, and check it off from your dashboard.', `<button class="button primary" data-action="add-activity">Add activity</button>`)}${paused.length ? `<section class="subsection">${sectionTitle('On hold', 'Paused activities')}<div class="activity-grid">${paused.map(card).join('')}</div></section>` : ''}</div>`;
}

function filteredTodos(items) { return items.filter(item => (stateUI.todoStatus === 'all' || (stateUI.todoStatus === 'done') === Boolean(item.completedOn)) && (stateUI.todoPriority === 'all' || item.priority === stateUI.todoPriority) && (!stateUI.todoDate || item.dueDate === stateUI.todoDate)); }
function todosPage() {
  const all = getState().todos.filter(activeTodo), todayItems = filteredTodos(all.filter(item => item.bucket === 'today')), weekItems = filteredTodos(all.filter(item => item.bucket === 'week'));
  return `<div class="page"><div class="page-intro"><div><span class="eyebrow">Make space for progress</span><h1>Todos</h1><p>One-time tasks for today and the days ahead.</p></div><button class="button primary" data-action="add-todo">＋ New todo</button></div><div class="filters" aria-label="Todo filters"><label>Status<select data-filter="todoStatus"><option value="all" ${stateUI.todoStatus === 'all' ? 'selected' : ''}>All</option><option value="pending" ${stateUI.todoStatus === 'pending' ? 'selected' : ''}>Pending</option><option value="done" ${stateUI.todoStatus === 'done' ? 'selected' : ''}>Completed</option></select></label><label>Priority<select data-filter="todoPriority"><option value="all" ${stateUI.todoPriority === 'all' ? 'selected' : ''}>All priorities</option>${['high','medium','low'].map(p => `<option value="${p}" ${stateUI.todoPriority === p ? 'selected' : ''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></label><label>Due date<input type="date" data-filter="todoDate" value="${esc(stateUI.todoDate)}"></label><button class="text-button" data-action="clear-filters">Clear filters</button></div><section class="card todo-section">${sectionTitle('The immediate', `Today’s todos · ${todayItems.length}`, `<button class="small-link button-link" data-action="add-todo" data-bucket="today">＋ Add</button>`)}${todayItems.length ? `<div class="stack">${todayItems.sort(todoSort).map(item => todoRow(item)).join('')}</div>` : blank('No matching todos', 'Add a task or adjust your filters.')}</section><section class="card todo-section">${sectionTitle('Look ahead', `This week’s todos · ${weekItems.length}`, `<button class="small-link button-link" data-action="add-todo" data-bucket="week">＋ Add</button>`)}${weekItems.length ? `<div class="stack">${weekItems.sort(todoSort).map(item => todoRow(item)).join('')}</div>` : blank('Nothing on the weekly list', 'Keep future tasks here until you are ready for them.')}</section></div>`;
}
function todoSort(a,b) { return Number(Boolean(a.completedOn)) - Number(Boolean(b.completedOn)) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || ({high:0,medium:1,low:2}[a.priority] - {high:0,medium:1,low:2}[b.priority]); }

function blockRow(block) {
  const link = block.linkType ? getState()[block.linkType === 'activity' ? 'activities' : 'todos'].find(item => item.id === block.linkId) : null;
  return `<tr><th scope="row" class="table-time"><time>${timeLabel(block.start)}</time><span>${timeLabel(block.end)}</span></th><td class="table-plan"><strong>${esc(block.title)}</strong>${block.notes ? `<small>${esc(block.notes)}</small>` : ''}${link ? `<small>Linked ${block.linkType}: ${esc(link.name || link.title)}</small>` : ''}</td><td class="table-action"><button class="icon-button" data-action="edit-block" data-id="${esc(block.id)}" aria-label="Edit ${esc(block.title)}">⋯</button></td></tr>`;
}
function timetablePage() {
  const blocks = [...getState().timetable].sort((a,b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  return `<div class="page"><div class="page-intro"><div><span class="eyebrow">A rhythm for every day</span><h1>Timetable</h1><p>One repeating daily plan. Each time block appears every day.</p></div><button class="button primary" data-action="add-block">＋ Add time block</button></div><section class="card schedule-card">${blocks.length ? `<div class="table-scroll"><table class="daily-table"><caption class="visually-hidden">Time blocks repeated every day</caption><thead><tr><th scope="col">Time</th><th scope="col">Plan</th><th scope="col">Edit</th></tr></thead><tbody>${blocks.map(blockRow).join('')}</tbody></table></div>` : blank('Your daily table is open', 'Add a time block and it will repeat every day.', `<button class="button small" data-action="add-block">Add time block</button>`)}</section></div>`;
}

function analyticsPage() {
  const state = getState(), daily = dayStats(state, today()), weekly = weekStats(state, today()), days = recentDays(state, today(), 14);
  const ranked = state.activities.filter(activeActivity).map(item => ({item, ...activityConsistency(state,item)})).filter(entry => entry.scheduled).sort((a,b) => b.rate - a.rate || b.done - a.done);
  const missed = state.activities.filter(item => scheduleOn(item, addDays(today(),-1)) && !completedActivity(state,item.id,addDays(today(),-1)));
  return `<div class="page"><div class="page-intro"><div><span class="eyebrow">A clearer picture</span><h1>Insights</h1><p>Progress based on your saved completion dates and planned schedule.</p></div></div><div class="insight-hero"><div class="card insight-stat"><span class="eyebrow">Today</span><strong>${daily.rate}%</strong><span>${daily.done} of ${daily.total} planned items done</span><div class="mini-track"><span style="width:${daily.rate}%"></span></div></div><div class="card insight-stat"><span class="eyebrow">This week</span><strong>${weekly.rate}%</strong><span>${weekly.done} of ${weekly.total} planned items done</span><div class="mini-track peach-track"><span style="width:${weekly.rate}%"></span></div></div></div><div class="analytics-grid"><section class="card">${sectionTitle('Daily rhythm', 'Last 14 days')}<div class="bar-chart" role="img" aria-label="Daily completion rates for the last 14 days">${days.map(item => `<div class="bar-column" title="${esc(formatDate(item.day))}: ${item.rate}% (${item.done}/${item.total})"><span class="bar-track"><span class="bar-fill" style="height:${item.rate}%"></span></span><small>${formatDate(item.day, {day:'numeric'})}</small></div>`).join('')}</div><p class="chart-note">Bars show completed planned items ÷ all items planned for that day. Empty days appear at 0%.</p></section><section class="card">${sectionTitle('Week at a glance', 'Daily progress')}<div class="week-bars">${weekly.days.map(item => `<div><span>${WEEKDAYS[weekday(item.day)]}</span><div class="mini-track"><span style="width:${item.rate}%"></span></div><strong>${item.rate}%</strong></div>`).join('')}</div></section></div><div class="analytics-grid"><section class="card">${sectionTitle('Showing up', 'Most consistent activities')}${ranked.length ? `<div class="ranking">${ranked.slice(0,5).map(({item,rate,done,scheduled}) => `<div><div class="item-icon ${esc(item.color)}">${iconMap[item.icon]}</div><div><strong>${esc(item.name)}</strong><small>${done} of ${scheduled} days · ${streak(state,item)} day streak</small></div><b>${rate}%</b></div>`).join('')}</div>` : blank('No activity data yet', 'Add an activity and start tracking to see patterns.')}</section><section class="card">${sectionTitle('Try again today', 'Missed yesterday')}${missed.length ? `<div class="stack">${missed.map(item => `<div class="missed-row"><span class="item-icon ${esc(item.color)}">${iconMap[item.icon]}</span><div><strong>${esc(item.name)}</strong><small>${esc(item.category || 'Activity')}</small></div></div>`).join('')}</div>` : blank('A good reset', 'No scheduled activities were missed yesterday.')}</section></div><p class="subtle analytics-footnote">Activity consistency uses the last 28 calendar days. Historical plans follow saved schedule changes; deleted items remain in past totals.</p></div>`;
}

function settingsPage() { const settings = getState().settings, permission = 'Notification' in window ? Notification.permission : 'unsupported'; return `<div class="page settings-page"><div class="page-intro"><div><span class="eyebrow">Make it yours</span><h1>Settings</h1><p>Your planner lives in this browser, on this device.</p></div></div><section class="card settings-card">${sectionTitle('Appearance', 'Theme')}<label class="field">Choose a theme<select data-setting="theme"><option value="system" ${settings.theme === 'system' ? 'selected' : ''}>Follow device</option><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option></select></label></section><section class="card settings-card">${sectionTitle('Stay on track', 'Notifications & alarms')}<p>Reminders are checked while Daymark is open. Mobile browsers may stop timers and notifications when the app is in the background or fully closed. Sound also needs a tap in this session before it can play.</p><div class="setting-line"><div><strong>Browser notifications</strong><small>Permission: ${esc(permission)}</small></div><button class="button small" data-action="notification-permission">${permission === 'granted' ? 'Enabled' : 'Enable notifications'}</button></div><label class="toggle-line"><input type="checkbox" data-setting="notificationsEnabled" ${settings.notificationsEnabled ? 'checked' : ''}><span>Use browser notifications for enabled item reminders</span></label><p class="subtle">Item reminders and in-app alarms can be set when editing an activity or todo. In-app messages work even if permission is denied.</p></section><section class="card settings-card">${sectionTitle('Install Daymark', 'Your planner, one tap away')}<p>Use your browser’s “Install app” or “Add to Home Screen” menu to open Daymark like an app.${stateUI.installPrompt ? ' This browser can install it now.' : ''}</p>${stateUI.installPrompt ? `<button class="button primary" data-action="install">Install app</button>` : ''}</section><section class="card settings-card">${sectionTitle('Your data', 'Backup & restore')}<p>Everything is saved in this browser’s localStorage. Clearing site data, using private browsing, or changing devices can remove it. Export a backup regularly.</p><div class="button-row"><button class="button primary" data-action="export">↓ Export JSON</button><button class="button light" data-action="import">↑ Import JSON</button><input id="import-file" class="visually-hidden" type="file" accept="application/json,.json" aria-label="Import Daymark JSON backup"></div><p class="subtle">Import replaces all current planner data after confirmation. Existing backups remain on your device.</p></section><section class="card settings-card danger-zone">${sectionTitle('Fresh start', 'Clear planner data')}<p>Delete all activities, todos, timetable blocks, completion history and settings from this browser.</p><button class="button danger-button" data-action="clear-data">Delete all data</button></section></div>`; }

function weeklyTrend() {
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const start = addDays(weekDates(today())[0], (index - 5) * 7);
    return { start, ...weekStats(getState(), start) };
  });
  return `<section class="card weekly-trend-card">${sectionTitle('The longer view', 'Last 6 weeks')}<div class="weekly-trend" role="img" aria-label="Completion rates for the last six weeks">${weeks.map(week => `<div class="weekly-trend-column" title="Week of ${esc(formatDate(week.start))}: ${week.rate}% (${week.done}/${week.total})"><strong>${week.rate}%</strong><span class="bar-track"><span class="bar-fill" style="height:${week.rate}%"></span></span><small>${formatDate(week.start, { month:'short', day:'numeric' })}</small></div>`).join('')}</div></section>`;
}

function render() {
  const focused = document.activeElement;
  const focusAction = focused?.dataset?.action;
  const focusId = focused?.dataset?.id;
  stateUI.page = validPage(); applyTheme();
  const content = ({dashboard, activities:activitiesPage, todos:todosPage, timetable:timetablePage, analytics:analyticsPage, settings:settingsPage})[stateUI.page]() + (stateUI.page === 'analytics' ? weeklyTrend() : '');
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#dashboard" aria-label="Daymark home"><span class="brand-mark">✦</span><span>daymark<small>make every day yours</small></span></a><span class="nav-caption">WORKSPACE</span><nav aria-label="Main navigation">${nav.map(([key,label,icon]) => `<a href="#${key}" class="nav-link ${stateUI.page === key ? 'selected' : ''}" ${stateUI.page === key ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-quote">“A little progress every day adds up.”</div><span class="offline-badge"><i></i> Ready for offline use</span></div></aside><div class="main-column"><header class="topbar"><div class="topbar-left"><span class="mobile-brand"><span class="brand-mark">✦</span> daymark</span><span class="breadcrumb">Workspace <span> / </span> ${nav.find(item => item[0] === stateUI.page)[1]}</span></div><div class="topbar-right"><span id="connection-label" class="connection-label">${navigator.onLine ? 'All changes saved locally' : 'Offline · changes saved locally'}</span><button class="avatar" data-action="open-settings" aria-label="Open settings">✦</button></div></header><main id="main-content" tabindex="-1">${getPersistenceError() ? `<div class="storage-warning" role="alert">${esc(getPersistenceError())}</div>` : ''}${content}</main></div><nav class="mobile-nav" aria-label="Mobile navigation">${nav.slice(0,5).map(([key,label,icon]) => `<a href="#${key}" class="${stateUI.page === key ? 'selected' : ''}" ${stateUI.page === key ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><small>${label}</small></a>`).join('')}<a href="#settings" class="${stateUI.page === 'settings' ? 'selected' : ''}" aria-label="Settings"><span aria-hidden="true">⚙</span><small>Settings</small></a></nav></div>`;
  if (focusAction === 'toggle-activity' || focusAction === 'toggle-todo') [...app.querySelectorAll('[data-action]')].find(node => node.dataset.action === focusAction && node.dataset.id === focusId)?.focus();
}

const dialog = document.createElement('dialog');
dialog.className = 'editor-dialog';
dialog.innerHTML = '<div id="dialog-content"></div>';
document.body.append(dialog);
const toast = document.createElement('div');
toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
document.body.append(toast);
let toastTimer;
function notify(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000); }
function openDialog(html) { dialog.querySelector('#dialog-content').innerHTML = html; dialog.showModal(); dialog.querySelector('input:not([type="hidden"]), select, textarea')?.focus(); }
function closeDialog() { dialog.close(); }
function field(label, control, hint = '') { return `<label class="field"><span>${label}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`; }
function dialogShell(kind, title, fields, editing = false) { return `<form id="editor-form" data-kind="${kind}" class="editor-form"><div class="dialog-head"><div><span class="eyebrow">${editing ? 'Make a change' : 'A fresh start'}</span><h2>${title}</h2></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close dialog">×</button></div><div class="form-body">${fields}</div><div class="dialog-actions">${editing ? `<button type="button" class="text-button danger-text" data-action="delete-${kind}" data-id="${esc(dialog.dataset.editId)}">Delete</button>` : '<span></span>'}<button type="button" class="button light" data-action="close-dialog">Cancel</button><button type="submit" class="button primary">${editing ? 'Save changes' : 'Add ' + kind}</button></div></form>`; }

function openActivity(item = null) {
  dialog.dataset.editId = item?.id || '';
  const days = item?.schedule.at(-1)?.days || [0,1,2,3,4,5,6];
  const fields = `${field('Activity name *', `<input name="name" maxlength="100" required value="${esc(item?.name || '')}" placeholder="e.g. Read for 20 minutes">`)}${field('Description', `<textarea name="description" maxlength="2000" rows="2" placeholder="What does this activity look like?">${esc(item?.description || '')}</textarea>`)}<div class="form-grid">${field('Category', `<input name="category" maxlength="50" value="${esc(item?.category || '')}" placeholder="e.g. Wellbeing">`)}${field('Preferred time', `<input type="time" name="preferredTime" value="${esc(item?.preferredTime || '')}">`)}</div><div class="form-grid">${field('Icon', `<select name="icon">${Object.entries(iconMap).map(([key,icon]) => `<option value="${key}" ${item?.icon === key ? 'selected' : ''}>${icon} ${key[0].toUpperCase()+key.slice(1)}</option>`).join('')}</select>`)}${field('Color', `<select name="color">${['mint','blue','peach','lilac','gold'].map(color => `<option value="${color}" ${item?.color === color ? 'selected' : ''}>${color[0].toUpperCase()+color.slice(1)}</option>`).join('')}</select>`)}</div><fieldset class="day-fieldset"><legend>Repeat on *</legend><div class="day-picker">${WEEKDAYS.map((label,index) => `<label><input type="checkbox" name="days" value="${index}" aria-label="${label}" ${days.includes(index) ? 'checked' : ''}><span>${label.slice(0,1)}</span></label>`).join('')}</div><small>Choose at least one day.</small></fieldset><div class="reminder-box"><strong>Reminder</strong><label class="toggle-line"><input type="checkbox" name="reminderEnabled" ${item?.reminderEnabled ? 'checked' : ''}><span>Browser notification</span></label><label class="toggle-line"><input type="checkbox" name="alarmEnabled" ${item?.alarmEnabled ? 'checked' : ''}><span>In-app sound</span></label>${field('Reminder time', `<input type="time" name="reminderTime" value="${esc(item?.reminderTime || '')}">`, 'The app must be open for reminders to fire.')}</div>`;
  openDialog(dialogShell('activity', item ? 'Edit activity' : 'New activity', fields, Boolean(item)));
}

function openTodo(item = null, bucket = 'today') {
  dialog.dataset.editId = item?.id || '';
  const fields = `${field('Todo title *', `<input name="title" maxlength="120" required value="${esc(item?.title || '')}" placeholder="e.g. Send the project update">`)}<div class="form-grid">${field('List', `<select name="bucket"><option value="today" ${(item?.bucket || bucket) === 'today' ? 'selected' : ''}>Today</option><option value="week" ${(item?.bucket || bucket) === 'week' ? 'selected' : ''}>This week</option></select>`)}${field('Priority', `<select name="priority">${['low','medium','high'].map(value => `<option value="${value}" ${(item?.priority || 'medium') === value ? 'selected' : ''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select>`)}</div><div class="form-grid">${field('Due date', `<input type="date" name="dueDate" value="${esc(item?.dueDate || (bucket === 'today' ? today() : ''))}">`)}${field('Time', `<input type="time" name="time" value="${esc(item?.time || '')}">`)}</div>${field('Notes', `<textarea name="notes" rows="3" maxlength="2000" placeholder="Useful details, links, or next steps">${esc(item?.notes || '')}</textarea>`)}<div class="reminder-box"><strong>Reminder</strong><label class="toggle-line"><input type="checkbox" name="reminderEnabled" ${item?.reminderEnabled ? 'checked' : ''}><span>Browser notification</span></label><label class="toggle-line"><input type="checkbox" name="alarmEnabled" ${item?.alarmEnabled ? 'checked' : ''}><span>In-app sound</span></label>${field('Reminder time', `<input type="time" name="reminderTime" value="${esc(item?.reminderTime || '')}">`, 'A due date is needed; the app must be open.')}</div>`;
  openDialog(dialogShell('todo', item ? 'Edit todo' : 'New todo', fields, Boolean(item)));
}

function openBlock(item = null) {
  dialog.dataset.editId = item?.id || '';
  const state = getState();
  const linkOptions = [ ...state.activities.filter(activeActivity).map(entry => `<option value="activity:${esc(entry.id)}" ${item?.linkType === 'activity' && item.linkId === entry.id ? 'selected' : ''}>Activity: ${esc(entry.name)}</option>`), ...state.todos.filter(activeTodo).map(entry => `<option value="todo:${esc(entry.id)}" ${item?.linkType === 'todo' && item.linkId === entry.id ? 'selected' : ''}>Todo: ${esc(entry.title)}</option>`) ].join('');
  const fields = `${field('Block title *', `<input name="title" maxlength="120" required value="${esc(item?.title || '')}" placeholder="e.g. Deep work">`)}<p class="form-note">This block repeats every day.</p><div class="form-grid">${field('Start time *', `<input type="time" name="start" required value="${esc(item?.start || '')}">`)}${field('End time *', `<input type="time" name="end" required value="${esc(item?.end || '')}">`)}</div>${field('Linked item', `<select name="link"><option value="">None</option>${linkOptions}</select>`)}${field('Notes', `<textarea name="notes" rows="3" maxlength="2000" placeholder="Optional details">${esc(item?.notes || '')}</textarea>`)}`;
  openDialog(dialogShell('block', item ? 'Edit time block' : 'New time block', fields, Boolean(item)));
}

function saveEditor(form) {
  const data = new FormData(form), kind = form.dataset.kind, editId = dialog.dataset.editId, day = today();
  if (kind === 'activity') {
    const days = data.getAll('days').map(Number);
    if (!days.length) { notify('Choose at least one repeat day.'); return; }
    const reminderEnabled = data.has('reminderEnabled'), alarmEnabled = data.has('alarmEnabled'), reminderTime = data.get('reminderTime');
    if ((reminderEnabled || alarmEnabled) && !reminderTime) { notify('Choose a reminder time.'); return; }
    update(state => {
      const item = editId ? state.activities.find(entry => entry.id === editId) : null;
      const values = { name: data.get('name').trim(), description: data.get('description').trim(), category: data.get('category').trim(), icon: data.get('icon'), color: data.get('color'), preferredTime: data.get('preferredTime'), reminderEnabled, alarmEnabled, reminderTime };
      if (item) { Object.assign(item, values); const last = item.schedule.at(-1); if (last?.from === day) Object.assign(last, { days, paused: last.paused }); else item.schedule.push({ from: day, days, paused: last?.paused || false }); }
      else state.activities.push({ id: id(), ...values, createdOn: day, deletedOn: '', schedule: [{ from: day, days, paused: false }] });
    });
  } else if (kind === 'todo') {
    const reminderEnabled = data.has('reminderEnabled'), alarmEnabled = data.has('alarmEnabled'), reminderTime = data.get('reminderTime'), dueDate = data.get('dueDate');
    if ((reminderEnabled || alarmEnabled) && (!reminderTime || !dueDate)) { notify('Choose a due date and reminder time.'); return; }
    update(state => { const item = editId ? state.todos.find(entry => entry.id === editId) : null; const values = { title: data.get('title').trim(), notes: data.get('notes').trim(), bucket: data.get('bucket'), priority: data.get('priority'), dueDate, time: data.get('time'), reminderEnabled, alarmEnabled, reminderTime }; if (item) Object.assign(item, values); else state.todos.push({ id:id(), ...values, createdOn:day, completedOn:'', deletedOn:'' }); });
  } else if (kind === 'block') {
    const start = data.get('start'), end = data.get('end');
    if (end <= start) { notify('End time must be after start time.'); return; }
    const [linkType, linkId] = (data.get('link') || '').split(':');
    update(state => { const item = editId ? state.timetable.find(entry => entry.id === editId) : null; const values = { title: data.get('title').trim(), notes: data.get('notes').trim(), start, end, linkType: linkType || '', linkId: linkId || '' }; if (item) Object.assign(item, values); else state.timetable.push({ id:id(), ...values }); });
  }
  closeDialog(); notify(editId ? 'Changes saved.' : 'Added to your planner.');
}

function confirmDelete(kind, itemId) {
  const label = kind === 'block' ? 'time block' : kind;
  if (!window.confirm(`Delete this ${label}? ${kind === 'block' ? 'It will be removed from the timetable.' : 'Past completion data will remain in your insights.'}`)) return;
  update(state => { const list = kind === 'activity' ? state.activities : kind === 'todo' ? state.todos : state.timetable; const item = list.find(entry => entry.id === itemId); if (!item) return; if (kind === 'block') state.timetable = state.timetable.filter(entry => entry.id !== itemId); else item.deletedOn = today(); });
  if (dialog.open) closeDialog(); notify(`${label[0].toUpperCase() + label.slice(1)} deleted.`);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, id: itemId } = button.dataset;
  if (action === 'add-activity') openActivity();
  if (action === 'edit-activity') openActivity(getState().activities.find(item => item.id === itemId));
  if (action === 'add-todo') openTodo(null, button.dataset.bucket || 'today');
  if (action === 'edit-todo') openTodo(getState().todos.find(item => item.id === itemId));
  if (action === 'add-block') openBlock();
  if (action === 'edit-block') openBlock(getState().timetable.find(item => item.id === itemId));
  if (action === 'close-dialog') closeDialog();
  if (action.startsWith('delete-')) confirmDelete(action.slice(7), itemId);
  if (action === 'pause-activity') update(state => { const item = state.activities.find(entry => entry.id === itemId); if (!item) return; const last = item.schedule.at(-1), paused = !last?.paused; if (last?.from === today()) last.paused = paused; else item.schedule.push({ from: today(), days: [...(last?.days || [])], paused }); });
  if (action === 'move-todo') update(state => { const item = state.todos.find(entry => entry.id === itemId); if (!item) return; item.bucket = item.bucket === 'today' ? 'week' : 'today'; if (item.bucket === 'today') item.dueDate = today(); });
  if (action === 'clear-filters') { stateUI.todoStatus = 'all'; stateUI.todoPriority = 'all'; stateUI.todoDate = ''; render(); }
  if (action === 'open-settings') location.hash = 'settings';
  if (action === 'export') { const blob = new Blob([exportData()], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `daymark-backup-${today()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Backup downloaded.'); }
  if (action === 'import') document.querySelector('#import-file')?.click();
  if (action === 'clear-data' && window.confirm('Delete all Daymark data from this browser? This cannot be undone unless you have an exported backup.')) { replace(emptyState()); notify('Planner data cleared.'); }
  if (action === 'notification-permission') { const result = await requestPermission(); if (result === 'granted') update(state => { state.settings.notificationsEnabled = true; }); else notify(result === 'denied' ? 'Notifications are blocked in browser settings. In-app reminders still work.' : 'Browser notifications are unavailable here.'); render(); }
  if (action === 'install' && stateUI.installPrompt) { stateUI.installPrompt.prompt(); stateUI.installPrompt = null; render(); }
});

document.addEventListener('change', async event => {
  const control = event.target;
  if (control.dataset.action === 'toggle-activity') update(state => { const history = state.activityHistory[control.dataset.id] ||= {}; if (control.checked) history[control.dataset.day] = true; else delete history[control.dataset.day]; });
  if (control.dataset.action === 'toggle-todo') update(state => { const item = state.todos.find(entry => entry.id === control.dataset.id); if (item) item.completedOn = control.checked ? today() : ''; });
  if (control.dataset.filter) { stateUI[control.dataset.filter] = control.value; render(); }
  if (control.dataset.setting === 'theme') update(state => { state.settings.theme = control.value; });
  if (control.dataset.setting === 'notificationsEnabled') update(state => { state.settings.notificationsEnabled = control.checked; });
  if (control.id === 'import-file' && control.files?.[0]) {
    try { const incoming = normalize(JSON.parse(await control.files[0].text())); if (window.confirm('Replace your current Daymark data with this backup? Export your current data first if you want to keep it.')) { replace(incoming); notify('Backup restored.'); } }
    catch (error) { notify(`Import failed: ${error.message}`); }
    control.value = '';
  }
});

dialog.addEventListener('submit', event => { event.preventDefault(); saveEditor(event.target); });
dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
document.addEventListener('pointerdown', unlockAlarm, { once: true });
window.addEventListener('hashchange', () => { render(); document.querySelector('#main-content')?.focus(); window.scrollTo(0,0); });
window.addEventListener('online', render); window.addEventListener('offline', render);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); stateUI.installPrompt = event; render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(notify); });

subscribe(render); load(); if (!location.hash) location.hash = 'dashboard'; render();
let renderedDay = today();
checkReminders(notify); setInterval(() => { if (today() !== renderedDay) { renderedDay = today(); render(); } checkReminders(notify); }, 30000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => notify('Offline caching could not be enabled in this browser.'));
