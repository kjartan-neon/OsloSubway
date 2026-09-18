"use strict";
// ============================================================================
// main.js — boot the game. ES modules are deferred, so the DOM (canvas +
// buttons) already exists when this runs.
//   initInput()  → wire keyboard + touch buttons
//   startLoop()  → update (physics) → render (draw) → next frame, forever
//   setInterval  → idle attract: slow roll on title so the tunnel scrolls
//                  behind the title screen. Wraps at 700m.
// ============================================================================

import { S } from './state.js';
import { initInput } from './input.js';
import { startLoop } from './update.js';

initInput();

/* idle attract: slow roll on title */
setInterval(() => {
  if (S.state === 'title') {
    S.trackPos += 2;
    if (S.trackPos > 700) S.trackPos = 0;
  }
}, 50);

startLoop();
