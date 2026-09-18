"use strict";
// ============================================================================
// audio.js — all sound, made with code (WebAudio). No audio files needed.
// ----------------------------------------------------------------------------
// JUNIOR GLOSSARY — WebAudio in 4 ideas:
//   AudioContext ("AC") → the speaker system. You build sounds inside it.
//   Oscillator         → a tone generator. Set its TYPE (waveform shape:
//                        'square' = harsh retro beep, 'sawtooth' = buzzy)
//                        and FREQUENCY (pitch in Hz; 440 = concert A).
//   Gain               → a volume knob. We fade it to ~0 so notes don't click.
//   Autoplay policy    → browsers stay SILENT until the user presses/clicks
//                        something. That's why input.js calls audio() on the
//                        first key/button press — it "unlocks" the speakers.
// Module state below: AC (created lazily on first use), muted flag, and the
// engine hum's oscillator+gain (one LONG note whose pitch follows speed).
// ============================================================================

let AC = null;   // the shared speaker system (null = not created yet)
let muted = false; // true = skip every sound (M key / 🔊 button)
let engineOsc = null, engineGain = null; // the endlessly-running engine hum

// Mute state reader (render/input ask "are we muted?" through this).
export function isMuted() { return muted; }

// audio(): get the speaker system, creating it on first call ("lazy").
// If the browser paused it (autoplay policy), resume it. Always call this
// before making a sound.
export function audio() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

// beep(f, dur, type, vol, slide) — the ONE building block of every sound.
//   f     → pitch in Hz (higher = squeakier). 220 = low A, 880 = high A.
//   dur   → length in seconds (0.07 = blip, 0.5 = long horn).
//   type  → waveform: 'square' (retro beep) or 'sawtooth' (buzzy).
//   vol   → loudness 0..1 (keep small; 0.12 is clearly audible).
//   slide → optional pitch glide in Hz (negative = falling siren).
// Recipe: make oscillator + gain → connect tone→volume→speakers → play the
// note, then schedule it to STOP after dur seconds. try/catch = "if sound
// fails (no speakers, blocked), stay silent instead of crashing the game".
export function beep(f, dur, type = 'square', vol = 0.12, slide = 0) {
  if (muted) return;
  try {
    const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), ac.currentTime + dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch (e) { /* audio unavailable — stay silent */ }
}

// chime(): the happy "doors opened / game started" arpeggio — 3 rising notes.
// setTimeout(fn, ms) = "run fn after ms milliseconds" (staggers the notes).
export function chime() {
  beep(660, 0.12);
  setTimeout(() => beep(880, 0.18), 130);
  setTimeout(() => beep(1320, 0.25), 260);
}

// hornSound(): two buzzy notes at once (a train-chord). Named hornSound —
// NOT horn — so it can't be confused with the sprHorn sprite picture.
export function hornSound() {
  beep(220, 0.5, 'sawtooth', 0.18);
  beep(277, 0.5, 'sawtooth', 0.18);
}

// startEngine(): create the ONE long engine note (if not already running).
// Unlike beep() this note never stops — updateEngine() retunes it every
// frame. Guard: do nothing if muted or if the engine already exists.
export function startEngine() {
  if (muted || engineOsc) return;
  try {
    const ac = audio();
    engineOsc = ac.createOscillator();
    engineGain = ac.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 40;
    engineGain.gain.value = 0.03;
    engineOsc.connect(engineGain);
    engineGain.connect(ac.destination);
    engineOsc.start();
  } catch (e) { /* audio unavailable — stay silent */ }
}

// updateEngine(speed, throttle): retune the engine hum every frame.
// Faster speed + higher throttle = higher pitch + louder. Called from
// update.js. Does nothing until startEngine() has run (engineOsc = null).
export function updateEngine(speed, throttle) {
  if (engineOsc && !muted) {
    engineOsc.frequency.value = 35 + speed * 6 + throttle * 8;
    engineGain.gain.value = 0.02 + speed * 0.001 + throttle * 0.008;
  }
}

// toggleMute(): flip muted on/off, silence (or restore) the engine hum, and
// swap the 🔊/🔇 button label. Returns the new muted value. Wired to the M
// key and the mute button in input.js.
export function toggleMute() {
  muted = !muted;
  if (engineGain) engineGain.gain.value = muted ? 0 : 0.03;
  const b = document.getElementById('btnMute');
  if (b) b.textContent = muted ? '🔇' : '🔊';
  return muted;
}
