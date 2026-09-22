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

// ===== Init =====
(function() {
  state.audio = $id('audioPlayer');
  var pasteModalEl = $id('pasteModal');
  var pasteModal = new bootstrap.Modal(pasteModalEl);

  // Audio events
  state.audio.addEventListener('loadedmetadata', function() {
    syncPlaybackClock();
    updateTimeDisplay();
  });
  // 后台标签页 rAF 暂停时由 timeupdate 兜底保持同步（浏览器节流至约 1-4Hz）
  // Keep sync when the tab is backgrounded (rAF pauses; timeupdate still fires)
  state.audio.addEventListener('timeupdate', onTimeUpdate);

  // 播放位置发生跳变时重设插值时钟基线
  // Re-baseline the interpolated clock whenever playback position jumps
  ['play', 'playing', 'pause', 'seeking', 'seeked', 'waiting', 'stalled', 'ratechange', 'ended']
    .forEach(function(ev) {
      state.audio.addEventListener(ev, syncPlaybackClock);
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
      if (state.batchMode) exitBatchMode();
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
      if (state.batchMode) exitBatchMode();
      renderTable();
    }
  });

  // Table: checkbox / lyric / time input changes
  $id('tableBody').addEventListener('change', function(e) {
    var input = e.target.closest('.row-checkbox');
    var idx;
    if (input) {
      idx = rowIdx(input);
      if (input.checked) {
        if (state.selectedIndices.indexOf(idx) < 0) state.selectedIndices.push(idx);
      } else {
        state.selectedIndices = state.selectedIndices.filter(function(i) { return i !== idx; });
      }
      updateSelectAll();
      return;
    }
    input = e.target.closest('.lyric-input');
    if (input) {
      idx = rowIdx(input);
      if (!isNaN(idx)) state.lines[idx].text = input.value;
      return;
    }
    input = e.target.closest('.time-edit-input');
    if (input) {
      idx = rowIdx(input);
      var newTime = strToTime(input.value);
      if (newTime === null) { input.value = timeToStr(state.lines[idx].start); return; }
      state.lines[idx].start = newTime;
      renderTable();
    }
  });

  // Select all checkbox (header)
  $id('selectAllCb').addEventListener('change', function() {
    if (this.checked) {
      state.selectedIndices = [];
      for (var i = 0; i < state.lines.length; i++) state.selectedIndices.push(i);
    } else {
      state.selectedIndices = [];
    }
    renderTable();
  });

  // Focus toggle
  $id('focusToggle').addEventListener('click', toggleFocus);

  // Focus: show/hide prev-next context lines
  $id('prevNextToggle').addEventListener('change', function() {
    state.showPrevNext = this.checked;
    if (state.focusMode) renderFocus();
  });

  // Table: buttons + row click (seek)
  $id('tableBody').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="dec"]');
    var idx;
    if (btn) { adjustTime(rowIdx(btn), -0.05); return; }
    btn = e.target.closest('[data-action="inc"]');
    if (btn) { adjustTime(rowIdx(btn), 0.05); return; }
    btn = e.target.closest('.btn-row-add');
    if (btn) { addLineAt(rowIdx(btn) + 1); return; }
    btn = e.target.closest('.btn-row-del');
    if (btn) { deleteLine(rowIdx(btn)); return; }
    if (e.target.closest('button, input')) return;
    var tr = e.target.closest('tr');
    if (!tr) return;
    idx = rowIdx(tr);
    if (!isNaN(idx)) setCurrentLine(idx);
  });
  $id('headAddBtn').addEventListener('click', function() {
    addLineAt(0);
  });

  // Focus: time input direct edit
  $id('focusTime').addEventListener('change', function() {
    if (state.currentIdx < 0 || state.currentIdx >= state.lines.length) return;
    if (state.lines[state.currentIdx].locked) return;
    var t = strToTime(this.value);
    if (t === null) { this.value = timeToStr(state.lines[state.currentIdx].start); return; }
    state.lines[state.currentIdx].start = t;
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
