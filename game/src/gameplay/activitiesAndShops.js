// Street races, Golden Shell collectibles, 8 city properties, plus 5 interactive systems: Car Modding, Character Wardrobe, Fishing, Gardening, and Barrio Viejo Roof Tile Repair.

import * as THREE from '../../vendor/three.module.min.js';
import { STREET_RACES, GOLDEN_SHELLS, FISHING_SPOTS, GARDEN_SITES, ROOF_REPAIR_SITES, PUBLIC_FACILITIES } from '../world/cityPlan.js';
import { WEAPONS, PROPERTIES, FISH_SPECIES, GARDEN_CROPS, CAR_PAINTS } from '../core/config.js';
import { getEmpireIncomePerHour } from '../core/gameState.js';
import { createVehicleMesh, applyVehicleMods } from '../entities/vehicleFactory.js';
import { buildCharacterMesh } from '../entities/playerController.js';

const TAXI_DESTINATIONS = [
  { name: 'Hotel Solsticio', x: -120, z: 194 },
  { name: 'General Hospital', x: -102, z: -96 },
  { name: 'Parque Dorado', x: -90, z: 112 },
  { name: 'Mirador Plaza', x: 18, z: -12 },
  { name: 'Mercado Nocturno', x: -310, z: -4 },
  { name: 'Esmeralda Marina', x: 245, z: 194 },
  { name: "Rafa's Garage", x: 150, z: -206 },
  { name: 'CDPD Precinct', x: 108, z: -96 },
];

const VIGILANTE_SPAWNS = [
  { name: 'Puerto Cenit Smuggler', x: 268, z: -22 },
  { name: 'Mercado Syndicate Hitman', x: -292, z: -6 },
  { name: 'Paseo Street Hijacker', x: -225, z: 194 },
  { name: 'Torre Vault Runner', x: 18, z: -168 },
  { name: 'Barrio Viejo Fugitive', x: 204, z: -194 },
];

export class ActivitiesAndShops {
  constructor(scene) {
    this.scene = scene;
    this.activeRace = null;
    this.nearbyShop = null;
    this.nearbyRace = null;
    this.nearbyFishing = null;
    this.nearbyGarden = null;
    this.nearbyRoof = null;
    this.spawnedPerkCars = new Map();

    // Active mini-game & GTA side-job states
    this.fishingSession = null;
    this.roofSession = null;
    this.taxiJob = null;      // { phase: 'pickup'|'dropoff', target, destName, timer, faresDone, farePay, passengerMesh }
    this.vigilanteJob = null; // { level, targetEnemy, targetName, timer, bounty }
    this.lastGardenSyncKey = '';
    this.lastRoofSyncKey = '';

    this.cpRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.45, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8 })
    );
    this.cpRing.position.y = 5.5;
    this.cpRing.visible = false;
    this.scene.add(this.cpRing);

    // Side-job 3D beacon (Taxi teal / Vigilante crimson)
    this.jobBeacon = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.6, 28),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.jobBeacon.rotation.x = -Math.PI / 2;
    this.jobBeacon.position.y = 0.22;
    this.jobBeacon.visible = false;
    this.scene.add(this.jobBeacon);
  }

  syncOwnedPropertyVehicles(state) {
    for (const prop of PROPERTIES) {
      if (!prop.spawnVehicle) continue;
      const owned = state.ownedProperties?.has(prop.id);
      if (owned && !this.spawnedPerkCars.has(prop.id)) {
        const mesh = createVehicleMesh(prop.spawnVehicle);
        mesh.position.set(prop.x + 8.5, 0, prop.z + 5.5);
        mesh.rotation.y = Math.PI / 2;
        this.scene.add(mesh);
        this.spawnedPerkCars.set(prop.id, mesh);
      } else if (!owned && this.spawnedPerkCars.has(prop.id)) {
        this.scene.remove(this.spawnedPerkCars.get(prop.id));
        this.spawnedPerkCars.delete(prop.id);
      }
    }
  }

  syncGardenMeshes(state, worldAnim) {
    if (!worldAnim?.gardenBeds || !state.gardenPlots) return;
    const key = state.gardenPlots.map((p) => `${p.id}:${p.cropId ?? '-'}:${p.stage}`).join('|');
    if (key === this.lastGardenSyncKey) return;
    this.lastGardenSyncKey = key;

    for (const site of GARDEN_SITES) {
      const roots = worldAnim.gardenBeds[site.id];
      if (!roots) continue;
      const plots = state.gardenPlots.filter((p) => p.siteId === site.id);
      plots.forEach((plot, idx) => {
        const root = roots[idx];
        if (!root) return;
        while (root.children.length > 0) root.remove(root.children[0]);
        if (!plot.cropId || plot.stage <= 0) return;

        const crop = GARDEN_CROPS.find((c) => c.id === plot.cropId) ?? GARDEN_CROPS[0];
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d8a4e, roughness: 0.75 });
        const bloomMat = new THREE.MeshStandardMaterial({ color: crop.color, roughness: 0.55 });
        const scale = plot.stage === 1 ? 0.42 : plot.stage === 2 ? 0.78 : 1.18;

        for (let k = -1; k <= 1; k++) {
          const px = k * 1.05;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 0.72 * scale, 6), stemMat);
          stalk.position.set(px, 0.36 * scale, 0);
          root.add(stalk);

          if (plot.stage >= 2) {
            for (const ang of [0, 2.1, 4.2]) {
              const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.55 * scale, 4), stemMat);
              leaf.position.set(px + Math.cos(ang) * 0.22 * scale, 0.48 * scale, Math.sin(ang) * 0.22 * scale);
              leaf.rotation.z = Math.cos(ang) * 0.85;
              leaf.rotation.x = Math.sin(ang) * 0.85;
              root.add(leaf);
            }
          }
          if (plot.stage >= 3) {
            const bloom = new THREE.Mesh(
              crop.id === 'palms' ? new THREE.ConeGeometry(0.45, 0.65, 6) : new THREE.SphereGeometry(0.24, 8, 8),
              bloomMat
            );
            bloom.position.set(px, 0.85 * scale, 0);
            root.add(bloom);
          }
        }
      });
    }
  }

  syncRoofMeshes(state, worldAnim) {
    if (!worldAnim?.roofSites || !state.roofProgress) return;
    const key = Object.entries(state.roofProgress).map(([k, v]) => `${k}:${v}`).join('|');
    if (key === this.lastRoofSyncKey) return;
    this.lastRoofSyncKey = key;

    for (const site of ROOF_REPAIR_SITES) {
      const slots = worldAnim.roofSites[site.id];
      if (!slots) continue;
      const count = state.roofProgress[site.id] ?? 0;
      slots.forEach((slot, idx) => {
        slot.mesh.material = idx < count ? slot.repairedMat : slot.damagedMat;
      });
    }
  }

  // (Mid-street stunt ramps removed for realistic city streets)
  onStuntLand() {}

  update(dt, elapsed, state, playerPos, worldAnim, audio) {
    // 0. Passive Empire Income
    const incomeHr = getEmpireIncomePerHour(state);
    if (incomeHr > 0) {
      state.vaultBalance = Math.min(250000, (state.vaultBalance ?? 0) + (incomeHr / 60) * dt);
    }
    this.syncOwnedPropertyVehicles(state);

    // Grow planted garden plots naturally over time
    if (state.gardenPlots) {
      for (const plot of state.gardenPlots) {
        if (plot.cropId && plot.stage < 3) {
          const crop = GARDEN_CROPS.find((c) => c.id === plot.cropId);
          const rate = 1 / (crop?.growSec ?? 22);
          plot.progress = Math.min(1, (plot.progress ?? 0) + dt * rate);
          if (plot.progress >= 1) plot.stage = 3;
          else if (plot.progress >= 0.55) plot.stage = 2;
          else plot.stage = 1;
        }
      }
    }
    this.syncGardenMeshes(state, worldAnim);
    this.syncRoofMeshes(state, worldAnim);

    // Update active Fishing Mini-game
    if (this.fishingSession) {
      const fs = this.fishingSession;
      if (fs.phase === 'wait') {
        fs.timer -= dt;
        if (fs.timer <= 0) {
          fs.phase = 'reel';
          fs.cursor = 0.15;
          fs.dir = 1;
          if (audio) audio.playUiBeep(860);
        }
      } else if (fs.phase === 'reel') {
        const spd = 1.05 * fs.targetFish.difficulty;
        fs.cursor += fs.dir * spd * dt;
        if (fs.cursor >= 1) { fs.cursor = 1; fs.dir = -1; }
        if (fs.cursor <= 0) { fs.cursor = 0; fs.dir = 1; }
      }
    }

    // Update active Roof Tile Repair Mini-game
    if (this.roofSession) {
      const rs = this.roofSession;
      rs.cursor += rs.dir * 1.15 * dt;
      if (rs.cursor >= 1) { rs.cursor = 1; rs.dir = -1; }
      if (rs.cursor <= 0) { rs.cursor = 0; rs.dir = 1; }
    }

    // 1. Collect Golden Shells
    for (let i = 0; i < GOLDEN_SHELLS.length; i++) {
      const sh = GOLDEN_SHELLS[i];
      const mesh = worldAnim.shells[i];
      if (!mesh) continue;
      if (state.collectedShells.has(sh.id)) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      if (Math.hypot(playerPos.x - sh.x, playerPos.z - sh.z) < 5.0) {
        state.collectedShells.add(sh.id);
        mesh.visible = false;
        state.cash += 1500;
        state.careerStats.cashEarned += 1500;
        state.rp += 120;
        state.toast = { text: `GOLDEN SHELL (${state.collectedShells.size}/20) · +$1,500`, timer: 3.2 };
        if (audio) audio.playUiBeep(920);
      }
    }

    // 2. Nearby Property, Race, Fishing, Gardening, or Roof Repair Trigger
    this.nearbyShop = null;
    for (const prop of PROPERTIES) {
      if (Math.hypot(playerPos.x - prop.x, playerPos.z - prop.z) < prop.radius) {
        this.nearbyShop = prop;
        break;
      }
    }

    this.nearbyFishing = null;
    for (const f of FISHING_SPOTS) {
      if (Math.hypot(playerPos.x - f.x, playerPos.z - f.z) < 11) {
        this.nearbyFishing = f;
        break;
      }
    }

    this.nearbyGarden = null;
    for (const g of GARDEN_SITES) {
      if (Math.hypot(playerPos.x - g.x, playerPos.z - g.z) < 12) {
        this.nearbyGarden = g;
        break;
      }
    }

    this.nearbyRoof = null;
    for (const r of ROOF_REPAIR_SITES) {
      if (Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < 11) {
        this.nearbyRoof = r;
        break;
      }
    }

    this.nearbyRace = null;
    if (!this.activeRace) {
      for (const r of STREET_RACES) {
        if (Math.hypot(playerPos.x - r.start.x, playerPos.z - r.start.z) < 16) {
          this.nearbyRace = r;
          break;
        }
      }
      this.cpRing.visible = false;
    } else {
      const cp = this.activeRace.race.checkpoints[this.activeRace.cpIdx];
      this.cpRing.visible = true;
      this.cpRing.position.set(cp.x, 5.2, cp.z);
      this.cpRing.rotation.y = elapsed * 1.4;
      if (Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z) < 15) {
        this.activeRace.cpIdx += 1;
        if (audio) audio.playUiBeep(720);
        if (this.activeRace.cpIdx >= this.activeRace.race.checkpoints.length) {
          const r = this.activeRace.race;
          state.completedRaces.add(r.id);
          state.cash += r.payout;
          state.careerStats.cashEarned += r.payout;
          state.rp += r.rp;
          state.toast = { text: `RACE WON: ${r.name} · +$${r.payout.toLocaleString()}`, timer: 4.2 };
          this.activeRace = null;
          this.cpRing.visible = false;
        }
      }
    }
  }

  // Classic Pay 'n' Spray at Rafa's Garage: repairs vehicle to 100%, applies fresh paint color, clears ALL wanted stars!
  triggerPayNSpray(state, playerVehicle, police, vehiclePhysics, saveManager, audio) {
    if (!playerVehicle) return false;
    const cost = state.cash >= 500 ? 500 : 0;
    state.cash = Math.max(0, state.cash - cost);
    const curPaint = state.carMods?.paint;
    const otherPaints = CAR_PAINTS.filter((p) => p.hex !== curPaint);
    const chosen = otherPaints[Math.floor(Math.random() * otherPaints.length)] ?? CAR_PAINTS[0];
    if (playerVehicle.typeKey === 'apex_gt' && state.carMods) {
      state.carMods.paint = chosen.hex;
    }
    if (vehiclePhysics) {
      vehiclePhysics.repairVehicle(playerVehicle, chosen.hex);
    } else {
      playerVehicle.hp = playerVehicle.maxHp;
      playerVehicle.condition = 100;
      playerVehicle.nitro = 100;
      playerVehicle.burning = false;
      playerVehicle.exploded = false;
      if (playerVehicle.mesh?.userData?.paintMat) {
        playerVehicle.mesh.userData.paintMat.color.set(chosen.hex);
      }
    }
    if (police) police.dropStars(state, 5);
    if (audio && audio.playSprayPaint) audio.playSprayPaint();
    else if (audio) audio.playUiBeep(840);
    if (saveManager) saveManager.saveSlot(state.activeSlot, state);
    state.toast = { text: `PAY 'N' SPRAY (${chosen.name.toUpperCase()}) · HEAT CLEARED`, timer: 3.4 };
    return true;
  }

  // Classic GTA Taxi Fares side-job [T] while driving a Cala Cab!
  toggleTaxiJob(state, playerPos, playerVehicle, audio) {
    if (this.taxiJob) {
      this.stopTaxiJob(state, 'TAXI SHIFT ENDED');
      return false;
    }
    if (!state.inVehicle || !playerVehicle?.spec?.isTaxi) {
      state.toast = { text: 'Board a yellow Cala Cab Taxi to run fares', timer: 2.2 };
      return false;
    }
    this.stopVigilanteJob(state, null);
    this.taxiJob = { phase: 'pickup', target: null, destName: '', timer: 65, faresDone: 0, farePay: 0, passengerMesh: null };
    this._spawnNextTaxiPickup(playerPos);
    state.toast = { text: `TAXI FARE · PICK UP PASSENGER (${this.taxiJob.destName})`, timer: 3.2 };
    if (audio) audio.playUiBeep(780);
    return true;
  }

  _spawnNextTaxiPickup(playerPos) {
    if (!this.taxiJob) return;
    if (this.taxiJob.passengerMesh) {
      this.scene.remove(this.taxiJob.passengerMesh);
      this.taxiJob.passengerMesh = null;
    }
    const candidates = TAXI_DESTINATIONS.filter((d) => Math.hypot(d.x - playerPos.x, d.z - playerPos.z) > 45);
    const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? TAXI_DESTINATIONS[0];
    this.taxiJob.phase = 'pickup';
    this.taxiJob.target = { x: pick.x, z: pick.z };
    this.taxiJob.destName = pick.name;
    this.taxiJob.timer = 65;

    const pass = buildCharacterMesh({
      jacket: 0x34e0c8, accent: 0xffffff, pants: 0x1e293b, outfitStyle: 'coastal', withWeapon: false,
    });
    pass.position.set(pick.x, 0, pick.z);
    this.scene.add(pass);
    this.taxiJob.passengerMesh = pass;
  }

  stopTaxiJob(state, toastMsg = null) {
    if (this.taxiJob?.passengerMesh) {
      this.scene.remove(this.taxiJob.passengerMesh);
    }
    this.taxiJob = null;
    if (!this.vigilanteJob) this.jobBeacon.visible = false;
    if (toastMsg && state) state.toast = { text: toastMsg, timer: 2.4 };
  }

  // Classic GTA Vigilante Patrol side-job [T] while driving a stolen CDPD Cruiser!
  toggleVigilanteJob(state, playerPos, playerVehicle, combat, audio) {
    if (this.vigilanteJob) {
      this.stopVigilanteJob(state, 'VIGILANTE PATROL ENDED');
      return false;
    }
    if (!state.inVehicle || !playerVehicle?.spec?.isPolice) {
      state.toast = { text: 'Steal a CDPD Cruiser to launch Vigilante Patrol', timer: 2.2 };
      return false;
    }
    this.stopTaxiJob(state, null);
    this.vigilanteJob = { level: 1, targetEnemy: null, targetName: '', timer: 80, bounty: 1200 };
    this._spawnNextVigilanteTarget(playerPos, combat);
    state.toast = { text: `VIGILANTE LV.1 · INTERCEPT ${this.vigilanteJob.targetName.toUpperCase()}`, timer: 3.4 };
    if (audio) audio.playUiBeep(820);
    return true;
  }

  _spawnNextVigilanteTarget(playerPos, combat) {
    if (!this.vigilanteJob || !combat) return;
    const candidates = VIGILANTE_SPAWNS.filter((s) => Math.hypot(s.x - playerPos.x, s.z - playerPos.z) > 40);
    const sp = candidates[Math.floor(Math.random() * candidates.length)] ?? VIGILANTE_SPAWNS[0];
    const hp = 85 + (this.vigilanteJob.level - 1) * 25;
    const enemy = combat.spawnEnemy(sp.x, sp.z, Math.atan2(playerPos.x - sp.x, playerPos.z - sp.z), false, hp);
    enemy.isVigilanteTarget = true;
    this.vigilanteJob.targetEnemy = enemy;
    this.vigilanteJob.targetName = sp.name;
    this.vigilanteJob.bounty = 1200 * this.vigilanteJob.level;
    this.vigilanteJob.timer = 80;
  }

  stopVigilanteJob(state, toastMsg = null) {
    this.vigilanteJob = null;
    if (!this.taxiJob) this.jobBeacon.visible = false;
    if (toastMsg && state) state.toast = { text: toastMsg, timer: 2.4 };
  }

  getActiveSideJobInfo() {
    if (this.taxiJob) {
      return {
        kind: 'taxi',
        title: `CALA CAB · FARE ${this.taxiJob.faresDone + 1}`,
        label: this.taxiJob.phase === 'pickup'
          ? `Pick up passenger at ${this.taxiJob.destName}`
          : `Drive passenger to ${this.taxiJob.destName}`,
        timer: this.taxiJob.timer,
        target: this.taxiJob.target,
      };
    }
    if (this.vigilanteJob && this.vigilanteJob.targetEnemy) {
      return {
        kind: 'vigilante',
        title: `VIGILANTE · LEVEL ${this.vigilanteJob.level}`,
        label: `Eliminate ${this.vigilanteJob.targetName} ($${this.vigilanteJob.bounty.toLocaleString()})`,
        timer: this.vigilanteJob.timer,
        target: { x: this.vigilanteJob.targetEnemy.pos.x, z: this.vigilanteJob.targetEnemy.pos.z },
      };
    }
    return null;
  }

  updateSideJobs(dt, elapsed, state, playerPos, playerVehicle, combat, audio) {
    if (this.taxiJob) {
      const tj = this.taxiJob;
      tj.timer -= dt;
      if (tj.timer <= 0) {
        this.stopTaxiJob(state, 'TAXI FARE EXPIRED');
      } else if (tj.target) {
        this.jobBeacon.visible = true;
        this.jobBeacon.material.color.setHex(0x34e0c8);
        this.jobBeacon.position.set(tj.target.x, 0.22, tj.target.z);
        this.jobBeacon.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.14);
        if (tj.passengerMesh) {
          tj.passengerMesh.rotation.y = Math.atan2(playerPos.x - tj.target.x, playerPos.z - tj.target.z);
        }
        const dist = Math.hypot(playerPos.x - tj.target.x, playerPos.z - tj.target.z);
        const drivingTaxi = state.inVehicle && playerVehicle?.spec?.isTaxi;
        if (drivingTaxi && dist < 11.5 && (playerVehicle.speed ?? 0) < 12) {
          if (tj.phase === 'pickup') {
            if (tj.passengerMesh) {
              this.scene.remove(tj.passengerMesh);
              tj.passengerMesh = null;
            }
            const drops = TAXI_DESTINATIONS.filter((d) => Math.hypot(d.x - playerPos.x, d.z - playerPos.z) > 80);
            const drop = drops[Math.floor(Math.random() * drops.length)] ?? TAXI_DESTINATIONS[0];
            tj.phase = 'dropoff';
            tj.target = { x: drop.x, z: drop.z };
            tj.destName = drop.name;
            tj.farePay = 650 + Math.round(Math.hypot(drop.x - playerPos.x, drop.z - playerPos.z) * 1.8);
            tj.timer = 75;
            state.toast = { text: `PASSENGER BOARDED · DRIVE TO ${drop.name.toUpperCase()}`, timer: 3.2 };
            if (audio) audio.playUiBeep(860);
          } else {
            const tip = Math.round(Math.max(100, tj.timer * 8));
            const total = tj.farePay + tip;
            tj.faresDone += 1;
            state.cash += total;
            state.careerStats.cashEarned += total;
            state.rp += 95;
            state.toast = { text: `FARE COMPLETE · +$${total.toLocaleString()} ($${tip} TIP)`, timer: 3.4 };
            if (audio && audio.playPickupChime) audio.playPickupChime();
            else if (audio) audio.playUiBeep(960);
            this._spawnNextTaxiPickup(playerPos);
          }
        }
      }
    } else if (this.vigilanteJob) {
      const vj = this.vigilanteJob;
      vj.timer -= dt;
      const e = vj.targetEnemy;
      if (vj.timer <= 0) {
        this.stopVigilanteJob(state, 'SUSPECT ESCAPED');
      } else if (!e || e.dead || e.downed) {
        state.cash += vj.bounty;
        state.careerStats.cashEarned += vj.bounty;
        state.rp += 130 * vj.level;
        state.toast = { text: `SUSPECT NEUTRALIZED · +$${vj.bounty.toLocaleString()} BOUNTY`, timer: 3.6 };
        if (audio && audio.playPickupChime) audio.playPickupChime();
        else if (audio) audio.playUiBeep(980);
        vj.level += 1;
        this._spawnNextVigilanteTarget(playerPos, combat);
      } else {
        this.jobBeacon.visible = true;
        this.jobBeacon.material.color.setHex(0xff3b5c);
        this.jobBeacon.position.set(e.pos.x, (e.pos.y ?? 0) + 0.22, e.pos.z);
        this.jobBeacon.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.16);
      }
    } else {
      this.jobBeacon.visible = false;
    }
  }

  getPromptText(state, playerVehicle = null, nearbyBoardable = null) {
    if (this.fishingSession) return '[SPACE] Reel / Strike · [E] Stop Fishing';
    if (this.roofSession) return '[SPACE] Hammer Tile · [E] Stop Repair';
    if (state?.inVehicle && playerVehicle?.engineStalled) return '[F] Exit Flooded Vehicle to Swim';
    if (this.nearbyShop) {
      if (this.nearbyShop.kind === 'garage' && state?.inVehicle) {
        return "[E] Pay 'n' Spray — Repair, Repaint & Clear Wanted";
      }
      const owned = state?.ownedProperties?.has(this.nearbyShop.id);
      if (!owned && this.nearbyShop.price > 0) {
        return `[E] Buy ${this.nearbyShop.name} ($${this.nearbyShop.price.toLocaleString()})`;
      }
      return `[E] Enter ${this.nearbyShop.name}`;
    }
    if (!state?.inVehicle && nearbyBoardable) {
      return nearbyBoardable.spec?.isBoat
        ? `[F] Pilot ${nearbyBoardable.spec.name}`
        : `[F] Enter ${nearbyBoardable.spec?.name ?? 'Vehicle'}`;
    }
    if (state?.inVehicle && playerVehicle?.spec?.isTaxi && !this.taxiJob) {
      return '[T] Start Taxi Fares';
    }
    if (state?.inVehicle && playerVehicle?.spec?.isPolice && !this.vigilanteJob) {
      return '[T] Vigilante Patrol · [H] Police Siren';
    }
    if (this.nearbyFishing) return `[E] Fish at ${this.nearbyFishing.name}`;
    if (this.nearbyGarden) return `[E] Tend Garden at ${this.nearbyGarden.name}`;
    if (this.nearbyRoof) return `[E] Repair Terracotta Roof (${this.nearbyRoof.name})`;
    if (this.nearbyRace) return `[E] Start Race: ${this.nearbyRace.name}`;
    return '';
  }

  startFishing(spot, state, player) {
    state.inVehicle = false;
    player.pos.set(spot.x, 0.72, spot.z);
    player.yaw = spot.facing ?? 0;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.yaw;
    player.setVisible(true);
    player.setFishingMode(true);
    const fish = FISH_SPECIES[Math.floor(Math.random() * FISH_SPECIES.length)];
    this.fishingSession = {
      spot,
      phase: 'wait',
      timer: 1.6 + Math.random() * 1.4,
      targetFish: fish,
      cursor: 0.5,
      dir: 1,
      zoneStart: 0.34,
      zoneEnd: 0.66,
      progress: 0,
    };
  }

  stopFishing(player) {
    this.fishingSession = null;
    if (player) {
      player.pos.y = 0;
      player.setFishingMode(false);
    }
  }

  triggerFishingReel(state, player, saveManager, audio) {
    const fs = this.fishingSession;
    if (!fs) return false;
    if (fs.phase !== 'reel') {
      state.toast = { text: 'Wait for a bite...', timer: 1.4 };
      return false;
    }
    const inZone = fs.cursor >= fs.zoneStart && fs.cursor <= fs.zoneEnd;
    if (inZone) {
      fs.progress += 1;
      if (audio) audio.playUiBeep(860 + fs.progress * 80);
      if (fs.progress >= 3) {
        const f = fs.targetFish;
        const kg = (f.minKg + Math.random() * (f.maxKg - f.minKg)).toFixed(1);
        state.cash += f.cash;
        state.careerStats.cashEarned += f.cash;
        state.careerStats.fishCaught = (state.careerStats.fishCaught ?? 0) + 1;
        state.rp += f.rp;
        state.fishLog = state.fishLog ?? [];
        state.fishLog.push({ name: f.name, kg: Number(kg), cash: f.cash });
        state.toast = { text: `CAUGHT ${f.name.toUpperCase()} (${kg} kg) · +$${f.cash}`, timer: 3.4 };
        saveManager.saveSlot(state.activeSlot, state);
        // Cast again automatically
        const nextFish = FISH_SPECIES[Math.floor(Math.random() * FISH_SPECIES.length)];
        fs.targetFish = nextFish;
        fs.phase = 'wait';
        fs.timer = 1.5 + Math.random() * 1.3;
        fs.progress = 0;
      }
    } else {
      fs.progress = Math.max(0, fs.progress - 1);
      if (audio) audio.playUiBeep(320);
    }
    return true;
  }

  startRoofRepair(site, state, player) {
    state.inVehicle = false;
    player.pos.set(site.x, 0, site.z + 1.2);
    player.yaw = Math.PI;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.yaw;
    player.setVisible(true);
    const cur = state.roofProgress[site.id] ?? 0;
    if (cur >= site.totalTiles) {
      state.roofProgress[site.id] = 0; // Fresh repair contract
    }
    this.roofSession = {
      site,
      cursor: 0.2,
      dir: 1,
      zoneStart: 0.36,
      zoneEnd: 0.64,
    };
  }

  stopRoofRepair() {
    this.roofSession = null;
  }

  triggerRoofHammer(state, saveManager, audio) {
    const rs = this.roofSession;
    if (!rs) return false;
    const inZone = rs.cursor >= rs.zoneStart && rs.cursor <= rs.zoneEnd;
    if (inZone) {
      const site = rs.site;
      const next = Math.min(site.totalTiles, (state.roofProgress[site.id] ?? 0) + 1);
      state.roofProgress[site.id] = next;
      if (audio) audio.playUiBeep(740 + next * 50);
      if (next >= site.totalTiles) {
        state.cash += site.payout;
        state.careerStats.cashEarned += site.payout;
        state.careerStats.roofsRepaired = (state.careerStats.roofsRepaired ?? 0) + 1;
        state.rp += 160;
        state.districtStanding['barrio-viejo'] = Math.min(100, (state.districtStanding['barrio-viejo'] ?? 79) + 6);
        state.toast = { text: `ROOF RESTORED · +$${site.payout.toLocaleString()} · +6 STANDING`, timer: 3.6 };
        saveManager.saveSlot(state.activeSlot, state);
        this.roofSession = null;
      }
    } else {
      if (audio) audio.playUiBeep(280);
    }
    return true;
  }

  // Garden actions (callable both at 3D bed modal and Career Activities tab)
  plantPlot(plotId, cropId, state, saveManager, audio) {
    const plot = state.gardenPlots?.find((p) => p.id === plotId);
    const crop = GARDEN_CROPS.find((c) => c.id === cropId);
    if (!plot || !crop) return false;
    if (state.cash < crop.seedCost) {
      state.toast = { text: `Need $${crop.seedCost} for ${crop.name} seeds`, timer: 2.2 };
      return false;
    }
    state.cash -= crop.seedCost;
    plot.cropId = crop.id;
    plot.stage = 1;
    plot.progress = 0.12;
    saveManager.saveSlot(state.activeSlot, state);
    if (audio) audio.playUiBeep(700);
    return true;
  }

  waterPlot(plotId, state, saveManager, audio) {
    const plot = state.gardenPlots?.find((p) => p.id === plotId);
    if (!plot || !plot.cropId || plot.stage >= 3) return false;
    plot.progress = Math.min(1, (plot.progress ?? 0) + 0.52);
    plot.stage = plot.progress >= 1 ? 3 : 2;
    saveManager.saveSlot(state.activeSlot, state);
    if (audio) audio.playUiBeep(820);
    return true;
  }

  harvestPlot(plotId, state, saveManager, audio) {
    const plot = state.gardenPlots?.find((p) => p.id === plotId);
    if (!plot || !plot.cropId || plot.stage < 3) return false;
    const crop = GARDEN_CROPS.find((c) => c.id === plot.cropId) ?? GARDEN_CROPS[0];
    state.cash += crop.sellValue;
    state.careerStats.cashEarned += crop.sellValue;
    state.careerStats.cropsHarvested = (state.careerStats.cropsHarvested ?? 0) + 1;
    state.rp += 75;
    const distId = plot.siteId === 'garden-villas' ? 'villas-del-cabo' : 'barrio-viejo';
    state.districtStanding[distId] = Math.min(100, (state.districtStanding[distId] ?? 60) + 3);
    plot.cropId = null;
    plot.stage = 0;
    plot.progress = 0;
    state.toast = { text: `HARVESTED ${crop.name.toUpperCase()} · +$${crop.sellValue}`, timer: 3.0 };
    saveManager.saveSlot(state.activeSlot, state);
    if (audio) audio.playUiBeep(900);
    return true;
  }

  interact(state, playerVehicle, player, saveManager, openShopModal, openGardenModal, audio) {
    if (this.fishingSession) {
      this.stopFishing(player);
      return true;
    }
    if (this.roofSession) {
      this.stopRoofRepair();
      return true;
    }
    if (this.nearbyFishing) {
      this.startFishing(this.nearbyFishing, state, player);
      return true;
    }
    if (this.nearbyRoof) {
      this.startRoofRepair(this.nearbyRoof, state, player);
      return true;
    }
    if (this.nearbyGarden) {
      if (openGardenModal) openGardenModal(this.nearbyGarden);
      return true;
    }
    if (this.nearbyRace && !this.activeRace) {
      this.activeRace = { race: this.nearbyRace, cpIdx: 0, startTime: performance.now() };
      state.toast = { text: `RACE STARTED: ${this.nearbyRace.name}`, timer: 3.0 };
      if (audio) audio.playUiBeep(660);
      return true;
    }
    if (this.nearbyShop) {
      if (openShopModal) openShopModal(this.nearbyShop);
      return true;
    }
    return false;
  }

  applyCarMod(category, value, cost, state, playerVehicle, saveManager, audio) {
    if (cost > 0 && state.cash < cost) {
      state.toast = { text: `Insufficient funds ($${cost.toLocaleString()})`, timer: 2.2 };
      return false;
    }
    if (cost > 0) state.cash -= cost;
    state.carMods[category] = value;
    state.careerStats.carModsInstalled = (state.careerStats.carModsInstalled ?? 0) + 1;
    if (category === 'armorLevel') state.vehicleUpgrades.armorLevel = value;
    if (category === 'turboLevel') state.vehicleUpgrades.nitroLevel = value;
    applyVehicleMods(playerVehicle, state.carMods);
    saveManager.saveSlot(state.activeSlot, state);
    if (audio) audio.playUiBeep(810);
    return true;
  }

  applyAppearanceMod(field, value, state, player, saveManager, audio) {
    state.playerAppearance[field] = value;
    if (player) player.applyAppearance(state.playerAppearance);
    saveManager.saveSlot(state.activeSlot, state);
    if (audio) audio.playUiBeep(760);
    return true;
  }

  applyPropertyAction(prop, actionId, state, playerVehicle, police, saveManager, audio, onTimeChanged) {
    if (actionId === 'buy-property') {
      if (state.ownedProperties.has(prop.id)) return;
      if (state.cash < prop.price) {
        state.toast = { text: `Need $${prop.price.toLocaleString()}`, timer: 2.6 };
        return;
      }
      state.cash -= prop.price;
      state.ownedProperties.add(prop.id);
      state.rp += 350;
      this.syncOwnedPropertyVehicles(state);
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: `ACQUIRED ${prop.name.toUpperCase()}`, timer: 3.8 };
      if (audio) audio.playUiBeep(920);
      return;
    }

    if (actionId === 'collect-vault') {
      const amt = Math.round(state.vaultBalance ?? 0);
      if (amt <= 0) {
        state.toast = { text: 'Vault empty', timer: 2.2 };
        return;
      }
      state.cash += amt;
      state.careerStats.cashEarned += amt;
      state.vaultBalance = 0;
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: `VAULT COLLECTED: +$${amt.toLocaleString()}`, timer: 3.4 };
      if (audio) audio.playUiBeep(880);
      return;
    }

    if (actionId === 'safehouse-rest') {
      state.health = state.maxHealth;
      state.armor = state.maxArmor;
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: `RESTED & SAVED (SLOT ${state.activeSlot})`, timer: 3.2 };
      if (audio) audio.playUiBeep(820);
      return;
    }

    if (actionId === 'advance-time') {
      state.timeOfDay = (state.timeOfDay + 5.5) % 24;
      if (onTimeChanged) onTimeChanged();
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: 'TIME ADVANCED +5.5H', timer: 2.4 };
      if (audio) audio.playUiBeep(720);
      return;
    }

    if (actionId === 'marina-cooldown') {
      if (playerVehicle) { playerVehicle.hp = playerVehicle.maxHp; playerVehicle.nitro = 100; }
      if (police) police.dropStars(state, 3);
      state.toast = { text: 'REPAIRED & HEAT CLEARED', timer: 3.2 };
      if (audio) audio.playUiBeep(840);
      return;
    }

    if (actionId === 'penthouse-stash') {
      state.health = state.maxHealth;
      state.armor = state.maxArmor;
      for (const w of WEAPONS) {
        if (!w.melee) state.weaponAmmo[w.id] = { clip: w.clip, reserve: w.reserve };
      }
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: 'HEALTH, ARMOR & AMMO RESTORED', timer: 3.2 };
      if (audio) audio.playUiBeep(880);
      return;
    }

    if (actionId === 'spawn-perk-vehicle' && playerVehicle) {
      playerVehicle.pos.set(prop.x + 8.5, 0, prop.z + 5.5);
      playerVehicle.mesh.position.copy(playerVehicle.pos);
      playerVehicle.hp = playerVehicle.maxHp;
      playerVehicle.nitro = 100;
      state.toast = { text: 'VEHICLE DELIVERED OUTSIDE', timer: 2.6 };
      if (audio) audio.playUiBeep(780);
      return;
    }

    if (prop.kind === 'garage') {
      if (actionId === 'repair' && state.cash >= 600) {
        state.cash -= 600;
        if (playerVehicle) { playerVehicle.hp = playerVehicle.maxHp; playerVehicle.nitro = 100; }
        state.toast = { text: 'REPAIRED & NITRO FILLED', timer: 2.4 };
      } else if (actionId === 'clear-wanted' && state.cash >= 2500) {
        state.cash -= 2500;
        if (police) police.dropStars(state, 5);
        state.toast = { text: 'PLATES SCRUBBED', timer: 2.8 };
      }
      if (audio) audio.playUiBeep(780);
      return;
    }

    if (prop.kind === 'gunsmith') {
      if (actionId === 'armor' && state.cash >= 1500) {
        state.cash -= 1500;
        state.armor = state.maxArmor;
        state.toast = { text: 'ARMOR VEST EQUIPPED', timer: 2.4 };
      } else if (actionId === 'ammo' && state.cash >= 900) {
        state.cash -= 900;
        for (const w of WEAPONS) {
          if (!w.melee) state.weaponAmmo[w.id] = { clip: w.clip, reserve: w.reserve };
        }
        state.toast = { text: 'AMMO RESTOCKED', timer: 2.4 };
      } else if (actionId === 'tactical-pack' && state.cash >= 2200) {
        state.cash -= 2200;
        state.health = state.maxHealth;
        state.armor = state.maxArmor;
        for (const w of WEAPONS) {
          if (!w.melee) state.weaponAmmo[w.id] = { clip: w.clip, reserve: Math.round(w.reserve * 1.35) };
        }
        state.toast = { text: 'TACTICAL PACK EQUIPPED', timer: 2.6 };
      }
      if (audio) audio.playUiBeep(780);
    }
  }
}
