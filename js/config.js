"use strict";
// ============================================================================
// config.js — shared numbers + drawing tools. Start here if you're new.
// ----------------------------------------------------------------------------
// JUNIOR GLOSSARY (used in every file):
//   export  → makes a name usable in OTHER files via `import ... from ...`.
//             Think: "this file shares this". Names WITHOUT export stay
//             private to the file.
//   const   → a value you can't reassign later (use for settings). `let` is
//             for values that DO change (like speed). Rule of thumb: const
//             until you need let.
//   canvas  → the <canvas id="game"> box in index.html we paint pixels into.
//   ctx     → the canvas's "2D paintbrush". Every draw call in the game goes
//             through this one object (fillRect, drawImage, fillText...).
// No imports here — this is the bottom of the dependency pile on purpose,
// so every other module can safely import from it without import cycles.
// ----------------------------------------------------------------------------
// W/H: canvas pixels (tiny on purpose — CSS stretches them big + chunky).
// HORIZON: the screen row where the tunnel vanishes (sky above, track below).
// COCKPIT_H: how many bottom pixels the dashboard covers (not 3D, just HUD).
// FOCAL: camera "zoom". Bigger = narrower view (things shrink faster).
// CAM_H: how high the camera sits above the rails, in world units.
// CEIL_H: how high the tunnel roof is, in the same world units.
// TUN_HALF: tunnel half-width in world units (full tunnel = 2 × this).
// ROOF_TOP: highest screen row the roof painter covers (rows above = sky).
// ============================================================================

// --- Screen + camera geometry (change the LOOK of the game here) ---
export const W = 200, H = 320;
export const HORIZON = 95;
export const COCKPIT_H = 90;
export const FOCAL = 100;
export const CAM_H = 14;
export const CEIL_H = 40;      // tunnel roof height (world units, camera at CAM_H)
export const TUN_HALF = 75;    // tunnel half-width (world units, narrower for portrait)
export const ROOF_TOP = 16;    // highest screen row the roof render covers

// --- Gameplay tuning (change the FEEL of the game here) ---
// VMAX: fastest the train may go (m/s). ST_VMAX: fastest allowed in stations.
// SPEED_SCALE: world scrolls 2× per m/s — real numbers stay sane, but the
//   ride LOOKS twice as fast. Rendering-only trick, physics ignores it.
// SPEEDS: the pool of random speed limits zones are picked from.
// LAMP_EVERY: a roof lamp every 60 m. SLEEPER_EVERY: a track sleeper every 6 m.
export const VMAX = 45, ST_VMAX = 20;
export const SPEED_SCALE = 2; // world scrolls 2× per m/s — numbers stay, feel doubles
export const LIM_KMH_TOP = 170;
export const SPEEDS = [42, 34, 27, 20]; // m/s ≈ 151/122/97/72 km/h (slow 50 removed for action)
export const LAMP_EVERY = 60, SLEEPER_EVERY = 6;

// --- Canvas hookup (the ONE paintbrush the whole game shares) ---
// getElementById finds <canvas id="game"> from index.html. This runs when the
// module loads — safe because <script type="module"> runs AFTER the page HTML
// is parsed (modules are "deferred" by default). getContext('2d') returns the
// paintbrush. imageSmoothingEnabled=false keeps scaled pixels sharp + blocky.
export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// makeBmp: build a tiny reusable "stamp" (offscreen canvas) you paint once,
// then stamp scaled copies of every frame with drawImage().
//   w,h → stamp size in pixels. fn(g,w,h) → your paint routine; g is the
//   stamp's own mini-paintbrush. Returns the stamp (a canvas element).
// Example: makeBmp(8,8,(g)=>{g.fillStyle='red';g.fillRect(0,0,8,8);})
//   makes an 8×8 red square you can draw big, small, anywhere, for free.
// Junior tip: fillStyle = "pick a paint color", fillRect(x,y,w,h) = "paint a
// rectangle". Almost all pixel art in sprites.js is just these two calls.
export function makeBmp(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  fn(g, w, h);
  return c;
}

// --- Shared palette (change the ART STYLE of the game here) ---
// One object holding every tunnel/track color, so the 16-bit look stays
// consistent. To re-theme the game, change a hex value here ONCE instead of
// hunting through render.js. Usage: ctx.fillStyle = PAL.rail;
export const PAL = {
  tunnel0: '#151524', tunnel1: '#1c1c30', brick: '#26263e', brickDark: '#191926',
  rail: '#9aa0b8', railHi: '#e8ecff', sleeper: '#4a3220', sleeper2: '#3a2818',
  floor: '#23232e', floorLine: '#3d3d55', lamp: '#fff2b0', lampGlow: '#ffcf4d',
  plat: '#5a5a6e', platEdge: '#ffe14d', pillarG: '#2e8b57', pillarR: '#b03030'
};
