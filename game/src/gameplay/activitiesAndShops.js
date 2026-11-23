// Street races, stunt jump scoring, Golden Shell collectibles, and 8 usable/purchasable Cala Dorada city properties.

import * as THREE from '../../vendor/three.module.min.js';
import { STREET_RACES, STUNT_RAMPS, GOLDEN_SHELLS } from '../world/cityPlan.js';
import { WEAPONS, PROPERTIES } from '../core/config.js';
import { getEmpireIncomePerHour } from '../core/gameState.js';
import { createVehicleMesh } from '../entities/vehicleFactory.js';

export class ActivitiesAndShops {
  constructor(scene) {
    this.scene = scene;
    this.activeRace = null; // { race, cpIdx, startTime }
    this.nearbyShop = null; // Matched property from PROPERTIES
    this.nearbyRace = null;
    this.spawnedPerkCars = new Map(); // propId -> THREE.Group

    this.cpRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.45, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8 })
    );
    this.cpRing.position.y = 5.5;
    this.cpRing.visible = false;
    this.scene.add(this.cpRing);
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
    // 0. Passive Empire Income accumulation into Syndicate Vault (accelerated for engaging gameplay)
    const incomeHr = getEmpireIncomePerHour(state);
    if (incomeHr > 0) {
      state.vaultBalance = Math.min(250000, (state.vaultBalance ?? 0) + (incomeHr / 60) * dt);
    }
    this.syncOwnedPropertyVehicles(state);

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

    // 2. Nearby Property or Street Race Trigger
    this.nearbyShop = null;
    for (const prop of PROPERTIES) {
      if (Math.hypot(playerPos.x - prop.x, playerPos.z - prop.z) < prop.radius) {
        this.nearbyShop = prop;
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

  getPromptText(state) {
    if (this.nearbyShop) {
      const owned = state?.ownedProperties?.has(this.nearbyShop.id);
      if (!owned && this.nearbyShop.price > 0) {
        return `Press [E] to buy ${this.nearbyShop.name} ($${this.nearbyShop.price.toLocaleString()} · $${this.nearbyShop.incomePerHr.toLocaleString()}/hr)`;
      }
      return `Press [E] to enter ${this.nearbyShop.name} (${this.nearbyShop.badge})`;
    }
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
      if (openShopModal) openShopModal(this.nearbyShop);
      return true;
    }
    return false;
  }

  applyPropertyAction(prop, actionId, state, playerVehicle, police, saveManager, audio, onTimeChanged) {
    if (actionId === 'buy-property') {
      if (state.ownedProperties.has(prop.id)) return;
      if (state.cash < prop.price) {
        state.toast = { text: `INSUFFICIENT FUNDS — NEED $${prop.price.toLocaleString()}`, timer: 2.6 };
        return;
      }
      state.cash -= prop.price;
      state.ownedProperties.add(prop.id);
      state.rp += 350;
      this.syncOwnedPropertyVehicles(state);
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: `PROPERTY ACQUIRED: ${prop.name.toUpperCase()} · +$${prop.incomePerHr.toLocaleString()}/hr`, timer: 4.0 };
      if (audio) audio.playUiBeep(920);
      return;
    }

    if (actionId === 'collect-vault') {
      const amt = Math.round(state.vaultBalance ?? 0);
      if (amt <= 0) {
        state.toast = { text: 'VAULT EMPTY — INCOME ACCUMULATING', timer: 2.4 };
        return;
      }
      state.cash += amt;
      state.careerStats.cashEarned += amt;
      state.vaultBalance = 0;
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: `EMPIRE INCOME COLLECTED: +$${amt.toLocaleString()}`, timer: 3.6 };
      if (audio) audio.playUiBeep(880);
      return;
    }

    if (actionId === 'safehouse-rest') {
      state.health = state.maxHealth;
      state.armor = state.maxArmor;
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: `${prop.shortName} REST — HEALTH & ARMOR FULL · SAVED SLOT ${state.activeSlot}`, timer: 3.5 };
      if (audio) audio.playUiBeep(820);
      return;
    }

    if (actionId === 'advance-time') {
      state.timeOfDay = (state.timeOfDay + 5.5) % 24;
      if (onTimeChanged) onTimeChanged();
      saveManager.saveSlot(state.activeSlot, state);
      state.toast = { text: 'TIME ADVANCED +5.5 HOURS', timer: 2.6 };
      if (audio) audio.playUiBeep(720);
      return;
    }

    if (actionId === 'marina-cooldown') {
      if (playerVehicle) { playerVehicle.hp = playerVehicle.maxHp; playerVehicle.nitro = 100; }
      if (police) police.dropStars(state, 3);
      state.toast = { text: 'ESMERALDA HIDEOUT — CAR REPAIRED & HEAT CLEARED', timer: 3.4 };
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
      state.toast = { text: 'CABO PENTHOUSE STASH — FULL HEALTH, ARMOR & AMMO', timer: 3.5 };
      if (audio) audio.playUiBeep(880);
      return;
    }

    if (actionId === 'spawn-perk-vehicle' && playerVehicle) {
      playerVehicle.pos.set(prop.x + 8.5, 0, prop.z + 5.5);
      playerVehicle.mesh.position.copy(playerVehicle.pos);
      playerVehicle.hp = playerVehicle.maxHp;
      playerVehicle.nitro = 100;
      state.toast = { text: `${prop.shortName} VEHICLE READY OUTSIDE`, timer: 2.8 };
      if (audio) audio.playUiBeep(780);
      return;
    }

    // Garage actions
    if (prop.kind === 'garage') {
      if (actionId === 'repair' && state.cash >= 600) {
        state.cash -= 600;
        if (playerVehicle) { playerVehicle.hp = playerVehicle.maxHp; playerVehicle.nitro = 100; }
        state.toast = { text: 'CHASSIS REPAIRED & NITRO FILLED (-$600)', timer: 2.5 };
      } else if (actionId === 'clear-wanted' && state.cash >= 2500) {
        state.cash -= 2500;
        if (police) police.dropStars(state, 5);
        state.toast = { text: 'PLATES SCRUBBED — WANTED LEVEL CLEARED (-$2,500)', timer: 3.0 };
      } else if (actionId === 'upgrade-nitro' && state.cash >= 4500) {
        state.cash -= 4500;
        state.vehicleUpgrades.nitroLevel = Math.min(3, (state.vehicleUpgrades.nitroLevel ?? 1) + 1);
        if (playerVehicle) playerVehicle.nitro = 100;
        saveManager.saveSlot(state.activeSlot, state);
        state.toast = { text: `TWIN-STAGE NITRO LV.${state.vehicleUpgrades.nitroLevel} INSTALLED (-$4,500)`, timer: 3.0 };
      } else if (actionId === 'upgrade-armor' && state.cash >= 6000) {
        state.cash -= 6000;
        state.vehicleUpgrades.armorLevel = Math.min(3, (state.vehicleUpgrades.armorLevel ?? 1) + 1);
        if (playerVehicle) {
          playerVehicle.maxHp = Math.round(playerVehicle.spec.maxHp * (1 + (state.vehicleUpgrades.armorLevel - 1) * 0.25));
          playerVehicle.hp = playerVehicle.maxHp;
        }
        saveManager.saveSlot(state.activeSlot, state);
        state.toast = { text: `CHASSIS ARMOR LV.${state.vehicleUpgrades.armorLevel} INSTALLED (-$6,000)`, timer: 3.0 };
      } else if (actionId.startsWith('paint:') && state.cash >= 1200) {
        state.cash -= 1200;
        const hex = actionId.slice(6);
        if (playerVehicle?.mesh.userData.paintMat) {
          playerVehicle.mesh.userData.paintMat.color.set(hex);
        }
        state.toast = { text: 'CUSTOM RESPRAY APPLIED (-$1,200)', timer: 2.5 };
      }
      if (audio) audio.playUiBeep(780);
      return;
    }

    // Gunsmith actions
    if (prop.kind === 'gunsmith') {
      if (actionId === 'armor' && state.cash >= 1500) {
        state.cash -= 1500;
        state.armor = state.maxArmor;
        state.toast = { text: 'KEVLAR VEST RESTORED (-$1,500)', timer: 2.5 };
      } else if (actionId === 'ammo' && state.cash >= 900) {
        state.cash -= 900;
        for (const w of WEAPONS) {
          if (!w.melee) state.weaponAmmo[w.id] = { clip: w.clip, reserve: w.reserve };
        }
        state.toast = { text: 'ALL WEAPON AMMO RESTOCKED (-$900)', timer: 2.5 };
      } else if (actionId === 'tactical-pack' && state.cash >= 2200) {
        state.cash -= 2200;
        state.health = state.maxHealth;
        state.armor = state.maxArmor;
        for (const w of WEAPONS) {
          if (!w.melee) state.weaponAmmo[w.id] = { clip: w.clip, reserve: Math.round(w.reserve * 1.35) };
        }
        state.toast = { text: 'SYNDICATE TACTICAL PACK EQUIPPED (-$2,200)', timer: 2.8 };
      }
      if (audio) audio.playUiBeep(780);
    }
  }
}
