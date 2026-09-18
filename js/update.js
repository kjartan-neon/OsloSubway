"use strict";
// ============================================================================
// update.js — physics + rules, then render().
// update(now): requestAnimationFrame gives us `now` (ms timestamp); dt clamps
// to 0.05s so tab-switch lag can't teleport.
// accel: throttle pushes (+1.4/notch), brakes pull (-2/notch), emergency
// slams (-6). Drag and rolling friction only apply when braking or emergency —
// at zero throttle with no brakes the train coasts at constant speed.
// Then: move (trackPos += speed*dt), limits, overspeed fines, clean-run
// trickle bonus, approach bonus, missed-station penalty, door timer,
// engine hum pitch. Doors state freezes the train (speed=0).
// ============================================================================

import { VMAX, SPEED_SCALE } from './config.js';
import {
  STATIONS, stopPos, pushStation, randLeg,
  ensureLimits, ensureMsgSigns,
  speedLimitAt, curveSharp, curveLimitAt
} from './world.js';
import { S, addScore, resetLegFlags, completeBoarding } from './state.js';
import { beep, updateEngine } from './audio.js';
import { render } from './render.js';

let last = performance.now();

export function update(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.state === 'drive' || S.state === 'doors') {
    // physics: 16-bit chunky notches
    const decelerating = S.brake > 0 || S.emergency;
    const drag = decelerating ? (S.speed * 0.055 + (S.speed > 0 ? 0.25 : 0)) : 0;
    const accel = S.throttle * 1.4 - S.brake * 2.0 - (S.emergency ? 6 : 0) - drag;
    if (S.state === 'doors') {
      S.speed = 0;
    } else {
      S.speed += accel * dt;
      if (S.speed < 0) S.speed = 0;
      if (S.speed > VMAX + 5) S.speed = VMAX + 5;
      S.trackPos += S.speed * dt * SPEED_SCALE;
      ensureLimits(S.trackPos);
      ensureMsgSigns(S.trackPos);
      // prune long-served stations behind us (keeps loops cheap; index follows)
      while (STATIONS.length && STATIONS[0].pos < S.trackPos - 400 && S.nextStIdx > 0) {
        STATIONS.shift();
        S.nextStIdx--;
      }
      // overspeed: escalating deduction + alarm while over the limit
      const lim = speedLimitAt(S.trackPos);
      if (S.speed > lim + 0.5) {
        S.overSpeedT += dt;
        S.flashT = 0.2;
        S.legClean = false;
        if (Math.floor(now / 300) !== Math.floor((now - dt * 1000) / 300)) beep(880, 0.06, 'square', 0.08);
        if (S.overSpeedT > 0.6) {
          const over = S.speed - lim;
          addScore(-(Math.ceil(over * 1.5) + 1), 'SPEEDING!');
          beep(160, 0.2, 'sawtooth', 0.14);
          S.overSpeedT = 0;
        }
      } else {
        S.overSpeedT = 0;
        // good driving: clean distance trickle while rolling under the limit
        if (S.speed > 4) {
          S.distClean += S.speed * dt;
          if (S.distClean >= 120) {
            S.distClean -= 120;
            addScore(8, 'CLEAN RUN');
            beep(990, 0.06, 'square', 0.05);
          }
        }
      }
      // rail screech when overcooking a sharp bend
      if (curveSharp(S.trackPos) > 0.16 && S.speed > curveLimitAt(S.trackPos)) {
        if (Math.random() < dt * 6) beep(1400 + Math.random() * 800, 0.08, 'sawtooth', 0.04);
      }
      // good driving: tidy approach to the next station
      {
        const ns = STATIONS[S.nextStIdx];
        if (ns && !S.approachAwarded) {
          const d = stopPos(ns) - S.trackPos;
          if (d < 170 && d > 25 && S.speed <= lim) {
            S.approachAwarded = true;
            addScore(25, 'NICE APPROACH');
            beep(740, 0.1, 'square', 0.07);
          }
        }
      }
      // timetable pressure
      S.timeLeft -= dt;
      if (S.timeLeft < 0) { S.timeLeft = 0; }
      // missed station? lay a fresh random leg ahead (endless running)
      const st = STATIONS[S.nextStIdx];
      if (st && S.trackPos - stopPos(st) > 30) {
        S.stationBonusMsg = 'MISSED ' + st.name + '! (-100)';
        S.msgTimer = 3;
        addScore(-100, 'MISSED STATION');
        beep(120, 0.4);
        st.signal = 'green';
        S.nextStIdx++;
        S.timeLeft += 40;
        S.departOk = false;
        resetLegFlags();
        pushStation(S.trackPos + randLeg(), undefined);
      }
    }
    if (S.state === 'doors') {
      S.doorTimer -= dt;
      if (Math.random() < dt * 8) beep(900 + Math.random() * 600, 0.03, 'square', 0.03);
      if (S.doorTimer <= 0) { // auto close => boarded => GREEN + new random leg
        completeBoarding(true);
      }
    }
    updateEngine(S.speed, S.throttle);
    if (S.hornT > 0) S.hornT -= dt;
  }
  render(dt);
  requestAnimationFrame(update);
}

// startLoop: seed `last`, then every frame runs update→render→next frame.
export function startLoop() {
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(update); });
}
