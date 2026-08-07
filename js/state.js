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
  showPrevNext: true,
  title: '',
  artist: '',
  useCheckboxes: true,
  selectedIndices: [],
  batchMode: false
};
