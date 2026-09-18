"use strict";
// ============================================================================
// state.js — game state machine + scoring + station flow.
// state machine: 'title' → 'drive' ⇄ 'doors' (done is unused legacy end screen).
// trackPos/speed = physics. throttle/brake = 0..4 notches (chunky arcade feel).
// nextStIdx = which station we are heading for. score/popups = feedback.
// legClean/approachAwarded/emergencyUsed = per-leg bonus flags, reset each leg.
// ============================================================================

import {
  STATIONS, LIMITS, MSGSIGNS,
  stopPos, pushStation, pickName, randLeg,
  ensureLimits, ensureMsgSigns
} from './world.js';
import { beep, chime } from './audio.js';

// Mutable game state lives on one object so ES-module imports stay in sync.
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

try { S.hiScore = parseInt(localStorage.getItem('supersubway_hi') || '0') || 0; } catch (e) { /* private mode */ }

/* score event feed + hi-score + per-leg driving flags */
// addScore: clamps at 0, saves hi-score to localStorage (survives reload),
// and pushes a floating "+100 GOOD STOP" popup (max 6 on screen).
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

export function resetLegFlags() {
  S.legClean = true;
  S.approachAwarded = false;
  S.emergencyUsed = false;
  S.distClean = 0;
  S.overSpeedT = 0;
}

// startGame: reset EVERYTHING for a fresh run (pos, speed, score, stations,
// limits) and switch state to 'drive'. Called from title/done screens.
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

// called once boarding is finished: turns THIS station green + lays random track ahead
// Flow: doors close (auto timer OR player presses D) → signal turns green →
// next station generated at random distance → player can depart. auto=true
// means the timer closed them; auto=false means the player closed them early.
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

// tryDoors: the D key / DOORS button. Only works when slow (<0.6 m/s) and
// within 25m of the stop point. First press OPENS (state→'doors', signal→red,
// points for accuracy). Second press (or timer) CLOSES via completeBoarding.
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

export function finishRun() {
  S.state = 'done';
  beep(523, 0.15);
  setTimeout(() => beep(659, 0.15), 160);
  setTimeout(() => beep(784, 0.3), 320);
}
