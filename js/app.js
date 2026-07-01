'use strict';

// ===== Utilities =====
function pad2(n) { return String(Math.floor(n)).padStart(2, '0'); }

function pad3(n) { return String(Math.floor(n)).padStart(3, '0'); }

function floor2(t) {
  if (!isFinite(t) || t < 0) return 0;
  return Math.floor(t * 100) / 100;
}

function timeToStr(t) {
  t = floor2(t);
  var m = Math.floor(t / 60);
  var s = Math.floor(t % 60);
  var cs = Math.floor((t % 1) * 100);
  return pad2(m) + ':' + pad2(s) + '.' + pad2(cs);
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
  var ms = Math.floor((t % 1) * 1000);
  return pad2(h) + ':' + pad2(m) + ':' + pad2(s) + ',' + pad3(ms);
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

// ===== Bootstrap modals =====
var pasteModal = null;

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
    if (times.length > 0 && remaining.trim()) {
      lines.push({ start: times[0], text: remaining.trim() });
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
  var lrc = '[ti:' + (state.title || 'Untitled') + ']\n';
  lrc += '[ar:' + (state.artist || 'Unknown') + ']\n';
  lrc += '[offset:0]\n';
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
  var tbody = $('#tableBody').empty();
  if (state.lines.length === 0) {
    tbody.append('<tr><td colspan="3" class="text-center text-muted py-4">暂无歌词，请导入 LRC 或粘贴歌词文本</td></tr>');
    updateLineCount();
    return;
  }
  if (state.currentIdx >= state.lines.length) state.currentIdx = -1;
  state.lines.forEach(function(line, i) {
    var isActive = (i === state.currentIdx);
    var tr = $('<tr>').toggleClass('active', isActive).data('idx', i);
    var indicator = $('<td>').addClass('col-indicator').text(isActive ? '\u25b6' : '');
    var timeStr = timeToStr(line.start);
    var timeTd = $('<td>').addClass('col-time');
    timeTd.append($('<input>').addClass('form-control form-control-sm time-edit-input').val(timeStr));
    timeTd.append($('<button>').addClass('btn btn-sm btn-outline-secondary btn-time').attr('data-action', 'dec').html('&minus;'));
    timeTd.append($('<button>').addClass('btn btn-sm btn-outline-secondary btn-time').attr('data-action', 'inc').text('+'));
    var lyricTd = $('<td>').addClass('col-lyric');
    lyricTd.append($('<input>').addClass('form-control form-control-sm lyric-input').val(line.text));
    tr.append(indicator, timeTd, lyricTd);
    tbody.append(tr);
  });
  updateLineCount();
  scrollToCurrent();
}

function scrollToCurrent() {
  if (state.lines.length === 0) return;
  var row = $('#tableBody tr.active');
  if (row.length) row[0].scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function updateHighlight() {
  var idx = state.currentIdx;
  $('#tableBody tr').each(function() {
    var i = $(this).data('idx');
    var isActive = (i === idx);
    $(this).toggleClass('active', isActive);
    $(this).find('.col-indicator').text(isActive ? '\u25b6' : '');
  });
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
    $('#focusLyric').text('\u2014');
    $('#focusTime').text('00:00.00');
    $('#focusIdx').text('- / -');
    $('#focusPrevLine').text('').parent().hide();
    $('#focusNextLine').text('').parent().hide();
    return;
  }
  var line = state.lines[state.currentIdx];
  $('#focusLyric').text(line.text);
  $('#focusTime').text(timeToStr(line.start));
  $('#focusIdx').text((state.currentIdx + 1) + ' / ' + state.lines.length);
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
function onTimeUpdate() {
  updateTimeDisplay();
  var audio = state.audio;
  if (!audio || !audio.src || state.lines.length === 0) return;
  var adj = audio.currentTime - state.offset;
  var idx = -1;
  for (var i = 0; i < state.lines.length; i++) {
    if (state.lines[i].start <= adj) idx = i;
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

function setOffset(valCS) {
  state.offset = valCS * 0.05;
  $('#offsetValue').text(state.offset.toFixed(2));
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
  if (e.key === 'ArrowUp' && !editing) {
    e.preventDefault();
    if (state.currentIdx > 0) setCurrentLine(state.currentIdx - 1);
    return;
  }
  if (e.key === 'ArrowDown' && !editing) {
    e.preventDefault();
    if (state.currentIdx < state.lines.length - 1) setCurrentLine(state.currentIdx + 1);
    return;
  }
  if (e.key === 'ArrowLeft' && state.focusMode && !editing) {
    e.preventDefault();
    if (state.currentIdx > 0) setCurrentLine(state.currentIdx - 1);
    return;
  }
  if (e.key === 'ArrowRight' && state.focusMode && !editing) {
    e.preventDefault();
    if (state.currentIdx < state.lines.length - 1) setCurrentLine(state.currentIdx + 1);
    return;
  }
}

// ===== Init =====
$(document).ready(function() {
  state.audio = document.getElementById('audioPlayer');
  pasteModal = new bootstrap.Modal('#pasteModal');

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
