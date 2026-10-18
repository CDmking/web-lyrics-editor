# AGENTS.md — Web Lyrics Editor

一个纯前端歌词时间戳编辑器。无构建工具、无 npm、无测试。

## 快速开始

```cmd
python -m http.server 8080
```
或双击 `index.html`（`file://` 在部分浏览器中可能阻止加载本地音频）。\
或运行 `server\start.cmd`（使用内置 Caddy）。

修改 `js/` 下任意文件或 `css/style.css`，然后刷新浏览器。

## 架构

- **`js/`** — 应用逻辑拆分为 7 个文件（见下表），通过 `index.html` 底部的有序 `<script>` 标签加载。
- **单一状态对象**（`js/state.js` 中的 `state`）。所有变更都通过 `renderTable()` / `renderFocus()` — 无双向绑定。
- **`index.html`** — Bootstrap 5 布局，底部加载 9 个脚本（bootstrap、Sortable、7 个应用文件）。
- **`server/`** — 包含预构建的 Caddy 可执行文件用于本地服务；不属于应用本身。

## 约定

- 无构建、无打包器、无 package.json。直接使用 `<script>` 标签。
- 无测试框架。无 lint、类型检查或 CI 配置。
- UI 文本为中文。代码注释与 README 为中英双语。
- 时间戳使用 `MM:SS.FF`，小数位为 2–3 位。精度按导入文件检测（最大小数位长度，最小 2 位）并存储在 `state.timePrecision`；SRT 输出始终使用 `HH:MM:SS,mmm`（毫秒）。
- 每个 JS 文件顶部都有 `'use strict'`。不使用 ES 模块 — 使用 `var` 和 IIFE 风格辅助函数。
- 新增代码保持相同风格：使用 `var`，不用模板字符串、箭头函数、`const`/`let`。
- 无 `.editorconfig`，无格式化工具。代码缩进不一致地使用 2 空格 — 匹配周围风格。

## JS 文件（加载顺序很重要）

| # | 文件 | 内容 |
|---|------|----------|
| 1 | `js/state.js` | 状态对象（`var state = {...}`） |
| 2 | `js/utils.js` | 工具函数（`timeToStr`、`strToTime` 等）+ DOM 辅助函数（`$id`、`el`、`cls` 等）+ 插值播放时钟（`playbackTime` / `syncPlaybackClock`） |
| 3 | `js/parser.js` | LRC 解析器（`parseLRC`） |
| 4 | `js/generators.js` | 导出生成器（`generateLRC`、`generateSRT`）+ 下载辅助函数 |
| 5 | `js/render.js` | 所有渲染函数（`renderTable`、`renderFocus`、`updateHighlight` 等）+ `initSortable` |
| 6 | `js/actions.js` | 音频同步、操作（打点、微调、添加、删除、批量）、加载、文件处理、键盘 |
| 7 | `js/app.js` | 初始化 IIFE — 所有事件绑定与启动逻辑（约 265 行） |

依赖关系是单向的：`state` / `utils` → `parser` / `generators` → `render` → `actions` → `app`。

## 注意事项

- **SortableJS** 以 `window.Sortable` 全局变量加载（`js/Sortable.min.js` 中的压缩版 CDN 副本）。
- **LRC offset 标签**（`[offset:±ms]`）在导入时应用，但**不会**重新导出。
- `start: 0` 的行（来自纯文本粘贴）没有时间戳 — 显示为 `00:00.00` 或当前文件精度（如 `00:00.000`）。
- **全局偏移**（±0.05s）按钮是**破坏性的**：`setOffset`/`batchOffset` 将位移直接写入每一行的 `start`（跳过锁定行），且没有撤销。`state.offset` 本身已废弃（始终为 0）；`state.appliedOffsetStep` 记录累计步数，以便重复按下时计算增量差值。
- `strToTime` 对无法解析的输入返回 `null`（例如 `1:2.3`、`01:23`、SRT 风格 `00:01:23,456`）；调用方会恢复之前的值，而不是写入 `00:00.00`。小数按当前文件精度（`state.timePrecision`）舍入，而不总是舍入到厘秒。
- LRC 解析器容忍 1–2 位分/秒和 1–3 位小数（`[1:02.30]`、`[01:02.5]`）：1 位 = 十分之一秒，3 位 = 毫秒。3 位及以上的分钟（`[123:45.67]`）仍回退为 `start: 0` 的纯文本行。
- 导入精度是文件级的：`parseLRC` 返回所有时间标签中小数位长度的最大值，下限为 2。非 10ms 的 `[offset:±ms]` 会将其提升到 3 位，以免偏移丢失。所有时间变更都使用 `roundTime()`，LRC 导出使用带 `state.timePrecision` 的 `timeToStr()`。
- 高亮同步在 `requestAnimationFrame` 上运行（标签页可见时），后台标签页则使用 `timeupdate` 回退（rAF 暂停；`timeupdate` 仍会触发，节流至约 1–4Hz）。位置来自 `utils.js` 中的 `playbackTime()`，**而不是**原始的 `audio.currentTime`：浏览器按媒体管线节奏刷新 `currentTime`（通常约 4Hz），因此逐帧轮询会得到重复的旧值，导致高亮滞后数十到数百毫秒。`playbackTime()` 使用 `performance.now()` 在刷新间隔之间进行插值（在 `play`/`pause`/`seeking`/`seeked`/`waiting`/`playing`/`ratechange`/`ended`/`loadedmetadata` 时重新基准化，最多超前 `CLOCK_MAX_AHEAD` 秒）。`snapTime`/`addLineAt`/`updateTimeDisplay` 使用同一时钟，因此打点（snapping）和预览（preview）保持一致。
- 表头的全选复选框是派生 UI 状态：`updateSelectAll()` 在 `renderTable()` 开头以及行复选框的 `change` 处理器中运行。任何修改 `state.selectedIndices` 的新代码路径也必须同步它（调用 `updateSelectAll()` 或经由 `renderTable()`）。
