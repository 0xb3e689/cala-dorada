// Razor-sharp dark-glass HUD overlay: mission card, CDPD dispatch board, wanted stars, weapons, crew, minimap, dialogue, radio & speedometer.

import * as THREE from '../../vendor/three.module.min.js';
import { DISTRICTS, WEAPONS, CREW, RADIO_STATIONS } from '../core/config.js';
import { getRankInfo, getStandingTier, formatTimeClock } from '../core/gameState.js';
import { renderPortraitSvg } from './portraitArt.js';
import { MinimapRenderer } from './minimapRenderer.js';

const _projVec = new THREE.Vector3();

export class HudOverlay {
  constructor() {
    this.root = document.getElementById('hud-root');
    this.combatLayer = document.getElementById('combat-world-layer');
    this.reticle = document.getElementById('reticle');
    this.missionEl = document.getElementById('mission-card');
    this.dispatchEl = document.getElementById('dispatch-board');
    this.statusEl = document.getElementById('status-strip');
    this.wantedEl = document.getElementById('wanted-panel');
    this.rankEl = document.getElementById('rank-card');
    this.weaponEl = document.getElementById('weapon-bar');
    this.crewEl = document.getElementById('crew-bar');
    this.districtEl = document.getElementById('district-card');
    this.gpsPillEl = document.getElementById('minimap-gps-pill');
    this.vitalsEl = document.getElementById('vitals-bar');
    this.dialogueEl = document.getElementById('dialogue-box');
    this.radioEl = document.getElementById('radio-ticker');
    this.vehicleEl = document.getElementById('vehicle-hud');
    this.toastEl = document.getElementById('banner-toast');
    this.promptEl = document.getElementById('interact-prompt');

    this.minimap = new MinimapRenderer(document.getElementById('minimap-canvas'));
    this.lastRenderTime = 0;
  }

  setVisible(vis) {
    this.root.classList.toggle('hidden', !vis);
    if (this.combatLayer) this.combatLayer.classList.toggle('hidden', !vis);
    if (!vis) this.reticle.classList.add('hidden');
  }

  // Project 3D enemy threat markers, enemy HP bars, hit-confirm crosshair & floating weapon damage numbers every frame
  updateCombatOverlay({ state, camera, enemies, damagePopups, hitConfirmTimer, hitConfirmCrit }) {
    if (!this.combatLayer) return;
    if (state.mode !== 'playing') {
      this.combatLayer.classList.add('hidden');
      this.combatLayer.innerHTML = '';
      this.reticle.classList.remove('hit-confirm', 'hit-crit');
      return;
    }

    const showHit = !state.inVehicle && hitConfirmTimer > 0;
    this.reticle.classList.toggle('hit-confirm', showHit);
    this.reticle.classList.toggle('hit-crit', showHit && Boolean(hitConfirmCrit));

    const W = window.innerWidth;
    const H = window.innerHeight;
    let html = '';

    // 1. Overhead Threat Markers & HP Bars for attacking enemies
    for (const e of enemies ?? []) {
      if (e.downed || !e.attacking) continue;
      _projVec.set(e.pos.x, e.pos.y + 2.34, e.pos.z);
      _projVec.project(camera);
      if (_projVec.z >= 1 || _projVec.z < -1) continue;
      const sx = (_projVec.x * 0.5 + 0.5) * W;
      const sy = (-_projVec.y * 0.5 + 0.5) * H;
      if (sx < 40 || sx > W - 40 || sy < 40 || sy > H - 40) continue;

      const curHp = Math.max(0, Math.round(e.hp));
      const maxHp = Math.max(1, Math.round(e.maxHp));
      const pct = Math.round((curHp / maxHp) * 100);
      html += `<div class="enemy-tag" style="left:${sx.toFixed(1)}px;top:${sy.toFixed(1)}px">
        <div class="enemy-threat-badge"><span>!</span><span>HOSTILE</span></div>
        <div class="enemy-hp-card">
          <div class="enemy-hp-track"><div class="enemy-hp-fill" style="width:${pct}%"></div></div>
          <span class="enemy-hp-num">${curHp}/${maxHp}</span>
        </div>
        <div class="enemy-chevron"></div>
      </div>`;
    }

    // 2. Floating Weapon & Melee Damage Numbers (NEVER for vehicle ramming!)
    for (const p of damagePopups ?? []) {
      if (p.source === 'vehicle') continue;
      _projVec.copy(p.pos);
      _projVec.project(camera);
      if (_projVec.z >= 1 || _projVec.z < -1) continue;
      const sx = (_projVec.x * 0.5 + 0.5) * W;
      const sy = (-_projVec.y * 0.5 + 0.5) * H;
      if (sx < 20 || sx > W - 20 || sy < 20 || sy > H - 20) continue;

      const op = Math.min(1, (p.life / p.maxLife) * 1.45);
      html += `<div class="dmg-popup ${p.crit ? 'crit' : ''}" style="left:${sx.toFixed(1)}px;top:${sy.toFixed(1)}px;opacity:${op.toFixed(2)}">-${p.amount}${p.crit ? '<span class="dmg-crit-tag">CRIT!</span>' : ''}</div>`;
    }

    this.combatLayer.classList.toggle('hidden', html.length === 0);
    this.combatLayer.innerHTML = html;
  }

  update(ctx) {
    const { state, mission, stage, nextStage, dispatch, playerVehicle, playerPos, playerYaw, policeUnits, heliPos, enemies, promptText, elapsed } = ctx;
    if (state.mode !== 'playing') {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    this.reticle.classList.toggle('hidden', state.inVehicle);

    // Minimap renders every frame for silky movement
    this.minimap.render({
      state, playerPos, playerYaw, policeUnits, heliPos, enemies,
      missionTarget: stage?.target ?? null, elapsed,
    });

    // DOM updates throttled slightly (~15Hz) unless forced
    if (elapsed - this.lastRenderTime < 0.06 && !ctx.forceDom) return;
    this.lastRenderTime = elapsed;

    // 1. Mission Card
    if (mission && stage) {
      const mins = Math.floor(state.missionTimer / 60);
      const secs = String(Math.floor(state.missionTimer % 60)).padStart(2, '0');
      const pips = mission.stages.map((_, i) =>
        `<span class="stage-pip ${i < state.missionStageIdx ? 'done' : i === state.missionStageIdx ? 'active' : ''}"></span>`
      ).join('');
      const nextText = nextStage ? `<strong>NEXT:</strong> ${nextStage.label}` : '<strong>FINAL STAGE</strong>';
      this.missionEl.innerHTML = `
        <div class="mission-top">
          <span>STORY · MISSION ${mission.number} · STAGE ${state.missionStageIdx + 1}/${mission.stages.length}</span>
          <span class="mission-timer">${mins}:${secs}</span>
        </div>
        <div class="mission-title">${mission.title}</div>
        <div class="stage-pips">${pips}</div>
        <div class="mission-obj">${stage.label}${stage.type === 'combat' && state.missionEnemiesRemaining > 0 ? ` (${state.missionEnemiesRemaining} left)` : ''}</div>
        <div class="mission-next">
          <span>${nextText}</span>
          <span class="mission-payout">$${mission.cash.toLocaleString()} · ${mission.rp} RP</span>
        </div>`;
    }

    // 2. CDPD Tactical Dispatch Board
    if (dispatch && dispatch.active && dispatch.units.length > 0) {
      this.dispatchEl.classList.remove('hidden');
      const rowsHtml = dispatch.units.map((u) => {
        const clsKey = u.tactic.split(' ')[0];
        return `<div class="dispatch-row">
          <span class="dispatch-callsign">${u.callsign}</span>
          <span class="dispatch-dist">${u.distance}m</span>
          <span class="tactic-pill tactic-${clsKey}">${u.tactic}</span>
        </div>`;
      }).join('');
      this.dispatchEl.innerHTML = `
        <div class="dispatch-hdr">
          <span>CDPD TACTICAL DISPATCH</span>
          <span class="dispatch-live"><span class="dispatch-dot"></span>${dispatch.units.length} UNITS</span>
        </div>
        <div class="dispatch-rows">${rowsHtml}</div>
        <div class="dispatch-chatter">“${dispatch.chatter}”</div>`;
    } else {
      this.dispatchEl.classList.add('hidden');
    }

    // 3. Clock + Cash
    const clk = formatTimeClock(state.timeOfDay);
    this.statusEl.innerHTML = `
      <div class="clock-block">
        <span class="clock-time">${clk.text}</span>
        <span class="clock-phase">${clk.phase}</span>
      </div>
      <div class="cash-display">$${Math.round(state.cash).toLocaleString()}</div>`;

    // 4. Wanted Stars + Air Unit Deployed
    const starsHtml = [1, 2, 3, 4, 5].map((n) => {
      const lit = n <= state.wantedLevel;
      const hot = lit && state.wantedLevel >= 4;
      return `<span class="w-star ${lit ? 'lit' : ''} ${hot ? 'hot' : ''}">★</span>`;
    }).join('');
    const badge = state.signalJamTimer > 0
      ? `<span class="air-badge" style="background:linear-gradient(90deg,#6c4ce0,#34e0c8)">JAMMED ${Math.ceil(state.signalJamTimer)}s</span>`
      : state.airUnitDeployed
        ? `<span class="air-badge">AIR UNIT DEPLOYED</span>`
        : state.wantedLevel > 0
          ? `<span class="air-badge" style="background:rgba(255,59,92,0.55)">PURSUIT ACTIVE</span>`
          : `<span class="heat-calm">CLEAR · NO HEAT</span>`;
    this.wantedEl.innerHTML = `<div class="wanted-stars">${starsHtml}</div>${badge}`;

    // 5. Rank / RP Bar
    const rInfo = getRankInfo(state.rp);
    this.rankEl.innerHTML = `
      <div class="rank-row">
        <span class="rank-title">RANK ${rInfo.rank} · ${rInfo.title.toUpperCase()}</span>
        <span class="rank-rp">${rInfo.rp.toLocaleString()} / ${rInfo.nextRp.toLocaleString()} RP</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(rInfo.progress * 100)}%;background:linear-gradient(90deg,#ff7846,#ffbe55)"></div></div>`;

    // 6. 6-Slot Weapon Bar
    this.weaponEl.innerHTML = WEAPONS.map((w, idx) => {
      const ammo = state.weaponAmmo[w.id];
      const ammoTxt = w.melee ? 'INF' : `${ammo.clip}/${ammo.reserve}`;
      return `<div class="w-slot ${idx === state.activeWeaponIdx ? 'active' : ''}">
        <span class="w-key">${w.slot}</span>
        <span class="w-icon">${w.icon}</span>
        <span class="w-name">${w.name.split(' ')[0]}</span>
        <span class="w-ammo">${ammoTxt}</span>
      </div>`;
    }).join('');

    // 7. 3 Crew Ability Cards
    this.crewEl.innerHTML = CREW.map((c) => {
      const cd = Math.ceil(state.crewCooldowns[c.id] ?? 0);
      return `<div class="crew-card ${cd === 0 ? 'ready' : 'cooling'}">
        <div class="crew-ava">${renderPortraitSvg(c.id)}</div>
        <div class="crew-meta">
          <div class="crew-keyline"><span class="key-cap">${c.key}</span><span>${c.name.split(' ')[0]}</span></div>
          <div class="crew-ab">${c.ability}</div>
          <div class="crew-cd">${cd === 0 ? 'READY' : `CD ${cd}s`}</div>
        </div>
      </div>`;
    }).join('');

    // 8. District + Standing
    const dist = DISTRICTS.find((d) => d.id === state.currentDistrictId) ?? DISTRICTS[0];
    const stVal = state.districtStanding[dist.id] ?? 50;
    const tier = getStandingTier(stVal);
    this.districtEl.innerHTML = `
      <div class="district-top">
        <span class="district-name">${dist.name}</span>
        <span class="district-stand">${tier} · ${stVal}</span>
      </div>
      <div class="district-sub">${dist.subtitle}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${stVal}%;background:linear-gradient(90deg,#34e0c8,#ffbe55)"></div></div>`;

    // GPS Pill on minimap
    const gpsGoal = state.customWaypoint ?? stage?.target;
    const gpsDist = gpsGoal ? Math.round(Math.hypot(playerPos.x - gpsGoal.x, playerPos.z - gpsGoal.z)) : 0;
    this.gpsPillEl.innerHTML = `<span>GPS: ${state.customWaypoint ? state.customWaypoint.label : (mission?.district ?? 'City')}</span><span>${gpsDist}m</span>`;

    // 9. Health & Armor Bars
    this.vitalsEl.innerHTML = `
      <div class="vital-row">
        <span class="vital-lbl">HEALTH</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(state.health)}%;background:linear-gradient(90deg,#2ecc71,#58f09c)"></div></div>
        <span class="vital-num">${Math.round(state.health)}</span>
      </div>
      <div class="vital-row">
        <span class="vital-lbl">ARMOR</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(state.armor)}%;background:linear-gradient(90deg,#3b82f6,#5eead4)"></div></div>
        <span class="vital-num">${Math.round(state.armor)}</span>
      </div>`;

    // 10. Portrait Dialogue Box
    if (state.dialogue) {
      this.dialogueEl.classList.remove('hidden');
      this.dialogueEl.innerHTML = `
        <div class="dlg-portrait">${renderPortraitSvg(state.dialogue.portrait)}</div>
        <div>
          <div class="dlg-speaker">${state.dialogue.speaker}</div>
          <div class="dlg-text">“${state.dialogue.text}”</div>
        </div>`;
    } else {
      this.dialogueEl.classList.add('hidden');
    }

    // 11. Radio Ticker
    const st = RADIO_STATIONS[state.radioStationIdx];
    const track = st.tracks[state.radioTrackIdx % st.tracks.length];
    this.radioEl.innerHTML = `
      <span class="radio-badge">${st.freq}</span>
      <div class="radio-info">
        <div class="radio-station">${st.name.toUpperCase()} · [R] TUNE</div>
        <div class="radio-track">${state.radioMuted ? 'Muted' : `♪ ${track}`}</div>
      </div>`;

    // 12. Vehicle / On-Foot Panel + Speedometer
    if (state.inVehicle && playerVehicle) {
      const mph = Math.round(playerVehicle.speed * 2.32);
      const hpPct = Math.round((playerVehicle.hp / playerVehicle.maxHp) * 100);
      const hpCol = hpPct > 55 ? '#42e38c' : hpPct > 28 ? '#ffbe55' : '#ff3b5c';
      this.vehicleEl.innerHTML = `
        <div class="veh-top">
          <span class="veh-name">${playerVehicle.spec.name}</span>
          <span class="veh-class">${playerVehicle.spec.cls}</span>
        </div>
        <div class="veh-speed-row">
          <div class="speed-big">
            <span class="speed-num">${mph}</span>
            <span class="speed-unit">MPH</span>
          </div>
          <div class="veh-cond-wrap">
            <div class="veh-cond-lbl"><span>CONDITION</span><span>${hpPct}%</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${hpPct}%;background:${hpCol}"></div></div>
            <div class="nitro-tag">NITRO ${Math.round(playerVehicle.nitro)}% · [SHIFT]</div>
          </div>
        </div>`;
    } else {
      const w = WEAPONS[state.activeWeaponIdx];
      const ammo = state.weaponAmmo[w.id];
      this.vehicleEl.innerHTML = `
        <div class="veh-top">
          <span class="veh-name">ON FOOT · ${w.name.toUpperCase()}</span>
          <span class="veh-class">COMBAT</span>
        </div>
        <div class="veh-speed-row">
          <div class="speed-big">
            <span class="speed-num">${w.melee ? '∞' : ammo.clip}</span>
            <span class="speed-unit">${w.melee ? 'MELEE' : `/ ${ammo.reserve}`}</span>
          </div>
          <div class="veh-cond-wrap">
            <div class="veh-cond-lbl"><span>[LMB] FIRE</span><span>[F] CAR</span></div>
            <div class="nitro-tag">[1-6] WEAPON · [M] MAP</div>
          </div>
        </div>`;
    }

    // Toast & Interact Prompt
    if (state.toast) {
      this.toastEl.classList.remove('hidden');
      this.toastEl.textContent = state.toast.text;
    } else {
      this.toastEl.classList.add('hidden');
    }

    if (promptText) {
      this.promptEl.classList.remove('hidden');
      this.promptEl.textContent = promptText;
    } else {
      this.promptEl.classList.add('hidden');
    }
  }
}
