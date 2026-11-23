// Persistent 3-slot localStorage Save Manager with Quick Save and realistic syndicate profiles.

import { serializeStateForSave, applySavedData } from '../core/gameState.js';

const STORAGE_KEY = 'cala_dorada_saves_v1';

const DEFAULT_SLOTS = {
  1: {
    savedAt: '18:42',
    savedDate: 'Today',
    completion: 67.6,
    act: 'Act II',
    missionTitle: 'Bridge Toll Takedown',
    districtName: 'Paseo Dorado',
    cash: 142850,
    rp: 6420,
    timeOfDay: 18.7,
    activeMissionId: 'm5',
    missionStageIdx: 2,
    completedMissions: { m1: 'GOLD', m2: 'GOLD', m3: 'SILVER', m4: 'GOLD', m6: 'BRONZE' },
    completedRaces: ['race-1', 'race-2', 'race-3'],
    completedStunts: ['stunt-1', 'stunt-2', 'stunt-3', 'stunt-4', 'stunt-5', 'stunt-6'],
    collectedShells: ['sh1', 'sh2', 'sh3', 'sh4', 'sh5', 'sh6', 'sh7', 'sh8', 'sh9', 'sh10', 'sh11', 'sh12', 'sh13', 'sh14'],
    districtStanding: {
      'paseo-dorado': 82, 'distrito-torre': 71, 'mercado-nocturno': 74,
      'puerto-cenit': 62, 'villas-del-cabo': 58, 'barrio-viejo': 84, 'bahia-esmeralda': 91,
    },
    careerStats: {
      cashEarned: 284600, pursuitsEvaded: 19, topSpeedMph: 164, stuntsLanded: 14, takedowns: 87, playtimeSec: 11420, distanceKm: 68.4,
    },
  },
  2: {
    savedAt: '21:15',
    savedDate: 'Yesterday',
    completion: 31.2,
    act: 'Act I',
    missionTitle: 'Lantern Ledger',
    districtName: 'Mercado Nocturno',
    cash: 48200,
    rp: 2940,
    timeOfDay: 21.6,
    activeMissionId: 'm3',
    missionStageIdx: 1,
    completedMissions: { m1: 'GOLD', m2: 'SILVER' },
    completedRaces: ['race-1'],
    completedStunts: ['stunt-1', 'stunt-2'],
    collectedShells: ['sh1', 'sh2', 'sh3', 'sh7', 'sh8'],
    districtStanding: {
      'paseo-dorado': 76, 'distrito-torre': 55, 'mercado-nocturno': 74,
      'puerto-cenit': 58, 'villas-del-cabo': 51, 'barrio-viejo': 70, 'bahia-esmeralda': 82,
    },
    careerStats: {
      cashEarned: 74900, pursuitsEvaded: 7, topSpeedMph: 146, stuntsLanded: 5, takedowns: 31, playtimeSec: 4620, distanceKm: 24.8,
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

  saveSlot(slotNum, state) {
    state.activeSlot = slotNum;
    this.slots[slotNum] = serializeStateForSave(state);
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
