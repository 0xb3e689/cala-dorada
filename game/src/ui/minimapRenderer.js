// High-contrast GTA radar minimap 100%-synced with the Pause City Map icons (Hospital, Police, Park, Garage, Wardrobe, Gunsmith, Property, Fishing, Garden, Roof Repair).

import { DISTRICTS, PROPERTIES } from '../core/config.js';
import {
  ROAD_X, ROAD_Z, PUBLIC_FACILITIES, FISHING_SPOTS, GARDEN_SITES, ROOF_REPAIR_SITES, computeGpsPath,
} from '../world/cityPlan.js';

function getPropertyMarkerColor(prop) {
  if (prop.kind === 'garage') return '#34e0c8';
  if (prop.kind === 'safehouse') return '#e879f9';
  if (prop.kind === 'gunsmith') return '#ff7846';
  return '#42e38c';
}

export class MinimapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render({ state, playerPos, playerYaw, policeUnits, footOfficers, heliPos, enemies, missionTarget, elapsed }) {
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

    // Ocean south of z = 266
    const seaTop = toScreen(0, 266).y;
    ctx.fillStyle = '#0e4963';
    ctx.fillRect(0, Math.max(0, seaTop), W, H);

    // Bay channel under Puente del Sol
    const bayA = toScreen(40, 156);
    const bayB = toScreen(180, 270);
    ctx.fillRect(bayA.x, bayA.y, bayB.x - bayA.x, bayB.y - bayA.y);

    // Beach strip
    const sandTop = toScreen(0, 224).y;
    ctx.fillStyle = 'rgba(229, 193, 133, 0.35)';
    ctx.fillRect(0, sandTop, W, Math.max(0, seaTop - sandTop));

    // District soft tints
    for (const d of DISTRICTS) {
      const p1 = toScreen(d.bounds.x1, d.bounds.z1);
      const p2 = toScreen(d.bounds.x2, d.bounds.z2);
      ctx.fillStyle = d.color + '16';
      ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    }

    // Central Parque Dorado green lawn + fountain
    const pk = PUBLIC_FACILITIES.park;
    const pk1 = toScreen(pk.x - pk.w / 2, pk.z - pk.d / 2);
    const pk2 = toScreen(pk.x + pk.w / 2, pk.z + pk.d / 2);
    ctx.fillStyle = 'rgba(46, 204, 113, 0.36)';
    ctx.fillRect(pk1.x, pk1.y, pk2.x - pk1.x, pk2.y - pk1.y);

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
    const brA = toScreen(40, 200);
    const brB = toScreen(180, 200);
    ctx.strokeStyle = '#e04f44';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(brA.x, brA.y);
    ctx.lineTo(brB.x, brB.y);
    ctx.stroke();

    // GPS Route Line
    const goal = state.customWaypoint ?? missionTarget;
    if (goal) {
      const path = computeGpsPath(playerPos, goal);
      if (path.length > 1) {
        ctx.strokeStyle = state.customWaypoint ? '#e85aff' : '#ffbe55';
        ctx.lineWidth = 3.0;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        path.forEach((pt, idx) => {
          const s = toScreen(pt.x, pt.z);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();

        const gs = toScreen(goal.x, goal.z);
        ctx.fillStyle = state.customWaypoint ? '#e85aff' : '#ffbe55';
        ctx.beginPath();
        ctx.arc(gs.x, gs.y, 4.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Hospital Red Cross & Police Blue Shield
    const hs = toScreen(PUBLIC_FACILITIES.hospital.x, PUBLIC_FACILITIES.hospital.z);
    if (hs.x >= -8 && hs.x <= W + 8 && hs.y >= -8 && hs.y <= H + 8) {
      ctx.fillStyle = '#ff4b5c';
      ctx.fillRect(hs.x - 1.5, hs.y - 4.5, 3, 9);
      ctx.fillRect(hs.x - 4.5, hs.y - 1.5, 9, 3);
    }
    const ps = toScreen(PUBLIC_FACILITIES.police.x, PUBLIC_FACILITIES.police.z);
    if (ps.x >= -8 && ps.x <= W + 8 && ps.y >= -8 && ps.y <= H + 8) {
      ctx.fillStyle = '#4ba3ff';
      ctx.beginPath();
      ctx.moveTo(ps.x, ps.y - 5);
      ctx.lineTo(ps.x + 4, ps.y - 2.5);
      ctx.lineTo(ps.x + 3.2, ps.y + 2.5);
      ctx.lineTo(ps.x, ps.y + 5);
      ctx.lineTo(ps.x - 3.2, ps.y + 2.5);
      ctx.lineTo(ps.x - 4, ps.y - 2.5);
      ctx.closePath();
      ctx.fill();
    }

    // Properties, Garage, Wardrobe, Gunsmith (100% synced colors)
    for (const prop of PROPERTIES) {
      const s = toScreen(prop.x, prop.z);
      if (s.x < -8 || s.x > W + 8 || s.y < -8 || s.y > H + 8) continue;
      const col = getPropertyMarkerColor(prop);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.beginPath();
      ctx.moveTo(0, -4.8);
      ctx.lineTo(4.2, -1);
      ctx.lineTo(4.2, 3.8);
      ctx.lineTo(-4.2, 3.8);
      ctx.lineTo(-4.2, -1);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = '#090e18';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // Activity blips (Fishing sky-blue, Garden lime, Roof Repair amber)
    for (const f of FISHING_SPOTS) {
      const s = toScreen(f.x, f.z);
      if (s.x < -6 || s.x > W + 6 || s.y < -6 || s.y > H + 6) continue;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3.3, 0, Math.PI * 2); ctx.fill();
    }
    for (const g of GARDEN_SITES) {
      const s = toScreen(g.x, g.z);
      if (s.x < -6 || s.x > W + 6 || s.y < -6 || s.y > H + 6) continue;
      ctx.fillStyle = '#a3e635';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3.3, 0, Math.PI * 2); ctx.fill();
    }
    for (const r of ROOF_REPAIR_SITES) {
      const s = toScreen(r.x, r.z);
      if (s.x < -6 || s.x > W + 6 || s.y < -6 || s.y > H + 6) continue;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3.3, 0, Math.PI * 2); ctx.fill();
    }

    // Enemy blips
    for (const e of enemies ?? []) {
      if (e.downed) continue;
      const s = toScreen(e.pos.x, e.pos.z);
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Police cruisers + on-foot police flashing blips
    const flash = Math.sin(elapsed * 14) > 0;
    for (const u of policeUnits ?? []) {
      const s = toScreen(u.pos.x, u.pos.z);
      ctx.fillStyle = flash ? '#ff3355' : '#33aaff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, u.isSwat ? 5.0 : 4.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    for (const o of footOfficers ?? []) {
      if (o.downed) continue;
      const s = toScreen(o.pos.x, o.pos.z);
      ctx.fillStyle = flash ? '#ff3355' : '#33aaff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Helicopter rotor icon
    if (state.airUnitDeployed && heliPos) {
      const hs2 = toScreen(heliPos.x, heliPos.z);
      ctx.strokeStyle = '#ffef9f';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hs2.x - 6.5, hs2.y); ctx.lineTo(hs2.x + 6.5, hs2.y);
      ctx.moveTo(hs2.x, hs2.y - 6.5); ctx.lineTo(hs2.x, hs2.y + 6.5);
      ctx.stroke();
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.arc(hs2.x, hs2.y, 2.8, 0, Math.PI * 2);
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
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.2, 5.5);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(-5.2, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
