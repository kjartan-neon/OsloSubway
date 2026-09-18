"use strict";
// ============================================================================
// sprites.js — ALL the pixel art. Read this if you want to change the LOOK.
// ----------------------------------------------------------------------------
// HOW TO READ THIS FILE (junior map):
//   A "sprite" is just a tiny picture (a stamp from makeBmp in config.js).
//   There are NO image files — every lamp, signal, person and bench below is
//   painted with code: pick a color (g.fillStyle='...') then paint a rectangle
//   (g.fillRect(x, y, width, height)). render.js then stamps each sprite BIG
//   or SMALL with drawImage() depending on distance. Sprites are tiny ON
//   PURPOSE — scaling a small picture up is what makes pixels look chunky.
//   Names starting with "spr" = ready-made sprite. Names ending in "Sprite"
//   (speedSignSprite, msgSignSprite, boardSprite) = FACTORY FUNCTIONS that
//   build a sprite for a given text/number and CACHE it (build once, reuse).
// Only import: makeBmp from config.js. Nothing else needed to draw.
// ============================================================================

import { makeBmp } from './config.js';

// --- Ceiling lamp ---
// Fixture bolted to the tunnel ROOF: dark housing (top rows), a mount, then
// a warm glowing tube that hangs down. render.js stamps this overhead.
// Reading a sprite recipe: each fillRect line paints one piece, top→bottom.
// clearRect first = "start transparent" so only our pixels show.
export const sprLamp = makeBmp(24, 10, (g) => {
  g.clearRect(0, 0, 24, 10);
  g.fillStyle = '#0c0c14'; g.fillRect(0, 0, 24, 4);          // housing
  g.fillStyle = '#3d3d5c'; g.fillRect(0, 0, 24, 1);          // rim light
  g.fillStyle = '#5a5a7a'; g.fillRect(10, 4, 4, 2);          // mount
  g.fillStyle = '#ffcf4d'; g.fillRect(8, 6, 8, 3);           // tube
  g.fillStyle = '#fff2b0'; g.fillRect(10, 6, 4, 1);          // hot spot
  g.fillStyle = 'rgba(255,242,176,0.4)'; g.fillRect(4, 5, 16, 5);
});

// --- Exit signals + trackside signals ---
// Big gantry signal heads at the end of each platform. RED = doors open /
// wait, GREEN = boarded / go. Each head is a dark box with one lit lamp and
// one dark lamp, plus a soft transparent "halo" rectangle around it so it
// glows at night. render.js picks sprExitR or sprExitG by st.signal.
// (sprSignalG/R are smaller spares, kept for future use.)
export const sprExitR = makeBmp(12, 20, (g) => {
  g.clearRect(0, 0, 12, 20);
  g.fillStyle = 'rgba(255,40,40,0.35)'; g.fillRect(0, 0, 12, 20);
  g.fillStyle = '#111'; g.fillRect(2, 1, 8, 18);
  g.fillStyle = '#666'; g.fillRect(2, 1, 8, 1);
  g.fillStyle = '#f22'; g.fillRect(3, 3, 6, 6);
  g.fillStyle = '#ffb0b0'; g.fillRect(4, 3, 2, 2);
  g.fillStyle = '#2a0505'; g.fillRect(3, 11, 6, 6);
});
export const sprExitG = makeBmp(12, 20, (g) => {
  g.clearRect(0, 0, 12, 20);
  g.fillStyle = 'rgba(40,255,120,0.35)'; g.fillRect(0, 0, 12, 20);
  g.fillStyle = '#111'; g.fillRect(2, 1, 8, 18);
  g.fillStyle = '#666'; g.fillRect(2, 1, 8, 1);
  g.fillStyle = '#3a0a0a'; g.fillRect(3, 3, 6, 6);
  g.fillStyle = '#0f6'; g.fillRect(3, 11, 6, 6);
  g.fillStyle = '#8fffb0'; g.fillRect(4, 11, 2, 2);
});
export const sprSignalG = makeBmp(8, 18, (g) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, 8, 18);
  g.fillStyle = '#222'; g.fillRect(1, 1, 6, 16);
  g.fillStyle = '#033'; g.fillRect(2, 2, 4, 4);
  g.fillStyle = '#0f6'; g.fillRect(2, 11, 4, 4);
  g.fillStyle = '#8fffb0'; g.fillRect(3, 11, 2, 1);
});
export const sprSignalR = makeBmp(8, 18, (g) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, 8, 18);
  g.fillStyle = '#222'; g.fillRect(1, 1, 6, 16);
  g.fillStyle = '#f22'; g.fillRect(2, 2, 4, 4);
  g.fillStyle = '#ffb0b0'; g.fillRect(3, 2, 2, 1);
  g.fillStyle = '#300'; g.fillRect(2, 11, 4, 4);
});

/* --- Speed-limit signs (CACHED factory — read this pattern!) ---
   speedSignSprite(50) builds the yellow "50" board ONCE, stores it in
   speedSignCache[50], and returns the SAME picture next time. Why? Painting
   text (fillText) is slow — without the cache we'd rebuild it 60×/second.
   Pattern to reuse: `if (cache[key]) return cache[key]; ...build...;
   cache[key] = result; return result;` */
// max-speed sign: yellow board on a grey post. Font shrinks for 3-digit
// numbers so "151" still fits. Called by render.js for every limit zone.
const speedSignCache = {};
export function speedSignSprite(kmh) {
  if (speedSignCache[kmh]) return speedSignCache[kmh];
  const c = makeBmp(26, 28, (g) => {
    g.clearRect(0, 0, 26, 28);
    g.fillStyle = '#333'; g.fillRect(11, 12, 4, 16);          // post
    g.fillStyle = '#ffe14d'; g.fillRect(0, 0, 26, 16);        // board
    g.fillStyle = '#000'; g.fillRect(0, 0, 26, 2); g.fillRect(0, 14, 26, 2);
    g.fillRect(0, 0, 2, 16); g.fillRect(24, 0, 2, 16);
    g.fillStyle = '#000'; g.textBaseline = 'top';
    const t = String(kmh);
    g.font = t.length > 2 ? 'bold 9px monospace' : 'bold 11px monospace';
    g.fillText(t, t.length > 2 ? 1 : 5, 3);
  });
  speedSignCache[kmh] = c;
  return c;
}

/* --- Green message signs (same cache pattern as speed signs) ---
   Green boards with white QUOTES ("MIND THE GAP"). Long messages are split
   into two lines at the middle word so they fit the 48px board. */
const msgSignCache = {};
export function msgSignSprite(msg) {
  if (msgSignCache[msg]) return msgSignCache[msg];
  const c = makeBmp(48, 26, (g) => {
    g.clearRect(0, 0, 48, 26);
    g.fillStyle = '#222'; g.fillRect(21, 14, 6, 12); // post
    g.fillStyle = '#0a3a0a'; g.fillRect(0, 0, 48, 1); // top housing
    g.fillStyle = '#1a6b1a'; g.fillRect(0, 1, 48, 13); // green board
    g.fillStyle = '#0a3a0a'; g.fillRect(0, 14, 48, 1); // bottom housing
    g.fillStyle = '#fff'; g.fillRect(0, 1, 48, 1); g.fillRect(0, 13, 48, 1); // border
    g.fillStyle = '#fff'; g.font = 'bold 5px monospace'; g.textBaseline = 'top';
    const words = msg.split(' ');
    // fit two lines
    const mid = Math.ceil(words.length / 2);
    const l1 = words.slice(0, mid).join(' ');
    const l2 = words.slice(mid).join(' ');
    g.fillText(l1.toUpperCase(), 2, 2);
    if (l2) g.fillText(l2.toUpperCase(), 2, 8);
  });
  msgSignCache[msg] = c;
  return c;
}

// --- Curve warning diamond ---
// Yellow diamond with a black squiggle arrow, planted before sharp bends.
// Painted with paths (moveTo/lineTo/stroke), not just rectangles — the one
// place we draw a non-rectangle shape. g.lineWidth = how thick the line is.
export const sprCurveWarn = makeBmp(18, 26, (g) => {
  g.clearRect(0, 0, 18, 26);
  g.fillStyle = '#333'; g.fillRect(7, 12, 4, 14);             // post
  g.fillStyle = '#ffe14d';                                // diamond
  g.beginPath(); g.moveTo(9, 0); g.lineTo(18, 9); g.lineTo(9, 18); g.lineTo(0, 9); g.closePath(); g.fill();
  g.fillStyle = '#000';
  g.beginPath(); g.moveTo(9, 2); g.lineTo(16, 9); g.lineTo(9, 16); g.lineTo(2, 9); g.closePath();
  g.fillStyle = '#ffe14d';
  g.beginPath(); g.moveTo(9, 3); g.lineTo(15, 9); g.lineTo(9, 15); g.lineTo(3, 9); g.closePath(); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 2;                   // squiggle arrow
  g.beginPath(); g.moveTo(12, 5); g.quadraticCurveTo(4, 8, 7, 13); g.stroke();
  g.fillStyle = '#000'; g.fillRect(5, 11, 5, 2);
});
// (Unused spare: yellow horn "sound bar". Kept so future effects can use it.)
export const sprHorn = makeBmp(12, 8, (g) => { g.fillStyle = '#ffec00'; g.fillRect(0, 2, 12, 4); g.fillStyle = '#000'; g.fillRect(0, 3, 12, 1); });

// --- Passengers ---
// personSprite(shirt, pants, skin) builds ONE 8×16 person from 3 colors:
// head+arms = skin, hair = black cap, torso = shirt, legs = pants, feet = black.
// PEOPLE holds 5 ready-made variants; render.js picks them per station with
// (i + st.pos) % PEOPLE.length — a cheap trick that looks random but gives
// the SAME crowd every visit (deterministic = no flickering between frames).
export function personSprite(shirt, pants, skin) {
  return makeBmp(8, 16, (g) => {
    g.clearRect(0, 0, 8, 16);
    g.fillStyle = skin; g.fillRect(2, 1, 4, 4);           // head
    g.fillStyle = '#111'; g.fillRect(2, 1, 4, 1);          // hair
    g.fillStyle = shirt; g.fillRect(1, 6, 6, 5);           // torso
    g.fillStyle = skin; g.fillRect(0, 6, 1, 4); g.fillRect(7, 6, 1, 4); // arms
    g.fillStyle = pants; g.fillRect(2, 11, 2, 5); g.fillRect(4, 11, 2, 5); // legs
    g.fillStyle = '#000'; g.fillRect(2, 15, 2, 1); g.fillRect(4, 15, 2, 1);
  });
}
/* PEOPLE: the 5 passenger variants. To add a new outfit, copy one line and
   change the 3 colors: personSprite(shirtColor, pantsColor, skinColor). */
export const PEOPLE = [
  personSprite('#e04040', '#2222aa', '#ffcc99'), personSprite('#30a030', '#333', '#8a5a2b'),
  personSprite('#3a7bff', '#444', '#ffcc99'), personSprite('#ff7bd5', '#222', '#5a3a1b'),
  personSprite('#ff8c00', '#005', '#ffe0b0')
];
// --- Station furniture ---
// sprBench: wooden slats + dark legs. sprStop: the white "STOP" board marking
// the exact place to halt. sprStopPost: striped red/white poles planted on
// BOTH sides of the stop point so you can spot it from far away.
export const sprBench = makeBmp(20, 8, (g) => {
  g.fillStyle = '#5a3a1a'; g.fillRect(0, 0, 20, 3);
  g.fillStyle = '#7a522a'; g.fillRect(0, 0, 20, 1);
  g.fillStyle = '#333'; g.fillRect(1, 3, 2, 5); g.fillRect(17, 3, 2, 5);
});
export const sprStop = makeBmp(24, 20, (g) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, 24, 20);
  g.fillStyle = '#ffe14d'; g.fillRect(0, 0, 24, 3); g.fillRect(0, 17, 24, 3);
  g.fillStyle = '#fff'; g.font = 'bold 9px monospace'; g.fillText('STOP', 1, 6);
  g.fillStyle = '#f22'; g.fillRect(9, 14, 6, 2);
});
/* striped marker post flagging the optimal stop point (planted each side) */
// Loop trick below: stripes alternate red/white every 4px down the pole.
export const sprStopPost = makeBmp(6, 34, (g) => {
  g.clearRect(0, 0, 6, 34);
  g.fillStyle = '#222'; g.fillRect(1, 10, 4, 24);             // pole
  for (let y = 10; y < 34; y += 4) { g.fillStyle = (y / 4) % 2 ? '#fff' : '#e02020'; g.fillRect(1, y, 4, 3); }
  g.fillStyle = '#fff'; g.fillRect(0, 0, 6, 10);              // flag board
  g.fillStyle = '#000'; g.fillRect(0, 0, 6, 1); g.fillRect(0, 9, 6, 1); g.fillRect(0, 0, 1, 10); g.fillRect(5, 0, 1, 10);
  g.fillStyle = '#e02020'; g.fillRect(1, 4, 4, 2);
});

/* --- Station name boards (cached factory, like the signs above) ---
   Blue board, white border, station name in caps (cut to 10 letters so it
   fits). boardSprite(name) builds each name once. hasBoard(name) just asks
   "did we build this one already?" without building. */
const boardCache = {};
export function boardSprite(name) {
  if (boardCache[name]) return boardCache[name];
  const c = makeBmp(64, 12, (g) => {
    g.fillStyle = '#0a1a6e'; g.fillRect(0, 0, 64, 12);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 11, 64, 1);
    g.fillStyle = '#fff'; g.font = 'bold 8px monospace'; g.textBaseline = 'top';
    g.fillText(name.slice(0, 10).toUpperCase(), 3, 2);
  });
  boardCache[name] = c;
  return c;
}
export function hasBoard(name) { return !!boardCache[name]; }
