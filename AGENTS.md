# AGENTS.md — Web Lyrics Editor

A pure frontend lyrics-timestamp editor. No build tools, no npm, no tests.

## Quick start

```cmd
python -m http.server 8080
```
Or double-click `index.html` (file:// may block local audio in some browsers).\
Or run `server\start.cmd` (uses bundled Caddy).

Edit `js/app.js` or `css/style.css`, then refresh browser.

## Architecture

- **`js/app.js`** (~848 lines) — the entire application. All logic, rendering, state, and event binding in one file.
- **Single state object** (`state` in `js/app.js:74`). All mutations go through `renderTable()` / `renderFocus()` — no two-way binding.
- **`index.html`** — Bootstrap 5 layout, loads 3 scripts (bootstrap, Sortable, app.js) at bottom.
- **`server/`** — contains a prebuilt Caddy binary for local serving; not part of the app itself.

## Conventions

- No build, no bundler, no package.json. Direct `<script>` tags.
- No test framework exists. No lint, typecheck, or CI config.
- UI text in Chinese. Code comments and README are Chinese + English bilingual.
- Timestamps are `MM:SS.CC` (centiseconds). SRT output uses `HH:MM:SS,mmm` (milliseconds).
- `'use strict'` at `js/app.js:17`. No ES modules — uses `var` and IIFE-style helpers.
- Keep additions in the same style: `var`, no template literals, no arrow functions, no `const`/`let`.
- No `.editorconfig`, no formatting tool. Code uses 2-space indent inconsistently — match surrounding style.

## Key modules (within app.js)

| Lines | Module |
|-------|--------|
| 19–53 | Utility functions (`timeToStr`, `strToTime`, `timeToSrt`, etc.) |
| 54–71 | DOM helpers (`$id`, `el`, `cls`, `append`) |
| 73–88 | State object |
| 90–131 | LRC parser (`parseLRC`) |
| 132–157 | Export generators (`generateLRC`, `generateSRT`) |
| 158–355 | Render functions |
| 356–373 | Audio time sync |
| 374–468 | Operations (snap, adjust, add, delete, batch) |
| 583–848 | Initialization and event binding |

## Gotchas

- **SortableJS** is loaded as `window.Sortable` global (minified CDN copy in `js/Sortable.min.js`).
- **LRC offset tag** (`[offset:±ms]`) is applied on import but **not** re-exported.
- Lines with `start: 0` (from plain-text paste) have no timestamp — they display as `00:00.00`.
- The 全局偏移 (±0.05s) buttons are **destructive**: `setOffset`/`batchOffset` write the shift directly into each line's `start` (locked lines are skipped) and there is no undo. `state.offset` itself is vestigial (always 0); `state.appliedOffsetStep` tracks the cumulative step count so repeated presses compute incremental deltas.
- `strToTime` returns `null` on unparseable input (e.g. `1:2.3`, `01:23`, SRT-style `00:01:23,456`); callers restore the previous value instead of writing `00:00.00`. Fractions are rounded to centiseconds (`01:23.456` → `01:23.46`).
- The LRC parser tolerates 1–2 digit minutes/seconds and 1–3 digit fractions (`[1:02.30]`, `[01:02.5]`): 1 digit = tenths of a second, 3 digits = milliseconds. 3+ digit minutes (`[123:45.67]`) still fall back to a `start: 0` plain line.
- Highlight sync runs on `requestAnimationFrame` (frame-accurate while the tab is visible) with a `timeupdate` fallback that keeps the highlight following playback when the tab is backgrounded (rAF pauses; `timeupdate` still fires, throttled to ~1–4Hz).
