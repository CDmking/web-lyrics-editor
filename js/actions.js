// Web Lyrics Editor — Online lyrics timestamp editor
// Copyright (C) 2026 Zi Jiaxu
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

'use strict';

// ===== Audio Sync =====
function onTimeUpdate() {
  updateTimeDisplay();
  var audio = state.audio;
  if (!audio || !audio.src || state.lines.length === 0) return;
  var adj = playbackTime() - state.offset;
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
    syncPlaybackClock();
  }
}

function snapLineAt(idx) {
  if (idx < 0 || idx >= state.lines.length) return;
  if (state.lines[idx].locked) return;
  var audio = state.audio;
  if (!audio || !audio.src) return;
  state.lines[idx].start = round2(Math.max(0, playbackTime() - state.offset));
  renderTable();
}

function snapTime() {
  snapLineAt(state.currentIdx);
}

function snapNextTime() {
  if (state.currentIdx < 0) return;
  snapLineAt(state.currentIdx + 1);
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
  if (audio && audio.src) {
    start = round2(Math.max(0, playbackTime() - state.offset));
  } else if (idx > 0 && idx <= state.lines.length) {
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
  state.currentIdx = Math.min(idx, state.lines.length - 1);
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

function exitBatchMode() {
  state.batchMode = false;
  $q('#batchMenu [data-action="batch-offset"]').classList.remove('active');
  $id('offsetDec').classList.remove('btn-batch');
  $id('offsetInc').classList.remove('btn-batch');
  $id('offsetLabel').textContent = '\u5168\u5c40\u504f\u79fb\uff1a';
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
  if (e.key === 'd' && !editing) {
    e.preventDefault();
    snapNextTime();
    return;
  }
  if (e.key === 'f' && !editing) {
    e.preventDefault();
    toggleFocus();
    return;
  }
  if (e.key === 'Escape' && state.focusMode) {
    toggleFocus();
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
