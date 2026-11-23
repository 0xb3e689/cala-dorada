// Core 3D game engine: Three.js renderer, full GTA mouse-look camera rig, solid CollisionWorld,
// WASTED & BUSTED state machines, car-hit-human physics, reload & exhaustion systems, and pure GTA UI integration.

import * as THREE from '../../vendor/three.module.min.js';
import {
  RADIO_STATIONS, GARDEN_CROPS, WEAPONS, CAR_PAINTS, CAR_SPOILERS, CAR_UNDERGLOWS, CAR_RIMS, WARDROBE_OPTIONS,
} from './config.js';
import { createInitialState } from './gameState.js';
import { InputController } from './input.js';
import { createTextureLibrary } from '../world/textures.js';
import { getDistrictAt, PUBLIC_FACILITIES, FISHING_SPOTS, ROOF_REPAIR_SITES } from '../world/cityPlan.js';
import { buildCalaDoradaCity } from '../world/cityBuilder.js';
import { SkyAndLighting } from '../world/skyAndLighting.js';
import { TrafficAndPeds } from '../world/trafficAndPeds.js';
import { createVehicleMesh, applyVehicleMods } from '../entities/vehicleFactory.js';
import { VehiclePhysics } from '../entities/vehiclePhysics.js';
import { PlayerController } from '../entities/playerController.js';
import { PoliceDispatch } from '../entities/policeDispatch.js';
import { HelicopterAI } from '../entities/helicopterAI.js';
import { CombatSystem } from '../entities/combatSystem.js';
import { MissionDirector } from '../gameplay/missionDirector.js';
import { CrewAbilities } from '../gameplay/crewAbilities.js';
import { ActivitiesAndShops } from '../gameplay/activitiesAndShops.js';
import { SaveManager } from '../gameplay/saveManager.js';
import { SoundAndRadio } from '../audio/soundAndRadio.js';
import { HudOverlay } from '../ui/hudOverlay.js';
import { CareerMenu } from '../ui/careerMenu.js';
import { TitleScreen } from '../ui/titleScreen.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class CalaDoradaEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = createInitialState();
    this.input = new InputController(canvas);
    this.saveManager = new SaveManager();
    this.audio = new SoundAndRadio();

    // Pointer lock & drag-look eligibility predicates
    this.input.canPointerLock = () =>
      this.state.mode === 'playing' &&
      !this.state.weaponWheelOpen &&
      !this.state.statusOverlay &&
      !this.activities?.fishingSession &&
      !this.activities?.roofSession;
    this.input.allowLeftDragLook = () =>
      this.state.mode === 'playing' &&
      this.state.inVehicle &&
      !this.state.weaponWheelOpen;

    // Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.5, 1600);
    this.cameraOverride = null;

    // Build World + Solid Spatial CollisionWorld
    this.textures = createTextureLibrary();
    this.sky = new SkyAndLighting(this.scene);
    const city = buildCalaDoradaCity(this.scene, this.textures);
    this.colliders = city.colliders;
    this.collisionWorld = city.collisionWorld;
    this.worldAnim = city.animated;
    this.parkedVehicles = city.parkedVehicles ?? [];

    // Entities wired with CollisionWorld
    this.traffic = new TrafficAndPeds(this.scene, this.collisionWorld);
    this.vehiclePhysics = new VehiclePhysics(this.scene, this.collisionWorld);
    this.player = new PlayerController(this.scene, this.collisionWorld);
    this.police = new PoliceDispatch(this.scene, this.collisionWorld);
    this.heli = new HelicopterAI(this.scene, this.collisionWorld);
    this.combat = new CombatSystem(this.scene, this.collisionWorld);
    this.player.setHeldWeapon(WEAPONS[this.state.activeWeaponIdx].id);

    // Spawn Hero Vehicle: Dorado Apex GT on Paseo Dorado
    const heroCarMesh = createVehicleMesh('apex_gt');
    heroCarMesh.position.set(-145, 0, 200);
    heroCarMesh.rotation.y = Math.PI / 2;
    this.scene.add(heroCarMesh);
    this.playerVehicle = this.vehiclePhysics.createDriverState(heroCarMesh, 'apex_gt');
    this.player.setVisible(false);

    // Gameplay Directors
    this.missions = new MissionDirector(this.scene);
    this.crew = new CrewAbilities();
    this.activities = new ActivitiesAndShops(this.scene);

    // Camera Mouse-Look Rig State
    this.camYaw = Math.PI / 2;
    this.camPitch = 0.22;
    this.mouseLookIdleTimer = 3.0;
    this.camShake = 0;
    this.camFlinch = 0;
    this.currentFov = 56;
    this.camPos = new THREE.Vector3(-160, 12, 215);
    this.camLook = new THREE.Vector3(-120, 2, 200);

    // UI Overlays
    this.hud = new HudOverlay({
      onSelectWeapon: (idx) => {
        this.selectWeapon(idx, { closeWheel: true });
      },
      onHoverWeapon: (idx) => {
        this.state.weaponWheelHoverIdx = idx;
      },
      onActivityStrike: () => this._handleActivityStrike(),
    });
    this.shopEl = document.getElementById('shop-overlay');
    this.career = new CareerMenu({
      onResume: () => this.setMode('playing'),
      onTimeChanged: () => this.sky.applyTimeOfDay(this.state.timeOfDay, this.getFocusPos()),
      onSlotLoaded: () => this.syncCustomizationVisuals(),
      onSettingsChanged: () => {
        this.renderer.shadowMap.enabled = Boolean(this.state.settings.shadows);
      },
    });
    this.title = new TitleScreen({
      onContinue: () => {
        this.saveManager.loadSlot(1, this.state);
        this.syncCustomizationVisuals();
        this.startPlay();
      },
      onNewGame: () => {
        this.state = createInitialState();
        this.vehiclePhysics.repairVehicle(this.playerVehicle, this.state.carMods.paint);
        this.playerVehicle.pos.set(-145, 0, 200);
        this.playerVehicle.yaw = Math.PI / 2;
        this.playerVehicle.vel.set(0, 0, 0);
        this.playerVehicle.speed = 0;
        this.playerVehicle.mesh.position.copy(this.playerVehicle.pos);
        this.playerVehicle.mesh.rotation.y = this.playerVehicle.yaw;
        this.camYaw = this.playerVehicle.yaw;
        this.camPitch = 0.22;
        this.police.clearAll();
        this.combat.clearEnemies();
        this.syncCustomizationVisuals();
        this.missions.startMission(this.state, 'm1', this.combat, this.police);
        this.startPlay();
      },
      onSelectSlot: (slot) => {
        if (!this.saveManager.loadSlot(slot, this.state)) {
          this.state = createInitialState();
          this.state.activeSlot = slot;
        }
        this.syncCustomizationVisuals();
        this.startPlay();
      },
      onOpenSettings: () => {
        this.saveManager.loadSlot(1, this.state);
        this.syncCustomizationVisuals();
        this.career.activeTab = 'SETTINGS';
        this.setMode('paused');
      },
    });

    this.elapsed = 0;
    this.lastTime = performance.now();
    this.shotFrozen = false;
    this.wheelShotRight = false;
    this._wheelOpenedAt = 0;

    this._bindEvents();
    this.setMode('title');
  }

  // Unified single source of truth for weapon switching (1-6, scroll wheel, radial weapon wheel click/hover-release)
  selectWeapon(index, opts = {}) {
    const idx = ((Number(index) % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    const weapon = WEAPONS[idx];
    this.state.activeWeaponIdx = idx;
    this.state.activeWeaponId = weapon.id;
    this.state.weaponWheelHoverIdx = idx;
    this.state.reloadTimer = 0;
    this.state.reloadingWeaponId = null;
    this.player.setHeldWeapon(weapon.id);
    if (opts.closeWheel !== false) {
      if (this.state.weaponWheelOpen) {
        this.state.weaponWheelOpen = false;
        this.input.suppressFireFor(240);
      }
    }
    this.hud.lastRenderTime = -999; // Immediate HUD active weapon icon/name/ammo refresh
    if (!opts.silent) {
      this.audio.playUiBeep(640 + idx * 40);
    }
    return weapon;
  }

  getAllShootableVehicles() {
    return [this.playerVehicle, ...this.police.units, ...this.traffic.cars, ...this.parkedVehicles];
  }

  syncCustomizationVisuals() {
    applyVehicleMods(this.playerVehicle, this.state.carMods);
    this.player.applyAppearance(this.state.playerAppearance);
    this.player.setHeldWeapon(WEAPONS[this.state.activeWeaponIdx].id);
    this.activities.lastGardenSyncKey = '';
    this.activities.lastRoofSyncKey = '';
    this.activities.syncGardenMeshes(this.state, this.worldAnim);
    this.activities.syncRoofMeshes(this.state, this.worldAnim);
  }

  _handleActivityStrike() {
    if (this.activities.fishingSession) {
      this.activities.triggerFishingReel(this.state, this.player, this.saveManager, this.audio);
    } else if (this.activities.roofSession) {
      this.activities.triggerRoofHammer(this.state, this.saveManager, this.audio);
      this.activities.syncRoofMeshes(this.state, this.worldAnim);
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });

    this.input.onAction = (code) => {
      this.audio.unlock();
      if (this.state.mode === 'title') {
        if (code === 'Enter') {
          this.saveManager.loadSlot(1, this.state);
          this.syncCustomizationVisuals();
          this.startPlay();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyM') {
        if (this.state.statusOverlay) return;
        if (this.state.weaponWheelOpen) {
          this.state.weaponWheelOpen = false;
          this.input.suppressFireFor(240);
          return;
        }
        if (this.activities.fishingSession) {
          this.activities.stopFishing(this.player);
          return;
        }
        if (this.activities.roofSession) {
          this.activities.stopRoofRepair();
          return;
        }
        if (this.state.mode === 'shop') {
          this.shopEl.classList.add('hidden');
          this.setMode('playing');
        } else {
          this.setMode(this.state.mode === 'paused' ? 'playing' : 'paused');
        }
        return;
      }

      if (this.state.mode !== 'playing' || this.state.statusOverlay) return;

      // CS:GO Radial Weapon Select Wheel [Q] or [Tab]
      if (code === 'KeyQ' || code === 'Tab') {
        if (this.state.weaponWheelOpen) {
          this.selectWeapon(this.state.weaponWheelHoverIdx ?? this.state.activeWeaponIdx, { closeWheel: true });
        } else {
          this.state.weaponWheelOpen = true;
          this.state.weaponWheelHoverIdx = this.state.activeWeaponIdx;
          this._wheelOpenedAt = performance.now();
          this.input.exitPointerLockSafe();
          this.input.suppressFireFor(200);
          this.audio.playUiBeep(680);
        }
        return;
      }

      // Fishing / Roof Repair mini-game strike on [Space]
      if (code === 'Space' && (this.activities.fishingSession || this.activities.roofSession)) {
        this._handleActivityStrike();
        return;
      }

      // Weapon slots 1-6 via unified selectWeapon()
      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5)) - 1;
        if (n >= 0 && n <= 5) {
          this.selectWeapon(n, { closeWheel: true });
        }
      }

      // Enter / Exit Vehicle [F]
      if (code === 'KeyF') this.toggleVehicle();

      // Crew Abilities [Z] [X] [C] (Note: [C] dives underwater when swimming!)
      if (code === 'KeyZ') this.crew.trigger('nadia', this.state, this.playerVehicle, this.police, this.audio);
      if (code === 'KeyX') {
        if (this.crew.trigger('toma', this.state, this.playerVehicle, this.police, this.audio)) {
          this.vehiclePhysics.repairVehicle(this.playerVehicle, this.state.carMods.paint);
        }
      }
      if (code === 'KeyC' && (this.state.inVehicle || !this.state.swimming)) {
        this.crew.trigger('sora', this.state, this.playerVehicle, this.police, this.audio);
      }

      // [R]: Reload firearm on foot | Cycle radio station in vehicle
      if (code === 'KeyR') {
        if (!this.state.inVehicle) {
          this.combat.startPlayerReload(this.state, this.audio);
        } else {
          this._cycleRadio();
        }
      }
      // [B]: Radio cycle anytime in vehicle
      if (code === 'KeyB' && this.state.inVehicle) {
        this._cycleRadio();
      }

      // Camera Cycle [V]
      if (code === 'KeyV') {
        const modes = ['chase', 'action', 'hood'];
        const cur = modes.indexOf(this.state.settings.cameraMode);
        this.state.settings.cameraMode = modes[(cur + 1) % modes.length];
      }

      // [E]: Bail out immediately if car is burning; otherwise interact with world spot/shop
      if (code === 'KeyE') {
        if (this.state.inVehicle && this.playerVehicle.burning) {
          this.toggleVehicle();
          return;
        }
        this.activities.interact(
          this.state,
          this.playerVehicle,
          this.player,
          this.saveManager,
          (sh) => this.openShop(sh),
          (site) => this.openGardenModal(site),
          this.audio
        );
      }

      // Quick Wanted Escalation [H] (steps gradually by 1 star!)
      if (code === 'KeyH') {
        this.police.addHeat(this.state, 110);
      }
    };

    // Release-to-select on hold-and-release of [Q] / [Tab] radial weapon wheel (>180ms hold)
    this.input.onKeyUp = (code) => {
      if ((code === 'KeyQ' || code === 'Tab') && this.state.weaponWheelOpen) {
        if (performance.now() - this._wheelOpenedAt > 180) {
          this.selectWeapon(this.state.weaponWheelHoverIdx ?? this.state.activeWeaponIdx, { closeWheel: true });
        }
      }
    };
  }

  _cycleRadio() {
    this.state.radioStationIdx = (this.state.radioStationIdx + 1) % RADIO_STATIONS.length;
    this.state.radioBannerTimer = 3.2;
    this.audio.playUiBeep(540);
  }

  getFocusPos() {
    return this.state.inVehicle ? this.playerVehicle.pos : this.player.pos;
  }

  getFocusYaw() {
    return this.state.inVehicle ? this.playerVehicle.yaw : this.player.yaw;
  }

  toggleVehicle() {
    if (this.state.inVehicle) {
      this.state.inVehicle = false;
      const rtX = Math.cos(this.playerVehicle.yaw);
      const rtZ = -Math.sin(this.playerVehicle.yaw);
      this.player.pos.copy(this.playerVehicle.pos).add(new THREE.Vector3(-rtX * 2.5, 0, -rtZ * 2.5));
      if (this.collisionWorld) this.collisionWorld.resolveCircle(this.player.pos, null, 0.62);
      this.player.yaw = this.playerVehicle.yaw;
      this.player.mesh.position.copy(this.player.pos);
      this.player.mesh.rotation.y = this.player.yaw;
      this.player.setVisible(true);
    } else if (!this.playerVehicle.exploded && this.player.pos.distanceTo(this.playerVehicle.pos) < 8) {
      this.state.inVehicle = true;
      this.state.reloadTimer = 0;
      this.state.reloadingWeaponId = null;
      this.player.setVisible(false);
    }
  }

  applyPlayerDamage(amount, opts = {}) {
    if (this.state.statusOverlay || this.shotFrozen) return;
    const dmg = Math.max(1, Math.round(amount));
    const hitArmor = this.state.armor > 0;
    let remaining = dmg;
    if (this.state.armor > 0) {
      const absorbed = Math.min(this.state.armor, remaining);
      this.state.armor = Math.max(0, this.state.armor - absorbed);
      remaining -= absorbed;
    }
    if (remaining > 0) {
      this.state.health = Math.max(0, this.state.health - remaining);
    }

    this.state.damageFlash = Math.min(0.85, (this.state.damageFlash ?? 0) + 0.42);
    this.camFlinch = Math.min(0.22, this.camFlinch + 0.12);
    if (!opts.silent) {
      this.audio.playPlayerPain(hitArmor);
    }
    if (!this.state.inVehicle) {
      this.player.applyBulletFlinch();
    }

    if (this.state.health <= 0) {
      this.triggerStatusOverlay('WASTED');
    }
  }

  triggerStatusOverlay(type) {
    if (this.state.statusOverlay) return;
    this.state.statusOverlay = { type, timer: 3.4, total: 3.4 };
    this.state.weaponWheelOpen = false;
    this.input.exitPointerLockSafe();
    this.input.suppressFireFor(400);
    // Ensure Dante is visible to play the physical WASTED collapse or BUSTED surrender animation!
    if (this.state.inVehicle) {
      this.state.inVehicle = false;
      const rtX = Math.cos(this.playerVehicle.yaw);
      const rtZ = -Math.sin(this.playerVehicle.yaw);
      this.player.pos.copy(this.playerVehicle.pos).add(new THREE.Vector3(-rtX * 2.3, 0, -rtZ * 2.3));
      this.player.yaw = this.playerVehicle.yaw;
      this.player.mesh.position.copy(this.player.pos);
      this.player.mesh.rotation.y = this.player.yaw;
      this.player.setVisible(true);
    }
    this.player.startDeathAnim(type);
    this.audio.playWastedBusted(type);
  }

  _completeStatusRespawn(type) {
    this.state.statusOverlay = null;
    this.state.bustProgress = 0;
    this.state.damageFlash = 0;
    this.state.wantedLevel = 0;
    this.state.wantedHeat = 0;
    this.state.hiddenFromPolice = false;
    this.state.airUnitDeployed = false;
    this.state.oxygen = this.state.maxOxygen ?? 100;
    this.state.swimming = false;
    this.state.diving = false;
    this.state.submergeDepth = 0;
    this.police.clearAll();
    this.combat.clearEnemies();
    this.player.resetDeathAnim();

    if (type === 'WASTED') {
      const h = PUBLIC_FACILITIES.hospital;
      const bill = Math.min(Math.round(this.state.cash), 1500);
      this.state.cash = Math.max(0, this.state.cash - bill);
      this.state.health = this.state.maxHealth;
      this.state.stamina = this.state.maxStamina;
      this.state.exhausted = false;
      this.state.exhaustTimer = 0;
      this.state.inVehicle = false;
      this.player.pos.set(h.spawnX, 0, h.spawnZ);
      this.player.yaw = h.spawnYaw;
      this.player.knockdownTimer = 0;
      this.player.mesh.position.copy(this.player.pos);
      this.player.mesh.rotation.set(0, h.spawnYaw, 0);
      this.player.setVisible(true);

      this.vehiclePhysics.repairVehicle(this.playerVehicle, this.state.carMods.paint);
      this.playerVehicle.pos.set(h.carX, 0, h.carZ);
      this.playerVehicle.vel.set(0, 0, 0);
      this.playerVehicle.speed = 0;
      this.playerVehicle.yaw = Math.PI / 2;
      this.playerVehicle.mesh.position.copy(this.playerVehicle.pos);
      this.playerVehicle.mesh.rotation.set(0, this.playerVehicle.yaw, 0);

      this.camYaw = h.spawnYaw;
      this.state.toast = { text: `DISCHARGED · -$${bill.toLocaleString()}`, timer: 3.2 };
    } else {
      const p = PUBLIC_FACILITIES.police;
      const fine = Math.min(Math.round(this.state.cash), 2000);
      this.state.cash = Math.max(0, this.state.cash - fine);
      this.state.health = this.state.maxHealth;
      this.state.stamina = this.state.maxStamina;
      this.state.exhausted = false;
      // Confiscate spare firearm ammo on arrest (keep starter clip)
      for (const w of WEAPONS) {
        if (!w.melee) this.state.weaponAmmo[w.id] = { clip: w.clip, reserve: 0 };
      }
      this.state.inVehicle = false;
      this.player.pos.set(p.spawnX, 0, p.spawnZ);
      this.player.yaw = p.spawnYaw;
      this.player.knockdownTimer = 0;
      this.player.mesh.position.copy(this.player.pos);
      this.player.mesh.rotation.set(0, p.spawnYaw, 0);
      this.player.setVisible(true);

      this.vehiclePhysics.repairVehicle(this.playerVehicle, this.state.carMods.paint);
      this.playerVehicle.pos.set(p.carX, 0, p.carZ);
      this.playerVehicle.vel.set(0, 0, 0);
      this.playerVehicle.speed = 0;
      this.playerVehicle.yaw = Math.PI / 2;
      this.playerVehicle.mesh.position.copy(this.playerVehicle.pos);
      this.playerVehicle.mesh.rotation.set(0, this.playerVehicle.yaw, 0);

      this.camYaw = p.spawnYaw;
      this.state.toast = { text: `RELEASED ON BAIL · -$${fine.toLocaleString()}`, timer: 3.2 };
    }
  }

  openGarageModal() {
    this.setMode('shop');
    this.shopEl.classList.remove('hidden');
    const mods = this.state.carMods;
    const paintBtns = CAR_PAINTS.map((p) => `
      <button class="swatch-btn ${mods.paint === p.hex ? 'active' : ''}" data-car-mod="paint" data-val="${p.hex}" data-cost="${p.price}">
        <span class="swatch-dot" style="background:${p.hex}"></span>${p.name}
      </button>`).join('');
    const finishBtns = ['metallic', 'matte'].map((f) => `
      <button class="swatch-btn ${mods.finish === f ? 'active' : ''}" data-car-mod="finish" data-val="${f}" data-cost="400">${f.toUpperCase()}</button>`).join('');
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

    this.shopEl.innerHTML = `
      <div class="glass-card panel-box" style="max-width:740px;margin:auto;max-height:84vh;overflow:auto">
        <div class="panel-hdr"><span>RAFA'S GARAGE · CUSTOMIZE</span><span style="color:#42e38c">$${Math.round(this.state.cash).toLocaleString()}</span></div>
        <div class="info-card"><h3>Paint & Finish</h3><div class="swatch-row">${paintBtns}</div><div class="swatch-row">${finishBtns}</div></div>
        <div class="info-card"><h3>Spoiler & Underglow</h3><div class="swatch-row">${spoilerBtns}</div><div class="swatch-row">${glowBtns}</div></div>
        <div class="info-card">
          <h3>Rims & Performance</h3>
          <div class="swatch-row">${rimBtns}</div>
          <div class="plot-row"><span>Turbo · Lv.${turboLvl}/3</span>${turboLvl < 3 ? `<button class="btn-xs" data-car-mod="turboLevel" data-val="${turboLvl + 1}" data-cost="${turboLvl * 3500}">$${(turboLvl * 3500).toLocaleString()}</button>` : '<span style="color:#42e38c;font-size:10px;font-weight:900">MAX</span>'}</div>
          <div class="plot-row"><span>Armor · Lv.${armorLvl}/3</span>${armorLvl < 3 ? `<button class="btn-xs" data-car-mod="armorLevel" data-val="${armorLvl + 1}" data-cost="${armorLvl * 4200}">$${(armorLvl * 4200).toLocaleString()}</button>` : '<span style="color:#42e38c;font-size:10px;font-weight:900">MAX</span>'}</div>
        </div>
        <button class="resume-btn" id="mod-close">CLOSE [ESC]</button>
      </div>`;

    this.shopEl.querySelectorAll('[data-car-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.carMod;
        const val = (cat === 'turboLevel' || cat === 'armorLevel') ? Number(btn.dataset.val) : btn.dataset.val;
        const cost = Number(btn.dataset.cost ?? 0);
        this.activities.applyCarMod(cat, val, cost, this.state, this.playerVehicle, this.saveManager, this.audio);
        this.openGarageModal();
      });
    });
    this.shopEl.querySelector('#mod-close').addEventListener('click', () => {
      this.shopEl.classList.add('hidden');
      this.setMode('playing');
    });
  }

  openWardrobeModal() {
    this.setMode('shop');
    this.shopEl.classList.remove('hidden');
    const app = this.state.playerAppearance;
    const mkBtns = (field, list, isColor = false) => list.map((it) => {
      const val = isColor ? it.hex : it.id;
      return `<button class="swatch-btn ${app[field] === val ? 'active' : ''}" data-app-field="${field}" data-val="${val}">
        ${isColor ? `<span class="swatch-dot" style="background:${it.hex}"></span>` : ''}${it.name}
      </button>`;
    }).join('');

    this.shopEl.innerHTML = `
      <div class="glass-card panel-box" style="max-width:740px;margin:auto;max-height:84vh;overflow:auto">
        <div class="panel-hdr"><span>DANTE'S LOFT · WARDROBE</span></div>
        <div class="info-card"><h3>Outfit & Colors</h3><div class="swatch-row">${mkBtns('outfitStyle', WARDROBE_OPTIONS.outfits)}</div><div class="swatch-row">${mkBtns('jacketColor', WARDROBE_OPTIONS.jacketColors, true)}</div><div class="swatch-row">${mkBtns('pantsColor', WARDROBE_OPTIONS.pantsColors, true)}</div></div>
        <div class="info-card"><h3>Hair & Style</h3><div class="swatch-row">${mkBtns('hairStyle', WARDROBE_OPTIONS.hairStyles)}</div><div class="swatch-row">${mkBtns('hairColor', WARDROBE_OPTIONS.hairColors, true)}</div></div>
        <div class="info-card"><h3>Skin & Accessories</h3><div class="swatch-row">${mkBtns('skinTone', WARDROBE_OPTIONS.skinTones, true)}</div><div class="swatch-row">${mkBtns('accessory', WARDROBE_OPTIONS.accessories)}</div></div>
        <button class="resume-btn" id="wardrobe-close">CLOSE [ESC]</button>
      </div>`;

    this.shopEl.querySelectorAll('[data-app-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activities.applyAppearanceMod(btn.dataset.appField, btn.dataset.val, this.state, this.player, this.saveManager, this.audio);
        this.openWardrobeModal();
      });
    });
    this.shopEl.querySelector('#wardrobe-close').addEventListener('click', () => {
      this.shopEl.classList.add('hidden');
      this.setMode('playing');
    });
  }

  openShop(prop) {
    this.setMode('shop');
    this.shopEl.classList.remove('hidden');
    const owned = this.state.ownedProperties?.has(prop.id);
    const vaultAmt = Math.round(this.state.vaultBalance ?? 0);

    let buttonsHtml = '';
    if (!owned && prop.price > 0) {
      buttonsHtml = `
        <div class="info-card" style="margin-bottom:6px">
          <h3 style="color:${prop.color}">${prop.districtLabel.toUpperCase()}</h3>
          <p>${prop.perks}</p>
        </div>
        <button class="menu-btn primary" data-act="buy-property"><span>BUY ${prop.shortName}</span><span>$${prop.price.toLocaleString()}</span></button>`;
    } else if (prop.kind === 'garage') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="open-garage-mod"><span>CUSTOMIZE VEHICLE</span></button>
        <button class="menu-btn" data-act="repair"><span>FULL REPAIR & NITRO</span><span>$600</span></button>
        <button class="menu-btn" data-act="clear-wanted"><span>SCRUB PLATES</span><span>$2,500</span></button>`;
    } else if (prop.kind === 'gunsmith') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="ammo"><span>RESTOCK AMMO</span><span>$900</span></button>
        <button class="menu-btn" data-act="armor"><span>BODY ARMOR (100%)</span><span>$1,500</span></button>
        <button class="menu-btn" data-act="tactical-pack"><span>FULL LOADOUT PACK</span><span>$2,200</span></button>`;
    } else if (prop.kind === 'safehouse') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="open-wardrobe-mod"><span>WARDROBE</span></button>
        <button class="menu-btn" data-act="safehouse-rest"><span>REST & SAVE</span><span>FREE</span></button>
        <button class="menu-btn" data-act="advance-time"><span>ADVANCE TIME (+5.5H)</span><span>FREE</span></button>`;
    } else if (prop.kind === 'vault') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="collect-vault"><span>COLLECT VAULT</span><span>+$${vaultAmt.toLocaleString()}</span></button>
        <button class="menu-btn" data-act="safehouse-rest"><span>SAVE SLOT ${this.state.activeSlot}</span><span>FREE</span></button>`;
    } else if (prop.kind === 'marina') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="marina-cooldown"><span>REPAIR & CLEAR HEAT</span><span>FREE</span></button>
        <button class="menu-btn" data-act="collect-vault"><span>COLLECT INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>`;
    } else if (prop.kind === 'penthouse') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="penthouse-stash"><span>HEALTH, ARMOR & AMMO</span><span>FREE</span></button>
        <button class="menu-btn" data-act="advance-time"><span>ADVANCE TIME (+5.5H)</span><span>FREE</span></button>
        <button class="menu-btn" data-act="collect-vault"><span>COLLECT INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>`;
    } else {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="spawn-perk-vehicle"><span>DELIVER VEHICLE</span><span>FREE</span></button>
        <button class="menu-btn" data-act="collect-vault"><span>COLLECT INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>`;
    }

    this.shopEl.innerHTML = `
      <div class="glass-card panel-box" style="max-width:480px;margin:auto">
        <div class="panel-hdr"><span>${prop.name.toUpperCase()}</span><span style="color:#42e38c">$${Math.round(this.state.cash).toLocaleString()}</span></div>
        ${buttonsHtml}
        <button class="resume-btn" id="shop-close">LEAVE [ESC]</button>
      </div>`;

    this.shopEl.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.act === 'open-garage-mod') {
          this.openGarageModal();
          return;
        }
        if (b.dataset.act === 'open-wardrobe-mod') {
          this.openWardrobeModal();
          return;
        }
        if (b.dataset.act === 'repair' || b.dataset.act === 'marina-cooldown') {
          this.vehiclePhysics.repairVehicle(this.playerVehicle, this.state.carMods.paint);
        }
        this.activities.applyPropertyAction(
          prop, b.dataset.act, this.state, this.playerVehicle, this.police, this.saveManager, this.audio,
          () => this.sky.applyTimeOfDay(this.state.timeOfDay, this.getFocusPos())
        );
        this.openShop(prop);
      });
    });
    this.shopEl.querySelector('#shop-close').addEventListener('click', () => {
      this.shopEl.classList.add('hidden');
      this.setMode('playing');
    });
  }

  openGardenModal(site) {
    this.setMode('shop');
    this.shopEl.classList.remove('hidden');
    const plots = (this.state.gardenPlots ?? []).filter((p) => p.siteId === site.id);
    const rows = plots.map((p, i) => {
      const crop = GARDEN_CROPS.find((c) => c.id === p.cropId);
      const label = crop ? `${crop.name} (${p.stage}/3)` : 'Empty Planter';
      let ctrls = '';
      if (!crop) {
        ctrls = GARDEN_CROPS.map((c) => `<button class="btn-xs alt" data-gp="plant" data-pid="${p.id}" data-cid="${c.id}">${c.name.split(' ')[0]} $${c.seedCost}</button>`).join('');
      } else if (p.stage < 3) {
        ctrls = `<button class="btn-xs alt" data-gp="water" data-pid="${p.id}">WATER</button>`;
      } else {
        ctrls = `<button class="btn-xs" data-gp="harvest" data-pid="${p.id}">HARVEST +$${crop.sellValue}</button>`;
      }
      return `<div class="plot-row"><span>Bed ${i + 1}: ${label}</span><div style="display:flex;gap:4px;flex-wrap:wrap">${ctrls}</div></div>`;
    }).join('');

    this.shopEl.innerHTML = `
      <div class="glass-card panel-box" style="max-width:560px;margin:auto">
        <div class="panel-hdr"><span>${site.name.toUpperCase()}</span><span style="color:#42e38c">$${Math.round(this.state.cash).toLocaleString()}</span></div>
        ${rows}
        <button class="resume-btn" id="garden-close">CLOSE [ESC]</button>
      </div>`;

    this.shopEl.querySelectorAll('[data-gp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.gp;
        if (act === 'plant') this.activities.plantPlot(btn.dataset.pid, btn.dataset.cid, this.state, this.saveManager, this.audio);
        else if (act === 'water') this.activities.waterPlot(btn.dataset.pid, this.state, this.saveManager, this.audio);
        else if (act === 'harvest') this.activities.harvestPlot(btn.dataset.pid, this.state, this.saveManager, this.audio);
        this.activities.syncGardenMeshes(this.state, this.worldAnim);
        this.openGardenModal(site);
      });
    });
    this.shopEl.querySelector('#garden-close').addEventListener('click', () => {
      this.shopEl.classList.add('hidden');
      this.setMode('playing');
    });
  }

  startPlay() {
    this.cameraOverride = null;
    this.shotFrozen = false;
    this.camYaw = this.getFocusYaw();
    this.camPitch = 0.22;
    this.setMode('playing');
    const m = this.missions.getActiveMission(this.state);
    this.state.dialogue = { ...m.dialogue, timer: 6.5 };
  }

  setMode(mode) {
    this.state.mode = mode;
    if (mode !== 'playing') this.input.exitPointerLockSafe();
    if (mode === 'title') {
      this.title.show(this.saveManager, this.state.activeSlot);
      this.career.hide();
      this.hud.setVisible(false);
    } else if (mode === 'paused') {
      this.title.hide();
      this.hud.setVisible(false);
      const st = this.missions.getActiveStage(this.state);
      this.career.show(this.state, this.getFocusPos(), st?.target ?? null, this.saveManager);
    } else if (mode === 'playing') {
      this.title.hide();
      this.career.hide();
      this.shopEl.classList.add('hidden');
      this.hud.setVisible(true);
      this.input.suppressFireFor(240);
    }
  }

  startLoop() {
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.step(dt);
    };
    requestAnimationFrame(tick);
  }

  _resolveVehicleHumanCollisions() {
    const v = this.playerVehicle;
    // 1. Player vehicle striking enemies, on-foot police, and civilian NPCs (ZERO floating weapon damage numbers!)
    if (v.speed > 3.5) {
      const fwdX = Math.sin(v.yaw);
      const fwdZ = Math.cos(v.yaw);
      const hitRadius = 2.45;

      for (const e of this.combat.enemies) {
        if (e.dead || e.downed || (e.knockdownTimer ?? 0) > 1.0) continue;
        const dx = e.pos.x - v.pos.x;
        const dz = e.pos.z - v.pos.z;
        if (dx * dx + dz * dz < hitRadius * hitRadius) {
          const len = Math.hypot(dx, dz) || 1;
          this.combat.applyEnemyDamage(e, Math.round(v.speed * 3.0), e.pos, this.state, {
            source: 'vehicle',
            dir: { x: (dx / len + fwdX) * 0.6, z: (dz / len + fwdZ) * 0.6 },
            impactSpeed: v.speed,
          });
          this.audio.playCarHitHuman(v.speed);
          this.police.addHeat(this.state, 18);
        }
      }

      for (const off of this.police.footOfficers) {
        if (off.dead || off.downed || off.knockdownTimer > 1.0) continue;
        const dx = off.pos.x - v.pos.x;
        const dz = off.pos.z - v.pos.z;
        if (dx * dx + dz * dz < hitRadius * hitRadius) {
          const len = Math.hypot(dx, dz) || 1;
          const res = this.police.applyOfficerVehicleImpact(off, (dx / len + fwdX) * 0.6, (dz / len + fwdZ) * 0.6, v.speed, this.state);
          this.audio.playCarHitHuman(v.speed);
          this.police.addHeat(this.state, res?.killed ? 65 : 42);
        }
      }

      for (const p of this.traffic.peds) {
        if (p.dead || p.downed || p.knockdownTimer > 1.0) continue;
        const dx = p.mesh.position.x - v.pos.x;
        const dz = p.mesh.position.z - v.pos.z;
        if (dx * dx + dz * dz < hitRadius * hitRadius) {
          const len = Math.hypot(dx, dz) || 1;
          const res = this.traffic.applyPedVehicleImpact(p, (dx / len + fwdX) * 0.6, (dz / len + fwdZ) * 0.6, v.speed);
          this.audio.playCarHitHuman(v.speed);
          this.traffic.triggerPanicNear(v.pos, 42);
          this.police.addHeat(this.state, res?.killed ? 36 : 22);
        }
      }
    }

    // 2. Traffic cars & police cruisers striking on-foot Player!
    if (!this.state.inVehicle && this.player.knockdownTimer <= 0 && !this.state.statusOverlay) {
      const pPos = this.player.pos;
      const checkCarHitPlayer = (carPos, carSpd, carDirX, carDirZ) => {
        if (carSpd < 4.0) return;
        const dx = pPos.x - carPos.x;
        const dz = pPos.z - carPos.z;
        if (dx * dx + dz * dz < 2.35 * 2.35) {
          const len = Math.hypot(dx, dz) || 1;
          this.player.applyVehicleImpact((dx / len + carDirX) * 0.6, (dz / len + carDirZ) * 0.6, carSpd);
          this.camShake = Math.min(1.0, carSpd / 20);
          this.audio.playCarHitHuman(carSpd);
          this.applyPlayerDamage(Math.round(carSpd * 1.85), { silent: false });
        }
      };

      for (const c of this.traffic.cars) {
        const dirX = c.axis === 'x' ? c.dir : 0;
        const dirZ = c.axis === 'z' ? c.dir : 0;
        checkCarHitPlayer(c.mesh.position, c.curSpeed ?? c.speed, dirX, dirZ);
      }
      for (const u of this.police.units) {
        checkCarHitPlayer(u.pos, u.speed, Math.sin(u.yaw), Math.cos(u.yaw));
      }
    }
  }

  _handleVehicleExplosion(v) {
    this.traffic.triggerPanicNear(v.pos, 60);
    this.police.addHeat(this.state, 80);
    this.camShake = 0.9;
    const blastRadius = 9.5;

    // Damage & knockback player if still inside or too close to exploding car
    if (this.state.inVehicle && v === this.playerVehicle) {
      this.toggleVehicle();
      this.applyPlayerDamage(200);
    } else {
      const pDist = this.player.pos.distanceTo(v.pos);
      if (pDist < blastRadius) {
        const dir = this.player.pos.clone().sub(v.pos).normalize();
        this.player.applyVehicleImpact(dir.x, dir.z, 22);
        this.applyPlayerDamage(Math.round((1 - pDist / blastRadius) * 110));
      }
    }

    // Blast nearby enemies, police & peds
    for (const e of this.combat.enemies) {
      if (e.downed) continue;
      if (e.pos.distanceTo(v.pos) < blastRadius) {
        const dir = e.pos.clone().sub(v.pos).normalize();
        this.combat.applyEnemyDamage(e, 140, e.pos, this.state, { source: 'vehicle', dir, impactSpeed: 22 });
      }
    }
    for (const o of this.police.footOfficers) {
      if (o.downed) continue;
      if (o.pos.distanceTo(v.pos) < blastRadius) {
        const dir = o.pos.clone().sub(v.pos).normalize();
        this.police.applyOfficerVehicleImpact(o, dir.x, dir.z, 22, this.state);
      }
    }
    for (const p of this.traffic.peds) {
      if (p.downed) continue;
      if (p.mesh.position.distanceTo(v.pos) < blastRadius) {
        const dir = p.mesh.position.clone().sub(v.pos).normalize();
        this.traffic.applyPedVehicleImpact(p, dir.x, dir.z, 22);
      }
    }
  }

  step(dt, forceDom = false, skipRender = false) {
    const rawDt = dt;
    // Slow-motion during WASTED / BUSTED cinematic overlay
    const timeScale = this.state.statusOverlay ? 0.25 : 1.0;
    const simDt = rawDt * timeScale;

    if (!this.shotFrozen) {
      this.elapsed += simDt;
    }

    const pos = this.getFocusPos();
    const yaw = this.getFocusYaw();

    // Update WASTED / BUSTED countdown & physical death/arrest animations in real time
    if (this.state.statusOverlay && !this.shotFrozen) {
      this.player.updateDeathAnim(rawDt);
      this.state.statusOverlay.timer -= rawDt;
      if (this.state.statusOverlay.timer <= 0) {
        this._completeStatusRespawn(this.state.statusOverlay.type);
      }
    }

    if (this.state.mode === 'playing' && !this.shotFrozen) {
      this.state.careerStats.playtimeSec += rawDt;
      if (!this.state.clockPaused) {
        this.state.timeOfDay = (this.state.timeOfDay + simDt * 0.014) % 24;
      }

      if (this.state.damageFlash > 0) this.state.damageFlash = Math.max(0, this.state.damageFlash - rawDt * 1.4);
      if (this.state.radioBannerTimer > 0) this.state.radioBannerTimer = Math.max(0, this.state.radioBannerTimer - rawDt);
      if (this.camShake > 0) this.camShake = Math.max(0, this.camShake - rawDt * 2.2);
      if (this.camFlinch > 0) this.camFlinch = Math.max(0, this.camFlinch - rawDt * 2.8);

      // Full Mouse Look (both On Foot and While Driving!)
      if (!this.state.weaponWheelOpen && !this.state.statusOverlay) {
        const dx = this.input.lookDeltaX;
        const dy = this.input.lookDeltaY;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          this.camYaw = wrapAngle(this.camYaw - dx * 0.0032);
          this.camPitch = Math.max(-0.34, Math.min(0.82, this.camPitch + dy * 0.0026));
          this.mouseLookIdleTimer = 0;
        } else {
          this.mouseLookIdleTimer += rawDt;
        }
      }

      // Smoothly recenter driving camera behind the car after ~2.5s of no mouse input while driving forward
      if (this.state.inVehicle && !this.state.statusOverlay && this.mouseLookIdleTimer >= 2.5 && this.playerVehicle.vFwd > 1.5) {
        const diff = wrapAngle(this.playerVehicle.yaw - this.camYaw);
        this.camYaw = wrapAngle(this.camYaw + diff * Math.min(1, simDt * 3.8));
        this.camPitch = THREE.MathUtils.lerp(this.camPitch, 0.22, Math.min(1, simDt * 3.2));
      }

      const lifecycleCallbacks = {
        audio: this.audio,
        onCrash: (spd) => {
          this.camShake = Math.min(0.85, spd / 34);
          if (spd > 20) this.traffic.triggerPanicNear(this.playerVehicle.pos, 36);
          if (spd > 28) this.police.addHeat(this.state, 20);
        },
        onIgnite: (veh) => {
          this.traffic.triggerPanicNear(veh?.pos ?? this.playerVehicle.pos, 45);
          if (veh?.isPoliceVehicle) this.police.deployOfficersFromCruiser(veh);
        },
        onExplode: (veh) => {
          if (veh?.isPoliceVehicle) this.police.addHeat(this.state, 95);
          this._handleVehicleExplosion(veh);
        },
      };

      // Tick damage/smoke/fire/5s-explosion lifecycle on player vehicle AND all damaged/burning/exploded cars!
      const allVehicles = this.getAllShootableVehicles();
      this.vehiclePhysics.updateVehicleLifecycle(this.playerVehicle, simDt, this.elapsed, lifecycleCallbacks);
      for (let vi = 1; vi < allVehicles.length; vi++) {
        const veh = allVehicles[vi];
        if (veh.hp < veh.maxHp || veh.burning || veh.exploded) {
          this.vehiclePhysics.updateVehicleLifecycle(veh, simDt, this.elapsed, lifecycleCallbacks);
        }
      }

      if (!this.state.statusOverlay) {
        if (this.state.inVehicle) {
          this.vehiclePhysics.updatePlayerVehicle(this.playerVehicle, this.input, simDt, this.elapsed, lifecycleCallbacks);
          const mph = Math.round(this.playerVehicle.speed * 2.237);
          if (mph > this.state.careerStats.topSpeedMph) this.state.careerStats.topSpeedMph = mph;
          this.state.careerStats.distanceKm += (this.playerVehicle.speed * simDt) / 1000;
        } else {
          this.player.updateOnFoot(this.input, simDt, this.elapsed, this.camYaw, this.state, this.audio, (drownDmg) => {
            this.applyPlayerDamage(drownDmg, { silent: true });
          });
          // Safe Pointer-Lock Click Guard: ONLY fire when input.canFireNow() is true!
          if (this.input.canFireNow() && !this.state.weaponWheelOpen && !this.activities.fishingSession && !this.activities.roofSession) {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const aimTarget = this.camera.position.clone().addScaledVector(camDir, 45);
            const muzzle = this.player.getMuzzleWorldPos();
            const aimDir = aimTarget.sub(muzzle).normalize();
            this.combat.tryPlayerFire(this.state, this.player, aimDir, this.audio, null, (kind) => {
              if (kind === 'gunshot') {
                this.police.addHeat(this.state, 12);
                this.traffic.triggerPanicNear(this.player.pos, 50);
              }
            }, {
              footOfficers: this.police.footOfficers,
              peds: this.traffic.peds,
              vehicles: allVehicles,
              onRecoil: (kick) => {
                this.camPitch = Math.max(-0.34, Math.min(0.82, this.camPitch - kick));
                this.camShake = Math.min(0.45, this.camShake + kick * 2.2);
              },
              onPedShot: (ped, dmg, dir) => {
                const res = this.traffic.applyPedShot(ped, dmg, dir);
                this.police.addHeat(this.state, res?.killed ? 44 : 24);
              },
              onPoliceShot: (_off, killed) => {
                this.police.addHeat(this.state, killed ? 65 : 40);
              },
              onVehicleShot: (veh, dmg, hitPt, hitNormal) => {
                this.vehiclePhysics.spawnCollisionSparks(hitPt, hitNormal.x, hitNormal.z, 8);
                this.vehiclePhysics.applyDamage(veh, dmg * 0.85, lifecycleCallbacks);
                this.traffic.triggerPanicNear(hitPt, 40);
                this.police.addHeat(this.state, veh.isPoliceVehicle ? 30 : 14);
              },
            });
          }
        }
      }

      this._resolveVehicleHumanCollisions();

      if (this.state.weaponWheelOpen) {
        const dx = this.input.mouseX - window.innerWidth / 2;
        const dy = this.input.mouseY - window.innerHeight / 2;
        if (Math.hypot(dx, dy) > 28) {
          const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
          const shifted = ((deg + 120) % 360 + 360) % 360;
          const idx = Math.floor(shifted / 60) % 6;
          if (idx !== this.state.weaponWheelHoverIdx) {
            this.state.weaponWheelHoverIdx = idx;
            this.selectWeapon(idx, { closeWheel: false, silent: true });
          }
        }
      }

      if (this.input.wheelDelta !== 0 && !this.state.statusOverlay) {
        this.selectWeapon(this.state.activeWeaponIdx + Math.sign(this.input.wheelDelta), { closeWheel: false });
      }

      this.vehiclePhysics.updateParticles(simDt);
      this.crew.update(simDt, this.state);
      this.traffic.update(simDt, this.elapsed, pos, this.state.wantedLevel > 0);
      this.combat.update(simDt, this.elapsed, this.state, pos, (dmg) => this.applyPlayerDamage(dmg), this.audio, allVehicles);
      this.heli.update(simDt, this.elapsed, this.state, pos, this.combat, (dmg) => this.applyPlayerDamage(dmg), this.audio);

      const playerSpd = this.state.inVehicle ? this.playerVehicle.speed : Math.hypot(this.player.vel.x, this.player.vel.z);
      const policeRes = this.police.update(
        simDt, this.elapsed, this.state, pos, yaw, this.heli, this.combat, playerSpd,
        (dmg) => this.applyPlayerDamage(dmg), this.audio, allVehicles
      );
      if (policeRes.bustedReady && !this.state.statusOverlay) {
        this.triggerStatusOverlay('BUSTED');
      }

      this.missions.update(simDt, this.elapsed, this.state, pos, this.combat, this.police, this.audio);
      this.activities.update(simDt, this.elapsed, this.state, pos, this.worldAnim, this.audio);

      this.state.currentDistrictId = getDistrictAt(pos.x, pos.z).id;
      this.state.crewActive = this.player.partnerMesh.visible || this.state.activeMissionId === 'm3' || this.state.activeMissionId === 'm5';

      if (this.state.dialogue) {
        this.state.dialogue.timer -= rawDt;
        if (this.state.dialogue.timer <= 0) this.state.dialogue = null;
      }
      if (this.state.toast) {
        this.state.toast.timer -= rawDt;
        if (this.state.toast.timer <= 0) this.state.toast = null;
      }

      this.audio.update(simDt, this.elapsed, this.state, this.playerVehicle.speed, this.playerVehicle.drifting);
      this._updateHud(forceDom);
    } else if (this.state.mode === 'title' && !this.shotFrozen) {
      this.traffic.update(rawDt, this.elapsed, new THREE.Vector3(-120, 0, 200), false);
    }

    this.sky.applyTimeOfDay(this.state.timeOfDay, pos, this.shotSunDir ?? null);
    this.sky.updateAmbient(simDt, this.elapsed, this.worldAnim, pos);
    this._updateCamera(rawDt);
    this.camera.updateMatrixWorld(true);

    // Combine syndicate enemies + hostile on-foot police for world-space combat overlay
    const allHostiles = this.combat.enemies.concat(this.police.footOfficers);
    this.hud.updateCombatOverlay({
      state: this.state,
      camera: this.camera,
      enemies: allHostiles,
      damagePopups: this.combat.damagePopups,
      hitConfirmTimer: this.combat.hitConfirmTimer,
      hitConfirmCrit: this.combat.hitConfirmCrit,
    });
    if (!skipRender) {
      this.renderer.render(this.scene, this.camera);
    }
    this.input.endFrame();
  }

  _updateHud(forceDom = false) {
    this.hud.update({
      state: this.state,
      mission: this.missions.getActiveMission(this.state),
      stage: this.missions.getActiveStage(this.state),
      playerVehicle: this.playerVehicle,
      playerPos: this.getFocusPos(),
      playerYaw: this.getFocusYaw(),
      policeUnits: this.police.units,
      footOfficers: this.police.footOfficers,
      heliPos: this.heli.mesh.position,
      enemies: this.combat.enemies,
      promptText: this.activities.getPromptText(this.state),
      activities: this.activities,
      wheelShotRight: this.wheelShotRight,
      elapsed: this.elapsed,
      forceDom,
    });
  }

  _updateCamera(dt) {
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.pos);
      this.camera.lookAt(this.cameraOverride.lookAt);
      return;
    }

    if (this.state.mode === 'title') {
      const t = this.elapsed * 0.12;
      this.camera.position.set(-135 + Math.sin(t) * 24, 33 + Math.cos(t * 0.7) * 2.5, 305);
      this.camera.lookAt(68, 17, 178);
      return;
    }

    const pos = this.getFocusPos();

    // Dynamic FOV surge under nitro boost (Need-for-Speed sensation!)
    const targetFov = (this.state.inVehicle && this.playerVehicle.boosting)
      ? 64
      : (this.state.inVehicle ? 56 + Math.min(4.5, this.playerVehicle.speed * 0.06) : 56);
    if (Math.abs(targetFov - this.currentFov) > 0.08) {
      this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, Math.min(1, dt * 6));
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // GTA WASTED / BUSTED slow-motion orbiting pull-up camera
    if (this.state.statusOverlay) {
      const prog = 1 - this.state.statusOverlay.timer / this.state.statusOverlay.total;
      const dist = 5.6 + prog * 7.8;
      const orbitYaw = this.camYaw + prog * 0.72;
      const desiredPos = new THREE.Vector3(
        pos.x - Math.sin(orbitYaw) * dist,
        pos.y + 3.0 + prog * 5.2,
        pos.z - Math.cos(orbitYaw) * dist
      );
      this.camPos.lerp(desiredPos, Math.min(1, dt * 3.5));
      this.camLook.lerp(new THREE.Vector3(pos.x, pos.y + 0.65, pos.z), Math.min(1, dt * 4.5));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    const cy = this.camYaw;
    const cp = this.camPitch + this.camFlinch * 0.35;
    const cosP = Math.cos(cp);
    const sinP = Math.sin(cp);
    const fwdX = Math.sin(cy);
    const fwdZ = Math.cos(cy);

    let desiredPos;
    let desiredLook;
    if (this.state.inVehicle) {
      const carFwdX = Math.sin(this.playerVehicle.yaw);
      const carFwdZ = Math.cos(this.playerVehicle.yaw);
      if (this.state.settings.cameraMode === 'hood') {
        desiredPos = new THREE.Vector3(pos.x + carFwdX * 0.9, pos.y + 1.85, pos.z + carFwdZ * 0.9);
        desiredLook = new THREE.Vector3(pos.x + fwdX * 26, pos.y + 1.4 - sinP * 8, pos.z + fwdZ * 26);
      } else {
        const orbitDist = this.state.settings.cameraMode === 'action' ? 9.8 : 11.8;
        desiredPos = new THREE.Vector3(
          pos.x - fwdX * orbitDist * cosP,
          Math.max(1.4, pos.y + 2.4 + orbitDist * sinP),
          pos.z - fwdZ * orbitDist * cosP
        );
        desiredLook = new THREE.Vector3(
          pos.x + fwdX * 12,
          pos.y + 1.75 - sinP * 2.5,
          pos.z + fwdZ * 12
        );
      }
    } else {
      // Over-the-shoulder GTA mouse-look camera (follows diving smoothly underwater too!)
      const rtX = -Math.cos(cy);
      const rtZ = Math.sin(cy);
      const dist = 4.6;
      const diveOffset = this.state.diving ? -(this.state.submergeDepth ?? 0) * 0.65 : 0;
      desiredPos = new THREE.Vector3(
        pos.x - fwdX * dist * cosP + rtX * 1.15,
        Math.max(this.state.diving ? -1.4 : 1.0, pos.y + 1.75 + diveOffset + dist * sinP),
        pos.z - fwdZ * dist * cosP + rtZ * 1.15
      );
      desiredLook = new THREE.Vector3(
        pos.x + fwdX * 22 * cosP,
        pos.y + 1.48 + diveOffset - sinP * 14,
        pos.z + fwdZ * 22 * cosP
      );
    }

    // Apply subtle camera shake on crashes / explosions / getting hit by a car
    if (this.camShake > 0.01) {
      const s = this.camShake * 0.32;
      desiredPos.x += (Math.random() - 0.5) * s;
      desiredPos.y += (Math.random() - 0.5) * s;
      desiredPos.z += (Math.random() - 0.5) * s;
    }

    const lerpAmt = Math.min(1, dt * 11.0);
    this.camPos.lerp(desiredPos, lerpAmt);
    this.camLook.lerp(desiredLook, lerpAmt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
}
