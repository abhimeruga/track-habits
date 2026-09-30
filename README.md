# Daymark

A mobile-first daily planner and habit tracker with a black and gray theme. Daymark is a dependency-free static Progressive Web App that keeps all planner data in your browser's localStorage. It has no account, backend, or external service.

## Run locally

Install Node.js 20.11 or newer, then run:

```sh
node server.mjs
```

Open [http://localhost:4173](http://localhost:4173). The included server is for local development; it serves the same static files used on GitHub Pages. Run `node --test` for the data and statistics checks.

## Deploy to GitHub Pages

1. Put this project in a GitHub repository and push it to the `main` branch.
2. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` publishes the static site on each push to `main`. You can also start it from the Actions tab.

The manifest, service worker, and assets use relative URLs so the app works at either a user site root or a repository path such as `https://username.github.io/daymark/`. GitHub Pages serves over HTTPS, which enables service workers and the Notifications API.

## Offline and installation

Open the site once while online. The service worker caches the app shell, icons, and offline fallback. Thereafter, the planner works offline and all changes are saved locally. Browser installation is available through the browser's **Install app** or **Add to Home Screen** menu when supported. If the shell was never cached, the offline fallback explains what to do.

An app update replaces the shell cache without clearing localStorage. Existing version 1 data is loaded and normalized; a backup from an unsupported version is rejected instead of overwriting current data.

## Data, statistics, and backup

Activities have dated completion records and dated schedule revisions. Todos keep their completion date. Deleted activities and todos are hidden from the planner while their past records remain available to insights. Daily and weekly rates count items scheduled or due on those dates. Activity consistency covers the last 28 days; the current streak follows scheduled days and allows today to remain open until it is completed.

The dashboard lists every active activity. Activities outside today's schedule stay visible but cannot be checked off that day. The timetable is a single table of blocks that repeat every day. On load or import, older weekday-specific timetable blocks become daily blocks while retaining their title, times, notes, and link.

All data stays in this browser's localStorage. Clearing site data, using private browsing, or switching devices can remove it. Use **Settings → Export JSON** to download a backup and **Import JSON** to restore one. Import replaces all current data after confirmation; export first if you need to keep the current state.

## Reminders and browser limits

Each activity and todo can have an optional browser notification, in-app sound, and reminder time. Browser notifications require permission and a secure context (HTTPS or localhost). Reminders are checked only while the app is open; mobile browsers may suspend timers or stop notifications when the app is backgrounded or closed. In-app messages still appear if permission is denied. Sound requires a user tap in the current session. Daymark does not claim to provide reliable closed-app alarms because the web platform cannot guarantee them without a push service.

## Project layout

- `src/main.js`: page templates, forms, and interactions.
- `src/store.js`: localStorage schema, backup validation, and updates.
- `src/date.js`, `src/analytics.js`: date and progress calculations.
- `src/notifications.js`: open-app reminders and in-app sound.
- `styles.css`, `theme.css`: responsive layout and monochrome theme.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline and installable app files.
- `scripts/generate-icons.mjs`: regenerate PNG app icons from the simple Daymark mark.
