// Pure 4-Tab GTA Pause Menu (MAP | STATS | SAVE | SETTINGS) with 100%-Synced City Map & Legend.

import { DISTRICTS, PROPERTIES } from '../core/config.js';
import { computeCompletionPercent, getEmpireIncomePerHour, formatTimeClock } from '../core/gameState.js';
import {
  ROAD_X, ROAD_Z, PUBLIC_FACILITIES, FISHING_SPOTS, GARDEN_SITES, ROOF_REPAIR_SITES, MAP_LEGEND, computeGpsPath,
} from '../world/cityPlan.js';

const TABS = ['MAP', 'STATS', 'SAVE', 'SETTINGS'];

function getPropertyMarkerColor(prop) {
  if (prop.kind === 'garage') return '#34e0c8';
  if (prop.kind === 'safehouse') return '#e879f9';
  if (prop.kind === 'gunsmith') return '#ff7846';
  return '#42e38c';
}

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
    const empireHr = getEmpireIncomePerHour(state);
    const tabsHtml = TABS.map((t) =>
      `<button class="tab-btn ${t === this.activeTab ? 'active' : ''}" data-tab="${t}">${t}</button>`
    ).join('');

    const topBar = `
      <div class="glass-card career-topbar">
        <div class="career-brand">CALA DORADA</div>
        <div class="career-tabs">${tabsHtml}</div>
        <div class="career-right-meta">
          <span class="cash-display" style="font-size:17px">$${Math.round(state.cash).toLocaleString()}</span>
          <button class="resume-btn" id="btn-resume">RESUME</button>
        </div>
      </div>`;

    let bodyHtml = '';
    if (this.activeTab === 'MAP') {
      bodyHtml = this._renderMapTab(state, pct, empireHr, saveManager);
    } else if (this.activeTab === 'STATS') {
      bodyHtml = this._renderStatsTab(state, pct, empireHr);
    } else if (this.activeTab === 'SAVE') {
      bodyHtml = this._renderSaveTab(state, saveManager);
    } else if (this.activeTab === 'SETTINGS') {
      bodyHtml = this._renderSettingsTab(state);
    }

    this.el.innerHTML = topBar + bodyHtml;
    this._bindEvents(state, playerPos, missionTarget, saveManager);
  }

  _renderMapTab(state, pct, empireHr, saveManager) {
    const legendHtml = MAP_LEGEND.map((item) =>
      `<span class="leg-item"><span class="leg-dot" style="background:${item.color}"></span>${item.label}</span>`
    ).join('');

    const slotsHtml = saveManager.getAllSlots().map(({ slot, data }) => `
      <div class="save-row ${slot === state.activeSlot ? 'current' : ''}">
        <div class="save-info">
          <div class="save-title">Slot ${slot}${data ? ` · ${data.completion.toFixed(1)}%` : ' · Empty'}</div>
          <div class="save-sub">${data ? `${data.missionTitle} · $${data.cash.toLocaleString()}` : 'Empty Slot'}</div>
        </div>
        <div class="save-actions">
          <button class="btn-xs" data-save="${slot}">SAVE</button>
          ${data ? `<button class="btn-xs alt" data-load="${slot}">LOAD</button>` : ''}
        </div>
      </div>`).join('');

    const mDone = Object.keys(state.completedMissions).length;
    const pDone = state.ownedProperties ? state.ownedProperties.size : 0;

    return `
      <div class="pause-grid">
        <div class="glass-card map-panel">
          <div class="panel-hdr">
            <span>CITY MAP</span>
            <span style="color:#b4bfd4;font-size:10px">CLICK TO SET GPS</span>
          </div>
          <canvas id="full-map-canvas" width="840" height="520"></canvas>
          <div class="map-legend">${legendHtml}</div>
        </div>
        <div class="career-col">
          <div class="glass-card panel-box">
            <div class="panel-hdr"><span>STATS</span><span style="color:#42e38c">${pct.toFixed(1)}%</span></div>
            <div class="stats-grid">
              <div class="stat-tile"><div class="stat-k">Missions</div><div class="stat-v">${mDone}/8</div></div>
              <div class="stat-tile"><div class="stat-k">Properties</div><div class="stat-v" style="color:#42e38c">${pDone}/${PROPERTIES.length}</div></div>
              <div class="stat-tile"><div class="stat-k">Top Speed</div><div class="stat-v">${state.careerStats.topSpeedMph} MPH</div></div>
              <div class="stat-tile"><div class="stat-k">Income</div><div class="stat-v" style="color:#ffd24d">$${empireHr.toLocaleString()}/h</div></div>
              <div class="stat-tile"><div class="stat-k">Takedowns</div><div class="stat-v">${state.careerStats.takedowns}</div></div>
              <div class="stat-tile"><div class="stat-k">Fish / Crops</div><div class="stat-v">${state.careerStats.fishCaught ?? 0} / ${state.careerStats.cropsHarvested ?? 0}</div></div>
            </div>
          </div>
          <div class="glass-card panel-box" style="flex:1">
            <div class="panel-hdr"><span>SAVE SLOTS</span></div>
            <div class="save-list">${slotsHtml}</div>
          </div>
        </div>
      </div>`;
  }

  _renderStatsTab(state, pct, empireHr) {
    const mins = Math.floor((state.careerStats.playtimeSec ?? 0) / 60);
    const mDone = Object.keys(state.completedMissions).length;
    const pDone = state.ownedProperties ? state.ownedProperties.size : 0;

    return `<div class="glass-card full-tab-panel">
      <div class="info-card">
        <h3>Progress (${pct.toFixed(1)}%)</h3>
        <div class="stats-grid">
          <div class="stat-tile"><div class="stat-k">Story Missions</div><div class="stat-v">${mDone} / 8</div></div>
          <div class="stat-tile"><div class="stat-k">Properties</div><div class="stat-v">${pDone} / ${PROPERTIES.length}</div></div>
          <div class="stat-tile"><div class="stat-k">Street Races</div><div class="stat-v">${state.completedRaces.size} / 4</div></div>
          <div class="stat-tile"><div class="stat-k">Golden Shells</div><div class="stat-v">${state.collectedShells.size} / 20</div></div>
        </div>
      </div>
      <div class="info-card">
        <h3>Career</h3>
        <div class="stats-grid">
          <div class="stat-tile"><div class="stat-k">Cash Earned</div><div class="stat-v" style="color:#ffd24d">$${state.careerStats.cashEarned.toLocaleString()}</div></div>
          <div class="stat-tile"><div class="stat-k">Empire Yield</div><div class="stat-v" style="color:#42e38c">$${empireHr.toLocaleString()}/hr</div></div>
          <div class="stat-tile"><div class="stat-k">Top Speed</div><div class="stat-v">${state.careerStats.topSpeedMph} MPH</div></div>
          <div class="stat-tile"><div class="stat-k">Distance</div><div class="stat-v">${(state.careerStats.distanceKm ?? 0).toFixed(1)} km</div></div>
          <div class="stat-tile"><div class="stat-k">Pursuits Evaded</div><div class="stat-v">${state.careerStats.pursuitsEvaded}</div></div>
          <div class="stat-tile"><div class="stat-k">Playtime</div><div class="stat-v">${mins} min</div></div>
        </div>
      </div>
      <div class="info-card">
        <h3>Activities</h3>
        <div class="stats-grid">
          <div class="stat-tile"><div class="stat-k">Car Mods</div><div class="stat-v">${state.careerStats.carModsInstalled ?? 0}</div></div>
          <div class="stat-tile"><div class="stat-k">Fish Caught</div><div class="stat-v">${state.careerStats.fishCaught ?? 0}</div></div>
          <div class="stat-tile"><div class="stat-k">Crops Harvested</div><div class="stat-v">${state.careerStats.cropsHarvested ?? 0}</div></div>
          <div class="stat-tile"><div class="stat-k">Roofs Repaired</div><div class="stat-v">${state.careerStats.roofsRepaired ?? 0}</div></div>
        </div>
      </div>
    </div>`;
  }

  _renderSaveTab(state, saveManager) {
    const cards = saveManager.getAllSlots().map(({ slot, data }) => `
      <div class="info-card" style="border-color:${slot === state.activeSlot ? '#ffbe55' : 'rgba(255,255,255,0.14)'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>Save Slot ${slot}</h3>
          <span style="font-family:var(--font-mono);color:#ffbe55;font-weight:900">${data ? `${data.completion.toFixed(1)}%` : 'EMPTY'}</span>
        </div>
        <p>${data ? `${data.missionTitle} · ${data.districtName}<br>$${data.cash.toLocaleString()} · ${data.savedDate} ${data.savedAt}` : 'No saved data in this slot.'}</p>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-xs" data-save="${slot}">SAVE</button>
          ${data ? `<button class="btn-xs alt" data-load="${slot}">LOAD</button>` : ''}
        </div>
      </div>`).join('');
    return `<div class="glass-card full-tab-panel">${cards}</div>`;
  }

  _renderSettingsTab(state) {
    const clk = formatTimeClock(state.timeOfDay);
    return `<div class="glass-card full-tab-panel">
      <div class="info-card">
        <h3>Audio</h3>
        <div class="plot-row">
          <span>SFX Volume</span>
          <input class="setting-slider" type="range" min="0" max="1" step="0.05" value="${state.settings.sfxVolume}" data-setting="sfxVolume">
        </div>
        <div class="plot-row">
          <span>Radio Volume</span>
          <input class="setting-slider" type="range" min="0" max="1" step="0.05" value="${state.settings.radioVolume}" data-setting="radioVolume">
        </div>
        <div class="plot-row">
          <span>Radio Mute</span>
          <button class="btn-xs alt" id="btn-toggle-mute">${state.radioMuted ? 'MUTED' : 'ON'}</button>
        </div>
      </div>
      <div class="info-card">
        <h3>Display & Camera</h3>
        <div class="plot-row">
          <span>Dynamic Shadows</span>
          <button class="btn-xs alt" id="btn-toggle-shadows">${state.settings.shadows ? 'ON' : 'OFF'}</button>
        </div>
        <div class="plot-row">
          <span>Driving Camera</span>
          <button class="btn-xs alt" id="btn-cycle-cam">${state.settings.cameraMode.toUpperCase()}</button>
        </div>
        <div class="plot-row">
          <span>Time of Day (${clk.text})</span>
          <input class="setting-slider" type="range" min="0" max="23.9" step="0.2" value="${state.timeOfDay.toFixed(1)}" id="slider-time">
        </div>
      </div>
      <div class="info-card">
        <h3>Controls</h3>
        <p><strong>WASD</strong> Move / Drive · <strong>Mouse</strong> Look / Aim<br>
        <strong>Shift</strong> Sprint / Nitro · <strong>Space</strong> Jump / Handbrake<br>
        <strong>F</strong> Enter / Exit Vehicle · <strong>E</strong> Interact / Bail Out<br>
        <strong>Q / Tab</strong> Weapon Wheel · <strong>R</strong> Reload / Radio<br>
        <strong>Z / X / C</strong> Crew Support · <strong>Esc / M</strong> Pause Map</p>
      </div>
    </div>`;
  }

  _bindEvents(state, playerPos, missionTarget, saveManager) {
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
        state.toast = { text: `SAVED SLOT ${slot}`, timer: 2.2 };
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });
    this.el.querySelectorAll('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.load);
        if (saveManager.loadSlot(slot, state)) {
          if (this.cb.onSlotLoaded) this.cb.onSlotLoaded();
          this.cb.onResume();
        }
      });
    });

    this.el.querySelectorAll('[data-setting]').forEach((sl) => {
      sl.addEventListener('input', () => {
        state.settings[sl.dataset.setting] = Number(sl.value);
      });
    });
    const muteBtn = this.el.querySelector('#btn-toggle-mute');
    if (muteBtn) muteBtn.addEventListener('click', () => {
      state.radioMuted = !state.radioMuted;
      this.render(state, playerPos, missionTarget, saveManager);
    });
    const shBtn = this.el.querySelector('#btn-toggle-shadows');
    if (shBtn) shBtn.addEventListener('click', () => {
      state.settings.shadows = !state.settings.shadows;
      if (this.cb.onSettingsChanged) this.cb.onSettingsChanged();
      this.render(state, playerPos, missionTarget, saveManager);
    });
    const camBtn = this.el.querySelector('#btn-cycle-cam');
    if (camBtn) camBtn.addEventListener('click', () => {
      const modes = ['chase', 'action', 'hood'];
      state.settings.cameraMode = modes[(modes.indexOf(state.settings.cameraMode) + 1) % modes.length];
      this.render(state, playerPos, missionTarget, saveManager);
    });
    const timeSl = this.el.querySelector('#slider-time');
    if (timeSl) timeSl.addEventListener('input', () => {
      state.timeOfDay = Number(timeSl.value);
      if (this.cb.onTimeChanged) this.cb.onTimeChanged();
      const hdr = timeSl.parentElement?.querySelector('span');
      if (hdr) hdr.textContent = `Time of Day (${formatTimeClock(state.timeOfDay).text})`;
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
        state.customWaypoint = { x: Math.round(wx), z: Math.round(wz), label: 'Waypoint' };
        this._drawFullCityMap(mapCanvas, state, playerPos, missionTarget);
      });
    }
  }

  _drawFullCityMap(canvas, state, playerPos, missionTarget) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const mapX = (wx) => ((wx + 470) / 950) * W;
    const mapY = (wz) => ((wz + 455) / 760) * H;

    // Ocean backdrop
    const seaGrad = ctx.createLinearGradient(0, 0, 0, H);
    seaGrad.addColorStop(0, '#071b2b');
    seaGrad.addColorStop(0.75, '#0b2d42');
    seaGrad.addColorStop(1, '#0d3d56');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle chart grid
    ctx.strokeStyle = 'rgba(100, 195, 225, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // Shallow turquoise coastal surf
    ctx.fillStyle = 'rgba(52, 224, 200, 0.14)';
    ctx.beginPath();
    ctx.moveTo(mapX(-460), mapY(264));
    ctx.bezierCurveTo(mapX(-200), mapY(278), mapX(-20), mapY(268), mapX(40), mapY(260));
    ctx.lineTo(mapX(40), mapY(156));
    ctx.lineTo(mapX(180), mapY(156));
    ctx.lineTo(mapX(180), mapY(262));
    ctx.bezierCurveTo(mapX(280), mapY(278), mapX(380), mapY(270), mapX(470), mapY(260));
    ctx.lineTo(mapX(470), mapY(295));
    ctx.lineTo(mapX(-460), mapY(295));
    ctx.closePath();
    ctx.fill();

    // City landmass
    ctx.fillStyle = '#152031';
    ctx.beginPath();
    ctx.moveTo(mapX(-455), mapY(-445));
    ctx.lineTo(mapX(465), mapY(-445));
    ctx.lineTo(mapX(465), mapY(254));
    ctx.quadraticCurveTo(mapX(320), mapY(266), mapX(180), mapY(252));
    ctx.lineTo(mapX(180), mapY(154));
    ctx.lineTo(mapX(40), mapY(154));
    ctx.lineTo(mapX(40), mapY(252));
    ctx.quadraticCurveTo(mapX(-200), mapY(266), mapX(-455), mapY(252));
    ctx.closePath();
    ctx.fill();

    // Golden beach strips
    ctx.fillStyle = '#b8965d';
    ctx.beginPath();
    ctx.moveTo(mapX(-455), mapY(224));
    ctx.lineTo(mapX(40), mapY(224));
    ctx.lineTo(mapX(40), mapY(252));
    ctx.quadraticCurveTo(mapX(-200), mapY(266), mapX(-455), mapY(252));
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(mapX(180), mapY(224));
    ctx.lineTo(mapX(465), mapY(224));
    ctx.lineTo(mapX(465), mapY(254));
    ctx.quadraticCurveTo(mapX(320), mapY(266), mapX(180), mapY(252));
    ctx.closePath();
    ctx.fill();

    // Wooden Fishing & Marina Piers
    ctx.strokeStyle = '#c49d68';
    ctx.lineWidth = 3.5;
    for (const px of [-210, 225]) {
      ctx.beginPath();
      ctx.moveTo(mapX(px), mapY(250));
      ctx.lineTo(mapX(px), mapY(282));
      ctx.stroke();
    }

    // District Zones
    for (const d of DISTRICTS) {
      const x1 = mapX(d.bounds.x1);
      const y1 = mapY(d.bounds.z1);
      const x2 = mapX(d.bounds.x2);
      const y2 = mapY(d.bounds.z2);
      ctx.fillStyle = d.color + '1c';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = d.color + '66';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
    }

    // Central Parque Dorado (green lawn + cross walkways + fountain!)
    const pk = PUBLIC_FACILITIES.park;
    const pkX = mapX(pk.x - pk.w / 2);
    const pkY = mapY(pk.z - pk.d / 2);
    const pkW = mapX(pk.x + pk.w / 2) - pkX;
    const pkH = mapY(pk.z + pk.d / 2) - pkY;
    ctx.fillStyle = '#1f6f43';
    ctx.fillRect(pkX, pkY, pkW, pkH);
    ctx.strokeStyle = '#42e38c';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(pkX, pkY, pkW, pkH);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(mapX(pk.x), mapY(pk.z), 4.5, 0, Math.PI * 2);
    ctx.fill();

    // City Road Grid
    ctx.strokeStyle = '#334257';
    ctx.lineWidth = 8.5;
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

    // Puente del Sol Bridge
    ctx.strokeStyle = '#e0453b';
    ctx.lineWidth = 9;
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

    // District Name Badges
    ctx.font = '800 10px "Avenir Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = mapX(d.center.x);
      const cy = mapY(d.bounds.z1) + 18;
      const label = d.name.toUpperCase();
      const tw = ctx.measureText(label).width + 18;
      ctx.fillStyle = 'rgba(9, 14, 24, 0.88)';
      ctx.beginPath();
      ctx.roundRect(cx - tw / 2, cy - 10, tw, 15, 4);
      ctx.fill();
      ctx.strokeStyle = d.color + '88';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillText(label, cx, cy + 1);
    }

    // GPS Route Line
    const goal = state.customWaypoint ?? missionTarget;
    if (goal) {
      const path = computeGpsPath(playerPos, goal);
      const routeCol = '#ffbe55';
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
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }

    // 100%-SYNCED MAP MARKERS (Matching MAP_LEGEND 1:1!)
    // 1. Hospital (#ff4b5c red cross)
    {
      const hx = mapX(PUBLIC_FACILITIES.hospital.x);
      const hy = mapY(PUBLIC_FACILITIES.hospital.z);
      ctx.fillStyle = '#120b14';
      ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff4b5c'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#ff4b5c';
      ctx.fillRect(hx - 2, hy - 5.5, 4, 11);
      ctx.fillRect(hx - 5.5, hy - 2, 11, 4);
    }

    // 2. Police Precinct HQ (#4ba3ff blue shield)
    {
      const px2 = mapX(PUBLIC_FACILITIES.police.x);
      const py2 = mapY(PUBLIC_FACILITIES.police.z);
      ctx.fillStyle = '#4ba3ff';
      ctx.beginPath();
      ctx.moveTo(px2, py2 - 7.5);
      ctx.lineTo(px2 + 6.5, py2 - 3.5);
      ctx.lineTo(px2 + 5.2, py2 + 3.5);
      ctx.lineTo(px2, py2 + 7.5);
      ctx.lineTo(px2 - 5.2, py2 + 3.5);
      ctx.lineTo(px2 - 6.5, py2 - 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#09111f'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    // 3. Garage (#34e0c8), Wardrobe (#e879f9), Gunsmith (#ff7846), Properties (#42e38c)
    for (const prop of PROPERTIES) {
      const sx = mapX(prop.x);
      const sy = mapY(prop.z);
      const col = getPropertyMarkerColor(prop);
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
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = '#08101c';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Fishing Piers (#38bdf8 sky-blue circle)
    for (const f of FISHING_SPOTS) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(mapX(f.x), mapY(f.z), 5.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#071420'; ctx.lineWidth = 1.6; ctx.stroke();
    }

    // 5. Garden Sites (#a3e635 lime diamond)
    for (const g of GARDEN_SITES) {
      const gx = mapX(g.x);
      const gy = mapY(g.z);
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.moveTo(gx, gy - 6); ctx.lineTo(gx + 6, gy); ctx.lineTo(gx, gy + 6); ctx.lineTo(gx - 6, gy);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#08140d'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // 6. Roof Repair Sites (#fb923c amber triangle)
    for (const rr of ROOF_REPAIR_SITES) {
      const rx = mapX(rr.x);
      const ry = mapY(rr.z);
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(rx, ry - 6.5); ctx.lineTo(rx + 6.5, ry + 5); ctx.lineTo(rx - 6.5, ry + 5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#180c06'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Bridge & Park crisp labels
    ctx.font = '800 8.5px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = '#ffe0a3';
    ctx.textAlign = 'center';
    ctx.fillText('PUENTE DEL SOL', mapX(110), mapY(200) - 12);
    ctx.fillStyle = '#b4f8d2';
    ctx.fillText('PARQUE DORADO', mapX(pk.x), mapY(pk.z) + 17);

    // 7. Mission Target Pin (#ffbe55 gold circle)
    if (missionTarget) {
      const mx = mapX(missionTarget.x);
      const my = mapY(missionTarget.z);
      ctx.strokeStyle = 'rgba(255, 190, 85, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 12.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffbe55';
      ctx.beginPath(); ctx.arc(mx, my, 7.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#12151f'; ctx.lineWidth = 2; ctx.stroke();
    }

    // 8. Player Marker (#ffffff white circle with coral rim)
    const px = mapX(playerPos.x);
    const py = mapY(playerPos.z);
    ctx.strokeStyle = 'rgba(255, 107, 74, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px, py, 7.0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff6138'; ctx.lineWidth = 2.6; ctx.stroke();
  }
}
