// Pure GTA-style minimal HUD overlay: NO CDPD DISPATCH, plain 5 wanted stars (zero text),
// single active weapon badge with reload progress & ∞ for melee, CS:GO radial weapon wheel,
// Health / Armor / Stamina bars, WASTED / BUSTED overlay, damage flash, bail-out alert, and clean driving speedometer.

import * as THREE from '../../vendor/three.module.min.js';
import { WEAPONS, CREW, RADIO_STATIONS } from '../core/config.js';
import { renderPortraitSvg } from './portraitArt.js';
import { MinimapRenderer } from './minimapRenderer.js';

const _projVec = new THREE.Vector3();

export function renderWeaponSvg(id) {
  switch (id) {
    case 'fists':
      return `<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">
        <path d="M14 14c0-3 2-5 4.5-5h1.5V8c0-1.4 1.1-2.5 2.5-2.5S25 6.6 25 8v.5h1V7.8c0-1.4 1.1-2.3 2.4-2.3S31 6.4 31 7.8v1.2h.8c1.4 0 2.7 1.1 2.7 2.6v6.2c0 3.6-2.7 6.2-6.5 6.2h-6.6c-4 0-7.4-2.8-7.4-6.8V14zm4-1.5v3.2h2.2v-3.2H18z"/>
      </svg>`;
    case 'bat':
      return `<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">
        <path d="M9 21.5l2.5 2.5 9.2-8.2 17.6-8.4c1.3-.6 1.8-2.2 1-3.4-.8-1.2-2.4-1.6-3.6-.8L19 13.4 9 21.5z"/>
      </svg>`;
    case 'pistol':
      return `<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">
        <path d="M11 8h24v5.5H24.5l-1.2 2.2h-4.5l-2.6 8.3h-5.6l3-9.5H11V8zm13.8 5.5v2.2h2.4v-2.2h-2.4z"/>
      </svg>`;
    case 'smg':
      return `<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">
        <path d="M6 10h26v2.2h8v2.6h-8v2.2h-5.5l-2.2 7.5h-4.2l1.6-7.5h-6.4l-2 6h-4.2l2.1-6.5H6V10zm13-3h7v2h-7V7z"/>
      </svg>`;
    case 'shotgun':
      return `<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">
        <path d="M4 13.5l6.5-1.5h33v2.6H26v2h-8.5l-4.2 5.4H8.8l3.5-5.2L4 16v-2.5zm19.5 1.1h11v2.2h-11v-2.2z"/>
      </svg>`;
    case 'carbine':
      return `<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">
        <path d="M4 11.5h7l2-1.5h15.5l1.5 1.5h14v2.3H32v2h-5.8l1.6 7.7h-4.2l-2-7.7H15l-2 5.8H9l1.8-5.8H4v-4.3zm14-4h8.5v2H18v-2z"/>
      </svg>`;
    default:
      return '';
  }
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function annulusWedgePath(cx, cy, rIn, rOut, startDeg, endDeg) {
  const [x1, y1] = polar(cx, cy, rOut, startDeg);
  const [x2, y2] = polar(cx, cy, rOut, endDeg);
  const [x3, y3] = polar(cx, cy, rIn, endDeg);
  const [x4, y4] = polar(cx, cy, rIn, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOut} ${rOut} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rIn} ${rIn} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
}

export class HudOverlay {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.root = document.getElementById('hud-root');
    this.combatLayer = document.getElementById('combat-world-layer');
    this.damageFlashEl = document.getElementById('damage-flash');
    this.underwaterTintEl = document.getElementById('underwater-tint');
    this.statusOverlayEl = document.getElementById('status-overlay');
    this.reticle = document.getElementById('reticle');
    this.reloadSvg = document.getElementById('reticle-reload-svg');
    this.reloadArc = document.getElementById('reticle-reload-arc');
    this.wheelEl = document.getElementById('weapon-wheel');
    this.missionEl = document.getElementById('mission-card');
    this.statusEl = document.getElementById('status-strip');
    this.wantedEl = document.getElementById('wanted-panel');
    this.weaponEl = document.getElementById('weapon-bar');
    this.crewEl = document.getElementById('crew-bar');
    this.vitalsEl = document.getElementById('vitals-bar');
    this.dialogueEl = document.getElementById('dialogue-box');
    this.radioEl = document.getElementById('radio-ticker');
    this.vehicleEl = document.getElementById('vehicle-hud');
    this.bailoutEl = document.getElementById('bailout-banner');
    this.toastEl = document.getElementById('banner-toast');
    this.promptEl = document.getElementById('interact-prompt');
    this.activityEl = document.getElementById('activity-hud');

    this.minimap = new MinimapRenderer(document.getElementById('minimap-canvas'));
    this.lastRenderTime = 0;
    this.lastWheelSignature = '';
  }

  setVisible(vis) {
    this.root.classList.toggle('hidden', !vis);
    if (this.combatLayer) this.combatLayer.classList.toggle('hidden', !vis);
    if (!vis) {
      this.reticle.classList.add('hidden');
      if (this.wheelEl) this.wheelEl.classList.add('hidden');
      if (this.statusOverlayEl) this.statusOverlayEl.classList.add('hidden');
      if (this.damageFlashEl) this.damageFlashEl.classList.add('hidden');
      if (this.underwaterTintEl) this.underwaterTintEl.classList.add('hidden');
    }
  }

  // CS:GO-style 6-wedge circular radial weapon selector (updates hover state in-place so clicks NEVER drop or fire bullets!)
  renderWeaponWheel(state, shotRight = false) {
    if (!this.wheelEl) return;
    if (state.mode !== 'playing' || !state.weaponWheelOpen || state.statusOverlay) {
      this.wheelEl.classList.add('hidden');
      this.wheelEl.classList.remove('shot-right');
      return;
    }

    this.wheelEl.classList.remove('hidden');
    this.wheelEl.classList.toggle('shot-right', Boolean(shotRight));

    const selIdx = state.weaponWheelHoverIdx ?? state.activeWeaponIdx;
    const activeW = WEAPONS[selIdx] ?? WEAPONS[0];
    const activeAmmo = state.weaponAmmo[activeW.id];
    const ammoSummary = activeW.melee ? '∞' : `${activeAmmo.clip} / ${activeAmmo.reserve}`;
    const ammoSig = WEAPONS.map((w) => w.melee ? 'i' : `${state.weaponAmmo[w.id].clip}/${state.weaponAmmo[w.id].reserve}`).join('|');
    const structSig = `${ammoSig}|${shotRight}`;

    // Fast in-place update if wheel SVG is already built (prevents DOM teardown between mousedown and click!)
    if (structSig === this.lastWheelSignature && this.wheelEl.querySelector('svg')) {
      this.wheelEl.querySelectorAll('.wheel-wedge').forEach((g) => {
        const idx = Number(g.dataset.widx);
        const isSel = idx === selIdx;
        g.classList.toggle('selected', isSel);
        const iconG = g.querySelector('.wedge-icon-g');
        if (iconG) iconG.setAttribute('fill', isSel ? '#fff6db' : '#d5dff2');
      });
      const hubName = this.wheelEl.querySelector('.wheel-hub-name');
      const hubAmmo = this.wheelEl.querySelector('.wheel-hub-ammo');
      if (hubName) hubName.textContent = activeW.name.toUpperCase();
      if (hubAmmo) hubAmmo.textContent = ammoSummary;
      return;
    }
    this.lastWheelSignature = structSig;

    const cx = 134;
    const cy = 134;
    const rIn = 52;
    const rOut = 124;
    const gap = 2.6;

    const wedges = WEAPONS.map((w, idx) => {
      const startDeg = -120 + idx * 60 + gap / 2;
      const endDeg = -120 + (idx + 1) * 60 - gap / 2;
      const midDeg = (startDeg + endDeg) / 2;
      const pathD = annulusWedgePath(cx, cy, rIn, rOut, startDeg, endDeg);

      const [ix, iy] = polar(cx, cy, 90, midDeg);
      const [kx, ky] = polar(cx, cy, 113, midDeg);
      const [ax, ay] = polar(cx, cy, 66, midDeg);

      const ammo = state.weaponAmmo[w.id];
      const selected = idx === selIdx;
      const iconInner = renderWeaponSvg(w.id)
        .replace('<svg viewBox="0 0 48 28" fill="currentColor" aria-hidden="true">', '')
        .replace('</svg>', '');

      return `<g class="wheel-wedge ${selected ? 'selected' : ''}" data-widx="${idx}">
        <path class="wedge-bg" d="${pathD}" />
        <text class="wedge-key" x="${kx.toFixed(1)}" y="${(ky + 3.5).toFixed(1)}" text-anchor="middle">${w.slot}</text>
        <g class="wedge-icon-g" transform="translate(${(ix - 17).toFixed(1)}, ${(iy - 10).toFixed(1)}) scale(0.71)" fill="${selected ? '#fff6db' : '#d5dff2'}">
          ${iconInner}
        </g>
        ${w.melee
          ? `<text class="wedge-inf" x="${ax.toFixed(1)}" y="${(ay + 5.5).toFixed(1)}" text-anchor="middle">∞</text>`
          : `<text class="wedge-ammo" x="${ax.toFixed(1)}" y="${(ay + 3.5).toFixed(1)}" text-anchor="middle">${ammo.clip}/${ammo.reserve}</text>`
        }
      </g>`;
    }).join('');

    this.wheelEl.innerHTML = `<svg viewBox="0 0 268 268" role="menu" aria-label="Weapon wheel">
      <defs>
        <linearGradient id="wheel-active-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255, 190, 85, 0.42)"/>
          <stop offset="100%" stop-color="rgba(255, 107, 74, 0.34)"/>
        </linearGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${rOut + 4}" fill="none" stroke="rgba(255, 224, 178, 0.14)" stroke-width="1"/>
      ${wedges}
      <circle class="wheel-hub-bg" cx="${cx}" cy="${cy}" r="${rIn - 4}"/>
      <text class="wheel-hub-name" x="${cx}" y="${cy - 4}" text-anchor="middle" style="font-size:9.5px">${activeW.name.toUpperCase()}</text>
      <text class="wheel-hub-ammo" x="${cx}" y="${cy + 14}" text-anchor="middle">${ammoSummary}</text>
    </svg>`;

    this.wheelEl.querySelectorAll('.wheel-wedge').forEach((g) => {
      g.addEventListener('mouseenter', () => {
        const idx = Number(g.dataset.widx);
        state.weaponWheelHoverIdx = idx;
        if (this.cb.onHoverWeapon) this.cb.onHoverWeapon(idx);
        this.renderWeaponWheel(state, shotRight);
      });
      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idx = Number(g.dataset.widx);
        if (this.cb.onSelectWeapon) this.cb.onSelectWeapon(idx);
      });
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });
    });
  }

  // World-space projected enemy threat markers, HP bars, hit-confirm crosshair, reload ring & weapon damage popups
  updateCombatOverlay({ state, camera, enemies, damagePopups, hitConfirmTimer, hitConfirmCrit }) {
    if (!this.combatLayer) return;
    if (state.mode !== 'playing' || state.statusOverlay) {
      this.combatLayer.classList.add('hidden');
      this.combatLayer.innerHTML = '';
      this.reticle.classList.remove('hit-confirm', 'hit-crit');
      return;
    }

    const showHit = hitConfirmTimer > 0;
    this.reticle.classList.toggle('hit-confirm', showHit);
    this.reticle.classList.toggle('hit-crit', showHit && Boolean(hitConfirmCrit));

    // Subtle reload progress ring around crosshair
    if (this.reloadSvg && this.reloadArc) {
      const reloading = state.reloadTimer > 0 && state.reloadDuration > 0;
      this.reloadSvg.classList.toggle('hidden', !reloading);
      if (reloading) {
        const prog = 1 - state.reloadTimer / state.reloadDuration;
        const circ = 106.8;
        this.reloadArc.setAttribute('stroke-dashoffset', String((circ * (1 - prog)).toFixed(1)));
      }
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    let html = '';

    for (const e of enemies ?? []) {
      if (e.dead || e.downed || !e.attacking) continue;
      const yOff = e.yOffset ?? 2.08;
      _projVec.set(e.pos.x, (e.pos.y ?? 0) + yOff, e.pos.z);
      _projVec.project(camera);
      if (_projVec.z >= 1 || _projVec.z < -1) continue;
      const sx = (_projVec.x * 0.5 + 0.5) * W;
      const sy = (-_projVec.y * 0.5 + 0.5) * H;
      if (sx < 40 || sx > W - 40 || sy < 40 || sy > H - 40) continue;

      const curHp = Math.max(0, Math.round(e.hp));
      const maxHp = Math.max(1, Math.round(e.maxHp));
      const pct = Math.round((curHp / maxHp) * 100);
      const badgeLabel = e.label ? `HOSTILE · ${e.label}` : 'HOSTILE';
      html += `<div class="enemy-tag" style="left:${sx.toFixed(1)}px;top:${sy.toFixed(1)}px">
        <div class="enemy-threat-badge"><span>!</span><span>${badgeLabel}</span></div>
        <div class="enemy-hp-card">
          <div class="enemy-hp-track"><div class="enemy-hp-fill" style="width:${pct}%"></div></div>
          <span class="enemy-hp-num">${curHp}/${maxHp}</span>
        </div>
        <div class="enemy-chevron"></div>
      </div>`;
    }

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
    const {
      state, mission, stage, playerVehicle, playerPos, playerYaw,
      policeUnits, footOfficers, heliPos, enemies, promptText, activities, elapsed, wheelShotRight,
    } = ctx;

    if (state.mode !== 'playing') {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);

    // Fullscreen GTA WASTED / BUSTED Overlay
    if (this.statusOverlayEl) {
      if (state.statusOverlay) {
        const t = state.statusOverlay.type;
        this.statusOverlayEl.classList.remove('hidden');
        this.statusOverlayEl.innerHTML = `<div class="status-banner"><div class="status-word ${t.toLowerCase()}">${t}</div></div>`;
      } else {
        this.statusOverlayEl.classList.add('hidden');
      }
    }

    // Red Screen-Edge Damage Flash & Blue-Teal Underwater Tint
    if (this.damageFlashEl) {
      const df = state.damageFlash ?? 0;
      this.damageFlashEl.classList.toggle('hidden', df <= 0.02);
      if (df > 0.02) this.damageFlashEl.style.opacity = String(Math.min(1, df).toFixed(2));
    }
    if (this.underwaterTintEl) {
      this.underwaterTintEl.classList.toggle('hidden', !state.diving || Boolean(state.statusOverlay));
    }

    const activeWeaponForReticle = WEAPONS[state.activeWeaponIdx] ?? WEAPONS[0];
    const canDriveBy = state.inVehicle && (activeWeaponForReticle.id === 'pistol' || activeWeaponForReticle.id === 'smg') && !ctx.shotFrozen;
    this.reticle.classList.toggle(
      'hidden',
      (state.inVehicle && !canDriveBy) || Boolean(state.statusOverlay) || Boolean(activities?.fishingSession) || Boolean(activities?.roofSession)
    );
    this.renderWeaponWheel(state, Boolean(wheelShotRight));

    // Minimap renders every frame (prioritize active Taxi/Vigilante side-job target when running a side-job!)
    const sideJob = activities?.getActiveSideJobInfo ? activities.getActiveSideJobInfo() : null;
    this.minimap.render({
      state, playerPos, playerYaw, policeUnits, footOfficers, heliPos, enemies,
      missionTarget: sideJob?.target ?? stage?.target ?? null, elapsed,
    });

    // Live Fishing / Roof Repair Mini-Game Bar
    if (this.activityEl) {
      if (activities?.fishingSession) {
        const fs = activities.fishingSession;
        this.activityEl.classList.remove('hidden');
        const zoneL = Math.round(fs.zoneStart * 100);
        const zoneW = Math.round((fs.zoneEnd - fs.zoneStart) * 100);
        const curL = Math.round(fs.cursor * 100);
        this.activityEl.innerHTML = `
          <div class="act-hdr">
            <span>FISHING</span>
            <span>${fs.phase === 'wait' ? 'CASTING...' : `${fs.progress}/3`}</span>
          </div>
          <div class="act-track">
            <div class="act-zone" style="left:${zoneL}%;width:${zoneW}%"></div>
            <div class="act-cursor" style="left:${curL}%"></div>
          </div>
          <div class="act-foot">
            <span>${fs.phase === 'wait' ? 'Watch the bobber...' : fs.targetFish.name}</span>
            <button class="btn-xs alt" id="btn-act-strike">${fs.phase === 'wait' ? 'WAIT' : 'REEL [SPACE]'}</button>
          </div>`;
        const b = this.activityEl.querySelector('#btn-act-strike');
        if (b && this.cb.onActivityStrike) b.onclick = () => this.cb.onActivityStrike();
      } else if (activities?.roofSession) {
        const rs = activities.roofSession;
        const done = state.roofProgress[rs.site.id] ?? 0;
        this.activityEl.classList.remove('hidden');
        const zoneL = Math.round(rs.zoneStart * 100);
        const zoneW = Math.round((rs.zoneEnd - rs.zoneStart) * 100);
        const curL = Math.round(rs.cursor * 100);
        this.activityEl.innerHTML = `
          <div class="act-hdr">
            <span>ROOF REPAIR</span>
            <span>${done}/${rs.site.totalTiles}</span>
          </div>
          <div class="act-track">
            <div class="act-zone" style="left:${zoneL}%;width:${zoneW}%"></div>
            <div class="act-cursor" style="left:${curL}%"></div>
          </div>
          <div class="act-foot">
            <span>Align tile in green zone</span>
            <button class="btn-xs" id="btn-act-strike">HAMMER [SPACE]</button>
          </div>`;
        const b = this.activityEl.querySelector('#btn-act-strike');
        if (b && this.cb.onActivityStrike) b.onclick = () => this.cb.onActivityStrike();
      } else {
        this.activityEl.classList.add('hidden');
      }
    }

    // BAIL OUT! alert when car catches fire during 5-second humane countdown
    if (this.bailoutEl) {
      const showBail = Boolean(state.inVehicle && playerVehicle?.burning && !playerVehicle.exploded);
      this.bailoutEl.classList.toggle('hidden', !showBail);
      if (showBail) {
        this.bailoutEl.textContent = `BAIL OUT! (${Math.ceil(playerVehicle.fireCountdown)}s)`;
      }
    }

    // Throttle remaining DOM updates (~15Hz) unless forced
    if (elapsed - this.lastRenderTime < 0.06 && !ctx.forceDom) return;
    this.lastRenderTime = elapsed;

    // 1. Concise Mission / Side-Job Card ONLY when active (Title + 1-line objective + timer — ZERO clutter!)
    if (sideJob) {
      this.missionEl.classList.remove('hidden');
      const mins = Math.floor(Math.max(0, sideJob.timer) / 60);
      const secs = String(Math.floor(Math.max(0, sideJob.timer) % 60)).padStart(2, '0');
      this.missionEl.innerHTML = `
        <div class="mission-head">
          <div class="mission-title">${sideJob.title}</div>
          <span class="mission-timer">${mins}:${secs}</span>
        </div>
        <div class="mission-obj">${sideJob.label}</div>`;
    } else if (mission && stage) {
      this.missionEl.classList.remove('hidden');
      const mins = Math.floor(state.missionTimer / 60);
      const secs = String(Math.floor(state.missionTimer % 60)).padStart(2, '0');
      this.missionEl.innerHTML = `
        <div class="mission-head">
          <div class="mission-title">${mission.title}</div>
          <span class="mission-timer">${mins}:${secs}</span>
        </div>
        <div class="mission-obj">${stage.label}${stage.type === 'combat' && state.missionEnemiesRemaining > 0 ? ` (${state.missionEnemiesRemaining})` : ''}</div>`;
    } else {
      this.missionEl.classList.add('hidden');
    }

    // 2. Top-Right Cash (Pure classic GTA green money)
    this.statusEl.innerHTML = `<div class="cash-display">$${Math.round(state.cash).toLocaleString()}</div>`;

    // 3. Plain 5 Wanted Stars ONLY — ZERO text beside or under stars! Flashing when hidden & cooling down!
    const flashRed = Math.sin(elapsed * 10) > 0;
    const hiddenDim = Boolean(state.hiddenFromPolice && state.wantedLevel > 0 && Math.sin(elapsed * 7.5) < 0);
    const starsHtml = [1, 2, 3, 4, 5].map((n) => {
      const lit = n <= state.wantedLevel;
      let cls = '';
      if (lit) {
        if (hiddenDim) cls = 'lit hidden-dim';
        else if (state.wantedLevel >= 4) cls = flashRed ? 'flash-red' : 'flash-blue';
        else cls = 'lit';
      }
      return `<span class="w-star ${cls}">★</span>`;
    }).join('');
    this.wantedEl.innerHTML = `<div class="wanted-stars">${starsHtml}</div>`;

    // 4. Single Active Weapon Badge (SVG silhouette + name + ammo with ∞ for melee + minimal reload bar)
    const activeW = WEAPONS[state.activeWeaponIdx] ?? WEAPONS[0];
    const activeAmmo = state.weaponAmmo[activeW.id];
    const ammoHtml = activeW.melee
      ? `<span class="wa-inf">∞</span>`
      : `<span>${activeAmmo.clip}</span><span class="wa-ammo-res">/ ${activeAmmo.reserve}</span>`;
    const reloadBar = (state.reloadTimer > 0 && state.reloadDuration > 0)
      ? `<div class="wa-reload-track"><div class="wa-reload-fill" style="width:${Math.round((1 - state.reloadTimer / state.reloadDuration) * 100)}%"></div></div>`
      : '';
    this.weaponEl.innerHTML = `
      <div class="wa-row">
        <div class="wa-left">
          <div class="wa-icon">${renderWeaponSvg(activeW.id)}</div>
          <span class="wa-name">${activeW.shortName}</span>
        </div>
        <div class="wa-ammo">${ammoHtml}</div>
      </div>${reloadBar}`;

    // 5. Compact Crew HP Bars ONLY when crew is active with you
    if (state.crewActive) {
      this.crewEl.classList.remove('hidden');
      this.crewEl.innerHTML = CREW.map((c) => {
        const hp = Math.max(0, Math.min(100, Math.round(state.crewHealth?.[c.id] ?? 100)));
        return `<div class="crew-card">
          <div class="crew-ava">${renderPortraitSvg(c.id)}</div>
          <div class="crew-meta">
            <span class="crew-name">${c.name.split(' ')[0]}</span>
            <div class="crew-hp-track"><div class="crew-hp-fill" style="width:${hp}%"></div></div>
          </div>
        </div>`;
      }).join('');
    } else {
      this.crewEl.classList.add('hidden');
    }

    // 6. Pure GTA Bottom-Left Vitals: Health (green) + Armor (blue) + slim Stamina bar + Oxygen bar (ONLY while underwater!)
    const hpPct = Math.max(0, Math.min(100, Math.round(state.health)));
    const arPct = Math.max(0, Math.min(100, Math.round(state.armor)));
    const stPct = Math.max(0, Math.min(100, Math.round(state.stamina ?? 100)));
    const oxPct = Math.max(0, Math.min(100, Math.round(state.oxygen ?? 100)));
    const stamCol = state.exhausted
      ? (Math.sin(elapsed * 14) > 0 ? '#ff6b4a' : '#ffbe55')
      : 'linear-gradient(90deg,#f59e0b,#ffd24d)';
    const showOxygen = Boolean(state.diving || oxPct < 99);
    const oxyCol = oxPct < 25 && Math.sin(elapsed * 14) > 0
      ? '#ff3b5c'
      : 'linear-gradient(90deg,#0ea5e9,#38bdf8)';
    const oxyHtml = showOxygen
      ? `<div class="bar-track slim" id="oxygen-bar"><div class="bar-fill" style="width:${oxPct}%;background:${oxyCol}"></div></div>`
      : '';
    this.vitalsEl.innerHTML = `
      <div class="vital-split">
        <div class="bar-track"><div class="bar-fill" style="width:${hpPct}%;background:linear-gradient(90deg,#22c55e,#4ade80)"></div></div>
        <div class="bar-track"><div class="bar-fill" style="width:${arPct}%;background:linear-gradient(90deg,#3b82f6,#60a5fa)"></div></div>
      </div>
      <div class="bar-track slim"><div class="bar-fill" style="width:${stPct}%;background:${stamCol}"></div></div>
      ${oxyHtml}`;

    // 7. Portrait Dialogue Box (shown during story beats)
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

    // 8. Minimal Radio Station Name (ONLY while driving) + Clean Speedometer (ONLY while driving!)
    if (state.inVehicle && playerVehicle) {
      const st = RADIO_STATIONS[state.radioStationIdx];
      this.radioEl.classList.remove('hidden');
      this.radioEl.textContent = state.radioMuted ? 'RADIO OFF' : st.name;

      this.vehicleEl.classList.remove('hidden');
      const mph = Math.round(playerVehicle.speed * 2.237);
      const condPct = Math.max(0, Math.min(100, Math.round((playerVehicle.hp / playerVehicle.maxHp) * 100)));
      const nitroPct = Math.round(playerVehicle.nitro);
      const condCol = condPct > 55 ? '#42e38c' : condPct > 28 ? '#ffbe55' : '#ff3b5c';
      this.vehicleEl.innerHTML = `
        <div class="veh-speed-row">
          <div class="speed-big">
            <span class="speed-num">${mph}</span>
            <span class="speed-unit">MPH</span>
          </div>
          <div class="veh-bars">
            <div class="veh-bar-row">
              <svg class="veh-bar-ico" viewBox="0 0 16 16" fill="${condCol}"><path d="M8 1L2 3.5v4.2c0 3.6 2.5 6.4 6 7.3 3.5-.9 6-3.7 6-7.3V3.5L8 1z"/></svg>
              <div class="bar-track"><div class="bar-fill" style="width:${condPct}%;background:${condCol}"></div></div>
            </div>
            <div class="veh-bar-row">
              <svg class="veh-bar-ico" viewBox="0 0 16 16" fill="#34e0c8"><path d="M9.5 1L3 9.2h4.4L6.5 15 13 6.8H8.6L9.5 1z"/></svg>
              <div class="bar-track"><div class="bar-fill" style="width:${nitroPct}%;background:linear-gradient(90deg,#34e0c8,#5eead4)"></div></div>
            </div>
          </div>
        </div>`;
    } else {
      this.radioEl.classList.add('hidden');
      this.vehicleEl.classList.add('hidden');
    }

    // Toast & Interact Prompt
    if (state.toast) {
      this.toastEl.classList.remove('hidden');
      this.toastEl.textContent = state.toast.text;
    } else {
      this.toastEl.classList.add('hidden');
    }

    if (promptText && !state.statusOverlay) {
      this.promptEl.classList.remove('hidden');
      this.promptEl.textContent = promptText;
    } else {
      this.promptEl.classList.add('hidden');
    }
  }
}
