"use strict";
// ============================================================================
// main.js — BOOT file: the 10 lines that start the whole game. Read this to
// see how the modules fit together.
// ----------------------------------------------------------------------------
// WHY THIS ORDER?
//   1. initInput()  → wire keyboard + buttons FIRST, so the title screen is
//      already clickable on the very first frame.
//   2. setInterval  → idle "attract mode": while S.state is 'title', creep
//      the camera +2 m every 50 ms (wraps at 700 m) so the tunnel scrolls
//      behind the title card. Stops itself once you press START (state flips
//      to 'drive'). setInterval(fn, ms) = "run fn every ms milliseconds".
//   3. startLoop()  → hand control to update.js: physics → draw → next frame,
//      ~60×/second, forever.
// MODULE TIMING NOTE (important!): <script type="module"> files are DEFERRED
// by default — the browser parses ALL of index.html (canvas + buttons exist!)
// BEFORE running this. That's why config.js can grab #game at import time.
// ============================================================================

import { S } from './state.js';
import { initInput } from './input.js';
import { startLoop } from './update.js';

initInput(); // step 1: controls live before the first frame.

/* step 2 — idle attract: slow roll ONLY on the title screen */
setInterval(() => {
  if (S.state === 'title') {
    S.trackPos += 2;
    if (S.trackPos > 700) S.trackPos = 0;
  }
}, 50);

startLoop(); // step 3: the game is now running — update↔render forever.
