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
    while ((match = remaining.match(/^\[(\d{1,2}):(\d{1,2})[.:](\d{1,3})\]/)) !== null) {
      var min = parseInt(match[1], 10);
      var sec = parseInt(match[2], 10);
      var frac = parseInt(match[3], 10);
      var div = match[3].length === 1 ? 10 : (match[3].length === 3 ? 1000 : 100);
      times.push(min * 60 + sec + frac / div);
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
    if (!line.match(/^\[.+\]$/)) {
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
