"use strict";
// ============================================================================
// input.js — keyboard + touch controls.
// Pattern: small do*() functions hold the real logic; keyboard handler AND
// touch buttons both call them. That way PWR works identically on ↑, W,
// or the on-screen button. lookX = -1/0/1 shifts the camera sideways.
// Call initInput() once from main.js.
// ============================================================================

import { S, startGame, tryDoors } from './state.js';
import { audio, beep, startEngine, hornSound, toggleMute } from './audio.js';

const keys = {};

export function doPower() {
  if (S.emergency) { S.emergency = false; }
  S.brake = Math.max(0, S.brake - 1);
  S.throttle = Math.min(4, S.throttle + 1);
  beep(300 + S.throttle * 90, 0.07);
}
export function doBrake() {
  S.throttle = 0;
  S.brake = Math.min(4, S.brake + 1);
  beep(220 - S.brake * 20, 0.08);
}
export function toggleEmergency() {
  S.emergency = !S.emergency;
  beep(S.emergency ? 180 : 520, 0.15);
  if (S.emergency) {
    S.throttle = 0; S.brake = 4;
    S.emergencyUsed = true;
    S.legClean = false;
  } else {
    S.brake = 0;
  }
}
export function doHorn() {
  hornSound();
  S.hornT = 1;
  beep(440, 0.1, 'square', 0.06);
}
export function pressStart() {
  if (S.state === 'title' || S.state === 'done') { startGame(); return true; }
  return false;
}

/* touch: detect + bind buttons (tap, hold-to-repeat for PWR/BRK) */
// bindTap: fire once per press. bindHold: fire once, then auto-repeat while
// held (like holding a key). pointer* events cover mouse+touch+pen at once.
function bindTap(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => { e.preventDefault(); audio(); startEngine(); fn(); });
}
function bindHold(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  let t1 = null, t2 = null;
  const start = e => {
    e.preventDefault(); audio(); startEngine(); el.classList.add('held'); fn();
    t1 = setTimeout(() => { t2 = setInterval(fn, 170); }, 380);
  };
  const end = () => { el.classList.remove('held'); clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

export function initInput() {
  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys[e.key.toLowerCase()] = true;
    audio(); startEngine();
    const k = e.key.toLowerCase();
    if (S.state === 'title' && (k === 'enter' || k === ' ')) { startGame(); return; }
    if (S.state === 'done' && k === 'enter') { startGame(); return; }
    if (k === 'm') { toggleMute(); return; }
    if (k === 'h') { doHorn(); return; }
    if (k === ' ') { toggleEmergency(); return; }
    if (k === 'd' || k === 'e' || k === 'o') { tryDoors(); return; }
    if (k === 'arrowup' || k === 'w') { doPower(); }
    if (k === 'arrowdown' || k === 's') { doBrake(); }
    if (k === 'arrowleft' || k === 'a') S.lookX = -1;
    if (k === 'arrowright') S.lookX = 1;
    void keys;
  });
  addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') S.lookX = 0;
    if (k === 'arrowright') S.lookX = 0;
  });

  if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch');
  }
  bindHold('btnPwr', doPower);
  bindHold('btnBrk', doBrake);
  bindTap('btnDoors', () => { if (!pressStart()) tryDoors(); });
  bindTap('btnGo', () => { if (!pressStart()) tryDoors(); });
  bindTap('btnHorn', doHorn);
  bindTap('btnEmg', toggleEmergency);
  bindTap('btnMute', toggleMute);

  const l = document.getElementById('btnLookL'), r = document.getElementById('btnLookR');
  if (l) {
    l.addEventListener('pointerdown', e => { e.preventDefault(); S.lookX = -1; });
    l.addEventListener('pointerup', () => { S.lookX = 0; });
    l.addEventListener('pointercancel', () => { S.lookX = 0; });
    l.addEventListener('pointerleave', () => { if (S.lookX < 0) S.lookX = 0; });
  }
  if (r) {
    r.addEventListener('pointerdown', e => { e.preventDefault(); S.lookX = 1; });
    r.addEventListener('pointerup', () => { S.lookX = 0; });
    r.addEventListener('pointercancel', () => { S.lookX = 0; });
    r.addEventListener('pointerleave', () => { if (S.lookX > 0) S.lookX = 0; });
  }
  // tap screen to start / dismiss title & done screens (also unlocks audio on iOS)
  const scr = document.getElementById('screen');
  if (scr) { scr.addEventListener('pointerdown', () => { audio(); startEngine(); pressStart(); }); }
  // keep layout honest on rotate / URL-bar show-hide
  addEventListener('orientationchange', () => setTimeout(() => window.scrollTo(0, 0), 100));
}
