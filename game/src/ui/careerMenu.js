// Clean AAA Pause / Career / Map / Garage / Wardrobe / Activities / Properties / Stats / Save menu (zero AI-slop text).

import {
  DISTRICTS, MISSIONS, PROPERTIES, CAR_PAINTS, CAR_SPOILERS, CAR_UNDERGLOWS, CAR_RIMS,
  WARDROBE_OPTIONS, GARDEN_CROPS,
} from '../core/config.js';
import { computeCompletionPercent, getRankInfo, getEmpireIncomePerHour } from '../core/gameState.js';
import { ROAD_X, ROAD_Z, LANDMARKS, STREET_RACES, FISHING_SPOTS, GARDEN_SITES, ROOF_REPAIR_SITES, computeGpsPath } from '../world/cityPlan.js';

const TABS = ['MAP', 'GARAGE', 'WARDROBE', 'ACTIVITIES', 'PROPERTIES', 'STATS', 'SAVE'];

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
        <div class="career-brand">CALA DORADA</div>
        <div class="career-tabs">${tabsHtml}</div>
        <div class="career-right-meta">
          <span class="cash-display" style="font-size:15px">$${Math.round(state.cash).toLocaleString()}</span>
          <button class="resume-btn" id="btn-resume">RESUME</button>
        </div>
      </div>`;

    let bodyHtml = '';
    if (this.activeTab === 'MAP' || this.activeTab === 'STATS' || this.activeTab === 'SAVE') {
      bodyHtml = this._renderUnifiedOverview(state, pct, rank, empireHr, saveManager);
    } else if (this.activeTab === 'GARAGE') {
      bodyHtml = this._renderGarageTab(state);
    } else if (this.activeTab === 'WARDROBE') {
      bodyHtml = this._renderWardrobeTab(state);
    } else if (this.activeTab === 'ACTIVITIES') {
      bodyHtml = this._renderActivitiesTab(state);
    } else if (this.activeTab === 'PROPERTIES') {
      bodyHtml = `<div class="glass-card full-tab-panel">${PROPERTIES.map((p) => {
        const owned = state.ownedProperties?.has(p.id);
        return `<div class="info-card" style="border-color:${owned ? p.color : 'rgba(255,255,255,0.14)'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3 style="margin:0;color:${p.color}">${p.name}</h3>
            <span style="font-size:10px;font-weight:900;padding:2px 7px;border-radius:4px;background:${owned ? 'rgba(66,227,140,0.2)' : 'rgba(255,190,85,0.18)'};color:${owned ? '#42e38c' : '#ffbe55'}">${owned ? 'OWNED' : `$${p.price.toLocaleString()}`}</span>
          </div>
          <p><strong>${p.districtLabel} · ${p.badge}</strong>${p.incomePerHr > 0 ? ` · <span style="color:#42e38c">$${p.incomePerHr.toLocaleString()}/hr</span>` : ''}<br>${p.perks}</p>
          <div><button class="btn-xs alt" data-prop-gps="${p.id}">SET GPS</button></div>
        </div>`;
      }).join('')}</div>`;
    }

    this.el.innerHTML = topBar + bodyHtml;
    this._bindEvents(state, playerPos, missionTarget, saveManager);
  }

  _renderGarageTab(state) {
    const mods = state.carMods;
    const paintBtns = CAR_PAINTS.map((p) => `
      <button class="swatch-btn ${mods.paint === p.hex ? 'active' : ''}" data-car-mod="paint" data-val="${p.hex}" data-cost="${p.price}">
        <span class="swatch-dot" style="background:${p.hex}"></span>${p.name}
      </button>`).join('');

    const finishBtns = ['metallic', 'matte'].map((f) => `
      <button class="swatch-btn ${mods.finish === f ? 'active' : ''}" data-car-mod="finish" data-val="${f}" data-cost="400">
        ${f.toUpperCase()}
      </button>`).join('');

    const spoilerBtns = CAR_SPOILERS.map((s) => `
      <button class="swatch-btn ${mods.spoiler === s.id ? 'active' : ''}" data-car-mod="spoiler" data-val="${s.id}" data-cost="${s.price}">
        ${s.name}${s.price ? ` ($${s.price})` : ''}
      </button>`).join('');

    const glowBtns = CAR_UNDERGLOWS.map((u) => `
      <button class="swatch-btn ${(mods.underglow === (u.hex ?? 'off')) ? 'active' : ''}" data-car-mod="underglow" data-val="${u.hex ?? 'off'}" data-cost="${u.price}">
        ${u.hex ? `<span class="swatch-dot" style="background:${u.hex}"></span>` : ''}${u.name}
      </button>`).join('');

    const rimBtns = CAR_RIMS.map((r) => `
      <button class="swatch-btn ${mods.rims === r.hex ? 'active' : ''}" data-car-mod="rims" data-val="${r.hex}" data-cost="${r.price}">
        <span class="swatch-dot" style="background:${r.hex}"></span>${r.name}
      </button>`).join('');

    const turboLvl = mods.turboLevel ?? 1;
    const armorLvl = mods.armorLevel ?? 1;

    return `<div class="glass-card full-tab-panel">
      <div class="info-card">
        <h3>Paint & Finish</h3>
        <div class="swatch-row">${paintBtns}</div>
        <div class="swatch-row">${finishBtns}</div>
      </div>
      <div class="info-card">
        <h3>Aero Spoiler</h3>
        <div class="swatch-row">${spoilerBtns}</div>
        <h3 style="margin-top:6px">Neon Underglow</h3>
        <div class="swatch-row">${glowBtns}</div>
      </div>
      <div class="info-card">
        <h3>Wheel Rims</h3>
        <div class="swatch-row">${rimBtns}</div>
        <h3 style="margin-top:6px">Performance Upgrades</h3>
        <div class="plot-row">
          <span>Engine Turbo · Lv.${turboLvl}/3</span>
          ${turboLvl < 3 ? `<button class="btn-xs" data-car-mod="turboLevel" data-val="${turboLvl + 1}" data-cost="${turboLvl * 3500}">UPGRADE $${(turboLvl * 3500).toLocaleString()}</button>` : '<span style="color:#42e38c;font-size:10px;font-weight:900">MAXED</span>'}
        </div>
        <div class="plot-row">
          <span>Chassis Armor · Lv.${armorLvl}/3</span>
          ${armorLvl < 3 ? `<button class="btn-xs" data-car-mod="armorLevel" data-val="${armorLvl + 1}" data-cost="${armorLvl * 4200}">UPGRADE $${(armorLvl * 4200).toLocaleString()}</button>` : '<span style="color:#42e38c;font-size:10px;font-weight:900">MAXED</span>'}
        </div>
      </div>
    </div>`;
  }

  _renderWardrobeTab(state) {
    const app = state.playerAppearance;
    const mkBtns = (field, list, isColor = false) => list.map((it) => {
      const val = isColor ? it.hex : it.id;
      const active = app[field] === val;
      return `<button class="swatch-btn ${active ? 'active' : ''}" data-app-field="${field}" data-val="${val}">
        ${isColor ? `<span class="swatch-dot" style="background:${it.hex}"></span>` : ''}${it.name}
      </button>`;
    }).join('');

    return `<div class="glass-card full-tab-panel">
      <div class="info-card">
        <h3>Outfit Style</h3>
        <div class="swatch-row">${mkBtns('outfitStyle', WARDROBE_OPTIONS.outfits)}</div>
        <h3 style="margin-top:6px">Jacket Color</h3>
        <div class="swatch-row">${mkBtns('jacketColor', WARDROBE_OPTIONS.jacketColors, true)}</div>
        <h3 style="margin-top:6px">Pants Color</h3>
        <div class="swatch-row">${mkBtns('pantsColor', WARDROBE_OPTIONS.pantsColors, true)}</div>
      </div>
      <div class="info-card">
        <h3>Hair Style</h3>
        <div class="swatch-row">${mkBtns('hairStyle', WARDROBE_OPTIONS.hairStyles)}</div>
        <h3 style="margin-top:6px">Hair Color</h3>
        <div class="swatch-row">${mkBtns('hairColor', WARDROBE_OPTIONS.hairColors, true)}</div>
      </div>
      <div class="info-card">
        <h3>Skin Tone</h3>
        <div class="swatch-row">${mkBtns('skinTone', WARDROBE_OPTIONS.skinTones, true)}</div>
        <h3 style="margin-top:6px">Accessories</h3>
        <div class="swatch-row">${mkBtns('accessory', WARDROBE_OPTIONS.accessories)}</div>
      </div>
    </div>`;
  }

  _renderActivitiesTab(state) {
    const fishRows = FISHING_SPOTS.map((f) => `
      <div class="plot-row">
        <span>${f.name}</span>
        <div style="display:flex;gap:5px">
          <button class="btn-xs alt" data-gps-x="${f.x}" data-gps-z="${f.z}" data-gps-lbl="${f.name}">GPS</button>
          <button class="btn-xs" data-start-fish="${f.id}">FISH</button>
        </div>
      </div>`).join('');

    const gardenRows = (state.gardenPlots ?? []).map((p) => {
      const crop = GARDEN_CROPS.find((c) => c.id === p.cropId);
      const status = !crop ? 'Empty Soil' : p.stage >= 3 ? `${crop.name} · Ready` : `${crop.name} · Stage ${p.stage}/3`;
      let actionHtml = '';
      if (!crop) {
        actionHtml = GARDEN_CROPS.slice(0, 2).map((c) =>
          `<button class="btn-xs alt" data-plant-plot="${p.id}" data-crop="${c.id}">+${c.name.split(' ')[0]}</button>`
        ).join('');
      } else if (p.stage < 3) {
        actionHtml = `<button class="btn-xs alt" data-water-plot="${p.id}">WATER</button>`;
      } else {
        actionHtml = `<button class="btn-xs" data-harvest-plot="${p.id}">HARVEST $${crop.sellValue}</button>`;
      }
      return `<div class="plot-row"><span style="font-size:10.5px">${status}</span><div style="display:flex;gap:4px">${actionHtml}</div></div>`;
    }).join('');

    const roofRows = ROOF_REPAIR_SITES.map((r) => {
      const done = state.roofProgress?.[r.id] ?? 0;
      return `<div class="plot-row">
        <span>${r.name} (${done}/${r.totalTiles})</span>
        <div style="display:flex;gap:5px">
          <button class="btn-xs alt" data-gps-x="${r.x}" data-gps-z="${r.z}" data-gps-lbl="${r.name}">GPS</button>
          <button class="btn-xs" data-start-roof="${r.id}">REPAIR</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="glass-card full-tab-panel">
      <div class="info-card">
        <h3>Coastal Fishing (${state.careerStats.fishCaught ?? 0} Caught)</h3>
        <p>Golden Snapper, Mahi-Mahi, Barracuda & Reef Grouper along Cala Dorada's wooden piers.</p>
        ${fishRows}
      </div>
      <div class="info-card">
        <h3>Courtyard & Villa Gardening (${state.careerStats.cropsHarvested ?? 0} Harvested)</h3>
        ${gardenRows}
      </div>
      <div class="info-card">
        <h3>Barrio Viejo Roof Repair (${state.careerStats.roofsRepaired ?? 0} Restored)</h3>
        <p>Restore damaged terracotta roof tiles in Barrio Viejo for cash and neighborhood standing.</p>
        ${roofRows}
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

    this.el.querySelectorAll('[data-gps-x]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.customWaypoint = { x: Number(btn.dataset.gpsX), z: Number(btn.dataset.gpsZ), label: btn.dataset.gpsLbl };
        this.activeTab = 'MAP';
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });

    this.el.querySelectorAll('[data-car-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.carMod;
        const val = (cat === 'turboLevel' || cat === 'armorLevel') ? Number(btn.dataset.val) : btn.dataset.val;
        const cost = Number(btn.dataset.cost ?? 0);
        if (this.cb.onCarMod) this.cb.onCarMod(cat, val, cost);
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });

    this.el.querySelectorAll('[data-app-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.cb.onAppearanceMod) this.cb.onAppearanceMod(btn.dataset.appField, btn.dataset.val);
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });

    this.el.querySelectorAll('[data-plant-plot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.cb.onGardenAction) this.cb.onGardenAction('plant', btn.dataset.plantPlot, btn.dataset.crop);
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });
    this.el.querySelectorAll('[data-water-plot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.cb.onGardenAction) this.cb.onGardenAction('water', btn.dataset.waterPlot);
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });
    this.el.querySelectorAll('[data-harvest-plot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.cb.onGardenAction) this.cb.onGardenAction('harvest', btn.dataset.harvestPlot);
        this.render(state, playerPos, missionTarget, saveManager);
      });
    });

    this.el.querySelectorAll('[data-start-fish]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.cb.onStartFishing) this.cb.onStartFishing(btn.dataset.startFish);
      });
    });
    this.el.querySelectorAll('[data-start-roof]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.cb.onStartRoof) this.cb.onStartRoof(btn.dataset.startRoof);
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
          if (this.cb.onSlotLoaded) this.cb.onSlotLoaded();
          this.cb.onResume();
        }
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
        state.customWaypoint = { x: Math.round(wx), z: Math.round(wz), label: 'Waypoint' };
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
      const done = state.completedMissions[m.id];
      const isActive = !done && m.id === state.activeMissionId;
      const cls = done ?? (isActive ? 'ACTIVE' : '');
      const text = done ?? (isActive ? '●' : '—');
      return `<div class="medal-chip ${cls}">
        <div class="medal-m">M${m.number}</div>
        <div class="medal-grade">${text}</div>
      </div>`;
    }).join('');

    const slotsHtml = saveManager.getAllSlots().map(({ slot, data }) => `
      <div class="save-row ${slot === state.activeSlot ? 'current' : ''}">
        <div class="save-info">
          <div class="save-title">Slot ${slot} · ${data ? `${data.act} · ${data.completion.toFixed(1)}%` : 'Empty'}</div>
          <div class="save-sub">${data ? `${data.missionTitle} · $${data.cash.toLocaleString()}` : 'No saved data'}</div>
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
          <div class="panel-hdr"><span>CAREER PROGRESS</span></div>
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
              <div style="font-size:10px;color:#b4bfd4;margin-top:2px">Act II</div>
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
          <div class="panel-hdr"><span>MISSION MEDALS</span><span>${mDone}/8</span></div>
          <div class="medal-strip">${medalsHtml}</div>
        </div>
      </div>

      <!-- CENTER COLUMN: Interactive Full-City District, Property & Activity Map -->
      <div class="glass-card map-panel">
        <div class="panel-hdr">
          <span>CITY MAP</span>
        </div>
        <canvas id="full-map-canvas" width="660" height="460"></canvas>
        <div class="map-legend">
          <span><span class="leg-dot" style="background:#ffffff"></span>Player</span>
          <span><span class="leg-dot" style="background:#ffbe55"></span>Mission</span>
          <span><span class="leg-dot" style="background:#e85aff"></span>GPS Pin</span>
          <span><span class="leg-dot" style="background:#42e38c"></span>Property</span>
          <span><span class="leg-dot" style="background:#38bdf8"></span>Fishing</span>
          <span><span class="leg-dot" style="background:#a3e635"></span>Garden</span>
          <span><span class="leg-dot" style="background:#fb923c"></span>Roof Repair</span>
        </div>
      </div>

      <!-- RIGHT COLUMN: Rank/RP + Career & Activities Counters + Save Slots -->
      <div class="career-col">
        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>SYNDICATE RANK</span><span>RANK ${rank.rank}</span></div>
          <div style="font-size:14.5px;font-weight:900;color:#fff">${rank.title}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(rank.progress * 100)}%;background:linear-gradient(90deg,#ff7846,#ffbe55)"></div></div>
          <div style="font-size:10px;color:#b4bfd4;font-family:var(--font-mono)">
            ${rank.rp.toLocaleString()} / ${rank.nextRp.toLocaleString()} RP
          </div>
        </div>

        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>CAREER STATS</span><span style="color:#42e38c">$${empireHr.toLocaleString()}/HR</span></div>
          <div class="stats-grid">
            <div class="stat-tile"><div class="stat-k">Cash Earned</div><div class="stat-v" style="color:#ffd24d">$${state.careerStats.cashEarned.toLocaleString()}</div></div>
            <div class="stat-tile"><div class="stat-k">Top Speed</div><div class="stat-v">${state.careerStats.topSpeedMph} MPH</div></div>
            <div class="stat-tile"><div class="stat-k">Car Mods</div><div class="stat-v" style="color:#34e0c8">${state.careerStats.carModsInstalled ?? 0}</div></div>
            <div class="stat-tile"><div class="stat-k">Fish Caught</div><div class="stat-v" style="color:#38bdf8">${state.careerStats.fishCaught ?? 0}</div></div>
            <div class="stat-tile"><div class="stat-k">Crops Harvested</div><div class="stat-v" style="color:#a3e635">${state.careerStats.cropsHarvested ?? 0}</div></div>
            <div class="stat-tile"><div class="stat-k">Roofs Repaired</div><div class="stat-v" style="color:#fb923c">${state.careerStats.roofsRepaired ?? 0}</div></div>
          </div>
        </div>

        <div class="glass-card panel-box">
          <div class="panel-hdr"><span>SAVE SLOTS</span></div>
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

    const seaGrad = ctx.createLinearGradient(0, 0, 0, H);
    seaGrad.addColorStop(0, '#071b2b');
    seaGrad.addColorStop(0.75, '#0b2d42');
    seaGrad.addColorStop(1, '#0d3d56');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(100, 195, 225, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 44) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 44) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

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

    ctx.strokeStyle = '#c49d68';
    ctx.lineWidth = 3;
    for (const px of [-210, 225, 255]) {
      ctx.beginPath();
      ctx.moveTo(mapX(px), mapY(248));
      ctx.lineTo(mapX(px), mapY(276));
      ctx.stroke();
    }

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

    ctx.fillStyle = 'rgba(220, 234, 255, 0.08)';
    for (let bx = -390; bx <= 380; bx += 52) {
      for (let bz = -395; bz <= 165; bz += 52) {
        if (Math.abs(bx - 110) < 62 && bz > 118) continue;
        const bw = 14 + (Math.abs(bx * 7 + bz * 3) % 10);
        const bh = 10 + (Math.abs(bx * 5 + bz * 11) % 9);
        ctx.fillRect(mapX(bx), mapY(bz), bw, bh);
      }
    }

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

    // Races
    for (const r of STREET_RACES) {
      ctx.fillStyle = '#34e0c8';
      ctx.beginPath();
      ctx.arc(mapX(r.start.x), mapY(r.start.z), 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fishing Piers (cyan markers)
    for (const f of FISHING_SPOTS) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(mapX(f.x), mapY(f.z), 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#071420';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Garden Beds (lime diamond markers)
    for (const g of GARDEN_SITES) {
      const gx = mapX(g.x);
      const gy = mapY(g.z);
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.moveTo(gx, gy - 5.5);
      ctx.lineTo(gx + 5.5, gy);
      ctx.lineTo(gx, gy + 5.5);
      ctx.lineTo(gx - 5.5, gy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#08140d';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Barrio Viejo Roof Repair Sites (orange triangle markers)
    for (const rr of ROOF_REPAIR_SITES) {
      const rx = mapX(rr.x);
      const ry = mapY(rr.z);
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(rx, ry - 6);
      ctx.lineTo(rx + 6, ry + 4.5);
      ctx.lineTo(rx - 6, ry + 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#180c06';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // 8 City Properties
    for (const prop of PROPERTIES) {
      const sx = mapX(prop.x);
      const sy = mapY(prop.z);
      const owned = state.ownedProperties?.has(prop.id);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.beginPath();
      ctx.moveTo(0, -7.0);
      ctx.lineTo(6.5, -1.2);
      ctx.lineTo(5.4, -1.2);
      ctx.lineTo(5.4, 5.5);
      ctx.lineTo(-5.4, 5.5);
      ctx.lineTo(-5.4, -1.2);
      ctx.lineTo(-6.5, -1.2);
      ctx.closePath();
      ctx.fillStyle = owned ? '#42e38c' : 'rgba(14, 18, 28, 0.92)';
      ctx.fill();
      ctx.strokeStyle = owned ? '#07140d' : '#ffbe55';
      ctx.lineWidth = owned ? 1.5 : 2.0;
      ctx.stroke();
      ctx.restore();
    }

    // Landmark Labels
    ctx.font = '800 8.5px "Avenir Next", system-ui, sans-serif';
    ctx.fillStyle = '#ffe0a3';
    ctx.textAlign = 'center';
    for (const lm of LANDMARKS) {
      if (lm.type === 'bridge') ctx.fillText(lm.name, mapX(lm.x), mapY(lm.z) - 12);
      else if (lm.id === 'mirador-plaza' || lm.id === 'rafas-garage') ctx.fillText(lm.name, mapX(lm.x), mapY(lm.z) - 11);
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
      ctx.arc(mx, my, 7.0, 0, Math.PI * 2);
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
