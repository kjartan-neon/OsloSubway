"use strict";
// ============================================================================
// state.js — the game's MEMORY + rules for stations/score. Read this second
// (after config.js) — almost every file reads S from here.
// ----------------------------------------------------------------------------
// STATE MACHINE (the game's modes — S.state is always exactly one of these):
//   'title' → press START → 'drive' ⇄ 'doors' (open/close with D).
//   'done' exists but is unused (endless mode never ends; kept for titles).
// WHY ONE `S` OBJECT? ES modules share exports "live": if we did
// `export let speed` in 5 files, each import could drift out of sync. One
// object (S.speed, S.score...) means every file sees the SAME numbers.
// FIELD GUIDE: trackPos/speed = physics (meters, m/s). throttle/brake =
// 0..4 arcade "notches" (chunky steps, not smooth %). emergency = full stop.
// doorsOpen/doorTimer/boarded = boarding sequence. nextStIdx = which station
// in STATIONS we're heading for. score/stopsDone/popups = feedback.
// timeLeft = timetable countdown. shake/lookX/hornT/overSpeedT/flashT =
// visuals+timers render/update use. legClean/approachAwarded/emergencyUsed/
// distClean = per-leg bonus flags, reset by resetLegFlags() each station.
// hiScore persists in localStorage (survives page reloads).
// ============================================================================

import {
  STATIONS, LIMITS, MSGSIGNS,
  stopPos, pushStation, pickName, randLeg,
  ensureLimits, ensureMsgSigns
} from './world.js';
import { beep, chime } from './audio.js';

// Mutable game state lives on ONE object so ES-module imports stay in sync
// (see header). popups = floating "+100 GOOD STOP" texts, each {txt, t
// (seconds left), color}. Max 6 on screen — oldest is dropped (shift()).
export const S = {
  state: 'title', // title | drive | doors | done
  trackPos: 0, speed: 0,           // m, m/s
  throttle: 0, brake: 0,           // 0..4 , 0..4
  emergency: false,
  doorsOpen: false, doorTimer: 0, boarded: false,
  nextStIdx: 0, score: 0, stopsDone: 0,
  late: 0, timeLeft: 0, stationBonusMsg: '', msgTimer: 0,
  shake: 0, lookX: 0, hornT: 0, overSpeedT: 0,
  flashT: 0, departOk: false,
  hiScore: 0,
  popups: [], // {txt,t,color}
  legClean: true, approachAwarded: false, emergencyUsed: false, distClean: 0,
};

// Hi-score: load saved best on boot. localStorage = tiny browser save slot.
// try/catch because private-mode browsers can BLOCK storage (would crash
// without it). parseInt(...)||0 = "a number, or 0 if the save is missing".
try { S.hiScore = parseInt(localStorage.getItem('supersubway_hi') || '0') || 0; } catch (e) { /* private mode */ }

/* --- Scoring --- */
// addScore(n, label): the ONLY way score changes. Clamps at 0 (never
// negative), saves a new hi-score, and (if label given) spawns a floating
// popup: green "+100 CLEAN LEG" for gains, red "-100 MISSED STATION" for
// fines. Example: addScore(300, 'PERFECT STOP').
export function addScore(n, label) {
  S.score = Math.max(0, S.score + n);
  if (S.score > S.hiScore) {
    S.hiScore = S.score;
    try { localStorage.setItem('supersubway_hi', String(S.hiScore)); } catch (e) { /* private mode */ }
  }
  if (label) {
    S.popups.push({ txt: (n >= 0 ? '+' : '') + n + ' ' + label, t: 2.4, color: n >= 0 ? '#0f6' : '#f44' });
    if (S.popups.length > 6) S.popups.shift();
  }
}

// resetLegFlags(): fresh bonus slate for the next station leg. Called by
// startGame(), completeBoarding(), and after a missed station. "Leg" = the
// stretch between two stations; drive it cleanly for bonus points.
export function resetLegFlags() {
  S.legClean = true;
  S.approachAwarded = false;
  S.emergencyUsed = false;
  S.distClean = 0;
  S.overSpeedT = 0;
}

// startGame(): FULL reset for a fresh run, then state → 'drive'.
// Steps: 1) zero physics/score/timers, 2) clear popups + leg flags,
// 3) wipe STATIONS and plant the first station 800 m ahead, 4) wipe LIMITS,
// seed one 42 m/s zone at 0 and generate ahead, 5) wipe + generate message
// signs, 6) switch mode + play the start chime. Called from title/done.
export function startGame() {
  S.trackPos = 0; S.speed = 0; S.throttle = 0; S.brake = 0; S.emergency = false;
  S.doorsOpen = false; S.doorTimer = 0; S.boarded = false;
  S.nextStIdx = 0; S.score = 0; S.stopsDone = 0;
  S.late = 0; S.timeLeft = 90; S.departOk = false;
  S.stationBonusMsg = ''; S.msgTimer = 0;
  S.popups.length = 0;
  resetLegFlags();
  STATIONS.length = 0;
  pushStation(800, pickName());
  LIMITS.length = 0;
  LIMITS.push({ at: 0, vms: 42 });
  ensureLimits(S.trackPos);
  MSGSIGNS.length = 0;
  ensureMsgSigns(S.trackPos);
  S.state = 'drive';
  chime();
}

// completeBoarding(auto): boarding is DONE — close up and get ready to go.
// Flow: doors close (auto timer ran out OR player pressed D early) → THIS
// station's signal turns GREEN → nextStIdx moves on → +45 s timetable → a NEW
// random station is planted ahead → leg flags reset. auto=true means "the
// 6-second timer closed them"; false means "the player closed them early"
// (slightly different departure message). Plays a two-tone "doors closed".
export function completeBoarding(auto) {
  const st = STATIONS[S.nextStIdx];
  S.doorsOpen = false;
  S.state = 'drive';
  S.departOk = true;
  const base = st ? st.pos : S.trackPos;
  if (st) { st.signal = 'green'; st.arrived = true; }
  S.nextStIdx++;
  S.timeLeft += 45;
  // NEW random length to next station, measured from the station just served
  const ahead = randLeg();
  pushStation(base + ahead, undefined);
  resetLegFlags();
  beep(400, 0.12);
  setTimeout(() => beep(600, 0.15), 140);
  if (auto) {
    S.stationBonusMsg = 'DEPART! NEXT: ' + STATIONS[S.nextStIdx].name + ' (' + ahead + 'm)';
  } else {
    S.stationBonusMsg = 'DOORS CLOSED — GREEN! GO!';
  }
  S.msgTimer = 2.5;
}

// tryDoors(): the D key / DOORS button. Rules: only in drive/doors mode,
// only when nearly stopped (speed ≤ 0.6 m/s), only near a platform (within
// 40 m of the stop point). FIRST press OPENS (mode→'doors', signal→RED,
// accuracy points: ≤6 m = 300 PERFECT, ≤12 m = 200, else 100; +50 SMOOTH if
// no emergency and gentle braking; +100 CLEAN LEG if no speeding this leg).
// SECOND press (or the 6 s timer) CLOSES via completeBoarding(). Too fast or
// no platform = angry buzz + hint message, no state change.
export function tryDoors() {
  if (S.state !== 'drive' && S.state !== 'doors') return;
  const st = STATIONS[S.nextStIdx];
  const err = st ? Math.abs(S.trackPos - stopPos(st)) : 9999;
  if (S.speed > 0.6) {
    S.stationBonusMsg = 'TOO FAST FOR DOORS!';
    S.msgTimer = 2;
    beep(140, 0.25);
    return;
  }
  if (!st) return;
  if (err > 40) {
    S.stationBonusMsg = 'NO PLATFORM HERE!';
    S.msgTimer = 2;
    beep(140, 0.25);
    return;
  }
  if (!S.doorsOpen) { // open — station reached => exit signal goes RED
    S.doorsOpen = true;
    S.state = 'doors';
    S.doorTimer = 6;
    S.boarded = false;
    st.signal = 'red';
    st.arrived = true;
    beep(520, 0.1);
    setTimeout(() => beep(780, 0.15), 120);
    chime();
    // score stop
    let pts = err <= 6 ? 300 : err <= 12 ? 200 : 100;
    if (Math.abs(S.speed) > 0.6) pts = 0;
    addScore(pts, (err <= 6 ? 'PERFECT STOP' : 'GOOD STOP'));
    S.stopsDone++;
    if (!S.emergencyUsed && S.brake <= 2) addScore(50, 'SMOOTH STOP');
    if (S.legClean) addScore(100, 'CLEAN LEG');
    S.stationBonusMsg = (err <= 6 ? 'PERFECT STOP! +' : 'GOOD STOP! +') + pts + ' — RED, BOARDING…';
    S.msgTimer = 3;
  } else { // close early => boarding done => GREEN + random next leg
    completeBoarding(false);
  }
}

// finishRun(): legacy "shift over" jingle → 'done' screen. Unused in endless
// mode (nothing calls it yet) but kept so a future timetable ending works.
export function finishRun() {
  S.state = 'done';
  beep(523, 0.15);
  setTimeout(() => beep(659, 0.15), 160);
  setTimeout(() => beep(784, 0.3), 320);
}
