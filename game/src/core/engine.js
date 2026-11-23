// Core 3D game engine: Three.js renderer, scene, dynamic camera rig, main loop, and full subsystem integration.

import * as THREE from '../../vendor/three.module.min.js';
import { RADIO_STATIONS } from './config.js';
import { createInitialState } from './gameState.js';
import { InputController } from './input.js';
import { createTextureLibrary } from '../world/textures.js';
import { getDistrictAt } from '../world/cityPlan.js';
import { buildCalaDoradaCity } from '../world/cityBuilder.js';
import { SkyAndLighting } from '../world/skyAndLighting.js';
import { TrafficAndPeds } from '../world/trafficAndPeds.js';
import { createVehicleMesh } from '../entities/vehicleFactory.js';
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

export class CalaDoradaEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = createInitialState();
    this.input = new InputController(canvas);
    this.saveManager = new SaveManager();
    this.audio = new SoundAndRadio();

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
    this.cameraOverride = null; // Used by shotMode or cinematic vistas

    // Build World
    this.textures = createTextureLibrary();
    this.sky = new SkyAndLighting(this.scene);
    const city = buildCalaDoradaCity(this.scene, this.textures);
    this.colliders = city.colliders;
    this.worldAnim = city.animated;

    // Entities
    this.traffic = new TrafficAndPeds(this.scene);
    this.vehiclePhysics = new VehiclePhysics(this.scene, this.colliders);
    this.player = new PlayerController(this.scene, this.colliders);
    this.police = new PoliceDispatch(this.scene);
    this.heli = new HelicopterAI(this.scene);
    this.combat = new CombatSystem(this.scene);

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

    // UI Overlays
    this.hud = new HudOverlay();
    this.shopEl = document.getElementById('shop-overlay');
    this.career = new CareerMenu({
      onResume: () => this.setMode('playing'),
      onTimeChanged: () => this.sky.applyTimeOfDay(this.state.timeOfDay, this.getFocusPos()),
    });
    this.title = new TitleScreen({
      onContinue: () => {
        this.saveManager.loadSlot(1, this.state);
        this.startPlay();
      },
      onNewGame: () => {
        this.state = createInitialState();
        this.missions.startMission(this.state, 'm1', this.combat, this.police);
        this.startPlay();
      },
      onSelectSlot: (slot) => {
        if (!this.saveManager.loadSlot(slot, this.state)) {
          this.state = createInitialState();
          this.state.activeSlot = slot;
        }
        this.startPlay();
      },
      onOpenCareer: () => {
        this.saveManager.loadSlot(1, this.state);
        this.setMode('paused');
      },
    });

    this.elapsed = 0;
    this.lastTime = performance.now();
    this.camPos = new THREE.Vector3(-160, 12, 215);
    this.camLook = new THREE.Vector3(-120, 2, 200);
    this.shotFrozen = false;

    this._bindEvents();
    this.setMode('title');
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
          this.startPlay();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyM') {
        if (this.state.mode === 'shop') {
          this.shopEl.classList.add('hidden');
          this.setMode('playing');
        } else {
          this.setMode(this.state.mode === 'paused' ? 'playing' : 'paused');
        }
        return;
      }

      if (this.state.mode !== 'playing') return;

      // Weapon slots 1-6
      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5)) - 1;
        if (n >= 0 && n <= 5) this.state.activeWeaponIdx = n;
      }

      // Enter / Exit Vehicle
      if (code === 'KeyF') this.toggleVehicle();

      // Crew Abilities [Z] [X] [C]
      if (code === 'KeyZ') this.crew.trigger('nadia', this.state, this.playerVehicle, this.police, this.audio);
      if (code === 'KeyX') this.crew.trigger('toma', this.state, this.playerVehicle, this.police, this.audio);
      if (code === 'KeyC') this.crew.trigger('sora', this.state, this.playerVehicle, this.police, this.audio);

      // Radio Station Cycle
      if (code === 'KeyR') {
        this.state.radioStationIdx = (this.state.radioStationIdx + 1) % RADIO_STATIONS.length;
        const st = RADIO_STATIONS[this.state.radioStationIdx];
        this.state.toast = { text: `RADIO TUNED: ${st.freq} ${st.name.toUpperCase()}`, timer: 2.2 };
        this.audio.playUiBeep(540);
      }

      // Camera Cycle
      if (code === 'KeyV') {
        const modes = ['chase', 'action', 'hood'];
        const cur = modes.indexOf(this.state.settings.cameraMode);
        this.state.settings.cameraMode = modes[(cur + 1) % modes.length];
      }

      // Interact with shop or race
      if (code === 'KeyE') {
        this.activities.interact(this.state, this.playerVehicle, this.saveManager, (sh) => this.openShop(sh), this.audio);
      }

      // Quick Wanted Test Escalation [H] for easy pursuit thrill
      if (code === 'KeyH') {
        this.police.addHeat(this.state, 105);
      }
    };
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
      this.player.pos.copy(this.playerVehicle.pos).add(new THREE.Vector3(-2.4, 0, 0));
      this.player.yaw = this.playerVehicle.yaw;
      this.player.setVisible(true);
    } else if (this.player.pos.distanceTo(this.playerVehicle.pos) < 8) {
      this.state.inVehicle = true;
      this.player.setVisible(false);
    }
  }

  openShop(shop) {
    this.setMode('shop');
    this.shopEl.classList.remove('hidden');
    const isGarage = shop.kind === 'garage';
    this.shopEl.innerHTML = `
      <div class="glass-card panel-box" style="max-width:480px;margin:auto">
        <div class="panel-hdr"><span>${shop.name.toUpperCase()}</span><span>$${Math.round(this.state.cash).toLocaleString()}</span></div>
        ${isGarage ? `
          <button class="menu-btn primary" data-buy="repair"><span>FULL REPAIR & NITRO</span><span>$600</span></button>
          <button class="menu-btn" data-buy="paint:#ff6138"><span>SOLSTICIO CORAL PAINT</span><span>$1,200</span></button>
          <button class="menu-btn" data-buy="paint:#34e0c8"><span>ESMERALDA TEAL PAINT</span><span>$1,200</span></button>
          <button class="menu-btn" data-buy="paint:#ffbe55"><span>GOLD COAST METALLIC</span><span>$1,200</span></button>
        ` : `
          <button class="menu-btn primary" data-buy="ammo"><span>RESTOCK ALL AMMO</span><span>$900</span></button>
          <button class="menu-btn" data-buy="armor"><span>KEVLAR ARMOR VEST (100%)</span><span>$1,500</span></button>
        `}
        <button class="resume-btn" id="shop-close">LEAVE SHOP [ESC]</button>
      </div>`;
    this.shopEl.querySelectorAll('[data-buy]').forEach((b) => {
      b.addEventListener('click', () => {
        this.activities.applyShopPurchase(shop.kind, b.dataset.buy, this.state, this.playerVehicle, this.audio);
        this.openShop(shop);
      });
    });
    this.shopEl.querySelector('#shop-close').addEventListener('click', () => {
      this.shopEl.classList.add('hidden');
      this.setMode('playing');
    });
  }

  startPlay() {
    this.cameraOverride = null;
    this.shotFrozen = false;
    this.setMode('playing');
    const m = this.missions.getActiveMission(this.state);
    this.state.dialogue = { ...m.dialogue, timer: 7.0 };
  }

  setMode(mode) {
    this.state.mode = mode;
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

  step(dt, forceDom = false) {
    if (!this.shotFrozen) {
      this.elapsed += dt;
    }

    const pos = this.getFocusPos();
    const yaw = this.getFocusYaw();

    if (this.state.mode === 'playing' && !this.shotFrozen) {
      this.state.careerStats.playtimeSec += dt;
      if (!this.state.clockPaused) {
        this.state.timeOfDay = (this.state.timeOfDay + dt * 0.014) % 24;
      }

      if (this.state.inVehicle) {
        this.vehiclePhysics.updatePlayerVehicle(this.playerVehicle, this.input, dt, {
          onCrash: (spd) => {
            if (spd > 28) this.police.addHeat(this.state, 35);
          },
          onStuntLand: (rampId, dist) => this.activities.onStuntLand(rampId, dist, this.state, this.audio),
        });
        const mph = Math.round(this.playerVehicle.speed * 2.32);
        if (mph > this.state.careerStats.topSpeedMph) this.state.careerStats.topSpeedMph = mph;
        this.state.careerStats.distanceKm += (this.playerVehicle.speed * dt) / 1000;
      } else {
        this.player.updateOnFoot(this.input, dt, this.elapsed, this.player.yaw);
        if (this.input.mouseDown) {
          const aimDir = new THREE.Vector3(Math.sin(this.player.yaw), -0.02, Math.cos(this.player.yaw)).normalize();
          this.combat.tryPlayerFire(this.state, this.player, aimDir, this.audio, null, () => {
            this.police.addHeat(this.state, 28);
            this.traffic.triggerPanicNear(this.player.pos, 50);
          });
        }
      }

      this.vehiclePhysics.updateParticles(dt);
      this.crew.update(dt, this.state);
      this.traffic.update(dt, this.elapsed, pos, this.state.wantedLevel > 0);
      this.combat.update(dt, this.elapsed, this.state, pos, (dmg) => {
        if (this.state.armor > 0) this.state.armor = Math.max(0, this.state.armor - dmg);
        else this.state.health = Math.max(15, this.state.health - dmg);
      });
      this.heli.update(dt, this.elapsed, this.state, pos);
      const dispatch = this.police.update(dt, this.elapsed, this.state, pos, yaw, this.heli);
      this.missions.update(dt, this.elapsed, this.state, pos, this.combat, this.police, this.audio);
      this.activities.update(dt, this.elapsed, this.state, pos, this.worldAnim, this.audio);

      this.state.currentDistrictId = getDistrictAt(pos.x, pos.z).id;

      if (this.state.dialogue) {
        this.state.dialogue.timer -= dt;
        if (this.state.dialogue.timer <= 0) this.state.dialogue = null;
      }
      if (this.state.toast) {
        this.state.toast.timer -= dt;
        if (this.state.toast.timer <= 0) this.state.toast = null;
      }

      this.audio.update(dt, this.elapsed, this.state, this.playerVehicle.speed, this.playerVehicle.drifting);
      this._updateHud(dispatch, forceDom);
    } else if (this.state.mode === 'title' && !this.shotFrozen) {
      this.traffic.update(dt, this.elapsed, new THREE.Vector3(-120, 0, 200), false);
    }

    this.sky.applyTimeOfDay(this.state.timeOfDay, pos);
    this.sky.updateAmbient(dt, this.elapsed, this.worldAnim);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _updateHud(dispatch, forceDom = false) {
    this.hud.update({
      state: this.state,
      mission: this.missions.getActiveMission(this.state),
      stage: this.missions.getActiveStage(this.state),
      nextStage: this.missions.getNextStage(this.state),
      dispatch,
      playerVehicle: this.playerVehicle,
      playerPos: this.getFocusPos(),
      playerYaw: this.getFocusYaw(),
      policeUnits: this.police.units,
      heliPos: this.heli.mesh.position,
      enemies: this.combat.enemies,
      promptText: this.activities.getPromptText(),
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
      const t = this.elapsed * 0.14;
      this.camera.position.set(-195 + Math.sin(t) * 28, 22 + Math.cos(t * 0.7) * 2.5, 256);
      this.camera.lookAt(-20, 14, 152);
      return;
    }

    const pos = this.getFocusPos();
    const yaw = this.getFocusYaw();
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    let desiredPos;
    let desiredLook;
    if (this.state.inVehicle) {
      if (this.state.settings.cameraMode === 'action') {
        desiredPos = new THREE.Vector3(pos.x + fwdX * 11 - fwdZ * 4.5, pos.y + 3.2, pos.z + fwdZ * 11 + fwdX * 4.5);
        desiredLook = new THREE.Vector3(pos.x - fwdX * 4, pos.y + 1.5, pos.z - fwdZ * 4);
      } else if (this.state.settings.cameraMode === 'hood') {
        desiredPos = new THREE.Vector3(pos.x + fwdX * 0.9, pos.y + 1.85, pos.z + fwdZ * 0.9);
        desiredLook = new THREE.Vector3(pos.x + fwdX * 26, pos.y + 1.4, pos.z + fwdZ * 26);
      } else {
        desiredPos = new THREE.Vector3(pos.x - fwdX * 12.5, pos.y + 5.2, pos.z - fwdZ * 12.5);
        desiredLook = new THREE.Vector3(pos.x + fwdX * 12, pos.y + 1.8, pos.z + fwdZ * 12);
      }
    } else {
      const rtX = -Math.cos(yaw);
      const rtZ = Math.sin(yaw);
      desiredPos = new THREE.Vector3(pos.x - fwdX * 4.8 + rtX * 1.35, pos.y + 2.35, pos.z - fwdZ * 4.8 + rtZ * 1.35);
      desiredLook = new THREE.Vector3(pos.x + fwdX * 14, pos.y + 1.5, pos.z + fwdZ * 14);
    }

    const lerpAmt = Math.min(1, dt * 8.5);
    this.camPos.lerp(desiredPos, lerpAmt);
    this.camLook.lerp(desiredLook, lerpAmt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
}
