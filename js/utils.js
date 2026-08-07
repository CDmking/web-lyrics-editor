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
