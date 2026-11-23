// Persistent 3-slot localStorage Save Manager with Quick Save and mathematically consistent syndicate profiles.

import { serializeStateForSave, applySavedData } from '../core/gameState.js';

const STORAGE_KEY = 'cala_dorada_saves_v4';

const DEFAULT_SLOTS = {
  1: {
    savedAt: '18:42',
    savedDate: 'Today',
    completion: 65.4,
    act: 'Act II',
    missionTitle: 'Bridge Toll Takedown',
    districtName: 'Paseo Dorado',
    cash: 142850,
    rp: 7650,
    timeOfDay: 18.7,
    activeMissionId: 'm5',
    missionStageIdx: 2,
    completedMissions: { m1: 'GOLD', m2: 'GOLD', m3: 'SILVER', m4: 'GOLD' },
    ownedProperties: ['dantes-loft', 'rafas-garage', 'el-taller', 'solsticio-club', 'cenit-warehouse'],
    vaultBalance: 14800,
    vehicleUpgrades: { nitroLevel: 2, armorLevel: 2 },
    carMods: {
      paint: '#ff6138',
      finish: 'metallic',
      spoiler: 'gt',
      underglow: '#34e0c8',
      rims: '#e6edf7',
      turboLevel: 2,
      armorLevel: 2,
    },
    playerAppearance: {
      outfitStyle: 'bomber',
      jacketColor: '#e65f3c',
      pantsColor: '#1b2230',
      hairStyle: 'swept',
      hairColor: '#1b1514',
      skinTone: '#d9a17a',
      accessory: 'aviators',
    },
    completedRaces: ['race-1', 'race-2', 'race-3', 'race-4'],
    completedStunts: ['stunt-1', 'stunt-2', 'stunt-3', 'stunt-4', 'stunt-5', 'stunt-6', 'stunt-7'],
    collectedShells: [
      'sh1', 'sh2', 'sh3', 'sh4', 'sh5', 'sh6', 'sh7', 'sh8',
      'sh9', 'sh10', 'sh11', 'sh12', 'sh13', 'sh14', 'sh15', 'sh16',
    ],
    districtStanding: {
      'paseo-dorado': 82, 'distrito-torre': 74, 'mercado-nocturno': 78,
      'puerto-cenit': 71, 'villas-del-cabo': 58, 'barrio-viejo': 84, 'bahia-esmeralda': 91,
    },
    careerStats: {
      cashEarned: 284600, pursuitsEvaded: 19, topSpeedMph: 164, stuntsLanded: 14, takedowns: 87, playtimeSec: 11420, distanceKm: 68.4,
      carModsInstalled: 6, fishCaught: 11, cropsHarvested: 8, roofsRepaired: 4,
    },
  },
  2: {
    savedAt: '21:15',
    savedDate: 'Yesterday',
    completion: 31.4,
    act: 'Act I',
    missionTitle: 'Lantern Ledger',
    districtName: 'Mercado Nocturno',
    cash: 48200,
    rp: 3420,
    timeOfDay: 21.6,
    activeMissionId: 'm3',
    missionStageIdx: 1,
    completedMissions: { m1: 'GOLD', m2: 'SILVER' },
    ownedProperties: ['dantes-loft', 'rafas-garage', 'el-taller'],
    vaultBalance: 4200,
    vehicleUpgrades: { nitroLevel: 1, armorLevel: 1 },
    carMods: {
      paint: '#2ec4b6',
      finish: 'metallic',
      spoiler: 'ducktail',
      underglow: 'off',
      rims: '#e6edf7',
      turboLevel: 1,
      armorLevel: 1,
    },
    playerAppearance: {
      outfitStyle: 'blazer',
      jacketColor: '#1e2430',
      pantsColor: '#24272e',
      hairStyle: 'swept',
      hairColor: '#1b1514',
      skinTone: '#d9a17a',
      accessory: 'aviators',
    },
    completedRaces: ['race-1'],
    completedStunts: ['stunt-1', 'stunt-2'],
    collectedShells: ['sh1', 'sh2', 'sh3', 'sh7', 'sh8'],
    districtStanding: {
      'paseo-dorado': 76, 'distrito-torre': 55, 'mercado-nocturno': 74,
      'puerto-cenit': 58, 'villas-del-cabo': 51, 'barrio-viejo': 70, 'bahia-esmeralda': 82,
    },
    careerStats: {
      cashEarned: 74900, pursuitsEvaded: 7, topSpeedMph: 146, stuntsLanded: 5, takedowns: 31, playtimeSec: 4620, distanceKm: 24.8,
      carModsInstalled: 2, fishCaught: 3, cropsHarvested: 2, roofsRepaired: 1,
    },
  },
  3: null,
};

export class SaveManager {
  constructor() {
    this.slots = this._readStorage();
  }

  _readStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { 1: parsed[1] ?? null, 2: parsed[2] ?? null, 3: parsed[3] ?? null };
      }
    } catch {
      // Fallback when storage is unavailable
    }
    return structuredClone(DEFAULT_SLOTS);
  }

  _persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.slots));
    } catch {
      // Ignore quota/private-mode errors
    }
  }

  getSlot(slotNum) {
    return this.slots[slotNum] ?? null;
  }

  getAllSlots() {
    return [1, 2, 3].map((n) => ({ slot: n, data: this.slots[n] ?? null }));
  }

  saveSlot(slotNum, state, worldSnap = null) {
    state.activeSlot = slotNum;
    this.slots[slotNum] = serializeStateForSave(state, worldSnap);
    this._persist();
    return this.slots[slotNum];
  }

  loadSlot(slotNum, state) {
    const data = this.slots[slotNum];
    if (!data) return false;
    state.activeSlot = slotNum;
    applySavedData(state, data);
    return true;
  }
}
