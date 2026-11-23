// Street races, stunt jump scoring, Golden Shell collectibles, and Garage/Gunsmith/Safehouse shops.

import * as THREE from '../../vendor/three.module.min.js';
import { STREET_RACES, STUNT_RAMPS, GOLDEN_SHELLS, SHOPS } from '../world/cityPlan.js';
import { WEAPONS } from '../core/config.js';

export class ActivitiesAndShops {
  constructor(scene) {
    this.scene = scene;
    this.activeRace = null; // { race, cpIdx, startTime }
    this.nearbyShop = null;
    this.nearbyRace = null;

    this.cpRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.45, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8 })
    );
    this.cpRing.position.y = 5.5;
    this.cpRing.visible = false;
    this.scene.add(this.cpRing);
  }

  onStuntLand(rampId, dist, state, audio) {
    const ramp = STUNT_RAMPS.find((r) => r.id === rampId);
    if (!ramp) return;
    const meters = Math.round(dist);
    if (meters >= 16) {
      const firstTime = !state.completedStunts.has(ramp.id);
      state.completedStunts.add(ramp.id);
      state.careerStats.stuntsLanded += 1;
      const bonus = firstTime ? 2500 : 600;
      state.cash += bonus;
      state.careerStats.cashEarned += bonus;
      state.rp += firstTime ? 180 : 50;
      state.toast = { text: `STUNT JUMP LANDED · ${meters}m · +$${bonus.toLocaleString()}`, timer: 3.6 };
      if (audio) audio.playUiBeep(820);
    }
  }

  update(dt, elapsed, state, playerPos, worldAnim, audio) {
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
        state.toast = {
          text: `GOLDEN SHELL FOUND (${state.collectedShells.size}/20) · +$1,500`,
          timer: 3.2,
        };
        if (audio) audio.playUiBeep(920);
      }
    }

    // 2. Nearby Shop or Race Trigger
    this.nearbyShop = null;
    for (const sh of SHOPS) {
      if (Math.hypot(playerPos.x - sh.x, playerPos.z - sh.z) < sh.radius) {
        this.nearbyShop = sh;
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

  getPromptText() {
    if (this.nearbyShop) return `Press [E] to enter ${this.nearbyShop.name}`;
    if (this.nearbyRace) return `Press [E] to start Street Race: ${this.nearbyRace.name}`;
    return '';
  }

  interact(state, playerVehicle, saveManager, openShopModal, audio) {
    if (this.nearbyRace && !this.activeRace) {
      this.activeRace = { race: this.nearbyRace, cpIdx: 0, startTime: performance.now() };
      state.toast = { text: `STREET RACE STARTED: ${this.nearbyRace.name}!`, timer: 3.0 };
      if (audio) audio.playUiBeep(660);
      return true;
    }
    if (this.nearbyShop) {
      if (this.nearbyShop.kind === 'safehouse') {
        state.health = state.maxHealth;
        state.armor = state.maxArmor;
        saveManager.saveSlot(state.activeSlot, state);
        state.toast = { text: `SAFEHOUSE REST — HEALTH & ARMOR FULL · SAVED SLOT ${state.activeSlot}`, timer: 3.5 };
        if (audio) audio.playUiBeep(820);
        return true;
      }
      if (openShopModal) openShopModal(this.nearbyShop);
      return true;
    }
    return false;
  }

  applyShopPurchase(kind, itemId, state, playerVehicle, audio) {
    if (kind === 'garage') {
      if (itemId === 'repair' && state.cash >= 600) {
        state.cash -= 600;
        if (playerVehicle) { playerVehicle.hp = playerVehicle.maxHp; playerVehicle.nitro = 100; }
        state.toast = { text: 'CHASSIS REPAIRED & NITRO FILLED (-$600)', timer: 2.5 };
      } else if (itemId.startsWith('paint:') && state.cash >= 1200) {
        state.cash -= 1200;
        const hex = itemId.slice(6);
        if (playerVehicle?.mesh.userData.paintMat) {
          playerVehicle.mesh.userData.paintMat.color.set(hex);
        }
        state.toast = { text: `RESPRAY APPLIED (-$1,200)`, timer: 2.5 };
      }
    } else if (kind === 'gunsmith') {
      if (itemId === 'armor' && state.cash >= 1500) {
        state.cash -= 1500;
        state.armor = state.maxArmor;
        state.toast = { text: 'KEVLAR VEST RESTORED (-$1,500)', timer: 2.5 };
      } else if (itemId === 'ammo' && state.cash >= 900) {
        state.cash -= 900;
        for (const w of WEAPONS) {
          if (!w.melee) state.weaponAmmo[w.id] = { clip: w.clip, reserve: w.reserve };
        }
        state.toast = { text: 'ALL WEAPON AMMO RESTOCKED (-$900)', timer: 2.5 };
      }
    }
    if (audio) audio.playUiBeep(780);
  }
}
