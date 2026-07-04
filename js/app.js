'use strict';

// ===== Utilities =====
function pad(n, w) { return String(Math.floor(n)).padStart(w, '0'); }

function floor2(t) { return Math.round(t * 100) / 100; }

function timeToStr(t) {
  t = floor2(t);
  var m = Math.floor(t / 60);
  var s = Math.floor(t % 60);
  var cs = Math.round((t % 1) * 100) % 100;
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
  t = floor2(t);
  var h = Math.floor(t / 3600);
  var m = Math.floor((t % 3600) / 60);
  var s = Math.floor(t % 60);
  var ms = Math.round((t % 1) * 1000) % 1000;
  return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + ',' + pad(ms, 3);
}

function filenameBase(name) {
  return name.replace(/\.[^.]+$/, '');
}

// ===== State =====
var state = {
  audio: null,
  audioUrl: null,
  audioName: '',
  lines: [],
  currentIdx: -1,
  offset: 0,
  focusMode: false,
  title: '',
  artist: ''
};
var _appliedOffsetStep = 0;

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
      lines.push({ start: times[0], text: remaining.trim() || '' });
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
    var adjusted = floor2(line.start + state.offset);
    lrc += '[' + timeToStr(adjusted) + ']' + line.text + '\n';
  });
  return lrc;
}

function generateSRT() {
  var srt = '';
  state.lines.forEach(function(line, i) {
    var start = floor2(line.start + state.offset);
    var end = i < state.lines.length - 1
      ? floor2(state.lines[i + 1].start + state.offset)
      : floor2(start + 5);
    srt += (i + 1) + '\n';
    srt += timeToSrt(start) + ' --> ' + timeToSrt(end) + '\n';
    srt += line.text + '\n\n';
  });
  return srt;
}

// ===== Rendering =====
function renderTable() {
  _scanStart = 0;
  var tbody = $('#tableBody').empty();
  if (state.lines.length === 0) {
    tbody.append('<tr><td colspan="4" class="text-center text-muted py-4">暂无歌词，请导入 LRC 或粘贴歌词文本</td></tr>');
    updateLineCount();
    return;
  }
  if (state.currentIdx >= state.lines.length) state.currentIdx = -1;
  var prefMax = -Infinity;
  state.lines.forEach(function(line, i) {
    var isActive = (i === state.currentIdx);
    var isReachable = i === 0 || line.start >= prefMax;
    if (line.start > prefMax) prefMax = line.start;
    var tr = $('<tr>').toggleClass('active', isActive).toggleClass('line-disabled', !isReachable).data('idx', i);
    var dragTd = $('<td>').addClass('col-drag').append($('<span>').addClass('drag-handle').text('\u283f'));
    var indicator = $('<td>').addClass('col-indicator').text(isActive ? '\u25b6' : '');
    var timeStr = timeToStr(line.start);
    var timeTd = $('<td>').addClass('col-time');
    timeTd.append($('<input>').addClass('form-control form-control-sm time-edit-input').val(timeStr));
    timeTd.append($('<button>').addClass('btn btn-sm btn-outline-secondary btn-time').attr('data-action', 'dec').html('&minus;'));
    timeTd.append($('<button>').addClass('btn btn-sm btn-outline-secondary btn-time').attr('data-action', 'inc').text('+'));
    var lyricTd = $('<td>').addClass('col-lyric');
    lyricTd.append($('<input>').addClass('form-control form-control-sm lyric-input').val(line.text));
    lyricTd.append($('<button>').addClass('btn-row-add').attr('title', '\u5728\u540e\u6dfb\u52a0').text('+'));
    lyricTd.append($('<button>').addClass('btn-row-del').attr('title', '\u5220\u9664\u6b64\u884c').html('&times;'));
    tr.append(dragTd, indicator, timeTd, lyricTd);
    tbody.append(tr);
  });
  updateLineCount();
  scrollToCurrent();
  initSortable();
}

var _sortable = null;

function initSortable() {
  if (_sortable) _sortable.destroy();
  var el = document.getElementById('tableBody');
  if (!el || el.children.length === 0) return;
  _sortable = new Sortable(el, {
    handle: '.drag-handle',
    animation: 150,
    easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    onEnd: function(evt) {
      var fromIdx = evt.oldIndex;
      var toIdx = evt.newIndex;
      if (fromIdx === toIdx) return;
      var item = state.lines.splice(fromIdx, 1)[0];
      state.lines.splice(toIdx, 0, item);
      renderTable();
    }
  });
}

function scrollToCurrent() {
  if (state.lines.length === 0) return;
  var row = $('#tableBody tr.active');
  if (row.length) row[0].scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function updateHighlight() {
  var idx = state.currentIdx;
  _scanStart = Math.max(0, idx);
  $('#tableBody tr.active').removeClass('active').find('.col-indicator').text('');
  if (idx >= 0) {
    var row = $('#tableBody tr').eq(idx);
    row.addClass('active');
    row.find('.col-indicator').text('\u25b6');
  }
  if (state.focusMode) renderFocus();
  scrollToCurrent();
  updateLineCount();
}

function updateLineCount() {
  var s = state.lines.length + ' \u53e5';
  if (state.currentIdx >= 0) s += ' \uff08\u5f53\u524d: ' + (state.currentIdx + 1) + '\uff09';
  $('#lineCount').text(s);
}

function renderFocus() {
  if (state.currentIdx < 0 || state.currentIdx >= state.lines.length) {
    $('#focusLyric').text('\u2014').css('fontSize', '2.2rem');
    $('#focusTime').val('00:00.00');
    $('#focusIdx').text('- / -');
    $('#focusPrevLine').text('').parent().hide();
    $('#focusNextLine').text('').parent().hide();
    return;
  }
  var line = state.lines[state.currentIdx];
  $('#focusLyric').text(line.text);
  $('#focusTime').val(timeToStr(line.start));
  var idxW = String(state.lines.length).length * 2 + 1;
  $('#focusIdx').text((state.currentIdx + 1) + ' / ' + state.lines.length).css('min-width', idxW + 'em');
  if (state.currentIdx > 0) {
    $('#focusPrevLine').text(state.lines[state.currentIdx - 1].text).parent().show();
  } else {
    $('#focusPrevLine').text('(\u65e0)').parent().show();
  }
  if (state.currentIdx < state.lines.length - 1) {
    $('#focusNextLine').text(state.lines[state.currentIdx + 1].text).parent().show();
  } else {
    $('#focusNextLine').text('(\u65e0)').parent().show();
  }
  fitFocusText();
}

function fitFocusText() {
  var el = document.getElementById('focusLyric');
  if (!el || !el.textContent) return;
  el.style.fontSize = '2.2rem';
  var w = el.clientWidth;
  while (el.scrollWidth > w && parseFloat(el.style.fontSize) > 0.8) {
    el.style.fontSize = (parseFloat(el.style.fontSize) - 0.1) + 'rem';
  }
}

function updateTimeDisplay() {
  var audio = state.audio;
  if (!audio || !audio.src) {
    $('#timeDisplay').text('00:00.00 / 00:00.00');
    return;
  }
  var cur = audio.currentTime || 0;
  var dur = audio.duration || 0;
  $('#timeDisplay').text(timeToStr(cur) + ' / ' + timeToStr(dur));
}

// ===== Audio Sync =====
var _scanStart = 0;

function onTimeUpdate() {
  updateTimeDisplay();
  var audio = state.audio;
  if (!audio || !audio.src || state.lines.length === 0) return;
  var adj = audio.currentTime - state.offset;
  var lines = state.lines;
  var idx = -1;
  if (_scanStart > 0 && adj >= lines[_scanStart - 1].start) {
    for (var i = _scanStart; i < lines.length; i++) {
      if (lines[i].start <= adj) idx = i;
      else break;
    }
  } else {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].start <= adj) idx = i;
      else break;
    }
  }
  if (idx >= 0) _scanStart = idx;
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
  var audio = state.audio;
  if (!audio || !audio.src) return;
  state.lines[idx].start = floor2(Math.max(0, audio.currentTime - state.offset));
  renderTable();
}

function adjustTime(idx, delta) {
  if (idx < 0 || idx >= state.lines.length) return;
  state.lines[idx].start = floor2(Math.max(0, state.lines[idx].start + delta));
  renderTable();
}

function addLineAt(idx) {
  var start = 0;
  var audio = state.audio;
  if (audio && audio.src && isFinite(audio.currentTime)) {
    start = floor2(Math.max(0, audio.currentTime - state.offset));
  } else if (idx > 0 && idx <= state.lines.length && state.lines.length > 0) {
    start = state.lines[idx - 1].start + 1;
  } else if (state.lines.length > 0) {
    start = state.lines[0].start;
  }
  state.lines.splice(idx, 0, { start: start, text: '' });
  state.currentIdx = idx;
  renderTable();
  var row = $('#tableBody tr').eq(idx);
  if (row.length) row.find('.lyric-input').focus();
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

function setOffset(valCS) {
  var delta = (valCS - _appliedOffsetStep) * 0.05;
  if (delta !== 0) {
    _appliedOffsetStep = valCS;
    state.lines.forEach(function(line) {
      line.start = floor2(Math.max(0, line.start + delta));
    });
    renderTable();
    if (state.focusMode) renderFocus();
  }
  $('#offsetValue').text((valCS * 0.05).toFixed(2));
  onTimeUpdate();
}

function toggleFocus() {
  state.focusMode = !state.focusMode;
  if (state.focusMode) {
    $('#tableView').addClass('d-none');
    $('#focusView').removeClass('d-none');
    $('#focusToggle').text('\u9000\u51fa\u4e13\u6ce8');
    renderFocus();
  } else {
    $('#tableView').removeClass('d-none');
    $('#focusView').addClass('d-none');
    $('#focusToggle').text('\u4e13\u6ce8');
    renderTable();
  }
}

// ===== Load Data =====
function loadLyricsFromLines(newLines) {
  state.lines = newLines;
  state.currentIdx = state.lines.length > 0 ? 0 : -1;
  state.offset = 0;
  _appliedOffsetStep = 0;
  $('#offsetSlider').val(0);
  $('#offsetValue').text('0.00');
  if (state.focusMode) {
    renderFocus();
  } else {
    renderTable();
  }
  syncMetadata();
}

function syncMetadata() {
  if (state.title) $('#titleInput').val(state.title);
  if (state.artist) $('#artistInput').val(state.artist);
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
  $('#audioName').text(file.name);
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
$(document).ready(function() {
  state.audio = document.getElementById('audioPlayer');
  var pasteModal = new bootstrap.Modal('#pasteModal');

  // Audio events
  state.audio.addEventListener('loadedmetadata', function() {
    updateTimeDisplay();
  });

  // rAF sync loop (~60fps, auto-pauses when tab hidden)
  function syncLoop() {
    onTimeUpdate();
    requestAnimationFrame(syncLoop);
  }
  requestAnimationFrame(syncLoop);

  // Upload audio
  $('#audioInput').change(function() {
    if (this.files && this.files[0]) onAudioFile(this.files[0]);
  });

  // Upload LRC
  $('#lrcInput').change(function() {
    if (this.files && this.files[0]) onLRCFile(this.files[0]);
  });

  // Paste lyrics
  $('#confirmPaste').click(function() {
    var text = $('#lyricsTextarea').val();
    if (text.trim()) {
      onLyricsText(text);
      pasteModal.hide();
      $('#lyricsTextarea').val('');
    }
  });
  $('#pasteModal').on('hidden.bs.modal', function() {
    $('#lyricsTextarea').val('');
  });

  // Offset slider
  $('#offsetSlider').on('input', function() {
    setOffset(parseInt($(this).val(), 10));
  });
  $('#offsetDec').click(function() {
    var v = parseInt($('#offsetSlider').val(), 10) - 1;
    if (v < -200) v = -200;
    $('#offsetSlider').val(v);
    setOffset(v);
  });
  $('#offsetInc').click(function() {
    var v = parseInt($('#offsetSlider').val(), 10) + 1;
    if (v > 200) v = 200;
    $('#offsetSlider').val(v);
    setOffset(v);
  });

  // Focus toggle
  $('#focusToggle').click(toggleFocus);

  // Table: row click (seek)
  $('#tableBody').on('click', 'tr', function(e) {
    if ($(e.target).is('button, input, .btn-time')) return;
    var idx = $(this).data('idx');
    if (idx !== undefined) setCurrentLine(idx);
  });

  // Table: time adjust buttons
  $('#tableBody').on('click', '[data-action="dec"]', function() {
    var idx = $(this).closest('tr').data('idx');
    adjustTime(idx, -0.05);
  });
  $('#tableBody').on('click', '[data-action="inc"]', function() {
    var idx = $(this).closest('tr').data('idx');
    adjustTime(idx, 0.05);
  });

  // Table: lyric text change
  $('#tableBody').on('change', '.lyric-input', function() {
    var idx = $(this).closest('tr').data('idx');
    if (idx !== undefined) state.lines[idx].text = $(this).val();
  });

  // Table: time input change
  $('#tableBody').on('change', '.time-edit-input', function() {
    var idx = $(this).closest('tr').data('idx');
    var newTime = strToTime($(this).val());
    state.lines[idx].start = floor2(newTime);
    renderTable();
  });

  // Table: add / delete row buttons
  $('#tableBody').on('click', '.btn-row-add', function() {
    var idx = $(this).closest('tr').data('idx');
    addLineAt(idx + 1);
  });
  $('#tableBody').on('click', '.btn-row-del', function() {
    var idx = $(this).closest('tr').data('idx');
    deleteLine(idx);
  });
  $('#headAddBtn').click(function() {
    addLineAt(0);
  });

  // Focus: time input direct edit
  $('#focusTime').on('change', function() {
    if (state.currentIdx < 0 || state.currentIdx >= state.lines.length) return;
    var t = strToTime($(this).val());
    state.lines[state.currentIdx].start = floor2(t);
    renderFocus();
  });

  // Focus mode controls
  $('#focusPrev').click(function() {
    if (state.currentIdx > 0) setCurrentLine(state.currentIdx - 1);
  });
  $('#focusNext').click(function() {
    if (state.currentIdx < state.lines.length - 1) setCurrentLine(state.currentIdx + 1);
  });
  $('#focusDec').click(function() {
    adjustTime(state.currentIdx, -0.05);
    if (state.focusMode) renderFocus();
  });
  $('#focusInc').click(function() {
    adjustTime(state.currentIdx, 0.05);
    if (state.focusMode) renderFocus();
  });
  $('#focusSnap').click(function() {
    snapTime();
    if (state.focusMode) renderFocus();
  });

  // Metadata inputs
  $('#titleInput').on('change', function() { state.title = $(this).val(); });
  $('#artistInput').on('change', function() { state.artist = $(this).val(); });

  // Export
  $('#exportLrc').click(doExportLRC);
  $('#exportSrt').click(doExportSRT);

  // Drag & Drop
  var dropCount = 0;
  function isAudioFile(file) {
    return file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|aac|m4a|wma)$/i.test(file.name);
  }
  function isLyricsFile(file) {
    return /\.(lrc|txt)$/i.test(file.name);
  }
  $(document).on('dragenter', function(e) {
    e.preventDefault();
    dropCount++;
    $('body').addClass('drag-over');
  });
  $(document).on('dragover', function(e) {
    e.preventDefault();
  });
  $(document).on('dragleave', function(e) {
    e.preventDefault();
    dropCount--;
    if (dropCount <= 0) { dropCount = 0; $('body').removeClass('drag-over'); }
  });
  $(document).on('drop', function(e) {
    e.preventDefault();
    dropCount = 0;
    $('body').removeClass('drag-over');
    var files = e.originalEvent.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (isAudioFile(f)) { onAudioFile(f); }
      else if (isLyricsFile(f)) { onLRCFile(f); }
    }
  });

  // Keyboard
  $(document).on('keydown', onKeyDown);

  // Initial render
  renderTable();
  updateTimeDisplay();
});
