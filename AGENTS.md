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

- **`js/app.js`** (~842 lines) — the entire application. All logic, rendering, state, and event binding in one file.
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
| 19–52 | Utility functions (`timeToStr`, `strToTime`, `timeToSrt`, etc.) |
| 54–71 | DOM helpers (`$id`, `el`, `cls`, `append`) |
| 73–88 | State object |
| 90–129 | LRC parser (`parseLRC`) |
| 131–155 | Export generators (`generateLRC`, `generateSRT`) |
| 157–337 | Render functions |
| 340–355 | Audio time sync |
| 358–450 | Operations (snap, adjust, add, delete, batch) |
| 827–842 | Initialization and event binding |

## Gotchas

- **SortableJS** is loaded as `window.Sortable` global (minified CDN copy in `js/Sortable.min.js`).
- **LRC offset tag** (`[offset:±ms]`) is applied on import but **not** re-exported.
- Lines with `start: 0` (from plain-text paste) have no timestamp — they display as `00:00.00`.
- The `state.offset` is a **global additive offset** displayed in UI but not persisted to individual line timestamps.
