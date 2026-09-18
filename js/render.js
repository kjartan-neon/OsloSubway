"use strict";
// ============================================================================
// render.js — projection (fake 3D) + all drawing.
// render(dt): draws ONE frame, back-to-front (painter's algorithm):
//   1. sky + vanishing point, 2. ROOF pass (rows above horizon = ceiling),
//   3. FLOOR/WALL pass (rows below horizon = track depth), 4. bore outlines,
//   5. sprites far→near (lamps, signs, stations, signals), 6. cockpit + HUD
//   7. overlays (title/doors/done/messages/popups/flash/scanlines).
// dt = seconds since last frame (drives countdown timers).
// frame++ drives all blinking/bobbing animation.
// ============================================================================

import {
  W, H, HORIZON, COCKPIT_H, FOCAL, CAM_H, CEIL_H, TUN_HALF, ROOF_TOP,
  LIM_KMH_TOP, VMAX, LAMP_EVERY, SLEEPER_EVERY, ctx, PAL
} from './config.js';
import {
  sprLamp, sprExitR, sprExitG, sprCurveWarn,
  speedSignSprite, msgSignSprite, PEOPLE, sprBench, sprStop, sprStopPost,
  boardSprite
} from './sprites.js';
import {
  STATIONS, LIMITS, MSGSIGNS,
  stopPos, sigPos, trackCurve, curveSharp, curveLimitAt,
  inStation, speedLimitAt, zoneLimitAt
} from './world.js';
import { S } from './state.js';

/* ---------- projection (height-aware: 0=floor, CEIL_H=roof) ---------- */
// projectY: the ONLY 3D math in the game. Given an object (worldZoff meters
// ahead, worldX meters sideways, worldY meters up), return screen {x, y, s}.
// s = scale = FOCAL/z: double the distance → half the size (perspective).
// dx subtracts the track bend so curves swing the world sideways.
// shake adds tiny random jitter for speed vibration. Returns null if behind.
// project() = floor-level shortcut (y=0). projectCeil() = roof shortcut.
// drawScaledBmp*: project, then drawImage centered, skipping tiny/far/huge.
export function projectY(worldZoff, worldX, worldY, camCurve) {
  const z = worldZoff;
  if (z < 2) return null;
  const s = FOCAL / z;
  const dx = trackCurve(S.trackPos + z) - camCurve;
  const x = W / 2 + (worldX - dx - S.lookX * 14) * s + (Math.random() - 0.5) * S.shake;
  const y = HORIZON + (CAM_H - worldY) * s + (Math.random() - 0.5) * S.shake;
  return { x, y, s, z };
}
export function project(worldZoff, worldX, camCurve) {
  return projectY(worldZoff, worldX, 0, camCurve);
}
export function projectCeil(worldZoff, worldX, camCurve) {
  return projectY(worldZoff, worldX, CEIL_H, camCurve);
}
export function drawScaledBmp(img, wx, wzoff, w, h) {
  const camC = trackCurve(S.trackPos);
  const p = project(wzoff, wx, camC);
  if (!p || p.y < -40 || p.y > H) return;
  const dw = w * p.s, dh = h * p.s;
  if (dw < 1 || dh < 1 || dw > 400) return;
  ctx.drawImage(img, p.x - dw / 2, p.y - dh, dw, dh);
}
export function drawScaledBmpY(img, wx, wy, wzoff, w, h) {
  const camC = trackCurve(S.trackPos);
  const p = projectY(wzoff, wx, wy, camC);
  if (!p || p.y < -60 || p.y > H) return;
  const dw = w * p.s, dh = h * p.s;
  if (dw < 1 || dh < 1 || dw > 400) return;
  ctx.drawImage(img, p.x - dw / 2, p.y - dh, dw, dh);
}

/* ---------- RENDER ---------- */
export let frame = 0;

export function render(dt) {
  frame++;
  S.shake = Math.min(3, S.speed * 0.09 + (S.speed > 20 ? Math.sin(frame * 0.7) * 0.8 : 0));
  // curve rumble: sharp bends shake the cab at speed
  {
    const csh = curveSharp(S.trackPos);
    if (csh > 0.13 && S.speed > 9) S.shake = Math.min(4, S.shake + csh * S.speed * 0.028);
  }
  const camC = trackCurve(S.trackPos);
  const stNow = inStation(S.trackPos);

  // sky / tunnel back
  const bg = ctx.createLinearGradient(0, 0, 0, HORIZON);
  bg.addColorStop(0, '#05050c'); bg.addColorStop(1, '#101024');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, HORIZON + 1);

  // distant glow dot (vanishing point)
  const vanishingX = W / 2 - S.lookX * 8;
  ctx.fillStyle = '#2a2a4a'; ctx.fillRect(vanishingX - 1, HORIZON - 2, 2, 2);
  ctx.fillStyle = '#55557a'; ctx.fillRect(vanishingX - 2, HORIZON - 1, 4, 1);

  /* ---- ROOF pass: rows above horizon = tunnel ceiling ---- */
  // Same trick as floor but mirrored: row y above horizon ↔ depth z on the
  // ceiling. Higher rows = farther. Panels alternate color every 8m so you
  // feel motion; ribs every 20m; lamp glow strips pulse overhead.
  for (let y = ROOF_TOP; y < HORIZON; y++) {
    const dy = (HORIZON - y) + 0.6;
    const z = ((CEIL_H - CAM_H) * FOCAL) / dy;   // world depth of this ceiling row
    if (z > 620) { ctx.fillStyle = '#05050c'; ctx.fillRect(0, y, W, 1); continue; }
    const wz = S.trackPos + z;
    const s = FOCAL / z;
    const halfTun = TUN_HALF * s;
    const cx = W / 2 - ((trackCurve(wz) - camC)) * s - S.lookX * 8 * (1 - z / 600);
    const inSt = inStation(wz);
    let ceil = ((Math.floor(wz / 8) % 2) === 0) ? '#101018' : '#151522';
    if (inSt) ceil = ((Math.floor(wz / 6) % 2) === 0) ? '#1b1b28' : '#20202f';
    ctx.fillStyle = ceil; ctx.fillRect(0, y, W, 1);
    // ribs run over the roof too (tunnel segments every 20m)
    if (Math.floor(wz) % 20 < 1) { ctx.fillStyle = '#2e2e4e'; ctx.fillRect(0, y, W, 1); }
    // darken outside the bore
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    const wl = cx - halfTun, wr = cx + halfTun;
    if (wl > 0) ctx.fillRect(0, y, wl, 1);
    if (wr < W) ctx.fillRect(wr, y, W - wr, 1);
    // roof lamp glow strip: warm pool baked into ceiling panels
    if (Math.floor(wz) % LAMP_EVERY < 4) {
      ctx.fillStyle = 'rgba(255,207,77,0.32)';
      const gw = Math.max(1, 9 * s);
      ctx.fillRect(cx - gw, y, gw * 2, 1);
    }
    // cable tray down the roof centre
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - 1, y, 2, 1);
  }

  /* ---- FLOOR/WALL pass: each screen row below horizon = one depth ---- */
  // Core pseudo-3D: screen row y ↔ world depth z = CAM_H*FOCAL/(y-HORIZON).
  // Low rows (bottom) = close = wide track; rows near horizon = far = narrow.
  // cx shifts each row by the track bend → curves. Then per row we paint:
  // walls, tunnel mouth darkening, platforms, track bed, sleepers, rails,
  // stop lines, limit lines, lamp pools. One fillRect per row = fast.
  for (let y = HORIZON; y < H - COCKPIT_H; y++) {
    const dy = (y - HORIZON) + 0.6;
    const z = (CAM_H * FOCAL) / dy;             // world depth of this row
    const wz = S.trackPos + z;
    const s = FOCAL / z;
    const halfRoad = 14 * s, halfTun = TUN_HALF * s; // road half-width, tunnel half-width (px)
    const cx = W / 2 - ((trackCurve(wz) - camC)) * s - S.lookX * 8 * (1 - z / 600);
    // tunnel walls (brick courses scroll past)
    const inSt = inStation(wz);
    let wall = ((Math.floor(wz / 8) % 2) === 0) ? PAL.tunnel0 : PAL.tunnel1;
    if (inSt) wall = ((Math.floor(wz / 6) % 2) === 0) ? '#23232e' : '#282836';
    ctx.fillStyle = wall;
    ctx.fillRect(0, y, W, 1);
    // brick-course shading on the walls (inside the bore only)
    const wl0 = cx - halfTun, wr0 = cx + halfTun;
    const course = (Math.floor(wz / 4) % 2) === 0;
    ctx.fillStyle = course ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(Math.max(0, wl0), y, Math.max(0, cx - halfRoad - 16 * s - Math.max(0, wl0)), 1);
    ctx.fillRect(Math.min(W, cx + halfRoad + 16 * s), y, Math.max(0, Math.min(W, wr0) - Math.min(W, cx + halfRoad + 16 * s)), 1);
    // wall edge highlight (tunnel ribs every 20m)
    if (Math.floor(wz) % 20 < 1) { ctx.fillStyle = '#33335a'; ctx.fillRect(0, y, W, 1); }
    // darken outside tunnel mouth
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const wl = cx - halfTun, wr = cx + halfTun;
    if (wl > 0) ctx.fillRect(0, y, wl, 1);
    if (wr < W) ctx.fillRect(wr, y, W - wr, 1);
    // platform floor in stations
    if (inSt) {
      ctx.fillStyle = ((Math.floor(wz / 4) % 2) === 0) ? PAL.plat : '#545464';
      const pl = cx - halfTun, pr = cx + halfTun;
      const tl = cx - halfRoad - 34 * s, tr = cx + halfRoad + 34 * s;
      if (tl > 0) ctx.fillRect(Math.max(0, pl), y, Math.max(0, tl - Math.max(0, pl)), 1);
      if (tr < W) ctx.fillRect(tr, y, Math.max(0, Math.min(W, pr) - tr), 1);
      // yellow platform edge
      ctx.fillStyle = PAL.platEdge;
      if (tl - 2 > 0 && tl < W) ctx.fillRect(tl - 2, y, Math.max(1, 3 * s), 1);
      if (tr > 0 && tr < W) ctx.fillRect(tr, y, Math.max(1, 3 * s), 1);
    }
    // floor / track bed
    const bedW = halfRoad + 16 * s;
    ctx.fillStyle = ((Math.floor(wz / 2) % 2) === 0) ? PAL.floor : '#20202a';
    ctx.fillRect(cx - bedW, y, bedW * 2, 1);
    // sleepers (scaling bands)
    if (Math.floor(wz) % SLEEPER_EVERY < 1.2) {
      ctx.fillStyle = (Math.floor(wz / SLEEPER_EVERY) % 2) ? PAL.sleeper : PAL.sleeper2;
      ctx.fillRect(cx - halfRoad, y, halfRoad * 2, 1);
    }
    // center third-rail glow / side rails
    const railW = Math.max(1, 1.4 * s);
    ctx.fillStyle = PAL.rail;
    ctx.fillRect(cx - halfRoad, y, railW, 1);
    ctx.fillRect(cx + halfRoad - railW, y, railW, 1);
    ctx.fillStyle = PAL.railHi;
    ctx.fillRect(cx - halfRoad, y, 1, 1);
    // optimal-stop white line: painted across the track at the exact stop point
    for (const stp of STATIONS) {
      if (Math.abs(wz - stopPos(stp)) < 0.9) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cx - halfRoad - 7 * s, y, halfRoad * 2 + 14 * s, 1);
        ctx.fillStyle = '#f4f6ff';
        ctx.fillRect(cx - halfRoad - 2 * s, y, halfRoad * 2 + 4 * s, 1);
        break;
      }
    }
    // speed-zone boundary: yellow line where the new limit STARTS (sign stands here)
    for (const zz of LIMITS) {
      if (Math.abs(wz - zz.at) < 0.9) {
        ctx.fillStyle = 'rgba(255,225,77,0.35)';
        ctx.fillRect(cx - halfRoad - 7 * s, y, halfRoad * 2 + 14 * s, 1);
        ctx.fillStyle = '#ffe14d';
        ctx.fillRect(cx - halfRoad - 2 * s, y, halfRoad * 2 + 4 * s, 1);
        break;
      }
    }
    // faint warm pool on the track bed under each roof lamp
    if (Math.floor(wz) % LAMP_EVERY < 3) { ctx.fillStyle = 'rgba(255,207,77,0.16)'; ctx.fillRect(cx - 2 * s, y, 4 * s, 1); }
  }

  /* ---- tunnel bore outlines: wall/ceiling edges converging ---- */
  // Draws 4 converging lines (left/right wall base + left/right roof edge)
  // by projecting points at increasing z and connecting them. Cheap "3D wire".
  (function () {
    function strokeSide(worldY, side) {
      ctx.beginPath();
      let started = false;
      for (let z = 8; z < 520; z += 10) {
        const s = FOCAL / z, wz = S.trackPos + z;
        const cx = W / 2 - ((trackCurve(wz) - camC)) * s - S.lookX * 8 * (1 - z / 600);
        const x = cx + side * TUN_HALF * s, y = HORIZON + (CAM_H - worldY) * s;
        if (y < ROOF_TOP - 4 || y > H - COCKPIT_H) continue;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    strokeSide(0, -1); strokeSide(0, 1); strokeSide(CEIL_H, -1); strokeSide(CEIL_H, 1);
    ctx.strokeStyle = 'rgba(120,120,170,0.35)';
    strokeSide(0, -1); strokeSide(0, 1);
  })();

  /* sprites back-to-front (scaling bitmaps!) */
  // IMPORTANT ORDER: draw far objects FIRST so near ones overlap them.
  // Lamps loop runs far→near (wz decreasing). Stations skip if off-screen
  // (off<-160 or >560) for speed. People bob with sin(frame…); signals show
  // red until boarded, green after (st.signal), with a pulsing glow.
  const camCurve = camC;
  // ROOF lamps: fixtures bolted to the tunnel ceiling, receding to horizon
  const firstLamp = Math.ceil((S.trackPos + 10) / LAMP_EVERY) * LAMP_EVERY;
  for (let wz = firstLamp + LAMP_EVERY * 6; wz > S.trackPos + 8; wz -= LAMP_EVERY) {
    const off = wz - S.trackPos;
    if (off > 520) continue;
    const pc = projectCeil(off, 0, camCurve);
    if (!pc) continue;
    drawScaledBmpY(sprLamp, 0, CEIL_H, off, 24, 10);
    // halo around the roof fixture
    if (pc.s > 0.15) {
      ctx.fillStyle = 'rgba(255,220,120,0.13)'; ctx.beginPath();
      ctx.ellipse(pc.x, pc.y + 2 * pc.s, 15 * pc.s, 5 * pc.s, 0, 0, 7); ctx.fill();
    }
    // light pool down on the track bed
    const pf = project(off, 0, camCurve);
    if (pf && pf.s > 0.3) {
      ctx.fillStyle = 'rgba(255,220,120,0.10)'; ctx.beginPath();
      ctx.ellipse(pf.x, pf.y, 20 * pf.s, 4 * pf.s, 0, 0, 7); ctx.fill();
    }
  }
  // max-speed signs at every zone start + warning diamond before sharp bends
  {
    for (const z of LIMITS) {
      const off = z.at - S.trackPos;
      if (off < -20 || off > 520) continue;
      drawScaledBmp(speedSignSprite(Math.round(z.vms * 3.6)), -42, off, 26, 28);
    }
    let warn = -1;
    {
      let prevSh = curveSharp(S.trackPos + 20) < 0.09;
      for (let zz = 30; zz < 500; zz += 12) {
        const sh = curveSharp(S.trackPos + zz);
        if (prevSh && sh > 0.11) { warn = Math.max(0, zz - 12); break; }
        prevSh = sh < 0.09;
      }
    }
    if (warn > 0) drawScaledBmp(sprCurveWarn, 42, warn, 18, 26);
    // green motivational signs on the right wall
    for (const ms of MSGSIGNS) {
      const off = ms.at - S.trackPos;
      if (off < -20 || off > 520) continue;
      drawScaledBmp(msgSignSprite(ms.msg), 38, off, 48, 26);
    }
  }
  // stations: pillars, benches, people, boards, STOP marker
  for (const st of STATIONS) {
    const off = st.pos - S.trackPos;
    const offStop = stopPos(st) - S.trackPos;
    if (off < -160 || off > 560) continue;
    const board = boardSprite(st.name);
    for (let d = -90; d <= 90; d += 18) {
      const o = off + d;
      if (o < 6 || o > 540) continue;
      drawScaledBmp(board, -62, o, 64, 12);
      // pillars both sides
      const pc = trackCurve(S.trackPos);
      const pl = project(o, -58, pc), pr = project(o, 58, pc);
      if (pl && pl.s > 0.15) {
        const pw = 6 * pl.s, ph = 40 * pl.s;
        ctx.fillStyle = '#101018'; ctx.fillRect(pl.x - pw / 2 - 1, pl.y - ph - 2, pw + 2, ph + 2);
        ctx.fillStyle = (Math.floor((S.trackPos + o) / 18) % 2) ? PAL.pillarG : PAL.pillarR;
        ctx.fillRect(pl.x - pw / 2, pl.y - ph, pw, ph);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(pl.x - pw / 2, pl.y - ph, 1, ph);
      }
      if (pr && pr.s > 0.15) {
        const pw = 6 * pr.s, ph = 40 * pr.s;
        ctx.fillStyle = '#101018'; ctx.fillRect(pr.x - pw / 2 - 1, pr.y - ph - 2, pw + 2, ph + 2);
        ctx.fillStyle = (Math.floor((S.trackPos + o) / 18) % 2) ? PAL.pillarR : PAL.pillarG;
        ctx.fillRect(pr.x - pw / 2, pr.y - ph, pw, ph);
      }
    }
    // people + benches (deterministic pseudo-random per station)
    for (let i = 0; i < 10; i++) {
      const px = (i % 2 ? 1 : -1) * (44 + ((i * 13) % 10));
      const pz = off - 80 + i * 17;
      if (pz < 8 || pz > 500) continue;
      const bob = Math.sin(frame * 0.15 + i * 2) * 1.5 * project(pz, px, camCurve)?.s || 0;
      const p = project(pz, px, camCurve);
      if (!p) continue;
      const per = PEOPLE[(i + st.pos) % PEOPLE.length];
      const dw = 8 * p.s, dh = 16 * p.s;
      if (dw > 0.5 && dh > 0.5) ctx.drawImage(per, p.x - dw / 2, p.y - dh + bob, dw, dh);
      if (i % 3 === 0) drawScaledBmp(sprBench, px + 8, pz, 20, 8);
    }
    // STOP marker at exact stop point (far end of platform) + striped posts
    drawScaledBmp(sprStop, 30, offStop, 24, 20);
    drawScaledBmp(sprStopPost, -32, offStop, 6, 34);
    drawScaledBmp(sprStopPost, 32, offStop, 6, 34);
    // EXIT SIGNAL at end of platform: open tunnel, red until boarded, then green.
    // (Deliberately NO wall here — the bore stays open past the signal.)
    {
      const sigOff = sigPos(st) - S.trackPos;
      if (sigOff > 6 && sigOff < 540) {
        const beam = projectCeil(sigOff, 0, camCurve);
        if (beam && beam.y > ROOF_TOP - 10) {
          const bw = TUN_HALF * beam.s;
          const bt = Math.max(1, 3 * beam.s);
          // gantry beam across the bore at roof height
          ctx.fillStyle = '#08080e';
          ctx.fillRect(beam.x - bw - 2, beam.y - bt - 1, (bw + 2) * 2, bt + 2);
          ctx.fillStyle = '#3d3d5c';
          ctx.fillRect(beam.x - bw, beam.y - bt, bw * 2, bt);
          ctx.fillStyle = '#77779a';
          ctx.fillRect(beam.x - bw, beam.y - bt, bw * 2, 1);
          // dropper + signal head hanging right of centre
          const green = st.signal === 'green';
          const hb = projectY(sigOff, 30, CEIL_H - 16, camCurve);
          if (hb) {
            const dw2 = 3 * hb.s;
            ctx.fillStyle = '#08080e';
            ctx.fillRect(hb.x - dw2 / 2, beam.y, dw2, Math.max(1, hb.y - 14 * hb.s - beam.y));
            const img = green ? sprExitG : sprExitR;
            const sw = 12 * hb.s, sh = 20 * hb.s;
            if (sw > 1 && sh > 1) ctx.drawImage(img, hb.x - sw / 2, hb.y - sh, sw, sh);
            // far-visible glow dot
            const pulse = green ? (0.7 + 0.3 * Math.sin(frame * 0.2)) : (0.7 + 0.3 * Math.sin(frame * 0.35));
            ctx.fillStyle = green ? `rgba(40,255,120,${0.5 * pulse})` : `rgba(255,40,40,${0.55 * pulse})`;
            ctx.beginPath(); ctx.ellipse(hb.x, hb.y - 14 * hb.s, 7 * hb.s, 7 * hb.s, 0, 0, 7); ctx.fill();
            ctx.fillStyle = green ? '#8fffb0' : '#ff6060';
            ctx.fillRect(hb.x - 1, hb.y - 15 * hb.s, 2, 2);
          }
        }
      }
    }
  }

  // horn visual handled by drawHornWaves()
  drawHornWaves(vanishingX);

  /* ---------- cockpit dashboard (bottom bitmap HUD) ---------- */
  // drawCockpit: the bottom panel — speed number + bar, LIM plaque, PWR/BRK
  // notch blocks (4 each), door lamp, countdown clock, score, next-station
  // name + distance bar. All plain fillRect/fillText, no images.
  drawCockpit(stNow);

  /* ---------- text HUD ---------- */
  // drawHUD: floating text over the 3D view — top score bar, signal repeater
  // (mini GO/STOP mirror), station banner, meters-to-stop countdown,
  // door prompt, SLOW DOWN / SHARP CURVE warnings.
  drawHUD(stNow);

  if (S.state === 'title') drawTitle();
  if (S.state === 'done') drawDone();
  if (S.state === 'doors') drawDoorsOverlay();
  if (S.msgTimer > 0) {
    S.msgTimer -= dt;
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(S.stationBonusMsg, W / 2 + 1, HORIZON + 22);
    ctx.fillStyle = '#ffe14d'; ctx.fillText(S.stationBonusMsg, W / 2, HORIZON + 21);
  }
  // score event popups (rise + fade, green gains / red deductions)
  for (let i = S.popups.length - 1; i >= 0; i--) {
    const pp = S.popups[i];
    pp.t -= dt;
    if (pp.t <= 0) { S.popups.splice(i, 1); continue; }
    const rise = (2.4 - pp.t) * 8;
    ctx.globalAlpha = Math.min(1, pp.t * 2);
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'right';
    ctx.fillStyle = '#000'; ctx.fillText(pp.txt, W - 7 + 1, HORIZON + 44 + i * 10 - rise + 1);
    ctx.fillStyle = pp.color; ctx.fillText(pp.txt, W - 7, HORIZON + 44 + i * 10 - rise);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  // overspeed flash
  if (S.flashT > 0) {
    S.flashT -= dt;
    ctx.fillStyle = `rgba(255,0,0,${0.12 + 0.1 * Math.sin(frame * 0.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawHornWaves(vx) {
  if (S.hornT <= 0) return;
  ctx.strokeStyle = '#ffec00'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const r = (frame * 3 + i * 8) % 30;
    ctx.globalAlpha = Math.max(0, 1 - r / 30);
    ctx.beginPath(); ctx.arc(vx, HORIZON - 6, 6 + r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCockpit(stNow) {
  void stNow;
  const y0 = H - COCKPIT_H;
  // panel base
  ctx.fillStyle = '#1b1b28'; ctx.fillRect(0, y0, W, COCKPIT_H);
  ctx.fillStyle = '#3d3d5c'; ctx.fillRect(0, y0, W, 3);
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, y0 + 3, W, 2);
  // windshield pillars
  ctx.fillStyle = '#101018'; ctx.fillRect(0, y0 - 6, 10, 10); ctx.fillRect(W - 10, y0 - 6, 10, 10);

  // LEFT: speedometer (x 0–50) + LIM sign (x 52–96)
  const kmh = S.speed * 3.6;
  ctx.fillStyle = '#0f0'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'left';
  ctx.fillText('KM/H', 4, y0 + 12);
  ctx.fillStyle = '#7df9ff'; ctx.font = 'bold 16px monospace';
  ctx.fillText(String(Math.round(kmh)).padStart(3, ' '), 2, y0 + 30);
  // speed bar
  ctx.fillStyle = '#333'; ctx.fillRect(2, y0 + 33, 44, 3);
  const frac = Math.min(1, kmh / LIM_KMH_TOP);
  ctx.fillStyle = frac > 0.8 ? '#f22' : frac > 0.6 ? '#ffe14d' : '#0f6';
  ctx.fillRect(2, y0 + 33, 44 * frac, 3);
  // Speed limit sign (styled like trackside signs) — shows static zone limit
  const limKmh = Math.round(zoneLimitAt(S.trackPos) * 3.6);
  ctx.fillStyle = '#8b8ba3'; ctx.font = 'bold 5px monospace';
  ctx.fillText('LIM', 52, y0 + 8);
  ctx.fillStyle = '#111'; ctx.fillRect(50, y0 + 9, 46, 30);        // housing
  ctx.fillStyle = '#000'; ctx.fillRect(51, y0 + 10, 44, 28);       // black border
  ctx.fillStyle = '#ffe14d'; ctx.fillRect(53, y0 + 12, 40, 24);    // yellow board
  ctx.fillStyle = '#000'; ctx.fillRect(53, y0 + 12, 40, 3);        // top band
  ctx.fillStyle = '#000'; ctx.fillRect(53, y0 + 33, 40, 3);        // bottom band
  ctx.fillStyle = '#000'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText(String(limKmh), 73, y0 + 32); ctx.textAlign = 'left';

  // RIGHT: PWR/BRK notch blocks (x 100–196)
  ctx.fillStyle = '#8b8ba3'; ctx.font = 'bold 6px monospace';
  ctx.fillText('PWR', 102, y0 + 14); ctx.fillText('BRK', 102, y0 + 26);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < S.throttle ? '#0f6' : '#123322'; ctx.fillRect(122 + i * 11, y0 + 8, 9, 7);
    ctx.fillStyle = '#000'; ctx.fillRect(122 + i * 11, y0 + 8, 9, 1);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < S.brake ? '#f44' : '#331111'; ctx.fillRect(122 + i * 11, y0 + 20, 9, 7);
  }
  if (S.emergency) { ctx.fillStyle = '#f00'; ctx.font = 'bold 7px monospace'; ctx.fillText('!EMERG!', 102, y0 + 38); }

  // MIDDLE ROW: door lamp + timer + score
  const r2 = y0 + 44;
  ctx.fillStyle = S.doorsOpen ? '#0f6' : '#333'; ctx.fillRect(6, r2, 8, 8);
  ctx.fillStyle = '#8b8ba3'; ctx.font = 'bold 6px monospace'; ctx.fillText('DR', 18, r2 + 7);
  ctx.fillStyle = '#7df9ff'; ctx.font = 'bold 7px monospace';
  ctx.fillText('T-' + Math.max(0, Math.ceil(S.timeLeft)) + 's', 36, r2 + 7);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText('S:' + S.score, 88, r2 + 7);

  // BOTTOM: next station + distance bar
  const st = STATIONS[S.nextStIdx];
  if (st) {
    const d = stopPos(st) - S.trackPos;
    ctx.fillStyle = '#8b8ba3'; ctx.font = 'bold 6px monospace';
    ctx.fillText('NEXT:' + st.name.slice(0, 11) + (d < 0 ? ' (!)' : ''), 6, y0 + 59);
    ctx.fillStyle = '#333'; ctx.fillRect(6, y0 + 63, 152, 5);
    const dd = Math.max(0, Math.min(1, 1 - d / 800));
    ctx.fillStyle = d < 0 ? '#f44' : '#7df9ff'; ctx.fillRect(6, y0 + 63, 152 * dd, 5);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'right';
    ctx.fillText((d >= 0 ? Math.round(d) : 0) + 'm', W - 4, y0 + 68); ctx.textAlign = 'left';
    // stop zone flash
    if (Math.abs(d) < 45 && S.speed < 3) {
      const on = Math.sin(frame * 0.4) > 0;
      ctx.fillStyle = on ? '#0f6' : '#063';
      ctx.fillRect(6, y0 + 63, 152, 5);
      ctx.fillStyle = '#000'; ctx.font = 'bold 5px monospace'; ctx.fillText('STOP ZONE', 10, y0 + 68);
    }
  }
  // hi-score line
  ctx.fillStyle = '#555566'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'right';
  ctx.fillText('HI:' + S.hiScore, W - 4, y0 + 79); ctx.textAlign = 'left';
  // bottom bar
  ctx.fillStyle = '#33334a'; ctx.fillRect(0, H - 4, W, 4);
}

function drawHUD(stNow) {
  ctx.textAlign = 'left'; ctx.font = 'bold 8px monospace';
  // top bar
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, 16);
  ctx.fillStyle = '#7df9ff'; ctx.fillText("SUBWAY '94", 4, 11);
  ctx.fillStyle = '#ffe14d'; ctx.textAlign = 'right';
  ctx.fillText('ST.' + (S.stopsDone + 1) + ' ' + S.score + 'pts', W - 4, 11);
  ctx.textAlign = 'left';
  // exit-signal repeater: mirrors the nearest gantry still ahead
  {
    let best = null, bestD = 1e9;
    for (const s of STATIONS) {
      const d = sigPos(s) - S.trackPos;
      if (d > -20 && d < 600 && d < bestD) { bestD = d; best = s; }
    }
    if (best) {
      const go = best.signal === 'green';
      ctx.fillStyle = '#000'; ctx.fillRect(W - 24, 18, 20, 10);
      ctx.fillStyle = go ? '#0f6' : '#f22'; ctx.fillRect(W - 22, 20, 16, 6);
      ctx.fillStyle = '#000'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center';
      ctx.fillText(go ? 'GO' : 'STOP', W - 14, 25); ctx.textAlign = 'left';
    }
  }
  // station banner when inside
  if (stNow) {
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    const wob = Math.sin(frame * 0.1) * 1;
    ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 76, 42 + wob, 152, 16);
    ctx.fillStyle = '#0a1a6e'; ctx.fillRect(W / 2 - 75, 43 + wob, 150, 14);
    ctx.fillStyle = '#fff'; ctx.fillText('== ' + stNow.name + ' ==', W / 2, 54 + wob);
    ctx.textAlign = 'left';
  }
  // meters-to-stop countdown: live distance to the optimal stop position
  {
    const stc = STATIONS[S.nextStIdx];
    if (stc && (S.state === 'drive' || S.state === 'doors')) {
      const d = stopPos(stc) - S.trackPos;
      const y = 26;
      let txt, col;
      if (S.state === 'doors') { txt = '■ BOARDING — WAIT FOR GREEN'; col = '#0f6'; }
      else if (d < 0) { txt = 'OVER BY ' + Math.round(-d) + 'm — TOO FAR!'; col = '#f44'; }
      else if (d <= 40) { txt = '★ STOP! ' + Math.round(d) + 'm ★'; col = (Math.sin(frame * 0.3) > 0) ? '#0f6' : '#8fffb0'; }
      else { txt = 'STOP IN ' + Math.round(d) + 'm'; col = '#7df9ff'; }
      ctx.font = 'bold 9px monospace';
      const wdt = ctx.measureText(txt).width + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(W / 2 - wdt / 2, y - 10, wdt, 13);
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, y + 1); ctx.textAlign = 'left';
    }
  }
  // door prompt
  const st = STATIONS[S.nextStIdx];
  if (st && S.state === 'drive' && Math.abs(S.trackPos - stopPos(st)) < 40 && S.speed < 0.6) {
    const on = Math.sin(frame * 0.3) > 0;
    if (on) {
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText('PRESS D — OPEN DOORS', W / 2 + 1, HORIZON + 34 + 1);
      ctx.fillStyle = '#0f6'; ctx.fillText('PRESS D — OPEN DOORS', W / 2, HORIZON + 34);
      ctx.textAlign = 'left';
    }
  }
  if (speedLimitAt(S.trackPos) < VMAX && S.speed > speedLimitAt(S.trackPos)) {
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f00'; ctx.fillText('!! SLOW DOWN !!', W / 2, HORIZON + 44);
    ctx.textAlign = 'left';
  }
  if (curveLimitAt(S.trackPos) < zoneLimitAt(S.trackPos) - 2.5 && S.speed > curveLimitAt(S.trackPos) - 1) {
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d'; ctx.fillText('!! SHARP CURVE !!', W / 2, HORIZON + 54);
    ctx.textAlign = 'left';
  }
}

function drawTitle() {
  ctx.fillStyle = 'rgba(0,0,10,0.84)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 20px monospace';
  ctx.fillText('SUPER SUBWAY', W / 2, 80);
  ctx.fillStyle = '#7df9ff'; ctx.font = 'bold 14px monospace';
  ctx.fillText("'94", W / 2, 100);
  ctx.fillStyle = '#8b8ba3'; ctx.font = 'bold 7px monospace';
  ctx.fillText('16-BIT SCALING BITMAP DRIVER', W / 2, 118);
  ctx.fillStyle = '#0f6'; ctx.font = 'bold 8px monospace';
  const blink = Math.sin(frame * 0.15) > 0;
  if (blink) ctx.fillText('— PRESS START TO GO —', W / 2, 150);
  ctx.fillStyle = '#ccc'; ctx.font = '7px monospace';
  ctx.fillText('STOP IN THE YELLOW ZONE', W / 2, 174);
  ctx.fillText('RED = WAIT  GREEN = GO', W / 2, 185);
  ctx.fillText('PWR/BRK to drive  SPACE=EMERG', W / 2, 196);
  ctx.fillText('D=DOORS  H=HORN  M=MUTE', W / 2, 207);
  ctx.fillText('SPEEDING LOSES POINTS!', W / 2, 218);
  ctx.fillStyle = '#555'; ctx.fillText('(C) 1994 NEO TRANSIT WORKS', W / 2, 244);
  ctx.textAlign = 'left';
}

function drawDoorsOverlay() {
  ctx.textAlign = 'center'; ctx.font = 'bold 8px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 72, HORIZON + 48, 144, 22);
  ctx.fillStyle = '#0f6'; ctx.fillText('BOARDING...', W / 2, HORIZON + 57);
  ctx.fillStyle = '#333'; ctx.fillRect(W / 2 - 64, HORIZON + 60, 128, 6);
  ctx.fillStyle = '#0f6'; ctx.fillRect(W / 2 - 64, HORIZON + 60, 128 * (1 - S.doorTimer / 6), 6);
  ctx.fillStyle = '#8b8ba3'; ctx.font = 'bold 7px monospace';
  ctx.fillText('D = CLOSE → GREEN → GO', W / 2, HORIZON + 78);
  ctx.textAlign = 'left';
}

function drawDone() {
  ctx.fillStyle = 'rgba(0,0,10,0.85)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f6'; ctx.font = 'bold 16px monospace';
  ctx.fillText('SHIFT COMPLETE!', W / 2, 118);
  ctx.fillStyle = '#ffe14d'; ctx.font = 'bold 10px monospace';
  ctx.fillText('SCORE: ' + S.score + ' PTS', W / 2, 146);
  ctx.fillStyle = '#ccc'; ctx.font = '8px monospace';
  ctx.fillText('STOPS: ' + S.stopsDone, W / 2, 166);
  ctx.fillStyle = S.score > 1100 ? '#7df9ff' : '#8b8ba3';
  ctx.fillText(S.score > 1100 ? 'LEGEND DRIVER ★' : S.score > 700 ? 'PRO DRIVER' : 'ROOKIE', W / 2, 184);
  if (Math.sin(frame * 0.15) > 0) { ctx.fillStyle = '#fff'; ctx.fillText('START = DRIVE AGAIN', W / 2, 222); }
  ctx.textAlign = 'left';
}
