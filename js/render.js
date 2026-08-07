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

var _sortable = null;

// ===== Rendering =====
function updateSelectAll() {
  var cb = $id('selectAllCb');
  if (!cb) return;
  cb.style.display = state.useCheckboxes ? '' : 'none';
  var n = state.lines.length;
  var selected = state.selectedIndices.length;
  cb.checked = n > 0 && selected === n;
  cb.indeterminate = selected > 0 && selected < n;
}

function renderTable() {
  updateSelectAll();
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

function applyPrevNextVisibility() {
  var wrap = $id('focusPreview');
  if (wrap) wrap.style.display = state.showPrevNext ? '' : 'none';
}

function renderFocus() {
  applyPrevNextVisibility();
  if (state.currentIdx < 0 || state.currentIdx >= state.lines.length) {
    $id('focusLyric').textContent = '\u2014';
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
  $id('focusPrevLine').textContent = state.currentIdx > 0 ? state.lines[state.currentIdx - 1].text : '(\u65e0)';
  $id('focusPrevLine').parentElement.style.display = '';
  $id('focusNextLine').textContent = state.currentIdx < state.lines.length - 1 ? state.lines[state.currentIdx + 1].text : '(\u65e0)';
  $id('focusNextLine').parentElement.style.display = '';
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
