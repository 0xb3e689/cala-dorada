// Core 3D game engine: Three.js renderer, scene, dynamic camera rig, main loop, and full subsystem integration.

import * as THREE from '../../vendor/three.module.min.js';
import { RADIO_STATIONS, GARDEN_CROPS } from './config.js';
import { createInitialState } from './gameState.js';
import { InputController } from './input.js';
import { createTextureLibrary } from '../world/textures.js';
import { getDistrictAt, FISHING_SPOTS, ROOF_REPAIR_SITES } from '../world/cityPlan.js';
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
    this.hud = new HudOverlay({
      onSelectWeapon: (idx) => {
        this.state.activeWeaponIdx = idx;
        this.state.weaponWheelHoverIdx = idx;
        this.state.weaponWheelOpen = false;
        this.audio.playUiBeep(640 + idx * 40);
      },
      onActivityStrike: () => this._handleActivityStrike(),
    });
    this.shopEl = document.getElementById('shop-overlay');
    this.career = new CareerMenu({
      onResume: () => this.setMode('playing'),
      onTimeChanged: () => this.sky.applyTimeOfDay(this.state.timeOfDay, this.getFocusPos()),
      onSlotLoaded: () => this.syncCustomizationVisuals(),
      onCarMod: (cat, val, cost) => this.activities.applyCarMod(cat, val, cost, this.state, this.playerVehicle, this.saveManager, this.audio),
      onAppearanceMod: (field, val) => this.activities.applyAppearanceMod(field, val, this.state, this.player, this.saveManager, this.audio),
      onGardenAction: (act, plotId, cropId) => {
        if (act === 'plant') this.activities.plantPlot(plotId, cropId, this.state, this.saveManager, this.audio);
        else if (act === 'water') this.activities.waterPlot(plotId, this.state, this.saveManager, this.audio);
        else if (act === 'harvest') this.activities.harvestPlot(plotId, this.state, this.saveManager, this.audio);
        this.activities.syncGardenMeshes(this.state, this.worldAnim);
      },
      onStartFishing: (spotId) => {
        const spot = FISHING_SPOTS.find((f) => f.id === spotId);
        if (spot) {
          this.setMode('playing');
          this.activities.startFishing(spot, this.state, this.player);
        }
      },
      onStartRoof: (siteId) => {
        const site = ROOF_REPAIR_SITES.find((r) => r.id === siteId);
        if (site) {
          this.setMode('playing');
          this.activities.startRoofRepair(site, this.state, this.player);
        }
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
      onOpenCareer: () => {
        this.saveManager.loadSlot(1, this.state);
        this.syncCustomizationVisuals();
        this.setMode('paused');
      },
    });

    this.elapsed = 0;
    this.lastTime = performance.now();
    this.camPos = new THREE.Vector3(-160, 12, 215);
    this.camLook = new THREE.Vector3(-120, 2, 200);
    this.shotFrozen = false;
    this.wheelShotRight = false;

    this._bindEvents();
    this.setMode('title');
  }

  syncCustomizationVisuals() {
    applyVehicleMods(this.playerVehicle, this.state.carMods);
    this.player.applyAppearance(this.state.playerAppearance);
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
          this.startPlay();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyM') {
        if (this.state.weaponWheelOpen) {
          this.state.weaponWheelOpen = false;
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

      if (this.state.mode !== 'playing') return;

      // CS:GO Radial Weapon Select Wheel [Q] or [Tab]
      if (code === 'KeyQ' || code === 'Tab') {
        this.state.weaponWheelOpen = !this.state.weaponWheelOpen;
        this.state.weaponWheelHoverIdx = this.state.activeWeaponIdx;
        this.audio.playUiBeep(this.state.weaponWheelOpen ? 680 : 480);
        return;
      }

      // Fishing / Roof Repair mini-game strike on [Space]
      if (code === 'Space' && (this.activities.fishingSession || this.activities.roofSession)) {
        this._handleActivityStrike();
        return;
      }

      // Weapon slots 1-6
      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5)) - 1;
        if (n >= 0 && n <= 5) {
          this.state.activeWeaponIdx = n;
          this.state.weaponWheelHoverIdx = n;
          this.state.weaponWheelOpen = false;
        }
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
        this.state.toast = { text: `${st.freq} ${st.name.toUpperCase()}`, timer: 2.2 };
        this.audio.playUiBeep(540);
      }

      // Camera Cycle
      if (code === 'KeyV') {
        const modes = ['chase', 'action', 'hood'];
        const cur = modes.indexOf(this.state.settings.cameraMode);
        this.state.settings.cameraMode = modes[(cur + 1) % modes.length];
      }

      // Interact with property, fishing pier, garden, roof repair, or street race
      if (code === 'KeyE') {
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

      // Quick Wanted Escalation [H]
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

  openShop(prop) {
    this.setMode('shop');
    this.shopEl.classList.remove('hidden');
    const owned = this.state.ownedProperties?.has(prop.id);
    const vaultAmt = Math.round(this.state.vaultBalance ?? 0);

    let buttonsHtml = '';
    if (!owned && prop.price > 0) {
      buttonsHtml = `
        <div class="info-card" style="margin-bottom:6px">
          <h3 style="color:${prop.color}">${prop.districtLabel.toUpperCase()} · ${prop.badge}</h3>
          <p>${prop.perks}</p>
        </div>
        <button class="menu-btn primary" data-act="buy-property"><span>BUY ${prop.shortName}</span><span>$${prop.price.toLocaleString()}</span></button>`;
    } else if (prop.kind === 'garage') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="open-garage-mod"><span>CUSTOMIZE VEHICLE (PAINT, SPOILER, NEON, RIMS)</span></button>
        <button class="menu-btn" data-act="repair"><span>FULL REPAIR & NITRO</span><span>$600</span></button>
        <button class="menu-btn" data-act="clear-wanted"><span>SCRUB PLATES (CLEAR WANTED)</span><span>$2,500</span></button>`;
    } else if (prop.kind === 'gunsmith') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="ammo"><span>RESTOCK ALL WEAPON AMMO</span><span>$900</span></button>
        <button class="menu-btn" data-act="armor"><span>KEVLAR ARMOR VEST (100%)</span><span>$1,500</span></button>
        <button class="menu-btn" data-act="tactical-pack"><span>FULL TACTICAL LOADOUT PACK</span><span>$2,200</span></button>`;
    } else if (prop.kind === 'safehouse') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="open-wardrobe-mod"><span>WARDROBE & APPEARANCE</span></button>
        <button class="menu-btn" data-act="safehouse-rest"><span>REST, FULL HEAL & SAVE</span><span>FREE</span></button>
        <button class="menu-btn" data-act="advance-time"><span>ADVANCE TIME (+5.5H)</span><span>FREE</span></button>`;
    } else if (prop.kind === 'vault') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="collect-vault"><span>COLLECT EMPIRE VAULT INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>
        <button class="menu-btn" data-act="safehouse-rest"><span>SECURE SAVE TO SLOT ${this.state.activeSlot}</span><span>FREE</span></button>`;
    } else if (prop.kind === 'marina') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="marina-cooldown"><span>QUICK REPAIR & CLEAR HEAT</span><span>FREE</span></button>
        <button class="menu-btn" data-act="collect-vault"><span>COLLECT EMPIRE INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>`;
    } else if (prop.kind === 'penthouse') {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="penthouse-stash"><span>FULL HEALTH, ARMOR & AMMO STASH</span><span>FREE</span></button>
        <button class="menu-btn" data-act="advance-time"><span>ADVANCE TIME OF DAY (+5.5H)</span><span>FREE</span></button>
        <button class="menu-btn" data-act="collect-vault"><span>COLLECT EMPIRE INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>`;
    } else {
      buttonsHtml = `
        <button class="menu-btn primary" data-act="spawn-perk-vehicle"><span>DELIVER ${prop.spawnVehicle === 'apex_gt' ? 'DORADO APEX GT' : 'ARMORED BAJA SUV'}</span><span>FREE</span></button>
        <button class="menu-btn" data-act="collect-vault"><span>COLLECT EMPIRE INCOME</span><span>+$${vaultAmt.toLocaleString()}</span></button>`;
    }

    this.shopEl.innerHTML = `
      <div class="glass-card panel-box" style="max-width:500px;margin:auto">
        <div class="panel-hdr"><span>${prop.name.toUpperCase()}</span><span style="color:#42e38c">$${Math.round(this.state.cash).toLocaleString()}</span></div>
        ${buttonsHtml}
        <button class="resume-btn" id="shop-close">LEAVE PROPERTY [ESC]</button>
      </div>`;

    this.shopEl.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.act === 'open-garage-mod') {
          this.shopEl.classList.add('hidden');
          this.career.activeTab = 'GARAGE';
          this.setMode('paused');
          return;
        }
        if (b.dataset.act === 'open-wardrobe-mod') {
          this.shopEl.classList.add('hidden');
          this.career.activeTab = 'WARDROBE';
          this.setMode('paused');
          return;
        }
        this.activities.applyPropertyAction(
          prop,
          b.dataset.act,
          this.state,
          this.playerVehicle,
          this.police,
          this.saveManager,
          this.audio,
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
      const label = crop ? `${crop.name} (Stage ${p.stage}/3)` : 'Empty Planter';
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
        // Car-vs-enemy ramming: deals impact damage cleanly with source: 'vehicle' (NEVER spawns floating damage numbers!)
        if (this.playerVehicle.speed > 7.5) {
          for (const e of this.combat.enemies) {
            if (e.downed) continue;
            if (Math.hypot(this.playerVehicle.pos.x - e.pos.x, this.playerVehicle.pos.z - e.pos.z) < 2.6) {
              this.combat.applyEnemyDamage(e, Math.round(this.playerVehicle.speed * 2.2), e.pos, this.state, { source: 'vehicle' });
              this.police.addHeat(this.state, 32);
            }
          }
        }
        const mph = Math.round(this.playerVehicle.speed * 2.32);
        if (mph > this.state.careerStats.topSpeedMph) this.state.careerStats.topSpeedMph = mph;
        this.state.careerStats.distanceKm += (this.playerVehicle.speed * dt) / 1000;
      } else {
        this.player.updateOnFoot(this.input, dt, this.elapsed, this.player.yaw);
        if (this.input.mouseDown && !this.state.weaponWheelOpen && !this.activities.fishingSession && !this.activities.roofSession) {
          // Aim directly along camera center ray (50%, 50% crosshair)
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          const aimTarget = this.camera.position.clone().addScaledVector(camDir, 45);
          const muzzle = this.player.getMuzzleWorldPos();
          const aimDir = aimTarget.sub(muzzle).normalize();
          this.combat.tryPlayerFire(this.state, this.player, aimDir, this.audio, null, () => {
            this.police.addHeat(this.state, 28);
            this.traffic.triggerPanicNear(this.player.pos, 50);
          });
        }
      }

      if (this.state.mode === 'playing' && this.state.weaponWheelOpen && !this.shotFrozen) {
        // Mouse direction sector selection for CS:GO radial wheel
        const dx = this.input.mouseX - window.innerWidth / 2;
        const dy = this.input.mouseY - window.innerHeight / 2;
        if (Math.hypot(dx, dy) > 28) {
          let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
          let shifted = ((deg + 120) % 360 + 360) % 360;
          const idx = Math.floor(shifted / 60) % 6;
          this.state.weaponWheelHoverIdx = idx;
          this.state.activeWeaponIdx = idx;
        }
      }

      if (this.input.wheelDelta !== 0) {
        this.state.activeWeaponIdx = (this.state.activeWeaponIdx + Math.sign(this.input.wheelDelta) + 6) % 6;
        this.state.weaponWheelHoverIdx = this.state.activeWeaponIdx;
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

    this.sky.applyTimeOfDay(this.state.timeOfDay, pos, this.shotSunDir ?? null);
    this.sky.updateAmbient(dt, this.elapsed, this.worldAnim);
    this._updateCamera(dt);
    this.camera.updateMatrixWorld(true);
    this.hud.updateCombatOverlay({
      state: this.state,
      camera: this.camera,
      enemies: this.combat.enemies,
      damagePopups: this.combat.damagePopups,
      hitConfirmTimer: this.combat.hitConfirmTimer,
      hitConfirmCrit: this.combat.hitConfirmCrit,
    });
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
