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
  var m = s.match(/^(\d{1,2}):(\d{1,2})[.:](\d{1,3})$/);
  if (!m) return null;
  var min = parseInt(m[1], 10);
  var sec = parseInt(m[2], 10);
  var frac = parseFloat('0.' + m[3]);
  return round2(min * 60 + sec + frac);
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

// ===== Playback Clock =====
// audio.currentTime 的刷新频率取决于播放管线（常约 4Hz），逐帧读取会拿到重复的旧值，
// 导致高亮阶梯式滞后。用 performance.now() 在两次刷新之间插值，得到逐帧连续的位置。
var _clock = { media: 0, wall: 0, valid: false };
var CLOCK_MAX_AHEAD = 0.3;

function syncPlaybackClock() {
  var audio = state.audio;
  if (!audio) return;
  _clock.media = audio.currentTime || 0;
  _clock.wall = performance.now();
  _clock.valid = true;
}

function playbackTime() {
  var audio = state.audio;
  if (!audio || !audio.src) return 0;
  var now = performance.now();
  var t = audio.currentTime || 0;
  if (audio.paused) {
    _clock.media = t;
    _clock.wall = now;
    _clock.valid = true;
    return t;
  }
  if (!_clock.valid || t !== _clock.media) {
    _clock.media = t;
    _clock.wall = now;
    _clock.valid = true;
  }
  var est = _clock.media + (now - _clock.wall) / 1000 * (audio.playbackRate || 1);
  if (est - t > CLOCK_MAX_AHEAD) {
    est = t + CLOCK_MAX_AHEAD;
    _clock.media = t;
    _clock.wall = now;
  }
  return est;
}

// ===== Helpers =====
var $id = document.getElementById.bind(document);
var $q = document.querySelector.bind(document);
var $qa = document.querySelectorAll.bind(document);

function el(tag) { return document.createElement(tag); }

function cls(el) {
  for (var i = 1; i < arguments.length; i++) el.classList.add(arguments[i]);
  return el;
}

function append(parent) {
  for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]);
  return parent;
}

function rowIdx(node) { return parseInt(node.closest('tr').dataset.idx, 10); }
