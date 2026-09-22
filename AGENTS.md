# AGENTS.md — Web Lyrics Editor

A pure frontend lyrics-timestamp editor. No build tools, no npm, no tests.

## Quick start

```cmd
python -m http.server 8080
```
Or double-click `index.html` (file:// may block local audio in some browsers).\
Or run `server\start.cmd` (uses bundled Caddy).

Edit any file under `js/` or `css/style.css`, then refresh browser.

## Architecture

- **`js/`** — application logic split into 7 files (see table below), loaded via ordered `<script>` tags at the bottom of `index.html`.
- **Single state object** (`state` in `js/state.js`). All mutations go through `renderTable()` / `renderFocus()` — no two-way binding.
- **`index.html`** — Bootstrap 5 layout, loads 9 scripts (bootstrap, Sortable, 7 app files) at bottom.
- **`server/`** — contains a prebuilt Caddy binary for local serving; not part of the app itself.

## Conventions

- No build, no bundler, no package.json. Direct `<script>` tags.
- No test framework exists. No lint, typecheck, or CI config.
- UI text in Chinese. Code comments and README are Chinese + English bilingual.
- Timestamps are `MM:SS.CC` (centiseconds). SRT output uses `HH:MM:SS,mmm` (milliseconds).
- `'use strict'` at the top of every JS file. No ES modules — uses `var` and IIFE-style helpers.
- Keep additions in the same style: `var`, no template literals, no arrow functions, no `const`/`let`.
- No `.editorconfig`, no formatting tool. Code uses 2-space indent inconsistently — match surrounding style.

## JS files (load order matters)

| # | File | Contents |
|---|------|----------|
| 1 | `js/state.js` | State object (`var state = {...}`) |
| 2 | `js/utils.js` | Utility functions (`timeToStr`, `strToTime`, etc.) + DOM helpers (`$id`, `el`, `cls`, etc.) + interpolated playback clock (`playbackTime` / `syncPlaybackClock`) |
| 3 | `js/parser.js` | LRC parser (`parseLRC`) |
| 4 | `js/generators.js` | Export generators (`generateLRC`, `generateSRT`) + download helpers |
| 5 | `js/render.js` | All render functions (`renderTable`, `renderFocus`, `updateHighlight`, etc.) + `initSortable` |
| 6 | `js/actions.js` | Audio sync, operations (snap, adjust, add, delete, batch), load, file handlers, keyboard |
| 7 | `js/app.js` | Init IIFE — all event binding and startup (~265 lines) |

Dependencies are single-direction: `state` / `utils` → `parser` / `generators` → `render` → `actions` → `app`.

## Gotchas

- **SortableJS** is loaded as `window.Sortable` global (minified CDN copy in `js/Sortable.min.js`).
- **LRC offset tag** (`[offset:±ms]`) is applied on import but **not** re-exported.
- Lines with `start: 0` (from plain-text paste) have no timestamp — they display as `00:00.00`.
- The 全局偏移 (±0.05s) buttons are **destructive**: `setOffset`/`batchOffset` write the shift directly into each line's `start` (locked lines are skipped) and there is no undo. `state.offset` itself is vestigial (always 0); `state.appliedOffsetStep` tracks the cumulative step count so repeated presses compute incremental deltas.
- `strToTime` returns `null` on unparseable input (e.g. `1:2.3`, `01:23`, SRT-style `00:01:23,456`); callers restore the previous value instead of writing `00:00.00`. Fractions are rounded to centiseconds (`01:23.456` → `01:23.46`).
- The LRC parser tolerates 1–2 digit minutes/seconds and 1–3 digit fractions (`[1:02.30]`, `[01:02.5]`): 1 digit = tenths of a second, 3 digits = milliseconds. 3+ digit minutes (`[123:45.67]`) still fall back to a `start: 0` plain line.
- Highlight sync runs on `requestAnimationFrame` (while the tab is visible) with a `timeupdate` fallback for backgrounded tabs (rAF pauses; `timeupdate` still fires, throttled to ~1–4Hz). The position comes from `playbackTime()` in `utils.js`, **not** raw `audio.currentTime`: browsers refresh `currentTime` at the media pipeline's cadence (often ~4Hz), so polling it per frame returns the same stale value and the highlight lags by tens–hundreds of ms. `playbackTime()` interpolates between refreshes with `performance.now()` (re-baselined on `play`/`pause`/`seeking`/`seeked`/`waiting`/`playing`/`ratechange`/`ended`/`loadedmetadata`, capped at `CLOCK_MAX_AHEAD` seconds ahead). `snapTime`/`addLineAt`/`updateTimeDisplay` use the same clock so打点 (snapping) and预览 (preview) stay consistent.
- The header 全选 checkbox is derived UI state: `updateSelectAll()` runs at the top of `renderTable()` and in the row-checkbox `change` handler. Any new code path that mutates `state.selectedIndices` must also sync it (call `updateSelectAll()` or route through `renderTable()`).
