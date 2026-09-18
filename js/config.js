"use strict";
// ============================================================================
// config.js — world sizes, camera numbers, palette, canvas, pixel helper.
// No imports. Every other module reads constants from here.
// ----------------------------------------------------------------------------
// W/H: canvas pixels. HORIZON: screen row where tunnel vanishes.
// COCKPIT_H: bottom HUD height. FOCAL: like camera zoom (bigger = narrower).
// CAM_H: camera height above track. CEIL_H: tunnel roof height.
// TUN_HALF: tunnel half-width in world units. ROOF_TOP: top clip row.
// ============================================================================

export const W = 200, H = 320;
export const HORIZON = 95;
export const COCKPIT_H = 90;
export const FOCAL = 100;
export const CAM_H = 14;
export const CEIL_H = 40;      // tunnel roof height (world units, camera at CAM_H)
export const TUN_HALF = 75;    // tunnel half-width (world units, narrower for portrait)
export const ROOF_TOP = 16;    // highest screen row the roof render covers

// Gameplay tuning (physics caps, scoring scale, track dressing density).
export const VMAX = 45, ST_VMAX = 20;
export const SPEED_SCALE = 2; // world scrolls 2× per m/s — numbers stay, feel doubles
export const LIM_KMH_TOP = 170;
export const SPEEDS = [42, 34, 27, 20, 14]; // m/s ≈ 151/122/97/72/50 km/h
export const LAMP_EVERY = 60, SLEEPER_EVERY = 6;

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// makeBmp: create a small offscreen canvas and let fn(g,w,h) paint on it.
// We use these as "sprites" — draw once, then stamp scaled copies each frame.
// Example: makeBmp(8,8,(g)=>{g.fillStyle='red';g.fillRect(0,0,8,8);})
export function makeBmp(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  fn(g, w, h);
  return c;
}

// 16-bit-ish palette: one place for all tunnel/track colors so the
// art style stays consistent. Change a hex here to re-theme the game.
export const PAL = {
  tunnel0: '#151524', tunnel1: '#1c1c30', brick: '#26263e', brickDark: '#191926',
  rail: '#9aa0b8', railHi: '#e8ecff', sleeper: '#4a3220', sleeper2: '#3a2818',
  floor: '#23232e', floorLine: '#3d3d55', lamp: '#fff2b0', lampGlow: '#ffcf4d',
  plat: '#5a5a6e', platEdge: '#ffe14d', pillarG: '#2e8b57', pillarR: '#b03030'
};
