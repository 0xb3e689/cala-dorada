// ESC / M Pause & Career Dossier menu with tabs, completion donut, medal strip, interactive city map, stats, and 3 save slots.

import { DISTRICTS, MISSIONS, CREW } from '../core/config.js';
import { computeCompletionPercent, getRankInfo } from '../core/gameState.js';
import { ROAD_X, ROAD_Z, LANDMARKS, SHOPS, STREET_RACES, computeGpsPath } from '../world/cityPlan.js';
import { renderPortraitSvg } from './portraitArt.js';

const TABS = ['MAP', 'STORY', 'STATS', 'CREW', 'SETTINGS', 'CONTROLS', 'SAVE'];

export class CareerMenu {
  constructor(callbacks) {
    this.el = document.getElementById('career-overlay');
    this.cb = callbacks;
    this.activeTab = 'MAP';
  }

  hide() {
    this.el.classList.add('hidden');
  }

  show(state, playerPos, missionTarget, saveManager) {
    this.el.classList.remove('hidden');
    this.render(state, playerPos, missionTarget, saveManager);
  }

  render(state, playerPos, missionTarget, saveManager) {
    const pct = computeCompletionPercent(state);
    const rank = getRankInfo(state.rp);
    const tabsHtml = TABS.map((t) =>
      `<button class="tab-btn ${t === this.activeTab ? 'active' : ''}" data-tab="${t}">${t}</button>`
    ).join('');

    const topBar = `
      <div class="glass-card career-topbar">
        <div class="career-brand">CALA DORADA · SYNDICATE DOSSIER</div>
        <div class="career-tabs">${tabsHtml}</div>
        <div class="career-right-meta">
          <span class="cash-display" style="font-size:15px">$${Math.round(state.cash).toLocaleString()}</span>
          <button class="resume-btn" id="btn-resume">[ESC] RESUME</button>
        </div>
      </div>`;

    let bodyHtml = '';
    if (this.activeTab === 'MAP' || this.activeTab === 'STATS' || this.activeTab === 'SAVE') {
      bodyHtml = this._renderUnifiedOverview(state, pct, rank, saveManager);
    } else if (this.activeTab === 'STORY') {
      bodyHtml = `<div class="glass-card full-tab-panel">${MISSIONS.map((m) => {
        const medal = state.completedMissions[m.id];
        const active = m.id === state.activeMissionId;
        return `<div class="info-card" style="${active ? 'border-color:#ffbe55' : ''}">
          <h3>Mission ${m.number}: ${m.title} ${medal ? `· [${medal}]` : active ? '· [ACTIVE]' : ''}</h3>
          <p><strong>${m.act} · ${m.district}</strong> — Payout $${m.cash.toLocaleString()} & ${m.rp} RP.<br>
          ${m.stages.map((s, i) => `${i + 1}. ${s.label}`).join('<br>')}</p>
        </div>`;
      }).join('')}</div>`;
    } else if (this.activeTab === 'CREW') {
      bodyHtml = `<div class="glass-card full-tab-panel">${CREW.map((c) => `
        <div class="info-card" style="display:flex;gap:12px;align-items:center">
          <div style="width:64px;height:64px;border-radius:10px;overflow:hidden;flex-shrink:0;border:1.5px solid ${c.color}">${renderPortraitSvg(c.id)}</div>
          <div>
            <h3>${c.name} — ${c.role}</h3>
            <p><strong>[${c.key}] ${c.ability}</strong> (Cooldown ${c.cooldown}s)<br>${c.desc}</p>
          </div>
        </div>`).join('')}</div>`;
    } else if (this.activeTab === 'CONTROLS') {
      bodyHtml = `<div class="glass-card full-tab-panel">
        <div class="info-card"><h3>Driving Controls</h3><p><b>W/A/S/D or Arrows</b>: Drive & Steer<br><b>Space</b>: Handbrake Drift<br><b>Shift</b>: Nitro Boost<br><b>F</b>: Enter / Exit Vehicle<br><b>V</b>: Cycle Camera Mode<br><b>R</b>: Switch Radio Station</p></div>
        <div class="info-card"><h3>On-Foot & Combat</h3><p><b>W/A/S/D</b>: Move · <b>Shift</b>: Sprint · <b>Space</b>: Jump<br><b>Left Click</b>: Fire Weapon / Melee<br><b>Right Drag</b>: Aim Camera<br><b>1 – 6</b>: Select Weapon Slot</p></div>
        <div class="info-card"><h3>Crew & City Actions</h3><p><b>Z</b>: Nadia Plate Swap (-2 Stars)<br><b>X</b>: Toma Field Repair & Nitro<br><b>C</b>: Sora Signal Jam (14s)<br><b>E</b>: Enter Garage / Gunsmith / Start Race<br><b>ESC / M</b>: Syndicate Dossier & Map</p></div>
      </div>`;
    } else if (this.activeTab === 'SETTINGS') {
      bodyHtml = `<div class="glass-card full-tab-panel">
        <div class="info-card"><h3>Audio & Radio</h3><p>SFX Volume: ${Math.round(state.settings.sfxVolume * 100)}%<br>Radio Volume: ${Math.round(state.settings.radioVolume * 100)}%<br>Press [R] in-game to switch between Onda Sol, Neon Pulse, Bahia Dub, and CDPD Scanner.</p></div>
        <div class="info-card"><h3>Time of Day</h3><p>Quick-cycle Cala Dorada lighting:<br><br>
          <button class="btn-xs" data-tod="18.7">Golden Hour (18:42)</button>
          <button class="btn-xs alt" data-tod="21.8">Neon Night (21:48)</button>
          <button class="btn-xs alt" data-tod="13.5">High Noon (13:30)</button></p></div>
      </div>`;
    }

    this.el.innerHTML = topBar + bodyHtml;

    // Bind events
    this.el.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });
    const resumeBtn = this.el.querySelector('#btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.cb.onResume());

    this.el.querySelectorAll('[data-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.save);
        saveManager.saveSlot(slot, state);
        state.toast = { text: `SAVED TO SLOT ${slot}`, timer: 2.4 };
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });
    this.el.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.load);
        if (saveManager.loadSlot(slot, state)) {
          this.cb.onResume();
        }
      });
    });
    this.el.querySelectorAll('[data-tod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.timeOfDay = Number(btn.dataset.tod);
        this.cb.onTimeChanged();
      });
    });

    const mapCanvas = this.el.querySelector('#full-map-canvas');
    if (mapCanvas) {
      this._drawFullCityMap(mapCanvas, state, playerPos, missionTarget);
      mapCanvas.addEventListener('click', (ev) => {
        const rect = mapCanvas.getBoundingClientRect();
        const nx = (ev.clientX - rect.left) / rect.width;
        const ny = (ev.clientY - rect.top) / rect.height;
        const wx = -470 + nx * 950;
        const wz = -455 + ny * 760;
        state.customWaypoint = { x: Math.round(wx), z: Math.round(wz), label: 'GPS Pin' };
        this._drawFullCityMap(mapCanvas, state, playerPos, missionTarget);
      });
    }
  }

  _renderUnifiedOverview(state, pct, rank, saveManager) {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);

    const mDone = Object.keys(state.completedMissions).length;
    const rDone = state.completedRaces.size;
    const sDone = state.completedStunts.size;
    const gDone = state.collectedShells.size;
    const dDone = Object.values(state.districtStanding).filter((v) => v >= 70).length;

    const checks = [
      { label: 'Story Missions', val: `${mDone}/8`, pct: (mDone / 8) * 100, col: '#ffbe55' },
      { label: 'Street Races', val: `${rDone}/4`, pct: (rDone / 4) * 100, col: '#34e0c8' },
      { label: 'Stunt Jumps', val: `${sDone}/8`, pct: (sDone / 8) * 100, col: '#ff6b4a' },
      { label: 'Golden Shells', val: `${gDone}/20`, pct: (gDone / 20) * 100, col: '#ffd24d' },
      { label: 'Trusted Districts', val: `${dDone}/7`, pct: (dDone / 7) * 100, col: '#4ba3ff' },
    ];

    const medalsHtml = MISSIONS.map((m) => {
      const g = state.completedMissions[m.id] ?? (m.id === state.activeMissionId ? 'LIVE' : '—');
      return `<div class="medal-chip ${g}">
        <div class="medal-m">M${m.number}</div>
        <div class="medal-grade">${g}</div>
      </div>`;
    }).join('');

    const hrs = Math.floor(state.careerStats.playtimeSec / 3600);
    const mins = Math.floor((state.careerStats.playtimeSec % 3600) / 60);

    const slotsHtml = saveManager.getAllSlots().map(({ slot, data }) => `
      <div class="save-row ${slot === state.activeSlot ? 'current' : ''}">
        <div class="save-info">
          <div class="save-title">Slot ${slot} · ${data ? `${data.act} · ${data.completion}%` : 'Empty Slot'}</div>
          <div class="save-sub">${data ? `${data.missionTitle} · $${data.cash.toLocaleString()} · ${data.savedAt}` : 'Ready to save current progress'}</div>
        </div>
        <div class="save-actions">
          <button class="btn-xs" data-save="${slot}">SAVE</button>
          ${data ? `<button class="btn-xs alt" data-load="${slot}">LOAD</button>` : ''}
        </div>
      </div>`).join('');

    return `
    <div class="career-grid">
      <!-- LEFT COLUMN: Completion Donut + Checklist + Mission Medals -->
      <div class="career-col">
        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>CAREER PROGRESS</span><span>GOLD COAST</span></div>
          <div class="donut-wrap">
            <svg class="donut-svg" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="9"/>
              <circle cx="46" cy="46" r="${r}" fill="none" stroke="url(#dgrad)" stroke-width="9"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
                transform="rotate(-90 46 46)"/>
              <defs>
                <linearGradient id="dgrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#34e0c8"/><stop offset="100%" stop-color="#ffbe55"/>
                </linearGradient>
              </defs>
            </svg>
            <div>
              <div class="donut-big">${pct.toFixed(1)}%</div>
              <div class="donut-lbl">COMPLETE</div>
              <div style="font-size:10px;color:#b4bfd4;margin-top:3px">Act II · Syndicate Rising</div>
            </div>
          </div>
          <div class="check-list">
            ${checks.map((c) => `
              <div class="check-item">
                <div class="check-row"><span>${c.label}</span><span class="check-val">${c.val}</span></div>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c.pct)}%;background:${c.col}"></div></div>
              </div>`).join('')}
          </div>
        </div>

        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>MISSION MEDALS</span><span>${mDone}/8 CLEARED</span></div>
          <div class="medal-strip">${medalsHtml}</div>
        </div>
      </div>

      <!-- CENTER COLUMN: Interactive Full-City District Map -->
      <div class="glass-card map-panel">
        <div class="panel-hdr">
          <span>CALA DORADA · INTERACTIVE TACTICAL MAP</span>
          <span style="color:#34e0c8;font-size:10px">CLICK ANYWHERE TO SET GPS WAYPOINT</span>
        </div>
        <canvas id="full-map-canvas" width="660" height="460"></canvas>
        <div class="map-legend">
          <span><span class="leg-dot" style="background:#ffffff"></span>Player</span>
          <span><span class="leg-dot" style="background:#ffbe55"></span>Story Mission</span>
          <span><span class="leg-dot" style="background:#e85aff"></span>GPS Waypoint</span>
          <span><span class="leg-dot" style="background:#34e0c8"></span>Garage / Races</span>
          <span><span class="leg-dot" style="background:#ff6b4a"></span>Gunsmith</span>
          <span><span class="leg-dot" style="background:#e04f44"></span>Puente del Sol</span>
        </div>
      </div>

      <!-- RIGHT COLUMN: Rank/RP + Career Stats + Save Slots -->
      <div class="career-col">
        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>SYNDICATE RANK</span><span>RANK ${rank.rank}</span></div>
          <div style="font-size:16px;font-weight:900;color:#fff">${rank.title}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(rank.progress * 100)}%;background:linear-gradient(90deg,#ff7846,#ffbe55)"></div></div>
          <div style="font-size:10px;color:#b4bfd4;display:flex;justify-content:space-between">
            <span>${rank.rp.toLocaleString()} RP</span><span>NEXT: ${rank.nextRp.toLocaleString()} RP</span>
          </div>
        </div>

        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>CAREER STATS</span><span>LIVE</span></div>
          <div class="stats-grid">
            <div class="stat-tile"><div class="stat-k">Cash Earned</div><div class="stat-v" style="color:#42e38c">$${state.careerStats.cashEarned.toLocaleString()}</div></div>
            <div class="stat-tile"><div class="stat-k">Pursuits Evaded</div><div class="stat-v">${state.careerStats.pursuitsEvaded}</div></div>
            <div class="stat-tile"><div class="stat-k">Top Speed</div><div class="stat-v">${state.careerStats.topSpeedMph} MPH</div></div>
            <div class="stat-tile"><div class="stat-k">Stunts Landed</div><div class="stat-v">${state.careerStats.stuntsLanded}</div></div>
            <div class="stat-tile"><div class="stat-k">Takedowns</div><div class="stat-v">${state.careerStats.takedowns}</div></div>
            <div class="stat-tile"><div class="stat-k">Playtime</div><div class="stat-v">${hrs}h ${mins}m</div></div>
          </div>
        </div>

        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>SAVE SLOTS</span><span>LOCAL STORAGE</span></div>
          <div class="save-list">${slotsHtml}</div>
        </div>
      </div>
    </div>`;
  }

  _drawFullCityMap(canvas, state, playerPos, missionTarget) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const mapX = (wx) => ((wx + 470) / 950) * W;
    const mapY = (wz) => ((wz + 455) / 760) * H;

    // Deep coastal ocean background
    ctx.fillStyle = '#0a2538';
    ctx.fillRect(0, 0, W, H);

    // Landmass silhouette
    ctx.fillStyle = '#152030';
    ctx.fillRect(mapX(-450), mapY(-445), mapX(465) - mapX(-450), mapY(255) - mapY(-445));

    // Golden beach shoreline
    ctx.fillStyle = '#a38756';
    ctx.fillRect(mapX(-450), mapY(226), mapX(465) - mapX(-450), mapY(256) - mapY(226));

    // Marina channel water cut under Puente del Sol
    ctx.fillStyle = '#0a2538';
    ctx.fillRect(mapX(42), mapY(150), mapX(178) - mapX(42), mapY(310) - mapY(150));

    // 7 Color-Coded Districts (fills & borders first)
    for (const d of DISTRICTS) {
      const x1 = mapX(d.bounds.x1);
      const y1 = mapY(d.bounds.z1);
      const x2 = mapX(d.bounds.x2);
      const y2 = mapY(d.bounds.z2);
      ctx.fillStyle = d.color + '28';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = d.color + '99';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    // Subtle city block building footprints for tactical depth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let bx = -380; bx <= 380; bx += 55) {
      for (let bz = -390; bz <= 160; bz += 55) {
        if (Math.abs(bx - 110) < 60 && bz > 120) continue;
        ctx.fillRect(mapX(bx), mapY(bz), 18, 13);
      }
    }

    // Road Grid
    ctx.strokeStyle = '#3c4a60';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (const rx of ROAD_X) {
      ctx.moveTo(mapX(rx), mapY(-360));
      ctx.lineTo(mapX(rx), mapY(215));
    }
    for (const rz of ROAD_Z) {
      ctx.moveTo(mapX(-360), mapY(rz));
      ctx.lineTo(mapX(370), mapY(rz));
    }
    ctx.stroke();

    // Iconic Red/Gold Puente del Sol Span
    ctx.strokeStyle = '#e04f44';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(mapX(40), mapY(200));
    ctx.lineTo(mapX(180), mapY(200));
    ctx.stroke();

    // Crisp District Labels with dark backing pills rendered ABOVE roads
    ctx.font = '800 10px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = mapX(d.center.x);
      const cy = mapY(d.bounds.z1) + 18;
      const label = d.name.toUpperCase();
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(10, 16, 28, 0.84)';
      ctx.fillRect(cx - tw / 2, cy - 10, tw, 14);
      ctx.fillStyle = '#f2f6ff';
      ctx.fillText(label, cx, cy);
    }

    // GPS Route Line
    const goal = state.customWaypoint ?? missionTarget;
    if (goal) {
      const path = computeGpsPath(playerPos, goal);
      ctx.strokeStyle = state.customWaypoint ? '#e85aff' : '#ffbe55';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      path.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(mapX(pt.x), mapY(pt.z));
        else ctx.lineTo(mapX(pt.x), mapY(pt.z));
      });
      ctx.stroke();
    }

    // Street Race start markers
    for (const r of STREET_RACES) {
      ctx.fillStyle = '#34e0c8';
      ctx.beginPath();
      ctx.arc(mapX(r.start.x), mapY(r.start.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shops & Landmarks
    for (const sh of SHOPS) {
      const sx = mapX(sh.x);
      const sy = mapY(sh.z);
      ctx.fillStyle = sh.kind === 'garage' ? '#34e0c8' : sh.kind === 'gunsmith' ? '#ff6b4a' : '#ffbe55';
      ctx.fillRect(sx - 5, sy - 5, 10, 10);
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - 5, sy - 5, 10, 10);
    }

    // Landmark pins
    ctx.font = '700 9px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = '#ffdca0';
    ctx.textAlign = 'center';
    for (const lm of LANDMARKS) {
      if (lm.type === 'bridge' || lm.id === 'mirador-plaza' || lm.id === 'rafas-garage') {
        ctx.fillText(lm.name, mapX(lm.x), mapY(lm.z) - 8);
      } else if (lm.id === 'hotel-solsticio') {
        ctx.fillText(lm.name, mapX(lm.x) - 24, mapY(lm.z) + 18);
      }
    }

    // Mission Target Pin
    if (missionTarget) {
      const mx = mapX(missionTarget.x);
      const my = mapY(missionTarget.z);
      ctx.fillStyle = '#ffbe55';
      ctx.beginPath();
      ctx.arc(mx, my, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#12151f';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Custom Waypoint Pin
    if (state.customWaypoint) {
      const wx = mapX(state.customWaypoint.x);
      const wy = mapY(state.customWaypoint.z);
      ctx.fillStyle = '#e85aff';
      ctx.beginPath();
      ctx.arc(wx, wy, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Marker
    const px = mapX(playerPos.x);
    const py = mapY(playerPos.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff6138';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}
