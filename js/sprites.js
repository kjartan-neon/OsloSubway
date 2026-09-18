"use strict";
// ============================================================================
// sprites.js — procedural pixel art (bitmaps that get SCALED).
// No image files! Every lamp, signal, person, bench is painted pixel by
// pixel with fillRect(), then drawn big/small with drawImage().
// "spr" = sprite. They are tiny on purpose — scaling keeps them chunky.
// ============================================================================

import { makeBmp } from './config.js';

// ceiling lamp fixture: housing bolted to tunnel ROOF, bulb hangs down
export const sprLamp = makeBmp(24, 10, (g) => {
  g.clearRect(0, 0, 24, 10);
  g.fillStyle = '#0c0c14'; g.fillRect(0, 0, 24, 4);          // housing
  g.fillStyle = '#3d3d5c'; g.fillRect(0, 0, 24, 1);          // rim light
  g.fillStyle = '#5a5a7a'; g.fillRect(10, 4, 4, 2);          // mount
  g.fillStyle = '#ffcf4d'; g.fillRect(8, 6, 8, 3);           // tube
  g.fillStyle = '#fff2b0'; g.fillRect(10, 6, 4, 1);          // hot spot
  g.fillStyle = 'rgba(255,242,176,0.4)'; g.fillRect(4, 5, 16, 5);
});

// big exit-signal heads (red / green) with glow halo
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

/* Speed-limit signs are cached: speedSignSprite(50) builds the bitmap once,
   then reuses it. Without the cache we'd rebuild text every frame (slow). */
/* max-speed sign per value (yellow board on a post) + sharp-curve warning */
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

/* Green motivational signs — short quotes on green boards with white text */
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
export const sprHorn = makeBmp(12, 8, (g) => { g.fillStyle = '#ffec00'; g.fillRect(0, 2, 12, 4); g.fillStyle = '#000'; g.fillRect(0, 3, 12, 1); });

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
/* personSprite: builds one 8x16 passenger from shirt/pants/skin colors.
   PEOPLE holds 5 variants; stations pick from it (pseudo-)randomly. */
export const PEOPLE = [
  personSprite('#e04040', '#2222aa', '#ffcc99'), personSprite('#30a030', '#333', '#8a5a2b'),
  personSprite('#3a7bff', '#444', '#ffcc99'), personSprite('#ff7bd5', '#222', '#5a3a1b'),
  personSprite('#ff8c00', '#005', '#ffe0b0')
];
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
export const sprStopPost = makeBmp(6, 34, (g) => {
  g.clearRect(0, 0, 6, 34);
  g.fillStyle = '#222'; g.fillRect(1, 10, 4, 24);             // pole
  for (let y = 10; y < 34; y += 4) { g.fillStyle = (y / 4) % 2 ? '#fff' : '#e02020'; g.fillRect(1, y, 4, 3); }
  g.fillStyle = '#fff'; g.fillRect(0, 0, 6, 10);              // flag board
  g.fillStyle = '#000'; g.fillRect(0, 0, 6, 1); g.fillRect(0, 9, 6, 1); g.fillRect(0, 0, 1, 10); g.fillRect(5, 0, 1, 10);
  g.fillStyle = '#e02020'; g.fillRect(1, 4, 4, 2);
});

/* station name board drawn on demand (still a scaled bitmap) */
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
