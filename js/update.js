"use strict";
// ============================================================================
// update.js — physics + scoring rules, then draw. Read this to change the
// GAMEPLAY (how the train moves and how points work).
// ----------------------------------------------------------------------------
// THE GAME LOOP (runs ~60×/second, forever):
//   browser calls update(now) → we move the train + apply rules → we call
//   render(dt) to draw → we ask the browser to call update() again next frame
//   (requestAnimationFrame). `now` = timestamp in ms. dt = seconds since the
//   last frame, CLAMPED to 0.05 s — without the clamp, switching tabs and
//   coming back would grant a huge dt and teleport the train through walls.
// PHYSICS (chunky arcade notches, not smooth pedals):
//   accel = throttle×1.4 − brake×2.0 − (emergency? 6 : 0) − drag.
//   Drag + rolling friction apply ONLY while braking/emerging — release
//   everything and the train COASTS at constant speed (no friction in space).
//   WORKED EXAMPLE: throttle 2, no brake → accel = 2.8 m/s². At dt = 1/60 s,
//   speed grows ~0.047 m/s per frame — smooth because frames are tiny.
// THEN, in order: move → generate track ahead → prune behind → overspeed
// fines → clean-run trickle → approach bonus → timetable → missed station →
// doors timer → engine hum + horn countdown → draw → next frame.
// In 'doors' mode the train is frozen (speed = 0) — boarding takes time.
// ============================================================================

import { VMAX, SPEED_SCALE } from './config.js';
import {
  STATIONS, stopPos, pushStation, randLeg,
  ensureLimits, ensureMsgSigns,
  speedLimitAt
} from './world.js';
import { S, addScore, resetLegFlags, completeBoarding } from './state.js';
import { beep, updateEngine } from './audio.js';
import { render } from './render.js';

// last: timestamp of the PREVIOUS frame. update() compares `now` vs `last`
// to get dt, then stores now as the new last. startLoop() seeds it.
let last = performance.now();

// update(now): one tick of physics + rules + draw, then re-queue itself.
// Only runs the simulation in 'drive'/'doors' (title screen just renders).
export function update(now) {
  // dt in seconds, clamped: Math.min(0.05, ...) caps tab-switch jumps.
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.state === 'drive' || S.state === 'doors') {
    // --- Physics: notches → acceleration → speed → position ---
    // decelerating = any brake or emergency (decides if drag applies).
    const decelerating = S.brake > 0 || S.emergency;
    const drag = decelerating ? (S.speed * 0.055 + (S.speed > 0 ? 0.25 : 0)) : 0;
    const accel = S.throttle * 1.4 - S.brake * 2.0 - (S.emergency ? 6 : 0) - drag;
    if (S.state === 'doors') {
      S.speed = 0; // boarding: the train CAN'T move with open doors, period.
    } else {
      S.speed += accel * dt; // integrate: speed grows by accel each second...
      if (S.speed < 0) S.speed = 0; // ...but never backwards...
      if (S.speed > VMAX + 5) S.speed = VMAX + 5; // ...and never absurdly fast.
      S.trackPos += S.speed * dt * SPEED_SCALE; // move along the 1-D track.
      ensureLimits(S.trackPos); // generate limit zones ahead (world.js).
      ensureMsgSigns(S.trackPos); // generate quote boards ahead (world.js).
      // Prune: drop stations > 400 m behind (they're done). nextStIdx-- keeps
      // pointing at the SAME upcoming station after shift() removes index 0.
      // Without pruning, STATIONS would grow forever and loops would slow.
      while (STATIONS.length && STATIONS[0].pos < S.trackPos - 400 && S.nextStIdx > 0) {
        STATIONS.shift();
        S.nextStIdx--;
      }
      // --- Overspeed: alarm + escalating fines while over the limit ---
      // lim = strictest limit HERE (zone/station). +0.5 grace avoids
      // flicker. While over: red flash + leg marked dirty + beep ~3×/second
      // (the Math.floor(now/300) trick fires only when a 300 ms bucket flips).
      // Every 0.6 s over: fine = ceil(how much over × 1.5) + 1, then reset the
      // 0.6 s clock so fines repeat while you keep speeding.
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
        S.overSpeedT = 0; // back under the limit: reset the fine clock.
        // Clean-run trickle: rolling > 4 m/s under the limit banks distance;
        // every 120 m of clean rolling = +8 "CLEAN RUN" + tiny happy blip.
        // Rewards smooth legal driving without pressing anything special.
        if (S.speed > 4) {
          S.distClean += S.speed * dt;
          if (S.distClean >= 120) {
            S.distClean -= 120;
            addScore(8, 'CLEAN RUN');
            beep(990, 0.06, 'square', 0.05);
          }
        }
      }
      // Approach bonus: ONE +25 "NICE APPROACH" per leg, awarded the first
      // frame you're 25–170 m out AND at/below the limit. approachAwarded
      // flag (reset each leg) guarantees it fires only once.
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
      // Timetable: counts down every frame (clamped at 0, never negative).
      // (Reaching 0 currently only shows T-0s — no game-over yet.)
      S.timeLeft -= dt;
      if (S.timeLeft < 0) { S.timeLeft = 0; }
      // Missed station: blew 30 m past the stop point without opening doors?
      // −100, sad trombone (low 120 Hz buzz), signal forced GREEN (so the
      // repeater never lies), move to the NEXT station, +40 s, fresh leg
      // flags, and plant a new station ahead (endless mode never runs out).
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
    // Doors mode: count the 6 s boarding timer down. Random quiet chatter
    // beeps (~8/second) sell the crowd. At 0 → auto-close = boarded = GREEN
    // + next leg (completeBoarding(true)). (Pressing D closes early instead.)
    if (S.state === 'doors') {
      S.doorTimer -= dt;
      if (Math.random() < dt * 8) beep(900 + Math.random() * 600, 0.03, 'square', 0.03);
      if (S.doorTimer <= 0) { // auto close => boarded => GREEN + new random leg
        completeBoarding(true);
      }
    }
    updateEngine(S.speed, S.throttle); // retune the engine hum to now.
    if (S.hornT > 0) S.hornT -= dt; // horn visuals fade after ~1 s.
  }
  render(dt); // draw everything (render.js).
  requestAnimationFrame(update); // "call me again next frame" — the loop!
}

// startLoop: boot the loop. Double-rAF trick: first callback SYNCs `last`
// to the browser's clock, second starts real updates — so frame #1 gets a
// correct (tiny) dt instead of a huge jump from performance.now().
export function startLoop() {
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(update); });
}
