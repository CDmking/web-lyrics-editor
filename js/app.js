'use strict';

// ===== Utilities =====
function pad(n, w) { return String(Math.floor(n)).padStart(w, '0'); }

function round2(t) { return Math.round(t * 100) / 100; }

function timeToStr(t) {
  t = round2(t);
  var m = Math.floor(t / 60);
  var s = Math.floor(t % 60);
  var cs = Math.round((t % 1) * 100);
  return pad(m, 2) + ':' + pad(s, 2) + '.' + pad(cs, 2);
}

function strToTime(s) {
  var m = s.match(/^(\d{1,2}):(\d{2})[.:](\d{1,3})$/);
  if (!m) return 0;
  var min = parseInt(m[1], 10);
  var sec = parseInt(m[2], 10);
  var frac = parseInt(m[3].padEnd(2, '0').slice(0, 2), 10);
  return min * 60 + sec + frac / 100;
}

function timeToSrt(t) {
  t = round2(t);
  var h = Math.floor(t / 3600);
  var m = Math.floor((t % 3600) / 60);
  var s = Math.floor(t % 60);
  var ms = Math.round((t % 1) * 1000);
  return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + ',' + pad(ms, 3);
}

function filenameBase(name) {
  return name.replace(/\.[^.]+$/, '');
}

// ===== Helpers =====
var $id = document.getElementById.bind(document);
var $q = document.querySelector.bind(document);
var $qa = document.querySelectorAll.bind(document);

function el(tag) { return document.createElement(tag); }

function attr(el, name, val) { el.setAttribute(name, val); return el; }

function cls(el) {
  for (var i = 1; i < arguments.length; i++) el.classList.add(arguments[i]);
  return el;
}

function append(parent) {
  for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]);
  return parent;
}

// ===== State =====
var state = {
  audio: null,
  audioUrl: null,
  audioName: '',
  lines: [],
  currentIdx: -1,
  offset: 0,
  appliedOffsetStep: 0,
  focusMode: false,
  title: '',
  artist: '',
  useCheckboxes: true,
  selectedIndices: [],
  batchMode: false
};

// ===== LRC Parser =====
function parseLRC(text) {
  var lines = [];
  var title = '';
  var artist = '';
  var fileOffsetMs = 0;
  text.split('\n').forEach(function(line) {
    line = line.trim();
    if (!line) return;
    var remaining = line;
    var times = [];
    var match;
    while ((match = remaining.match(/^\[(\d{2}):(\d{2})[.:](\d{2,3})\]/)) !== null) {
      var min = parseInt(match[1], 10);
      var sec = parseInt(match[2], 10);
      var frac = parseInt(match[3], 10);
      times.push(min * 60 + sec + frac / (match[3].length === 3 ? 1000 : 100));
      remaining = remaining.slice(match[0].length);
    }
    if (times.length > 0) {
      lines.push({ start: times[0], text: remaining.trim() || '', locked: false });
      return;
    }
    var ti = line.match(/^\[ti:(.*)\]/i);
    if (ti) { title = ti[1].trim(); return; }
    var ar = line.match(/^\[ar:(.*)\]/i);
    if (ar) { artist = ar[1].trim(); return; }
    var off = line.match(/^\[offset:([+-]?\d+)\]/i);
    if (off) { fileOffsetMs = parseInt(off[1], 10); return; }
    if (line && !line.match(/^\[.+\]$/)) {
      lines.push({ start: 0, text: line });
    }
  });
  if (fileOffsetMs !== 0) {
    var offsetSec = fileOffsetMs / 1000;
    lines.forEach(function(l) { l.start = Math.max(0, l.start + offsetSec); });
  }
  lines.sort(function(a, b) { return a.start - b.start; });
  return { lines: lines, title: title, artist: artist };
}

// ===== Generators =====
function generateLRC() {
  var lrc = '';
  if (state.title) lrc += '[ti:' + state.title + ']\n';
  if (state.artist) lrc += '[ar:' + state.artist + ']\n';
  state.lines.forEach(function(line) {
    var adjusted = round2(line.start + state.offset);
    lrc += '[' + timeToStr(adjusted) + ']' + line.text + '\n';
  });
  return lrc;
}

function generateSRT() {
  var srt = '';
  state.lines.forEach(function(line, i) {
    var start = round2(line.start + state.offset);
    var end = i < state.lines.length - 1
      ? round2(state.lines[i + 1].start + state.offset)
      : round2(start + 5);
    srt += (i + 1) + '\n';
    srt += timeToSrt(start) + ' --> ' + timeToSrt(end) + '\n';
    srt += line.text + '\n\n';
  });
  return srt;
}

// ===== Rendering =====
function renderTable() {
  var tbody = $id('tableBody');
  tbody.innerHTML = '';
  if (state.lines.length === 0) {
    var row = el('tr');
    var td = append(el('td'), document.createTextNode('\u6682\u65e0\u6b4c\u8bcd\uff0c\u8bf7\u5bfc\u5165 LRC \u6216\u7c98\u8d34\u6b4c\u8bcd\u6587\u672c'));
    td.className = 'text-center text-muted py-4';
    td.colSpan = 4;
    row.appendChild(td);
    tbody.appendChild(row);
    updateLineCount();
    return;
  }
  if (state.currentIdx >= state.lines.length) state.currentIdx = -1;
  var prefMax = -Infinity;
  state.lines.forEach(function(line, i) {
    var isActive = (i === state.currentIdx);
    var isReachable = i === 0 || line.start >= prefMax;
    if (line.start > prefMax) prefMax = line.start;
    var tr = el('tr');
    if (isActive) tr.classList.add('active');
    if (!isReachable) tr.classList.add('line-disabled');
    tr.dataset.idx = i;

    var dragTd = cls(el('td'), 'col-drag');
    if (state.useCheckboxes) {
      var cb = el('input');
      cb.type = 'checkbox';
      cb.className = 'row-checkbox';
      if (state.selectedIndices.indexOf(i) >= 0) cb.checked = true;
      dragTd.appendChild(cb);
    } else {
      var handle = el('span');
      handle.className = 'drag-handle';
      handle.textContent = '\u283f';
      dragTd.appendChild(handle);
    }

    var indicator = cls(el('td'), 'col-indicator');
    indicator.textContent = isActive ? '\u25b6' : '';

    var timeStr = timeToStr(line.start);
    var timeTd = cls(el('td'), 'col-time');
    if (line.locked) timeTd.classList.add('time-locked');
    var timeInput = el('input');
    timeInput.className = 'form-control form-control-sm time-edit-input';
    timeInput.value = timeStr;
    timeInput.disabled = line.locked;
    timeTd.appendChild(timeInput);
    var decBtn = el('button');
    decBtn.className = 'btn btn-sm btn-outline-secondary btn-time';
    decBtn.setAttribute('data-action', 'dec');
    decBtn.innerHTML = '&minus;';
    decBtn.disabled = line.locked;
    timeTd.appendChild(decBtn);
    var incBtn = el('button');
    incBtn.className = 'btn btn-sm btn-outline-secondary btn-time';
    incBtn.setAttribute('data-action', 'inc');
    incBtn.textContent = '+';
    incBtn.disabled = line.locked;
    timeTd.appendChild(incBtn);

    var lyricTd = cls(el('td'), 'col-lyric');
    var lyricInput = el('input');
    lyricInput.className = 'form-control form-control-sm lyric-input';
    lyricInput.value = line.text;
    lyricTd.appendChild(lyricInput);
    var addBtn = el('button');
    addBtn.className = 'btn-row-add';
    addBtn.title = '\u5728\u540e\u6dfb\u52a0';
    addBtn.textContent = '+';
    lyricTd.appendChild(addBtn);
    var delBtn = el('button');
    delBtn.className = 'btn-row-del';
    delBtn.title = '\u5220\u9664\u6b64\u884c';
    delBtn.innerHTML = '&times;';
    lyricTd.appendChild(delBtn);

    append(tr, dragTd, indicator, timeTd, lyricTd);
    tbody.appendChild(tr);
  });
  updateLineCount();
  scrollToCurrent();
  if (!state.useCheckboxes) initSortable();
}

var _sortable = null;

function initSortable() {
  if (_sortable) _sortable.destroy();
  if (state.useCheckboxes) return;
  var el = $id('tableBody');
  if (!el || el.children.length === 0) return;
  _sortable = new Sortable(el, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: function(evt) {
      var fromIdx = evt.oldIndex;
      var toIdx = evt.newIndex;
      if (fromIdx === toIdx) return;
      var item = state.lines.splice(fromIdx, 1)[0];
      state.lines.splice(toIdx, 0, item);
      if (state.currentIdx === fromIdx) {
        state.currentIdx = toIdx;
      } else if (state.currentIdx > fromIdx && state.currentIdx <= toIdx) {
        state.currentIdx--;
      } else if (state.currentIdx < fromIdx && state.currentIdx >= toIdx) {
        state.currentIdx++;
      }
      renderTable();
    }
  });
}

function scrollToCurrent() {
  if (state.lines.length === 0) return;
  var row = $q('#tableBody tr.active');
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function updateHighlight() {
  var idx = state.currentIdx;
  var active = $q('#tableBody tr.active');
  if (active) {
    active.classList.remove('active');
    var ind = active.querySelector('.col-indicator');
    if (ind) ind.textContent = '';
  }
  if (idx >= 0) {
    var row = $qa('#tableBody tr')[idx];
    if (row) {
      row.classList.add('active');
      var ind = row.querySelector('.col-indicator');
      if (ind) ind.textContent = '\u25b6';
    }
  }
  if (state.focusMode) renderFocus();
  scrollToCurrent();
  updateLineCount();
}

function updateLineCount() {
  var s = state.lines.length + ' \u53e5';
  if (state.currentIdx >= 0) s += ' \uff08\u5f53\u524d: ' + (state.currentIdx + 1) + '\uff09';
  $id('lineCount').textContent = s;
}

function renderFocus() {
  if (state.currentIdx < 0 || state.currentIdx >= state.lines.length) {
    $id('focusLyric').textContent = '\u2014';
    $id('focusLyric').style.fontSize = '2.2rem';
    $id('focusTime').value = '00:00.00';
    $id('focusIdx').textContent = '- / -';
    $id('focusPrevLine').textContent = '';
    $id('focusPrevLine').parentElement.style.display = 'none';
    $id('focusNextLine').textContent = '';
    $id('focusNextLine').parentElement.style.display = 'none';
    return;
  }
  var line = state.lines[state.currentIdx];
  var locked = line.locked;
  $id('focusLyric').textContent = line.text;
  $id('focusTime').value = timeToStr(line.start);
  $id('focusDec').disabled = locked;
  $id('focusInc').disabled = locked;
  $id('focusSnap').disabled = locked;
  $id('focusTime').disabled = locked;
  var idxW = String(state.lines.length).length * 2 + 1;
  $id('focusIdx').textContent = (state.currentIdx + 1) + ' / ' + state.lines.length;
  $id('focusIdx').style.minWidth = idxW + 'em';
  if (state.currentIdx > 0) {
    $id('focusPrevLine').textContent = state.lines[state.currentIdx - 1].text;
    $id('focusPrevLine').parentElement.style.display = '';
  } else {
    $id('focusPrevLine').textContent = '(\u65e0)';
    $id('focusPrevLine').parentElement.style.display = '';
  }
  if (state.currentIdx < state.lines.length - 1) {
    $id('focusNextLine').textContent = state.lines[state.currentIdx + 1].text;
    $id('focusNextLine').parentElement.style.display = '';
  } else {
    $id('focusNextLine').textContent = '(\u65e0)';
    $id('focusNextLine').parentElement.style.display = '';
  }
}

function updateTimeDisplay() {
  var audio = state.audio;
  if (!audio || !audio.src) {
    $id('timeDisplay').textContent = '00:00.00 / 00:00.00';
    return;
  }
  var cur = audio.currentTime || 0;
  var dur = audio.duration || 0;
  $id('timeDisplay').textContent = timeToStr(cur) + ' / ' + timeToStr(dur);
}

// ===== Audio Sync =====
function onTimeUpdate() {
  updateTimeDisplay();
  var audio = state.audio;
  if (!audio || !audio.src || state.lines.length === 0) return;
  var adj = audio.currentTime - state.offset;
  var lines = state.lines;
  var idx = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].start <= adj) idx = i;
    else break;
  }
  if (idx !== state.currentIdx) {
    state.currentIdx = idx;
    updateHighlight();
  }
}

// ===== Actions =====
function setCurrentLine(idx) {
  if (idx < 0 || idx >= state.lines.length) return;
  state.currentIdx = idx;
  updateHighlight();
  var audio = state.audio;
  if (audio && audio.src) {
    audio.currentTime = state.lines[idx].start + state.offset;
  }
}

function snapTime() {
  var idx = state.currentIdx;
  if (idx < 0 || idx >= state.lines.length) return;
  if (state.lines[idx].locked) return;
  var audio = state.audio;
  if (!audio || !audio.src) return;
  state.lines[idx].start = round2(Math.max(0, audio.currentTime - state.offset));
  renderTable();
}

function adjustTime(idx, delta) {
  if (idx < 0 || idx >= state.lines.length) return;
  if (state.lines[idx].locked) return;
  state.lines[idx].start = round2(Math.max(0, state.lines[idx].start + delta));
  renderTable();
}

function addLineAt(idx) {
  var start = 0;
  var audio = state.audio;
  if (audio && audio.src && isFinite(audio.currentTime)) {
    start = round2(Math.max(0, audio.currentTime - state.offset));
  } else if (idx > 0 && idx <= state.lines.length && state.lines.length > 0) {
    start = state.lines[idx - 1].start + 1;
  } else if (state.lines.length > 0) {
    start = state.lines[0].start;
  }
  state.lines.splice(idx, 0, { start: start, text: '', locked: false });
  state.currentIdx = idx;
  renderTable();
  var rows = $qa('#tableBody tr');
  if (rows[idx]) rows[idx].querySelector('.lyric-input').focus();
}

function deleteLine(idx) {
  if (state.lines.length === 0) return;
  state.lines.splice(idx, 1);
  if (state.lines.length === 0) {
    state.currentIdx = -1;
  } else if (idx >= state.lines.length) {
    state.currentIdx = state.lines.length - 1;
  } else {
    state.currentIdx = idx;
  }
  renderTable();
}

function batchOffset(delta) {
  state.selectedIndices.forEach(function(i) {
    if (state.lines[i].locked) return;
    state.lines[i].start = round2(Math.max(0, state.lines[i].start + delta));
  });
  renderTable();
}

function setOffset(valCS) {
  var delta = (valCS - state.appliedOffsetStep) * 0.05;
  if (delta !== 0) {
    state.appliedOffsetStep = valCS;
    state.lines.forEach(function(line) {
      if (line.locked) return;
      line.start = round2(Math.max(0, line.start + delta));
    });
    renderTable();
    if (state.focusMode) renderFocus();
  }
  onTimeUpdate();
}

function toggleFocus() {
  state.focusMode = !state.focusMode;
  if (state.focusMode) {
    $id('tableView').classList.add('d-none');
    $id('focusView').classList.remove('d-none');
    $id('focusToggle').textContent = '\u9000\u51fa\u4e13\u6ce8';
    renderFocus();
  } else {
    $id('tableView').classList.remove('d-none');
    $id('focusView').classList.add('d-none');
    $id('focusToggle').textContent = '\u4e13\u6ce8';
    renderTable();
  }
}

// ===== Load Data =====
function loadLyricsFromLines(newLines) {
  state.lines = newLines;
  state.currentIdx = state.lines.length > 0 ? 0 : -1;
  state.offset = 0;
  state.appliedOffsetStep = 0;
  if (state.focusMode) {
    renderFocus();
  } else {
    renderTable();
  }
  syncMetadata();
}

function syncMetadata() {
  if (state.title) $id('titleInput').value = state.title;
  if (state.artist) $id('artistInput').value = state.artist;
}

// ===== Export =====
function downloadFile(content, filename, mime) {
  mime = mime || 'text/plain';
  var blob = new Blob([content], { type: mime + ';charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function doExportLRC() {
  if (state.lines.length === 0) return;
  var base = filenameBase(state.audioName) || 'lyrics';
  downloadFile(generateLRC(), base + '.lrc');
}

function doExportSRT() {
  if (state.lines.length === 0) return;
  var base = filenameBase(state.audioName) || 'lyrics';
  downloadFile(generateSRT(), base + '.srt');
}

// ===== File Handlers =====
function onAudioFile(file) {
  if (!file) return;
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  state.audioName = file.name;
  $id('audioName').textContent = file.name;
  state.audio.src = state.audioUrl;
  state.audio.load();
}

function onLRCFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var result = parseLRC(e.target.result);
    state.title = result.title;
    state.artist = result.artist;
    loadLyricsFromLines(result.lines);
  };
  reader.readAsText(file);
}

function onLyricsText(text) {
  if (!text.trim()) return;
  var result = parseLRC(text);
  if (!state.title && result.title) state.title = result.title;
  if (!state.artist && result.artist) state.artist = result.artist;
  loadLyricsFromLines(result.lines);
}

// ===== Keyboard =====
function onKeyDown(e) {
  var tag = e.target.tagName;
  var editing = (tag === 'INPUT' || tag === 'TEXTAREA');
  if (e.key === ' ' && !editing) {
    e.preventDefault();
    var audio = state.audio;
    if (!audio || !audio.src) return;
    if (audio.paused) audio.play(); else audio.pause();
    return;
  }
  if (e.key === 's' && !editing) {
    e.preventDefault();
    snapTime();
    return;
  }
  if (e.key === 'f' && !editing) {
    e.preventDefault();
    toggleFocus();
    return;
  }
  if (e.key === 'Escape') {
    if (state.focusMode) {
      toggleFocus();
      return;
    }
    return;
  }
  if ((e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && state.focusMode)) && !editing) {
    e.preventDefault();
    if (state.currentIdx > 0) setCurrentLine(state.currentIdx - 1);
    return;
  }
  if ((e.key === 'ArrowDown' || (e.key === 'ArrowRight' && state.focusMode)) && !editing) {
    e.preventDefault();
    if (state.currentIdx < state.lines.length - 1) setCurrentLine(state.currentIdx + 1);
    return;
  }
}

// ===== Init =====
(function() {
  state.audio = $id('audioPlayer');
  var pasteModalEl = $id('pasteModal');
  var pasteModal = new bootstrap.Modal(pasteModalEl);

  // Audio events
  state.audio.addEventListener('loadedmetadata', function() {
    updateTimeDisplay();
  });

  // rAF sync loop
  function syncLoop() {
    onTimeUpdate();
    requestAnimationFrame(syncLoop);
  }
  requestAnimationFrame(syncLoop);

  // Upload audio
  $id('audioInput').addEventListener('change', function() {
    if (this.files && this.files[0]) onAudioFile(this.files[0]);
  });

  // Upload LRC
  $id('lrcInput').addEventListener('change', function() {
    if (this.files && this.files[0]) onLRCFile(this.files[0]);
  });

  // Paste lyrics
  $id('confirmPaste').addEventListener('click', function() {
    var text = $id('lyricsTextarea').value;
    if (text.trim()) {
      onLyricsText(text);
      pasteModal.hide();
      $id('lyricsTextarea').value = '';
    }
  });
  pasteModalEl.addEventListener('hidden.bs.modal', function() {
    $id('lyricsTextarea').value = '';
  });

  // Offset buttons
  $id('offsetDec').addEventListener('click', function() {
    if (state.batchMode && state.selectedIndices.length > 0) {
      batchOffset(-0.05);
    } else {
      setOffset(Math.max(-200, state.appliedOffsetStep - 1));
    }
  });
  $id('offsetInc').addEventListener('click', function() {
    if (state.batchMode && state.selectedIndices.length > 0) {
      batchOffset(0.05);
    } else {
      setOffset(Math.min(200, state.appliedOffsetStep + 1));
    }
  });

  // Mode toggle
  $id('modeToggle').addEventListener('click', function() {
    state.useCheckboxes = !state.useCheckboxes;
    if (!state.useCheckboxes) {
      state.selectedIndices = [];
      if (state.batchMode) {
        state.batchMode = false;
        $q('#batchMenu [data-action="batch-offset"]').classList.remove('active');
        $id('offsetDec').classList.remove('btn-batch');
        $id('offsetInc').classList.remove('btn-batch');
        $id('offsetLabel').textContent = '\u5168\u5c40\u504f\u79fb\uff1a';
      }
    }
    this.textContent = state.useCheckboxes ? '\u62d6\u62fd' : '\u591a\u9009';
    renderTable();
  });

  // Batch dropdown
  $id('batchMenu').addEventListener('click', function(e) {
    var item = e.target.closest('[data-action]');
    if (!item) return;
    var action = item.dataset.action;
    if (action === 'batch-offset') {
      state.batchMode = !state.batchMode;
      item.classList.toggle('active', state.batchMode);
      $id('offsetDec').classList.toggle('btn-batch', state.batchMode);
      $id('offsetInc').classList.toggle('btn-batch', state.batchMode);
      $id('offsetLabel').textContent = state.batchMode ? '\u6279\u91cf\u504f\u79fb\uff1a' : '\u5168\u5c40\u504f\u79fb\uff1a';
    } else if (action === 'toggle-lock') {
      state.selectedIndices.forEach(function(i) { state.lines[i].locked = !state.lines[i].locked; });
      state.selectedIndices = [];
      renderTable();
    } else if (action === 'delete-selected') {
      var indices = state.selectedIndices.slice().sort(function(a, b) { return b - a; });
      if (indices.length === 0) return;
      indices.forEach(function(i) { state.lines.splice(i, 1); });
      state.selectedIndices = [];
      state.currentIdx = -1;
      if (state.batchMode) {
        state.batchMode = false;
        $q('#batchMenu [data-action="batch-offset"]').classList.remove('active');
        $id('offsetDec').classList.remove('btn-batch');
        $id('offsetInc').classList.remove('btn-batch');
        $id('offsetLabel').textContent = '\u5168\u5c40\u504f\u79fb\uff1a';
      }
      renderTable();
    }
  });

  // Row checkbox
  $id('tableBody').addEventListener('change', function(e) {
    var cb = e.target.closest('.row-checkbox');
    if (!cb) return;
    var idx = parseInt(cb.closest('tr').dataset.idx, 10);
    if (cb.checked) {
      if (state.selectedIndices.indexOf(idx) < 0) state.selectedIndices.push(idx);
    } else {
      state.selectedIndices = state.selectedIndices.filter(function(i) { return i !== idx; });
    }
  });

  // Focus toggle
  $id('focusToggle').addEventListener('click', toggleFocus);

  // Table: row click (seek)
  $id('tableBody').addEventListener('click', function(e) {
    if (e.target.closest('button, input, .btn-time')) return;
    var tr = e.target.closest('tr');
    if (!tr) return;
    var idx = parseInt(tr.dataset.idx, 10);
    if (!isNaN(idx)) setCurrentLine(idx);
  });

  // Table: time adjust buttons
  $id('tableBody').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="dec"]');
    if (btn) {
      var idx = parseInt(btn.closest('tr').dataset.idx, 10);
      adjustTime(idx, -0.05);
    }
  });
  $id('tableBody').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="inc"]');
    if (btn) {
      var idx = parseInt(btn.closest('tr').dataset.idx, 10);
      adjustTime(idx, 0.05);
    }
  });

  // Table: lyric text change
  $id('tableBody').addEventListener('change', function(e) {
    var input = e.target.closest('.lyric-input');
    if (!input) return;
    var idx = parseInt(input.closest('tr').dataset.idx, 10);
    if (!isNaN(idx)) state.lines[idx].text = input.value;
  });

  // Table: time input change
  $id('tableBody').addEventListener('change', function(e) {
    var input = e.target.closest('.time-edit-input');
    if (!input) return;
    var idx = parseInt(input.closest('tr').dataset.idx, 10);
    var newTime = strToTime(input.value);
    state.lines[idx].start = round2(newTime);
    renderTable();
  });

  // Table: add / delete row buttons
  $id('tableBody').addEventListener('click', function(e) {
    var btn = e.target.closest('.btn-row-add');
    if (btn) {
      var idx = parseInt(btn.closest('tr').dataset.idx, 10);
      addLineAt(idx + 1);
    }
  });
  $id('tableBody').addEventListener('click', function(e) {
    var btn = e.target.closest('.btn-row-del');
    if (btn) {
      var idx = parseInt(btn.closest('tr').dataset.idx, 10);
      deleteLine(idx);
    }
  });
  $id('headAddBtn').addEventListener('click', function() {
    addLineAt(0);
  });

  // Focus: time input direct edit
  $id('focusTime').addEventListener('change', function() {
    if (state.currentIdx < 0 || state.currentIdx >= state.lines.length) return;
    if (state.lines[state.currentIdx].locked) return;
    var t = strToTime(this.value);
    state.lines[state.currentIdx].start = round2(t);
    renderFocus();
  });

  // Focus mode controls
  $id('focusPrev').addEventListener('click', function() {
    if (state.currentIdx > 0) setCurrentLine(state.currentIdx - 1);
  });
  $id('focusNext').addEventListener('click', function() {
    if (state.currentIdx < state.lines.length - 1) setCurrentLine(state.currentIdx + 1);
  });
  $id('focusDec').addEventListener('click', function() {
    adjustTime(state.currentIdx, -0.05);
    if (state.focusMode) renderFocus();
  });
  $id('focusInc').addEventListener('click', function() {
    adjustTime(state.currentIdx, 0.05);
    if (state.focusMode) renderFocus();
  });
  $id('focusSnap').addEventListener('click', function() {
    snapTime();
    if (state.focusMode) renderFocus();
  });

  // Metadata inputs
  $id('titleInput').addEventListener('change', function() { state.title = this.value; });
  $id('artistInput').addEventListener('change', function() { state.artist = this.value; });

  // Export
  $id('exportLrc').addEventListener('click', doExportLRC);
  $id('exportSrt').addEventListener('click', doExportSRT);

  // Drag & Drop
  var dropCount = 0;
  function isAudioFile(file) {
    return file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|aac|m4a|wma)$/i.test(file.name);
  }
  function isLyricsFile(file) {
    return /\.(lrc|txt)$/i.test(file.name);
  }
  document.addEventListener('dragenter', function(e) {
    e.preventDefault();
    dropCount++;
    document.body.classList.add('drag-over');
  });
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
  });
  document.addEventListener('dragleave', function(e) {
    e.preventDefault();
    dropCount--;
    if (dropCount <= 0) { dropCount = 0; document.body.classList.remove('drag-over'); }
  });
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    dropCount = 0;
    document.body.classList.remove('drag-over');
    var files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (isAudioFile(f)) { onAudioFile(f); }
      else if (isLyricsFile(f)) { onLRCFile(f); }
    }
  });

  // Keyboard
  document.addEventListener('keydown', onKeyDown);

  // Initial render
  renderTable();
  updateTimeDisplay();
})();
