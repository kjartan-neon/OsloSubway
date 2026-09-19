"use strict";
// ============================================================================
// world.js — the TRACK database + track-shape math. No drawing here.
// ----------------------------------------------------------------------------
// THE BIG IDEA (read this first): the world is ONE-DIMENSIONAL. Everything is
// just a number = "meters along the track" (a position, like a milestone).
//   S.trackPos (in state.js) = where the TRAIN FRONT is right now.
//   A station at pos 800 while the train is at 200 → 600 m ahead.
// render.js turns (objectPos − trainPos) into on-screen size each frame, and
// update.js moves the train forward. Stations/signs/limits never move — only
// the train's number grows. New stations are generated forever AHEAD of the
// train; update.js deletes ones far BEHIND (so arrays stay short + fast).
// Only import: SPEEDS (the pool of random speed limits) from config.js.
// ============================================================================

import { SPEEDS } from './config.js';

// Real Oslo metro names, reused forever in random order.
export const NAMES = ['BERGKRYSTALLEN', 'MUNKELIA', 'KARLSRUD', 'LAMBERTSETER', 'BRATTLIKOLLEN', 'RYEN', 'HØYENHALL', 'MANGLERUD', 'BRYNSENG', 'HELSFYR', 'ENSJØ', 'LØREN', 'GRØNLAND', 'TØYEN', 'JERNBANETORGET', 'STORTINGET', 'NATIONALTHEATRET', 'MAJORSTUEN', 'BLINDERN', 'FORSKNINGSPARKEN', 'ULLEVÅL STADION', 'NYDALEN', 'STORO', 'SINSEN', 'RISLØKKA', 'LINDERUD', 'VOLLEBEKK', 'VEITVET', 'KALBAKKEN', 'RØDTVET', 'AMMERUD', 'GRORUD', 'ROMSÅS', 'STOVNER', 'ROMMEN', 'VESTLI'];

// --- Station geometry (picture this, junior!) ---
// A station is {name, pos, signal, arrived}. `pos` = platform CENTRE.
//   ST_HALF  = platform half-length (110 m): platform spans pos±110.
//   STOP_OFF = the perfect stop point sits 80 m PAST the centre (far end,
//              so the whole train fits on the platform when you stop there).
//   SIG_PAST = the exit signal sits 70 m past the STOP point (platform end).
// Example: station at 1000 → stop at 1080, signal at 1150.
export const STATIONS = []; // {name,pos,signal:'red'|'green',arrived}
export const ST_HALF = 110;          // platform half-length (m)
export const STOP_OFF = 80;          // optimal stop point sits this far past platform centre (far end)
export const SIG_PAST = 70;          // exit signal sits this far past the stop point

// stopPos(st)/sigPos(st): convert "station" → "exact meter number" for the
// stop line and the exit signal. Everyone (render, state, update) uses these
// so the numbers can never disagree.
export function stopPos(st) { return st.pos + STOP_OFF; }
export function sigPos(st) { return st.pos + STOP_OFF + SIG_PAST; }
// randLeg(): random distance to the NEXT station: 900–1800 m.
// Math.random() = 0..1 decimal. ×900 = 0..900, floor = whole meter, +900.
export function randLeg() { return 900 + Math.floor(Math.random() * 900); } // 900..1800m random
// pickName(): random station name, never the same twice in a row (the
// do...while loop re-rolls while it equals the previous station's name).
export function pickName() {
  let n;
  do { n = NAMES[Math.floor(Math.random() * NAMES.length)]; }
  while (STATIONS.length && STATIONS[STATIONS.length - 1].name === n);
  return n;
}
// pushStation(pos, name): add a station to the STATIONS list and return it.
// New stations start RED (you must stop + open doors before leaving).
export function pushStation(pos, name) {
  const st = { name: name || pickName(), pos, signal: 'red', arrived: false };
  STATIONS.push(st);
  return st;
}

/* --- Speed-limit zones: [{at, vms}, ...] sorted by position ---
   Each zone = "from meter `at`, the limit is `vms` m/s". A trackside sign
   stands exactly at `at`. LIMITS always holds ~1400 m of zones ahead.
   ensureLimits(trackPos): generate zones ahead until covered; delete very old
   ones past 80 entries (they're far behind and will never matter again).
   Inside: zones are 160–360 m apart, random limit from SPEEDS.
   (Curves are VISUAL ONLY — they never change limits.) */
// zoneLimitAt(p): "which zone covers meter p?" Answer = the LAST zone whose
// `at` is at-or-before p (loop keeps overwriting v while zones are behind us,
// stops at the first zone ahead). Default 42 m/s if the list is empty.
export const LIMITS = [];
export function ensureLimits(trackPos) {
  let lastAt = LIMITS.length ? LIMITS[LIMITS.length - 1].at : -100;
  while (lastAt < trackPos + 1400) {
    const at = lastAt + 160 + Math.floor(Math.random() * 200);
    const vms = SPEEDS[Math.floor(Math.random() * SPEEDS.length)];
    lastAt = at;
    LIMITS.push({ at: lastAt, vms });
  }
  if (LIMITS.length > 80) LIMITS.splice(0, LIMITS.length - 80);
}

/* --- Green message signs: [{at, msg}, ...] ---
   Friendly boards ("MIND THE GAP") on the right wall. ensureMsgSigns works
   like ensureLimits (generate ~1400 m ahead, cap at 80) but SKIPS spots near
   a speed sign (nearLim check) so signs never overlap each other. */
export const MSG_QUOTES = ['GOOD DRIVING', 'HAVE A NICE DAY', 'GREAT WORK', 'SMOOTH RIDE',
  'MIND THE GAP', 'ENJOY THE RIDE', 'STAY ON TIME', 'NICE AND STEADY',
  'KEEP IT UP', 'SAFE TRAVELS', 'NEXT STOP SOON', 'WATCH THE SIGNS',
  'SMOOTH OPERATOR', 'GREAT STOP'];
export const MSGSIGNS = [];
export function ensureMsgSigns(trackPos) {
  let lastAt = MSGSIGNS.length ? MSGSIGNS[MSGSIGNS.length - 1].at : -40;
  while (lastAt < trackPos + 1400) {
    lastAt += 180 + Math.floor(Math.random() * 160);
    const nearLim = LIMITS.some(z => Math.abs(z.at - lastAt) < 70);
    if (!nearLim) {
      MSGSIGNS.push({ at: lastAt, msg: MSG_QUOTES[Math.floor(Math.random() * MSG_QUOTES.length)] });
    }
  }
  if (MSGSIGNS.length > 80) MSGSIGNS.splice(0, MSGSIGNS.length - 80);
}

export function zoneLimitAt(p) {
  let v = LIMITS.length ? LIMITS[0].vms : 42;
  for (const z of LIMITS) { if (z.at <= p) v = z.vms; else break; }
  return v;
}

// --- Track shape (VISUAL ONLY — no gameplay effect) ---
// trackCurve(p): sideways offset of the rails at meter p. It's the SUM of 3
// sine waves (gentle + medium + small wiggles) — adding sines gives
// natural-feeling bends instead of repeating identical curves.
// render.js draws each row shifted by (curve(ahead) − curve(here)): on a
// straight the difference is 0 (tunnel centered); in a bend it grows, so the
// tunnel visually SWINGS sideways. That's the whole "curves" trick.
// curveSharp(p): "how bendy is it HERE?" = how fast the offset changes across
// ±14 m. Used ONLY to place curve-warning signs (visual motion cues).
// curveLimitAt(p): kept for reference only — NOT enforced anymore.
// inStation(p): which station (if any) owns meter p? Scans STATIONS for one
// whose centre is within ST_HALF. Returns the station or null.
// speedLimitAt(p): THE rule the game enforces = strictest of (zone limit,
// station limit near platforms). Station slow zone extends 72 m each way
// from the platform centre (tight zone = more full-speed action).
// Curves do NOT affect it.
export function trackCurve(p) {
  return Math.sin(p * 0.0046) * 40 + Math.sin(p * 0.0014) * 48 + Math.sin(p * 0.011) * 9;
}
export function curveSharp(p) {
  return Math.abs(trackCurve(p + 14) - trackCurve(p - 14)) / 28;
}
export function curveLimitAt(p) {
  const sh = curveSharp(p);
  return Math.max(20, Math.min(45, 45 - sh * 90));
}
export function inStation(p) {
  for (const s of STATIONS) { if (Math.abs(p - s.pos) < ST_HALF) return s; }
  return null;
}
// NOTE: VMAX/ST_VMAX default here (45/20) so this file works standalone;
// update.js/render.js always pass the real config values implicitly via the
// same numbers — one source of truth lives in config.js.
export function speedLimitAt(p, VMAX = 45, ST_VMAX = 20) {
  let lim = Math.min(zoneLimitAt(p), VMAX);
  const s = inStation(p);
  if (s && Math.abs(p - s.pos) < 72) lim = Math.min(lim, ST_VMAX);
  return lim;
}
