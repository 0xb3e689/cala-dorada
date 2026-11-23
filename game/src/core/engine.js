// Core 3D game engine: Three.js renderer, full GTA mouse-look camera rig, solid CollisionWorld,
// WASTED & BUSTED state machines, car-hit-human physics, reload & exhaustion systems, and pure GTA UI integration.

import * as THREE from '../../vendor/three.module.min.js';
import {
  RADIO_STATIONS, GARDEN_CROPS, WEAPONS, CAR_PAINTS, CAR_SPOILERS, CAR_UNDERGLOWS, CAR_RIMS, WARDROBE_OPTIONS,
} from './config.js';
import { createInitialState } from './gameState.js';
import { InputController } from './input.js';
import { createTextureLibrary } from '../world/textures.js';
import { getDistrictAt, PUBLIC_FACILITIES, FISHING_SPOTS, ROOF_REPAIR_SITES, WORLD_PICKUPS } from '../world/cityPlan.js';
import { buildCalaDoradaCity } from '../world/cityBuilder.js';
import { SkyAndLighting } from '../world/skyAndLighting.js';
import { TrafficAndPeds } from '../world/trafficAndPeds.js';
import {
  createVehicleMesh, applyVehicleMods, setVehicleHeadlights, updatePoliceLightbar, getRadialGlowTexture,
} from '../entities/vehicleFactory.js';
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
    this.explosives = city.animated.explosives ?? [];

    // Entities wired with CollisionWorld
    this.traffic = new TrafficAndPeds(this.scene, this.collisionWorld);
    this.vehiclePhysics = new VehiclePhysics(this.scene, this.collisionWorld);
    this.player = new PlayerController(this.scene, this.collisionWorld);
    this.police = new PoliceDispatch(this.scene, this.collisionWorld);
    this.heli = new HelicopterAI(this.scene, this.collisionWorld);
    this.combat = new CombatSystem(this.scene, this.collisionWorld);
    this.player.setHeldWeapon(WEAPONS[this.state.activeWeaponIdx].id);

    // Spawn In-World Floating Pickups (Hospital Medkit, Precinct Armor, Alley Ammo & Cash)
    for (const pk of WORLD_PICKUPS) {
      this.combat.spawnPickup({ x: pk.x, y: 0, z: pk.z }, pk.kind, {
        id: pk.id,
        amount: pk.amount,
        respawnSec: 45,
      });
    }

    // Drive-by window muzzle flash sprite (reused when firing out of a vehicle!)
    this.driveByFlash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,190,68,0.9)', 'rgba(255,90,20,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.driveByFlash.scale.set(1.15, 1.15, 1);
    this.driveByFlash.visible = false;
    this.driveByFlashTimer = 0;
    this.scene.add(this.driveByFlash);

    // Spawn Hero Vehicle: Dorado Apex GT on Paseo Dorado
    const heroCarMesh = createVehicleMesh('apex_gt');
    heroCarMesh.position.set(-145, 0, 200);
    heroCarMesh.rotation.y = Math.PI / 2;
    this.scene.add(heroCarMesh);
    this.personalVehicle = this.vehiclePhysics.createDriverState(heroCarMesh, 'apex_gt');
    this.playerVehicle = this.personalVehicle;
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
      getWorldSnapshot: () => this.getWorldSnapshot(),
      onSlotLoaded: () => {
        this.applyLoadedWorldState();
        this.syncCustomizationVisuals();
      },
      onSettingsChanged: () => {
        this.renderer.shadowMap.enabled = Boolean(this.state.settings.shadows);
      },
    });
    this.title = new TitleScreen({
      onContinue: () => {
        this.saveManager.loadSlot(1, this.state);
        this.applyLoadedWorldState();
        this.syncCustomizationVisuals();
        this.startPlay();
      },
      onNewGame: () => {
        this.state = createInitialState();
        if (this.playerVehicle && this.playerVehicle !== this.personalVehicle) {
          this.playerVehicle.playerDriven = false;
        }
        this.playerVehicle = this.personalVehicle;
        this.vehiclePhysics.repairVehicle(this.personalVehicle, this.state.carMods.paint);
        this.personalVehicle.pos.set(-145, 0, 200);
        this.personalVehicle.yaw = Math.PI / 2;
        this.personalVehicle.vel.set(0, 0, 0);
        this.personalVehicle.speed = 0;
        this.personalVehicle.mesh.position.copy(this.personalVehicle.pos);
        this.personalVehicle.mesh.rotation.y = this.personalVehicle.yaw;
        this.camYaw = this.personalVehicle.yaw;
        this.camPitch = 0.22;
        this.activities.stopTaxiJob(this.state);
        this.activities.stopVigilanteJob(this.state);
        this.clearAllPursuitAndCombatState();
        this.syncCustomizationVisuals();
        this.missions.startMission(this.state, 'm1', this.combat, this.police);
        this.startPlay();
      },
      onSelectSlot: (slot) => {
        if (!this.saveManager.loadSlot(slot, this.state)) {
          this.state = createInitialState();
          this.state.activeSlot = slot;
        } else {
          this.applyLoadedWorldState();
        }
        this.syncCustomizationVisuals();
        this.startPlay();
      },
      onOpenSettings: () => {
        this.saveManager.loadSlot(1, this.state);
        this.applyLoadedWorldState();
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
    const set = new Set();
    const out = [];
    const add = (v) => {
      if (v && !set.has(v)) {
        set.add(v);
        out.push(v);
      }
    };
    add(this.playerVehicle);
    add(this.personalVehicle);
    for (const u of this.police.units) add(u);
    for (const c of this.traffic.cars) add(c);
    for (const p of this.parkedVehicles) add(p);
    return out;
  }

  getWorldSnapshot() {
    const pv = this.playerVehicle ?? this.personalVehicle;
    return {
      playerPos: {
        x: Math.round(this.player.pos.x * 100) / 100,
        y: Math.round(this.player.pos.y * 100) / 100,
        z: Math.round(this.player.pos.z * 100) / 100,
        yaw: Math.round(this.player.yaw * 1000) / 1000,
      },
      vehiclePos: pv ? {
        x: Math.round(pv.pos.x * 100) / 100,
        y: Math.round(pv.pos.y * 100) / 100,
        z: Math.round(pv.pos.z * 100) / 100,
        yaw: Math.round(pv.yaw * 1000) / 1000,
      } : null,
    };
  }

  applyLoadedWorldState() {
    const s = this.state;
    if (this.playerVehicle && this.playerVehicle !== this.personalVehicle) {
      this.playerVehicle.playerDriven = false;
    }
    this.playerVehicle = this.personalVehicle;
    if (s.savedVehiclePos && this.personalVehicle) {
      this.personalVehicle.pos.set(s.savedVehiclePos.x, s.savedVehiclePos.y ?? 0, s.savedVehiclePos.z);
      this.personalVehicle.yaw = s.savedVehiclePos.yaw ?? this.personalVehicle.yaw;
      this.personalVehicle.vel.set(0, 0, 0);
      this.personalVehicle.speed = 0;
      this.personalVehicle.mesh.position.copy(this.personalVehicle.pos);
      this.personalVehicle.mesh.rotation.set(0, this.personalVehicle.yaw, 0);
    }
    if (s.savedPlayerPos) {
      this.player.pos.set(s.savedPlayerPos.x, s.savedPlayerPos.y ?? 0, s.savedPlayerPos.z);
      this.player.yaw = s.savedPlayerPos.yaw ?? this.player.yaw;
      this.player.vel.set(0, 0, 0);
      this.player.mesh.position.copy(this.player.pos);
      this.player.mesh.rotation.set(0, this.player.yaw, 0);
    }
    this.player.setVisible(!s.inVehicle);
    this.camYaw = this.getFocusYaw();
  }

  syncCustomizationVisuals() {
    applyVehicleMods(this.personalVehicle, this.state.carMods);
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

      // [R]: Reload firearm on foot (or while doing drive-by in vehicle with shift) | Cycle radio station in vehicle
      if (code === 'KeyR') {
        if (!this.state.inVehicle) {
          this.combat.startPlayerReload(this.state, this.audio);
        } else {
          this._cycleRadio();
        }
      }

      // Camera Distance Cycle [V]: close -> medium -> far
      if (code === 'KeyV') {
        const modes = ['close', 'medium', 'far'];
        const cur = modes.indexOf(this.state.settings.cameraMode);
        this.state.settings.cameraMode = modes[(cur + 1) % modes.length];
        this.state.toast = { text: `CAMERA: ${this.state.settings.cameraMode.toUpperCase()}`, timer: 1.6 };
      }

      // Headlights Toggle [L] while in vehicle
      if (code === 'KeyL' && this.state.inVehicle && this.playerVehicle) {
        this.playerVehicle.headlightsOn = !this.playerVehicle.headlightsOn;
        setVehicleHeadlights(this.playerVehicle, this.playerVehicle.headlightsOn);
        this.audio.playUiBeep(this.playerVehicle.headlightsOn ? 760 : 520);
        this.state.toast = { text: this.playerVehicle.headlightsOn ? 'HEADLIGHTS ON' : 'HEADLIGHTS OFF', timer: 1.5 };
      }

      // Vehicle Horn & Stolen Police Siren Toggle [H]
      if (code === 'KeyH' && this.state.inVehicle && this.playerVehicle) {
        if (this.playerVehicle.spec?.isPolice) {
          this.playerVehicle.sirenActive = !this.playerVehicle.sirenActive;
          this.audio.playUiBeep(this.playerVehicle.sirenActive ? 880 : 480);
          this.state.toast = { text: this.playerVehicle.sirenActive ? 'CDPD SIREN ACTIVATED' : 'CDPD SIREN OFF', timer: 1.8 };
        } else {
          this.audio.playHorn(Boolean(this.playerVehicle.spec?.isBoat));
          this.traffic.reactToHorn(this.playerVehicle.pos, 22);
        }
      }

      // Taxi Fares / Vigilante Patrol Side-Jobs Toggle [T]
      if (code === 'KeyT' && this.state.inVehicle && this.playerVehicle) {
        if (this.playerVehicle.spec?.isTaxi) {
          this.activities.toggleTaxiJob(this.state, this.playerVehicle.pos, this.playerVehicle, this.audio);
        } else if (this.playerVehicle.spec?.isPolice) {
          this.activities.toggleVigilanteJob(this.state, this.playerVehicle.pos, this.playerVehicle, this.combat, this.audio);
        } else {
          this.state.toast = { text: 'Use [T] in a Cala Cab Taxi or CDPD Cruiser', timer: 2.2 };
        }
      }

      // [E]: Bail out if burning/stalled; Classic Pay 'n' Spray if driving into Rafa's Garage; board nearby boat; otherwise interact!
      if (code === 'KeyE') {
        if (this.state.inVehicle && (this.playerVehicle.burning || this.playerVehicle.engineStalled)) {
          this.toggleVehicle();
          return;
        }
        if (this.state.inVehicle && this.activities.nearbyShop?.kind === 'garage') {
          this.activities.triggerPayNSpray(
            this.state, this.playerVehicle, this.police, this.vehiclePhysics, this.saveManager, this.audio
          );
          return;
        }
        if (!this.state.inVehicle) {
          const nearBoat = this.findNearestBoardableVehicle(10.5, true);
          if (nearBoat) {
            this.enterVehicle(nearBoat);
            return;
          }
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

  findNearestBoardableVehicle(maxDist = 8.5, boatsOnly = false) {
    let best = null;
    let bestDist = maxDist;
    const candidates = this.getAllShootableVehicles();
    for (const v of candidates) {
      if (!v || v.exploded) continue;
      if (boatsOnly && !v.spec?.isBoat) continue;
      const dist = Math.hypot(v.pos.x - this.player.pos.x, v.pos.z - this.player.pos.z);
      const dy = Math.abs((v.pos.y ?? 0) - (this.player.pos.y ?? 0));
      const limit = v.spec?.isBoat ? Math.max(maxDist, 10.5) : maxDist;
      if (dist < bestDist && dist < limit && dy < 3.2) {
        bestDist = dist;
        best = v;
      }
    }
    return best;
  }

  enterVehicle(veh) {
    if (!veh || veh.exploded) return false;
    if (this.playerVehicle && this.playerVehicle !== veh) {
      this.playerVehicle.playerDriven = false;
    }
    // Ensure stolen traffic/parked/police vehicle has full driver physics fields initialized!
    veh.vel = veh.vel ?? new THREE.Vector3();
    veh.speed = veh.speed ?? 0;
    veh.vFwd = veh.vFwd ?? 0;
    veh.vy = veh.vy ?? 0;
    veh.grounded = true;
    veh.nitro = veh.nitro ?? 100;
    veh.boosting = false;
    veh.drifting = false;
    veh.headlightsOn = veh.headlightsOn ?? true;
    veh.sirenActive = veh.sirenActive ?? false;
    veh.engineStalled = veh.engineStalled ?? false;
    veh.turboLevel = veh.turboLevel ?? 1;
    veh.playerDriven = true;

    this.playerVehicle = veh;
    this.state.inVehicle = true;
    this.state.swimming = false;
    this.state.diving = false;
    this.state.reloadTimer = 0;
    this.state.reloadingWeaponId = null;
    this.player.swimming = false;
    this.player.diving = false;
    this.player.submergeDepth = 0;
    this.player.setVisible(false);
    this.camYaw = veh.yaw;
    this.audio.playUiBeep(620);

    // Jacking a police cruiser adds gradual heat; carjacking traffic spawns a reactive driver (70% timid / 30% brave!)
    if (veh.isTraffic && !veh.spec?.isPolice) {
      this.traffic.spawnCarjackedDriver(veh.pos, veh.yaw, this.player.pos);
    }
    if (veh.spec?.isPolice) {
      this.police.addHeat(this.state, 85);
      this.state.toast = { text: 'CDPD CRUISER · [H] SIREN · [T] VIGILANTE', timer: 3.0 };
    } else if (veh.spec?.isTaxi) {
      this.state.toast = { text: 'CALA CAB · PRESS [T] FOR TAXI FARES', timer: 2.8 };
    } else if (veh.spec?.isBoat) {
      this.state.toast = { text: 'ESMERALDA SPEEDBOAT · SAIL BAY & RÍO DORADO', timer: 2.8 };
    }
    return true;
  }

  _placePlayerSafelyBesideVehicle(veh) {
    const rtX = Math.cos(veh.yaw);
    const rtZ = -Math.sin(veh.yaw);
    const fwdX = Math.sin(veh.yaw);
    const fwdZ = Math.cos(veh.yaw);
    const onBridge = this.collisionWorld ? this.collisionWorld.isOnBridgeDeck(veh.pos.x, veh.pos.z, veh.pos.y) : false;

    const offsets = [
      [-rtX * 2.4, -rtZ * 2.4],
      [rtX * 2.4, rtZ * 2.4],
      [-fwdX * 3.2, -fwdZ * 3.2],
      [fwdX * 3.2, fwdZ * 3.2],
    ];

    let chosen = null;
    for (const [ox, oz] of offsets) {
      const tx = veh.pos.x + ox;
      const tz = veh.pos.z + oz;
      if (onBridge && this.collisionWorld) {
        // Stay cleanly on the bridge deck instead of stepping off into the water!
        if (this.collisionWorld.getBridgeDeckY(tx, tz) < 0.2) continue;
      }
      const ty = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(tx, tz, veh.pos.y) : 0;
      const probe = { x: tx, y: ty, z: tz };
      const hit = this.collisionWorld ? this.collisionWorld.resolveCircle(probe, null, 0.62) : { hit: false };
      if (!hit.hit) {
        chosen = probe;
        break;
      }
    }

    if (!chosen) {
      const ty = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(veh.pos.x, veh.pos.z, veh.pos.y) : 0;
      chosen = { x: veh.pos.x - rtX * 2.2, y: ty, z: veh.pos.z - rtZ * 2.2 };
      if (this.collisionWorld) this.collisionWorld.resolveCircle(chosen, null, 0.62);
    }

    // Exiting a boat or flooded car in water lands cleanly at water level y = 0 in swimming mode!
    const wDepth = this.collisionWorld ? this.collisionWorld.getWaterDepth(chosen.x, chosen.z, chosen.y) : 0;
    this.player.pos.set(chosen.x, wDepth >= 0.9 ? 0 : chosen.y, chosen.z);
    this.player.vel.set(0, 0, 0);
    this.player.vy = 0;
    this.player.grounded = true;
    this.player.swimming = wDepth >= 0.92;
    this.state.swimming = this.player.swimming;
    this.player.yaw = veh.yaw;
    this.player.mesh.position.copy(this.player.pos);
    this.player.mesh.rotation.set(0, this.player.yaw, 0);
    this.player.setVisible(true);
  }

  toggleVehicle() {
    if (this.state.inVehicle) {
      const veh = this.playerVehicle;
      this.state.inVehicle = false;
      if (veh) {
        veh.boosting = false;
        veh.drifting = false;
        if (veh.mesh?.userData?.nitroFlames) veh.mesh.userData.nitroFlames.visible = false;
        if (veh !== this.personalVehicle) veh.playerDriven = false;
        this._placePlayerSafelyBesideVehicle(veh);
      }
    } else {
      const near = this.findNearestBoardableVehicle(8.8, false);
      if (near) {
        this.enterVehicle(near);
      }
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

  // Complete pursuit, police, helicopter, projectile, audio & NPC aggro cleanup on WASTED / BUSTED AND on respawn!
  clearAllPursuitAndCombatState() {
    this.state.wantedLevel = 0;
    this.state.wantedHeat = 0;
    this.state.bustProgress = 0;
    this.state.inSight = false;
    this.state.hiddenFromPolice = false;
    this.state.airUnitDeployed = false;
    this.state.shotAtPolice = false;
    this.state.signalJamTimer = 0;

    this.police.clearAll(this.state);
    this.heli.dismiss(this.state);
    this.combat.clearEnemies();
    this.combat.clearProjectiles();
    this.traffic.resetAggro();
    this.audio.stopPursuitAudio();
  }

  triggerStatusOverlay(type) {
    if (this.state.statusOverlay) return;
    this.state.statusOverlay = { type, timer: 3.4, total: 3.4 };
    this.state.weaponWheelOpen = false;
    this.input.exitPointerLockSafe();
    this.input.suppressFireFor(400);
    this.activities.stopTaxiJob(this.state);
    this.activities.stopVigilanteJob(this.state);

    // Immediately despawn ALL police/heli/projectiles, stop sirens/rotor audio, and reset NPC/gang aggro!
    this.clearAllPursuitAndCombatState();

    // Cleanly exit & release any vehicle before WASTED / BUSTED animation so controls are NEVER locked!
    if (this.state.inVehicle && this.playerVehicle) {
      const veh = this.playerVehicle;
      this.state.inVehicle = false;
      veh.vel.set(0, 0, 0);
      veh.speed = 0;
      veh.boosting = false;
      veh.sirenActive = false;
      if (veh !== this.personalVehicle) veh.playerDriven = false;
      this._placePlayerSafelyBesideVehicle(veh);
    }
    this.player.startDeathAnim(type);
    this.audio.playWastedBusted(type);
  }

  _completeStatusRespawn(type) {
    this.state.statusOverlay = null;
    this.state.damageFlash = 0;
    this.state.oxygen = this.state.maxOxygen ?? 100;
    this.state.swimming = false;
    this.state.diving = false;
    this.state.submergeDepth = 0;

    // Guarantee 100% peaceful 0-star respawn with zero leftover units, bullets, sirens, or NPC aggro!
    this.clearAllPursuitAndCombatState();

    this.player.resetDeathAnim();
    this.player.knockdownTimer = 0;
    this.player.flinchTimer = 0;
    this.player.meleeSwingTimer = 0;
    if (this.playerVehicle && this.playerVehicle !== this.personalVehicle) {
      this.playerVehicle.playerDriven = false;
      this.playerVehicle.sirenActive = false;
    }
    this.playerVehicle = this.personalVehicle;

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
        <button class="menu-btn primary" data-act="pay-n-spray"><span>PAY 'N' SPRAY (REPAIR & CLEAR HEAT)</span><span>$500</span></button>
        <button class="menu-btn" data-act="open-garage-mod"><span>CUSTOMIZE VEHICLE</span></button>
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
        if (b.dataset.act === 'pay-n-spray') {
          this.activities.triggerPayNSpray(
            this.state, this.playerVehicle, this.police, this.vehiclePhysics, this.saveManager, this.audio
          );
          this.shopEl.classList.add('hidden');
          this.setMode('playing');
          return;
        }
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

      for (const g of this.traffic.gangMembers) {
        if (g.dead || g.downed || g.knockdownTimer > 1.0) continue;
        const dx = g.pos.x - v.pos.x;
        const dz = g.pos.z - v.pos.z;
        if (dx * dx + dz * dz < hitRadius * hitRadius) {
          const len = Math.hypot(dx, dz) || 1;
          const res = this.traffic.applyGangDamage(g, Math.round(v.speed * 3.0), {
            x: (dx / len + fwdX) * 0.6,
            z: (dz / len + fwdZ) * 0.6,
          }, {
            source: 'vehicle', impactSpeed: v.speed, state: this.state, combatSystem: this.combat,
          });
          this.audio.playCarHitHuman(v.speed);
          this.police.addHeat(this.state, res?.killed ? 28 : 16);
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

  _damageExplosive(exp, amount, lifecycleCallbacks) {
    if (!exp || exp.exploded) return;
    exp.hp -= amount;
    if (exp.hp <= 0) {
      this._detonateExplosive(exp, lifecycleCallbacks);
    }
  }

  _detonateExplosive(exp, lifecycleCallbacks) {
    if (!exp || exp.exploded) return;
    exp.exploded = true;
    exp.chainTimer = 0;
    if (exp.bodyMat) {
      exp.bodyMat.color.setHex(0x1b1c20);
      exp.bodyMat.roughness = 0.95;
    }
    exp.mesh.scale.set(1.0, 0.35, 1.0);
    exp.mesh.rotation.z = 0.45;
    this.vehiclePhysics.spawnExplosion(exp.pos);
    this.audio.playExplosion();
    this.camShake = Math.max(this.camShake, 0.95);
    this.traffic.triggerPanicNear(exp.pos, 65, { heavy: true });
    this.police.addHeat(this.state, 45);

    const blastRadius = 9.5;
    // Blast nearby vehicles
    for (const v of this.getAllShootableVehicles()) {
      if (v.exploded) continue;
      const d = v.pos.distanceTo(exp.pos);
      if (d < blastRadius) {
        this.vehiclePhysics.applyDamage(v, Math.round((1 - d / blastRadius) * 120), lifecycleCallbacks);
      }
    }
    // Blast nearby enemies, cops, peds & player
    for (const e of this.combat.enemies) {
      if (e.dead || e.downed) continue;
      if (e.pos.distanceTo(exp.pos) < blastRadius) {
        const dir = e.pos.clone().sub(exp.pos).normalize();
        this.combat.applyEnemyDamage(e, 140, e.pos, this.state, { source: 'vehicle', dir, impactSpeed: 22 });
      }
    }
    for (const o of this.police.footOfficers) {
      if (o.dead || o.downed) continue;
      if (o.pos.distanceTo(exp.pos) < blastRadius) {
        const dir = o.pos.clone().sub(exp.pos).normalize();
        this.police.applyOfficerVehicleImpact(o, dir.x, dir.z, 22, this.state);
      }
    }
    for (const p of this.traffic.peds) {
      if (p.dead || p.downed) continue;
      if (p.mesh.position.distanceTo(exp.pos) < blastRadius) {
        const dir = p.mesh.position.clone().sub(exp.pos).normalize();
        this.traffic.applyPedVehicleImpact(p, dir.x, dir.z, 22);
      }
    }
    if (!this.state.inVehicle) {
      const pd = this.player.pos.distanceTo(exp.pos);
      if (pd < blastRadius) {
        const dir = this.player.pos.clone().sub(exp.pos).normalize();
        this.player.applyVehicleImpact(dir.x, dir.z, 20);
        this.applyPlayerDamage(Math.round((1 - pd / blastRadius) * 85));
      }
    }
    // Chain-reaction ignite neighboring gas pumps & fuel barrels within 7.5m!
    for (const other of this.explosives) {
      if (other.exploded || other === exp || other.chainTimer > 0) continue;
      if (other.pos.distanceTo(exp.pos) < 7.5) {
        other.chainTimer = 0.16 + Math.random() * 0.14;
      }
    }
  }

  _updateExplosivesAndParked(dt, lifecycleCallbacks) {
    // Chain-reaction countdown + vehicle ramming onto gas pumps / fuel barrels!
    const pv = this.state.inVehicle ? this.playerVehicle : null;
    for (const exp of this.explosives) {
      if (exp.exploded) continue;
      if (exp.chainTimer > 0) {
        exp.chainTimer -= dt;
        if (exp.chainTimer <= 0) {
          this._detonateExplosive(exp, lifecycleCallbacks);
        }
        continue;
      }
      if (pv && pv.speed > 9.0) {
        const d = Math.hypot(pv.pos.x - exp.pos.x, pv.pos.z - exp.pos.z);
        if (d < exp.radius + 1.75 && Math.abs((pv.pos.y ?? 0) - (exp.pos.y ?? 0)) < 2.0) {
          this._detonateExplosive(exp, lifecycleCallbacks);
        }
      }
    }

    // Settle knockback & yaw spin on parked vehicles when rammed
    for (const pv2 of this.parkedVehicles) {
      if (pv2.playerDriven) continue;
      if (pv2.knockVel && pv2.knockVel.lengthSq() > 0.02) {
        pv2.knockVel.multiplyScalar(Math.pow(0.08, dt));
        if (this.collisionWorld && !pv2.spec?.isBoat) {
          this.collisionWorld.moveAndSlide(pv2.pos, pv2.knockVel, 1.55, dt, { bounce: 0.22 });
          pv2.pos.y = this.collisionWorld.getSurfaceHeight(pv2.pos.x, pv2.pos.z, pv2.pos.y);
        } else {
          pv2.pos.x += pv2.knockVel.x * dt;
          pv2.pos.z += pv2.knockVel.z * dt;
        }
        pv2.vel.copy(pv2.knockVel);
      }
      if (Math.abs(pv2.yawSpin ?? 0) > 0.01) {
        pv2.yaw += pv2.yawSpin * dt;
        pv2.mesh.rotation.y = pv2.yaw;
        pv2.yawSpin *= Math.pow(0.07, dt);
      }
    }
  }

  _firePlayerWeapon(allVehicles, lifecycleCallbacks, fromVehicle = false) {
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const aimTarget = this.camera.position.clone().addScaledVector(camDir, 120);
    let origin;
    if (fromVehicle) {
      const v = this.playerVehicle;
      const sideX = -Math.cos(v.yaw) * 0.9;
      const sideZ = Math.sin(v.yaw) * 0.9;
      origin = new THREE.Vector3(v.pos.x + sideX, (v.pos.y ?? 0) + 1.25, v.pos.z + sideZ);
    } else {
      origin = this.player.getMuzzleWorldPos();
    }
    const aimDir = aimTarget.sub(origin).normalize();
    const fired = this.combat.tryPlayerFire(this.state, this.player, aimDir, this.audio, null, (kind) => {
      if (kind === 'gunshot') {
        this.police.addHeat(this.state, 12);
        this.traffic.triggerPanicNear(this.getFocusPos(), 50, { heavy: true });
      }
    }, {
      fromVehicle,
      origin: fromVehicle ? origin : null,
      aimRayOrigin: this.camera.position.clone(),
      aimRayDir: camDir.clone(),
      ignoreVehicle: fromVehicle ? this.playerVehicle : null,
      footOfficers: this.police.footOfficers,
      gangMembers: this.traffic.gangMembers,
      peds: this.traffic.peds,
      vehicles: allVehicles,
      explosives: this.explosives,
      heliUnit: this.heli,
      onRecoil: (kick) => {
        // Expanded vertical pitch range: up to +70 deg (-1.22 rad) skyward, down to -45 deg (+0.785 rad)
        this.camPitch = Math.max(-1.22, Math.min(0.785, this.camPitch - kick));
        this.camShake = Math.min(0.45, this.camShake + kick * 2.2);
      },
      onPedShot: (ped, dmg, dir, isMelee) => {
        const res = this.traffic.applyPedShot(ped, dmg, dir, { isMelee });
        this.police.addHeat(this.state, res?.killed ? 44 : (isMelee ? 16 : 24));
      },
      onGangShot: (gm, dmg, dir, isMelee) => {
        const res = this.traffic.applyGangDamage(gm, dmg, dir, {
          source: isMelee ? 'melee' : 'weapon',
          attacker: 'player',
          state: this.state,
          combatSystem: this.combat,
        });
        this.police.addHeat(this.state, res?.killed ? 28 : 14);
      },
      onPoliceShot: (_off, killed, isFirearm) => {
        this.police.addHeat(this.state, killed ? 65 : 40, { shotAtPolice: Boolean(isFirearm) });
      },
      onHeliShot: (hitPt, dmg) => {
        const res = this.heli.applyDamage(dmg, hitPt, this.state, this.combat, this.vehiclePhysics, this.audio);
        this.police.addHeat(this.state, res.killed ? 95 : 30, { shotAtPolice: true });
      },
      onVehicleShot: (veh, dmg, hitPt, hitNormal) => {
        this.vehiclePhysics.spawnCollisionSparks(hitPt, hitNormal.x, hitNormal.z, 8);
        this.vehiclePhysics.applyDamage(veh, dmg * 0.85, lifecycleCallbacks);
        this.traffic.triggerPanicNear(hitPt, 40, { heavy: true });
        const isPol = Boolean(veh.isPoliceVehicle || veh.spec?.isPolice);
        this.police.addHeat(this.state, isPol ? 30 : 14, { shotAtPolice: isPol });
      },
      onExplosiveShot: (exp, dmg) => {
        this._damageExplosive(exp, dmg, lifecycleCallbacks);
      },
    });
    if (fired && fromVehicle && this.driveByFlash) {
      this.driveByFlash.position.copy(origin).addScaledVector(aimDir, 0.55);
      this.driveByFlash.visible = true;
      this.driveByFlashTimer = 0.075;
    }
    return fired;
  }

  _handleVehicleExplosion(v) {
    this.traffic.triggerPanicNear(v.pos, 60, { heavy: true });
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
    for (const g of this.traffic.gangMembers) {
      if (g.downed) continue;
      if (g.pos.distanceTo(v.pos) < blastRadius) {
        const dir = g.pos.clone().sub(v.pos).normalize();
        this.traffic.applyGangDamage(g, 140, dir, { source: 'vehicle', impactSpeed: 22, state: this.state, combatSystem: this.combat });
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

      // Full Mouse Look (both On Foot and While Driving! Upward +70 deg [-1.22 rad] to Downward -45 deg [+0.785 rad])
      if (!this.state.weaponWheelOpen && !this.state.statusOverlay) {
        const dx = this.input.lookDeltaX;
        const dy = this.input.lookDeltaY;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          this.camYaw = wrapAngle(this.camYaw - dx * 0.0032);
          this.camPitch = Math.max(-1.22, Math.min(0.785, this.camPitch + dy * 0.0026));
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
        onEngineStalled: () => {
          this.state.toast = { text: 'ENGINE FLOODED — PRESS [F] TO SWIM', timer: 3.0 };
        },
        onIgnite: (veh) => {
          this.traffic.triggerPanicNear(veh?.pos ?? this.playerVehicle.pos, 45);
          if (veh?.isPoliceVehicle) this.police.deployOfficersFromCruiser(veh);
        },
        onExplode: (veh) => {
          if (veh?.isPoliceVehicle || veh?.spec?.isPolice) this.police.addHeat(this.state, 95);
          this._handleVehicleExplosion(veh);
        },
        onVehicleCollide: (a, b, impactSpeed, contactPt) => {
          const involvesPlayer = this.state.inVehicle && (a === this.playerVehicle || b === this.playerVehicle);
          const other = a === this.playerVehicle ? b : a;
          if (involvesPlayer) {
            this.camShake = Math.max(this.camShake, Math.min(0.75, impactSpeed / 26));
            if (impactSpeed > 12) this.traffic.triggerPanicNear(contactPt, 35);
            if (other?.isPoliceVehicle || other?.spec?.isPolice) {
              this.police.addHeat(this.state, Math.min(60, Math.round(impactSpeed * 2.2)));
            } else if (impactSpeed > 18) {
              this.police.addHeat(this.state, 16);
            }
          }
        },
      };

      if (this.driveByFlashTimer > 0) {
        this.driveByFlashTimer -= rawDt;
        if (this.driveByFlashTimer <= 0 && this.driveByFlash) this.driveByFlash.visible = false;
      }

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
          if (this.playerVehicle.sirenActive && this.playerVehicle.spec?.isPolice) {
            updatePoliceLightbar(this.playerVehicle.mesh, this.elapsed, 0);
          }
          const mph = Math.round(this.playerVehicle.speed * 2.237);
          if (mph > this.state.careerStats.topSpeedMph) this.state.careerStats.topSpeedMph = mph;
          this.state.careerStats.distanceKm += (this.playerVehicle.speed * simDt) / 1000;

          // Classic GTA Drive-By Shooting from Vehicles (Pistol or Vector SMG!)
          if (this.input.canFireNow() && !this.state.weaponWheelOpen) {
            this._firePlayerWeapon(allVehicles, lifecycleCallbacks, true);
          }
        } else {
          this.player.updateOnFoot(this.input, simDt, this.elapsed, this.camYaw, this.state, this.audio, (drownDmg) => {
            this.applyPlayerDamage(drownDmg, { silent: true });
          });
          // Safe Pointer-Lock Click Guard: ONLY fire when input.canFireNow() is true!
          if (this.input.canFireNow() && !this.state.weaponWheelOpen && !this.activities.fishingSession && !this.activities.roofSession) {
            this._firePlayerWeapon(allVehicles, lifecycleCallbacks, false);
          }
        }
      }

      // Solid Vehicle-vs-Vehicle Collisions, Explosives & Vehicle-vs-Human Collisions!
      this.vehiclePhysics.resolveVehicleCollisions(allVehicles, simDt, lifecycleCallbacks);
      this._updateExplosivesAndParked(simDt, lifecycleCallbacks);
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
      const sirenSource = (this.state.inVehicle && this.playerVehicle?.sirenActive && this.playerVehicle.spec?.isPolice)
        ? this.playerVehicle
        : null;

      this.traffic.update(simDt, this.elapsed, pos, this.state.wantedLevel > 0, sirenSource, {
        statusOverlay: Boolean(this.state.statusOverlay),
        onPlayerHit: (dmg) => this.applyPlayerDamage(dmg),
        combatSystem: this.combat,
        audio: this.audio,
        vehicles: allVehicles,
        policeUnits: this.police.units,
        footOfficers: this.police.footOfficers,
        onGangFired: (gm) => this.police.notifyGangGunfire(gm, this.state),
        onOfficerHitByGang: (off, dmg, dir) => this.police.applyOfficerDamage(off, dmg, dir, null),
      });

      if (!this.state.statusOverlay) {
        this.combat.update(simDt, this.elapsed, this.state, pos, (dmg) => this.applyPlayerDamage(dmg), this.audio, allVehicles);
        this.heli.update(simDt, this.elapsed, this.state, pos, this.combat, (dmg) => this.applyPlayerDamage(dmg), this.audio, this.vehiclePhysics);

        // Compute exact GTA resistance state for authentic BUSTED break-free rules
        const moveAxes = this.input.getMoveAxes();
        const pressingMove = moveAxes.forward !== 0 || moveAxes.right !== 0;
        const pressingSprint = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
        const pressingThrottle = moveAxes.forward !== 0;
        const playerResisting = this.state.inVehicle
          ? (pressingThrottle || this.input.mouseDown)
          : (pressingMove || pressingSprint || this.input.mouseDown || this.player.meleeSwingTimer > 0);

        const playerSpd = this.state.inVehicle ? this.playerVehicle.speed : Math.hypot(this.player.vel.x, this.player.vel.z);
        const policeRes = this.police.update(
          simDt, this.elapsed, this.state, pos, yaw, this.heli, this.combat, playerSpd,
          (dmg) => this.applyPlayerDamage(dmg), this.audio, allVehicles, {
            playerResisting,
            gangMembers: this.traffic.gangMembers,
            onGangShotByPolice: (gm, dmg, dir, off) => this.traffic.applyGangDamage(gm, dmg, dir, {
              attacker: 'police',
              policeOfficer: off,
              combatSystem: this.combat,
            }),
            onPoliceGunfireNear: (polPos, off) => this.traffic.alertGangsToPoliceNear(polPos, off, 18),
          }
        );
        if (policeRes.bustedReady && !this.state.statusOverlay) {
          this.triggerStatusOverlay('BUSTED');
        }
      }

      this.missions.update(simDt, this.elapsed, this.state, pos, this.combat, this.police, this.audio);
      this.activities.update(simDt, this.elapsed, this.state, pos, this.worldAnim, this.audio);
      this.activities.updateSideJobs(simDt, this.elapsed, this.state, pos, this.playerVehicle, this.combat, this.audio);

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

      this.audio.update(
        simDt, this.elapsed, this.state, this.playerVehicle.speed, this.playerVehicle.drifting,
        Boolean(sirenSource), Boolean(this.heli.active || this.heli.crashing)
      );
      this._updateHud(forceDom);
    } else if (this.state.mode === 'title' && !this.shotFrozen) {
      this.traffic.update(rawDt, this.elapsed, new THREE.Vector3(-120, 0, 200), false);
    }

    this.sky.applyTimeOfDay(this.state.timeOfDay, pos, this.shotSunDir ?? null);
    this.sky.updateAmbient(simDt, this.elapsed, this.worldAnim, pos);
    this._updateCamera(rawDt);
    this.camera.updateMatrixWorld(true);

    // Check if crosshair is aimed at HALCÓN-1 helicopter to illuminate its overhead ! HOSTILE + HP bar
    if (this.state.mode === 'playing' && !this.state.statusOverlay && this.heli.isActiveHostile()) {
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);
      if (this.heli.testRayHit(this.camera.position, lookDir, 155)) {
        this.heli.targetedTimer = 1.6;
      }
    }

    // Combine syndicate enemies + hostile on-foot police + attacking brave civilians + provoked gangs + targeted/damaged HALCÓN-1!
    const attackingPeds = this.traffic.peds.filter((p) => p.attacking && !p.dead && !p.downed);
    const attackingGangs = this.traffic.gangMembers.filter((g) => g.attacking && !g.dead && !g.downed);
    const allHostiles = this.combat.enemies
      .concat(this.police.footOfficers)
      .concat(attackingPeds)
      .concat(attackingGangs);
    if (this.heli.isActiveHostile() && (this.heli.targetedTimer > 0 || this.heli.lastHitTimer > 0 || this.heli.hp < this.heli.maxHp)) {
      allHostiles.push({
        pos: this.heli.mesh.position,
        yOffset: 3.8,
        hp: this.heli.hp,
        maxHp: this.heli.maxHp,
        attacking: true,
        dead: false,
        downed: false,
        label: 'HALCÓN-1',
      });
    }
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
    const nearbyBoardable = !this.state.inVehicle ? this.findNearestBoardableVehicle(8.8, false) : null;
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
      promptText: this.activities.getPromptText(this.state, this.playerVehicle, nearbyBoardable),
      activities: this.activities,
      wheelShotRight: this.wheelShotRight,
      shotFrozen: this.shotFrozen,
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
    const cp = Math.max(-1.22, Math.min(0.785, this.camPitch + this.camFlinch * 0.35));
    const lookElev = -cp; // Positive = looking UP into the sky (up to +70 deg / +1.22 rad), Negative = looking down (to -45 deg)
    const cosE = Math.cos(lookElev);
    const sinE = Math.sin(lookElev);
    const fwdX = Math.sin(cy);
    const fwdZ = Math.cos(cy);

    let desiredPos;
    let desiredLook;
    if (this.state.inVehicle) {
      const lookBack = this.input.isDown('KeyB');
      const camMode = this.state.settings.cameraMode;
      const orbitDist = camMode === 'close' ? 8.2 : camMode === 'far' ? 15.2 : 11.4;
      const camElev = camMode === 'close' ? 2.0 : camMode === 'far' ? 3.2 : 2.4;
      const effYaw = lookBack ? wrapAngle(this.playerVehicle.yaw + Math.PI) : cy;
      const eFwdX = Math.sin(effYaw);
      const eFwdZ = Math.cos(effYaw);
      const effDist = lookElev > 0 ? THREE.MathUtils.lerp(orbitDist, 6.2, Math.min(1, lookElev / 1.22)) : orbitDist;
      desiredPos = new THREE.Vector3(
        pos.x - eFwdX * effDist * cosE,
        Math.max(pos.y + 0.95, pos.y + camElev - effDist * sinE),
        pos.z - eFwdZ * effDist * cosE
      );
      const lookDir = new THREE.Vector3(eFwdX * cosE, sinE, eFwdZ * cosE);
      desiredLook = lookElev > 0.12
        ? desiredPos.clone().addScaledVector(lookDir, 60)
        : new THREE.Vector3(pos.x + eFwdX * 14, pos.y + 1.75 + sinE * 4.5, pos.z + eFwdZ * 14);
      if (lookBack) {
        this.camPos.copy(desiredPos);
        this.camLook.copy(desiredLook);
      }
    } else {
      // Over-the-shoulder GTA mouse-look camera supporting full +70 deg sky aim to shoot down HALCÓN-1!
      const rtX = -Math.cos(cy);
      const rtZ = Math.sin(cy);
      const diveOffset = this.state.diving ? -(this.state.submergeDepth ?? 0) * 0.65 : 0;
      const dist = lookElev > 0
        ? THREE.MathUtils.lerp(4.6, 2.35, Math.min(1, lookElev / 1.22))
        : 4.6;
      const shoulderPivot = new THREE.Vector3(
        pos.x + rtX * 1.05,
        pos.y + 1.65 + diveOffset,
        pos.z + rtZ * 1.05
      );
      const lookDir = new THREE.Vector3(fwdX * cosE, sinE, fwdZ * cosE);
      desiredPos = new THREE.Vector3(
        shoulderPivot.x - lookDir.x * dist,
        Math.max(this.state.diving ? -1.4 : pos.y + 0.58, shoulderPivot.y - lookDir.y * dist),
        shoulderPivot.z - lookDir.z * dist
      );
      desiredLook = desiredPos.clone().addScaledVector(lookDir, 65);
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
