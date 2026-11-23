// ESC / M Pause & Career Dossier menu with tabs (including PROPERTIES), completion donut, medal strip, interactive city map, empire income stats, and 3 save slots.

import { DISTRICTS, MISSIONS, CREW, PROPERTIES } from '../core/config.js';
import { computeCompletionPercent, getRankInfo, getEmpireIncomePerHour } from '../core/gameState.js';
import { ROAD_X, ROAD_Z, LANDMARKS, STREET_RACES, computeGpsPath } from '../world/cityPlan.js';
import { renderPortraitSvg } from './portraitArt.js';

const TABS = ['MAP', 'PROPERTIES', 'STORY', 'STATS', 'CREW', 'SETTINGS', 'CONTROLS', 'SAVE'];

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
    const empireHr = getEmpireIncomePerHour(state);
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
      bodyHtml = this._renderUnifiedOverview(state, pct, rank, empireHr, saveManager);
    } else if (this.activeTab === 'PROPERTIES') {
      bodyHtml = `<div class="glass-card full-tab-panel">${PROPERTIES.map((p) => {
        const owned = state.ownedProperties?.has(p.id);
        return `<div class="info-card" style="border-color:${owned ? p.color : 'rgba(255,255,255,0.14)'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <h3 style="margin:0;color:${p.color}">${p.name}</h3>
            <span style="font-size:10px;font-weight:900;padding:2px 7px;border-radius:4px;background:${owned ? 'rgba(66,227,140,0.2)' : 'rgba(255,190,85,0.18)'};color:${owned ? '#42e38c' : '#ffbe55'}">${owned ? 'OWNED' : `$${p.price.toLocaleString()}`}</span>
          </div>
          <p><strong>${p.districtLabel} · ${p.badge}</strong>${p.incomePerHr > 0 ? ` · <span style="color:#42e38c">$${p.incomePerHr.toLocaleString()}/hr</span>` : ''}<br>${p.perks}</p>
          <div style="margin-top:8px"><button class="btn-xs alt" data-prop-gps="${p.id}">SET GPS WAYPOINT</button></div>
        </div>`;
      }).join('')}</div>`;
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
        <div class="info-card"><h3>Crew & Properties</h3><p><b>Z</b>: Nadia Plate Swap (-2 Stars)<br><b>X</b>: Toma Field Repair & Nitro<br><b>C</b>: Sora Signal Jam (14s)<br><b>E</b>: Buy / Enter Property, Shop, or Race<br><b>ESC / M</b>: Syndicate Dossier & Map</p></div>
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

    this.el.querySelectorAll('[data-prop-gps]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prop = PROPERTIES.find((p) => p.id === btn.dataset.propGps);
        if (prop) {
          state.customWaypoint = { x: prop.x, z: prop.z, label: prop.shortName };
          this.activeTab = 'MAP';
          this.render(state, playerPos, missionTarget, saveManager);
        }
      });
    });

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

  _renderUnifiedOverview(state, pct, rank, empireHr, saveManager) {
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);

    const mDone = Object.keys(state.completedMissions).length;
    const pDone = state.ownedProperties ? state.ownedProperties.size : 0;
    const rDone = state.completedRaces.size;
    const sDone = state.completedStunts.size;
    const gDone = state.collectedShells.size;
    const dDone = Object.values(state.districtStanding).filter((v) => v >= 70).length;

    const checks = [
      { label: 'Story Missions', val: `${mDone}/8`, pct: (mDone / 8) * 100, col: '#ffbe55' },
      { label: 'Properties Owned', val: `${pDone}/${PROPERTIES.length}`, pct: (pDone / PROPERTIES.length) * 100, col: '#42e38c' },
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
          <div class="save-title">Slot ${slot} · ${data ? `${data.act} · ${data.completion.toFixed(1)}%` : 'Empty Slot'}</div>
          <div class="save-sub">${data ? `${data.missionTitle} · $${data.cash.toLocaleString()}` : 'Ready to save current progress'}</div>
        </div>
        <div class="save-actions">
          <button class="btn-xs" data-save="${slot}">SAVE</button>
          ${data ? `<button class="btn-xs alt" data-load="${slot}">LOAD</button>` : ''}
        </div>
      </div>`).join('');

    return `
    <div class="career-grid">
      <!-- LEFT COLUMN: Completion Donut + Checklist (incl. Properties Owned) + Mission Medals -->
      <div class="career-col">
        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>CAREER PROGRESS</span><span>GOLD COAST</span></div>
          <div class="donut-wrap">
            <svg class="donut-svg" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="8"/>
              <circle cx="42" cy="42" r="${r}" fill="none" stroke="url(#dgrad)" stroke-width="8"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
                transform="rotate(-90 42 42)"/>
              <defs>
                <linearGradient id="dgrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#34e0c8"/><stop offset="100%" stop-color="#ffbe55"/>
                </linearGradient>
              </defs>
            </svg>
            <div>
              <div class="donut-big">${pct.toFixed(1)}%</div>
              <div class="donut-lbl">COMPLETE</div>
              <div style="font-size:10px;color:#b4bfd4;margin-top:2px">Act II · Syndicate Rising</div>
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

      <!-- CENTER COLUMN: Interactive Full-City District & Property Map -->
      <div class="glass-card map-panel">
        <div class="panel-hdr">
          <span>CALA DORADA · INTERACTIVE TACTICAL MAP</span>
          <span style="color:#34e0c8;font-size:10px">CLICK ANYWHERE TO SET GPS WAYPOINT</span>
        </div>
        <canvas id="full-map-canvas" width="660" height="460"></canvas>
        <div class="map-legend">
          <span><span class="leg-dot" style="background:#ffffff"></span>Player</span>
          <span><span class="leg-dot" style="background:#ffbe55"></span>Story Mission</span>
          <span><span class="leg-dot" style="background:#e85aff"></span>GPS Pin</span>
          <span><span class="leg-dot" style="background:#42e38c"></span>Owned Property</span>
          <span><span class="leg-dot" style="background:transparent;border:2px solid #ffbe55"></span>For Sale</span>
          <span><span class="leg-dot" style="background:#34e0c8"></span>Races</span>
          <span><span class="leg-dot" style="background:#e04f44"></span>Puente del Sol</span>
        </div>
      </div>

      <!-- RIGHT COLUMN: Rank/RP + Career & Empire Income Stats + Save Slots -->
      <div class="career-col">
        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>SYNDICATE RANK</span><span>RANK ${rank.rank}</span></div>
          <div style="font-size:15px;font-weight:900;color:#fff">${rank.title}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(rank.progress * 100)}%;background:linear-gradient(90deg,#ff7846,#ffbe55)"></div></div>
          <div style="font-size:10px;color:#b4bfd4;display:flex;justify-content:space-between">
            <span>${rank.rp.toLocaleString()} RP</span><span>NEXT: ${rank.nextRp.toLocaleString()} RP</span>
          </div>
        </div>

        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>CAREER & EMPIRE</span><span style="color:#42e38c">$${empireHr.toLocaleString()}/HR</span></div>
          <div class="stats-grid">
            <div class="stat-tile"><div class="stat-k">Empire Income</div><div class="stat-v" style="color:#42e38c">$${empireHr.toLocaleString()}/hr</div></div>
            <div class="stat-tile"><div class="stat-k">Cash Earned</div><div class="stat-v" style="color:#ffd24d">$${state.careerStats.cashEarned.toLocaleString()}</div></div>
            <div class="stat-tile"><div class="stat-k">Pursuits Evaded</div><div class="stat-v">${state.careerStats.pursuitsEvaded}</div></div>
            <div class="stat-tile"><div class="stat-k">Top Speed</div><div class="stat-v">${state.careerStats.topSpeedMph} MPH</div></div>
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

    // Deep coastal ocean gradient
    const seaGrad = ctx.createLinearGradient(0, 0, 0, H);
    seaGrad.addColorStop(0, '#071b2b');
    seaGrad.addColorStop(0.75, '#0b2d42');
    seaGrad.addColorStop(1, '#0d3d56');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle nautical grid lines
    ctx.strokeStyle = 'rgba(100, 195, 225, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 44) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 44) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Coastal turquoise shallow shelf aura
    ctx.fillStyle = 'rgba(52, 224, 200, 0.14)';
    ctx.beginPath();
    ctx.moveTo(mapX(-460), mapY(258));
    ctx.bezierCurveTo(mapX(-200), mapY(274), mapX(-20), mapY(264), mapX(42), mapY(256));
    ctx.lineTo(mapX(42), mapY(156));
    ctx.lineTo(mapX(178), mapY(156));
    ctx.lineTo(mapX(178), mapY(258));
    ctx.bezierCurveTo(mapX(280), mapY(276), mapX(380), mapY(268), mapX(470), mapY(256));
    ctx.lineTo(mapX(470), mapY(290));
    ctx.lineTo(mapX(-460), mapY(290));
    ctx.closePath();
    ctx.fill();

    // Organic Coastal Landmass silhouette
    ctx.fillStyle = '#152031';
    ctx.beginPath();
    ctx.moveTo(mapX(-450), mapY(-442));
    ctx.lineTo(mapX(462), mapY(-442));
    ctx.lineTo(mapX(462), mapY(248));
    ctx.quadraticCurveTo(mapX(320), mapY(262), mapX(178), mapY(246));
    ctx.lineTo(mapX(178), mapY(152));
    ctx.lineTo(mapX(42), mapY(152));
    ctx.lineTo(mapX(42), mapY(246));
    ctx.quadraticCurveTo(mapX(-200), mapY(262), mapX(-450), mapY(246));
    ctx.closePath();
    ctx.fill();

    // Golden beach shoreline curves
    ctx.fillStyle = '#b8965d';
    ctx.beginPath();
    ctx.moveTo(mapX(-450), mapY(224));
    ctx.lineTo(mapX(42), mapY(224));
    ctx.lineTo(mapX(42), mapY(248));
    ctx.quadraticCurveTo(mapX(-200), mapY(262), mapX(-450), mapY(248));
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(mapX(178), mapY(224));
    ctx.lineTo(mapX(462), mapY(224));
    ctx.lineTo(mapX(462), mapY(248));
    ctx.quadraticCurveTo(mapX(320), mapY(262), mapX(178), mapY(248));
    ctx.closePath();
    ctx.fill();

    // Marina wooden piers
    ctx.strokeStyle = '#c49d68';
    ctx.lineWidth = 3;
    for (const px of [215, 245, 275]) {
      ctx.beginPath();
      ctx.moveTo(mapX(px), mapY(248));
      ctx.lineTo(mapX(px), mapY(274));
      ctx.stroke();
    }

    // 7 Color-Coded Districts
    for (const d of DISTRICTS) {
      const x1 = mapX(d.bounds.x1);
      const y1 = mapY(d.bounds.z1);
      const x2 = mapX(d.bounds.x2);
      const y2 = mapY(d.bounds.z2);
      ctx.fillStyle = d.color + '20';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = d.color + '88';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
    }

    // Greenbelt parks
    ctx.fillStyle = 'rgba(66, 227, 140, 0.14)';
    ctx.fillRect(mapX(-340), mapY(-370), mapX(-215) - mapX(-340), mapY(-285) - mapY(-370));
    ctx.fillRect(mapX(-40), mapY(-35), mapX(40) - mapX(-40), mapY(35) - mapY(-35));

    // Building footprints
    ctx.fillStyle = 'rgba(220, 234, 255, 0.08)';
    for (let bx = -390; bx <= 380; bx += 52) {
      for (let bz = -395; bz <= 165; bz += 52) {
        if (Math.abs(bx - 110) < 62 && bz > 118) continue;
        const bw = 14 + (Math.abs(bx * 7 + bz * 3) % 10);
        const bh = 10 + (Math.abs(bx * 5 + bz * 11) % 9);
        ctx.fillRect(mapX(bx), mapY(bz), bw, bh);
      }
    }

    // Road Grid
    ctx.strokeStyle = '#334257';
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    for (const rx of ROAD_X) {
      ctx.moveTo(mapX(rx), mapY(-360));
      ctx.lineTo(mapX(rx), mapY(215));
    }
    for (const rz of ROAD_Z) {
      ctx.moveTo(mapX(-365), mapY(rz));
      ctx.lineTo(mapX(375), mapY(rz));
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 224, 168, 0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    for (const rx of ROAD_X) {
      ctx.moveTo(mapX(rx), mapY(-360));
      ctx.lineTo(mapX(rx), mapY(215));
    }
    for (const rz of ROAD_Z) {
      ctx.moveTo(mapX(-365), mapY(rz));
      ctx.lineTo(mapX(375), mapY(rz));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Puente del Sol Bridge Span
    ctx.strokeStyle = '#e0453b';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    ctx.moveTo(mapX(38), mapY(200));
    ctx.lineTo(mapX(182), mapY(200));
    ctx.stroke();
    ctx.strokeStyle = '#ffc857';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mapX(38), mapY(200));
    ctx.lineTo(mapX(182), mapY(200));
    ctx.stroke();
    for (const tx of [76, 144]) {
      ctx.fillStyle = '#ff5247';
      ctx.fillRect(mapX(tx) - 3.5, mapY(200) - 7, 7, 14);
      ctx.strokeStyle = '#ffd46e';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX(tx) - 3.5, mapY(200) - 7, 7, 14);
    }

    // Crisp District Labels
    ctx.font = '800 9.5px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = mapX(d.center.x);
      const cy = mapY(d.bounds.z1) + 18;
      const label = d.name.toUpperCase();
      const tw = ctx.measureText(label).width + 20;
      ctx.fillStyle = 'rgba(9, 14, 24, 0.88)';
      ctx.beginPath();
      ctx.roundRect(cx - tw / 2, cy - 10, tw, 15, 4);
      ctx.fill();
      ctx.strokeStyle = d.color + '88';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(cx - tw / 2 + 6, cy - 2.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillText(label, cx + 3, cy + 1);
    }

    // Glowing GPS Route Line
    const goal = state.customWaypoint ?? missionTarget;
    if (goal) {
      const path = computeGpsPath(playerPos, goal);
      const routeCol = state.customWaypoint ? '#e85aff' : '#ffbe55';
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = routeCol + '44';
      ctx.lineWidth = 9;
      ctx.beginPath();
      path.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(mapX(pt.x), mapY(pt.z));
        else ctx.lineTo(mapX(pt.x), mapY(pt.z));
      });
      ctx.stroke();

      ctx.strokeStyle = routeCol;
      ctx.lineWidth = 3.6;
      ctx.stroke();
      ctx.restore();
    }

    // Street Race start markers
    for (const r of STREET_RACES) {
      ctx.fillStyle = '#34e0c8';
      ctx.beginPath();
      ctx.arc(mapX(r.start.x), mapY(r.start.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#091420';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // 8 City Properties with Distinct House Markers (Green-Filled = Owned, Gold-Outlined = Purchasable)
    for (const prop of PROPERTIES) {
      const sx = mapX(prop.x);
      const sy = mapY(prop.z);
      const owned = state.ownedProperties?.has(prop.id);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.beginPath();
      ctx.moveTo(0, -7.2);
      ctx.lineTo(6.8, -1.2);
      ctx.lineTo(5.6, -1.2);
      ctx.lineTo(5.6, 5.8);
      ctx.lineTo(-5.6, 5.8);
      ctx.lineTo(-5.6, -1.2);
      ctx.lineTo(-6.8, -1.2);
      ctx.closePath();

      if (owned) {
        ctx.fillStyle = '#42e38c';
        ctx.fill();
        ctx.strokeStyle = '#07140d';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(14, 18, 28, 0.92)';
        ctx.fill();
        ctx.strokeStyle = '#ffbe55';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Landmark & Property Labels
    ctx.font = '800 8.5px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = '#ffe0a3';
    ctx.textAlign = 'center';
    for (const lm of LANDMARKS) {
      if (lm.type === 'bridge') {
        ctx.fillText(lm.name, mapX(lm.x), mapY(lm.z) - 12);
      } else if (lm.id === 'mirador-plaza' || lm.id === 'rafas-garage') {
        ctx.fillText(lm.name, mapX(lm.x), mapY(lm.z) - 11);
      } else if (lm.id === 'hotel-solsticio') {
        ctx.fillText(lm.name, mapX(lm.x) - 24, mapY(lm.z) + 18);
      }
    }

    // Mission Target Pin
    if (missionTarget) {
      const mx = mapX(missionTarget.x);
      const my = mapY(missionTarget.z);
      ctx.strokeStyle = 'rgba(255, 190, 85, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffbe55';
      ctx.beginPath();
      ctx.arc(mx, my, 7.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#12151f';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Custom Waypoint Pin
    if (state.customWaypoint) {
      const wx = mapX(state.customWaypoint.x);
      const wy = mapY(state.customWaypoint.z);
      ctx.strokeStyle = 'rgba(232, 90, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e85aff';
      ctx.beginPath();
      ctx.arc(wx, wy, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#12151f';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Player Marker
    const px = mapX(playerPos.x);
    const py = mapY(playerPos.z);
    ctx.strokeStyle = 'rgba(255, 107, 74, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 12.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff6138';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
}
