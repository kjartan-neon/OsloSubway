"use strict";
// ============================================================================
// input.js — keyboard + touch controls. Call initInput() ONCE from main.js.
// ----------------------------------------------------------------------------
// THE PATTERN (why this file looks the way it does): small do*() functions
// hold the REAL logic (doPower, doBrake...). The keyboard handler AND the
// on-screen buttons BOTH call them — so ↑, W, and the PWR button behave
// IDENTICALLY. Fix a bug once, fix it everywhere.
// JUNIOR GLOSSARY:
//   addEventListener('keydown', fn) → "run fn every time a key is pressed".
//   pointerdown/up/...             → unified mouse+touch+pen events (one set
//                                   of handlers covers phones AND desktops).
//   lookX = -1/0/1                 → peek left / center / right (shifts the
//                                   camera in render.js).
//   e.preventDefault()             → "browser, DON'T do your normal thing"
//                                   (stops arrows from scrolling the page).
//   e.repeat                       → true when a held key auto-fires; we skip
//                                   those so one press = one notch.
// ============================================================================

import { S, startGame, tryDoors } from './state.js';
import { audio, beep, startEngine, hornSound, toggleMute } from './audio.js';

// keys{}: tracks which keys are currently held (mostly for debugging; the
// game reacts on the PRESS event, not by polling this). Keys are lowercased
// so 'W' and 'w' match the same entry.
const keys = {};

// --- The do*() action functions (shared by keyboard AND touch) ---
// doPower: one throttle notch up (max 4). Cancels emergency first, eases off
// the brake, higher pitch beep per notch so you HEAR the notch count.
// doBrake: throttle slams to 0 (safety!), one brake notch up (max 4).
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
// toggleEmergency: SPACE / ! EMERG button. ON = full stop NOW (throttle 0,
// brake 4, marks the leg dirty so CLEAN LEG/SMOOTH bonuses are lost).
// Press again to release (brake back to 0, power stays 0 — you pull away
// manually). Low buzz = engaged, higher blip = released.
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
// doHorn: sound + set hornT=1 so render.js draws expanding horn waves for
// ~1 second (update.js counts hornT back down to 0).
export function doHorn() {
  hornSound();
  S.hornT = 1;
  beep(440, 0.1, 'square', 0.06);
}
// pressStart(): used by the START button + screen taps. If we're on the
// title/done screen, start a fresh game (returns true = "I handled it").
// Otherwise returns false so the caller falls through to tryDoors().
export function pressStart() {
  if (S.state === 'title' || S.state === 'done') { startGame(); return true; }
  return false;
}

/* --- Button helpers (touch + mouse, one pattern) --- */
// bindTap(id, fn): fire fn ONCE per press (DOORS, HORN, EMERG...). Also calls
// audio()+startEngine() first — every tap unlocks/keeps the sound alive.
// bindHold(id, fn): fire once, then auto-REPEAT while held (PWR/BRK): first
// repeat after 380 ms, then every 170 ms — like holding a keyboard key.
// end() on pointerup/cancel/leave stops repeating + removes the .held style
// (the CSS "pressed" look). contextmenu is blocked so long-presses don't pop
// up a menu on phones.
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

// initInput(): wire EVERYTHING. Called once from main.js at boot.
// KEYBOARD MAP: Enter/Space = start · ↑/W = power · ↓/S = brake ·
// Space = emergency · D/E/O = doors · H = horn · M = mute · ←→/A = look.
// (Space doubles as start on the title screen, emergency while driving.)
// Then: touch detect → hold-buttons (PWR/BRK) → tap-buttons → look left/right
// (press-and-hold to peek) → tap-the-screen to start (also unlocks audio on
// iPhones, where sound needs a screen touch) → rotation scroll fix.
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
