// High-contrast tactical radar minimap with streets, coastline, GPS path, police blips, helicopter, and icons.

import { DISTRICTS } from '../core/config.js';
import { ROAD_X, ROAD_Z, SHOPS, computeGpsPath } from '../world/cityPlan.js';

export class MinimapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render({ state, playerPos, playerYaw, policeUnits, heliPos, enemies, missionTarget, elapsed }) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const scale = 0.42;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d1926';
    ctx.fillRect(0, 0, W, H);

    const toScreen = (wx, wz) => ({
      x: W / 2 + (wx - playerPos.x) * scale,
      y: H / 2 + (wz - playerPos.z) * scale,
    });

    // Ocean south of z = 250
    const seaTop = toScreen(0, 250).y;
    ctx.fillStyle = '#0e4963';
    ctx.fillRect(0, Math.max(0, seaTop), W, H);

    // Beach strip
    const sandTop = toScreen(0, 224).y;
    ctx.fillStyle = 'rgba(229, 193, 133, 0.35)';
    ctx.fillRect(0, sandTop, W, Math.max(0, seaTop - sandTop));

    // District soft tints
    for (const d of DISTRICTS) {
      const p1 = toScreen(d.bounds.x1, d.bounds.z1);
      const p2 = toScreen(d.bounds.x2, d.bounds.z2);
      ctx.fillStyle = d.color + '1c';
      ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    }

    // Road Grid
    ctx.strokeStyle = '#313d4f';
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    for (const rx of ROAD_X) {
      const a = toScreen(rx, -365);
      const b = toScreen(rx, 215);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    for (const rz of ROAD_Z) {
      const a = toScreen(-365, rz);
      const b = toScreen(375, rz);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // Puente del Sol bridge highlight
    const brA = toScreen(44, 200);
    const brB = toScreen(176, 200);
    ctx.strokeStyle = '#e04f44';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(brA.x, brA.y);
    ctx.lineTo(brB.x, brB.y);
    ctx.stroke();

    // GPS Route Line (magenta/gold)
    const goal = state.customWaypoint ?? missionTarget;
    if (goal) {
      const path = computeGpsPath(playerPos, goal);
      if (path.length > 1) {
        ctx.strokeStyle = state.customWaypoint ? '#e85aff' : '#ffbe55';
        ctx.lineWidth = 3.2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        path.forEach((pt, idx) => {
          const s = toScreen(pt.x, pt.z);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();

        // Goal Pin
        const gs = toScreen(goal.x, goal.z);
        ctx.fillStyle = state.customWaypoint ? '#e85aff' : '#ffbe55';
        ctx.beginPath();
        ctx.arc(gs.x, gs.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Shop icons
    for (const sh of SHOPS) {
      const s = toScreen(sh.x, sh.z);
      if (s.x < -8 || s.x > W + 8 || s.y < -8 || s.y > H + 8) continue;
      ctx.fillStyle = sh.kind === 'garage' ? '#34e0c8' : sh.kind === 'gunsmith' ? '#ff6b4a' : '#ffbe55';
      ctx.fillRect(s.x - 3.5, s.y - 3.5, 7, 7);
    }

    // Enemy blips
    for (const e of enemies) {
      if (e.downed) continue;
      const s = toScreen(e.pos.x, e.pos.z);
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Police flashing red/blue blips
    const flash = Math.sin(elapsed * 14) > 0;
    for (const u of policeUnits) {
      const s = toScreen(u.pos.x, u.pos.z);
      ctx.fillStyle = flash ? '#ff3355' : '#33aaff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, u.isSwat ? 5.2 : 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Helicopter rotor icon
    if (state.airUnitDeployed && heliPos) {
      const hs = toScreen(heliPos.x, heliPos.z);
      ctx.strokeStyle = '#ffef9f';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hs.x - 7, hs.y); ctx.lineTo(hs.x + 7, hs.y);
      ctx.moveTo(hs.x, hs.y - 7); ctx.lineTo(hs.x, hs.y + 7);
      ctx.stroke();
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.arc(hs.x, hs.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player directional arrow at center
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-playerYaw + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a0f18';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
