"use strict";
// ============================================================================
// world.js — track / timetable (ENDLESS).
// The world is 1-dimensional: everything lives at a "pos" in meters along
// the track. trackPos = where the train front is. Stations/signs/lamps are
// just numbers; rendering converts (objectPos - trackPos) into screen size.
// New stations are generated forever ahead, old ones pruned behind.
// ============================================================================

import { SPEEDS } from './config.js';

export const NAMES = ['BERGKRYSTALLEN', 'MUNKELIA', 'KARLSRUD', 'LAMBERTSETER', 'BRATTLIKOLLEN', 'RYEN', 'HØYENHALL', 'MANGLERUD', 'BRYNSENG', 'HELSFYR', 'ENSJØ', 'LØREN', 'GRØNLAND', 'TØYEN', 'JERNBANETORGET', 'STORTINGET', 'NATIONALTHEATRET', 'MAJORSTUEN', 'BLINDERN', 'FORSKNINGSPARKEN', 'ULLEVÅL STADION', 'NYDALEN', 'STORO', 'SINSEN', 'RISLØKKA', 'LINDERUD', 'VOLLEBEKK', 'VEITVET', 'KALBAKKEN', 'RØDTVET', 'AMMERUD', 'GRORUD', 'ROMSÅS', 'STOVNER', 'ROMMEN', 'VESTLI'];

export const STATIONS = []; // {name,pos,signal:'red'|'green',arrived}
export const ST_HALF = 110;          // platform half-length (m)
export const STOP_OFF = 80;          // optimal stop point sits this far past platform centre (far end)
export const SIG_PAST = 70;          // exit signal sits this far past the stop point

export function stopPos(st) { return st.pos + STOP_OFF; }
export function sigPos(st) { return st.pos + STOP_OFF + SIG_PAST; }
export function randLeg() { return 900 + Math.floor(Math.random() * 900); } // 900..1800m random
export function pickName() {
  let n;
  do { n = NAMES[Math.floor(Math.random() * NAMES.length)]; }
  while (STATIONS.length && STATIONS[STATIONS.length - 1].name === n);
  return n;
}
export function pushStation(pos, name) {
  const st = { name: name || pickName(), pos, signal: 'red', arrived: false };
  STATIONS.push(st);
  return st;
}

/* endless speed-limit zones: [{at, vms}] — each zone starts with a trackside sign */
// ensureLimits: keep ~1400m of random limit zones generated ahead of the train
// and drop very old ones (max 80). zoneLimitAt: "last zone at-or-before p wins".
export const LIMITS = [];
export function ensureLimits(trackPos) {
  let lastAt = LIMITS.length ? LIMITS[LIMITS.length - 1].at : -100;
  while (lastAt < trackPos + 1400) {
    let at = lastAt + 160 + Math.floor(Math.random() * 200);
    let vms = SPEEDS[Math.floor(Math.random() * SPEEDS.length)];
    // snap to nearby curve start and set 50 km/h
    let prevSh = curveSharp(at - 50) < 0.09;
    for (let dp = -40; dp <= 80; dp += 8) {
      const sh = curveSharp(at + dp);
      if (prevSh && sh > 0.11) {
        const snap = at + dp - 12;
        if (snap > lastAt + 60) { at = snap; vms = 14; }
        break;
      }
      prevSh = sh < 0.09;
    }
    lastAt = at;
    LIMITS.push({ at: lastAt, vms });
  }
  if (LIMITS.length > 80) LIMITS.splice(0, LIMITS.length - 80);
}

/* Green motivational signs alongside the track */
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

// trackCurve: sideways offset of the track at position p (sum of 3 sines =
// gentle + medium + wiggly bends). Everything on screen shifts by the
// difference between the curve ahead and the curve at the camera — that is
// what makes bends appear to swing. curveSharp: how bendy is it HERE
// (sampled ±14m). curveLimitAt: sharper bend → lower safe speed.
// speedLimitAt: the strictest of zone limit, station limit, curve limit.
export function trackCurve(p) {
  return Math.sin(p * 0.0046) * 40 + Math.sin(p * 0.0014) * 48 + Math.sin(p * 0.011) * 9;
}
export function curveSharp(p) {
  return Math.abs(trackCurve(p + 14) - trackCurve(p - 14)) / 28;
}
export function curveLimitAt(p) {
  const sh = curveSharp(p);
  return Math.max(14, Math.min(45, 45 - sh * 90));
}
export function inStation(p) {
  for (const s of STATIONS) { if (Math.abs(p - s.pos) < ST_HALF) return s; }
  return null;
}
export function speedLimitAt(p, VMAX = 45, ST_VMAX = 20) {
  let lim = Math.min(zoneLimitAt(p), VMAX);
  const s = inStation(p);
  if (s && Math.abs(p - s.pos) < 130) lim = Math.min(lim, ST_VMAX);
  return Math.min(lim, curveLimitAt(p));
}
