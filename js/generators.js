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
