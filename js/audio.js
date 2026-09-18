"use strict";
// ============================================================================
// audio.js — tiny square-wave 16-bit bleeps (WebAudio, no assets).
// WebAudio 101: AudioContext = speaker system. Oscillator = tone generator,
// Gain = volume knob. beep() makes a short tone that fades out.
// Browsers block sound until the user presses something, so audio() is
// called on first key/touch (and resumes if suspended). Mute = skip all.
// ============================================================================

let AC = null;
let muted = false;
let engineOsc = null, engineGain = null;

export function isMuted() { return muted; }

export function audio() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

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

export function chime() {
  beep(660, 0.12);
  setTimeout(() => beep(880, 0.18), 130);
  setTimeout(() => beep(1320, 0.25), 260);
}

export function hornSound() {
  beep(220, 0.5, 'sawtooth', 0.18);
  beep(277, 0.5, 'sawtooth', 0.18);
}

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

// Called every frame from update(): pitch follows speed + throttle.
export function updateEngine(speed, throttle) {
  if (engineOsc && !muted) {
    engineOsc.frequency.value = 35 + speed * 6 + throttle * 8;
    engineGain.gain.value = 0.02 + speed * 0.001 + throttle * 0.008;
  }
}

export function toggleMute() {
  muted = !muted;
  if (engineGain) engineGain.gain.value = muted ? 0 : 0.03;
  const b = document.getElementById('btnMute');
  if (b) b.textContent = muted ? '🔇' : '🔊';
  return muted;
}
