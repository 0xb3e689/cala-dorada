// Central game state: progression, rank/RP, district standing, career stats, wanted heat, and mission progress.

import { DISTRICTS, WEAPONS, RANKS, MISSIONS } from './config.js';

export function createInitialState() {
  const standing = {};
  for (const d of DISTRICTS) standing[d.id] = d.standingInit;

  const weaponAmmo = {};
  for (const w of WEAPONS) {
    weaponAmmo[w.id] = { clip: w.clip, reserve: w.reserve };
  }

  return {
    mode: 'title', // 'title' | 'playing' | 'paused' | 'shop'
    activeSlot: 1,
    timeOfDay: 18.7, // 0..24 (18.7 = golden hour sunset, 21.8 = neon night)
    clockPaused: false,

    cash: 24500,
    rp: 1450,
    health: 100,
    maxHealth: 100,
    armor: 80,
    maxArmor: 100,

    wantedLevel: 0,
    wantedHeat: 0, // 0..500
    evadeTimer: 0,
    airUnitDeployed: false,
    signalJamTimer: 0,

    activeWeaponIdx: 2, // 0..5
    weaponAmmo,

    inVehicle: true,
    currentDistrictId: 'paseo-dorado',
    districtStanding: standing,

    activeMissionId: 'm1',
    missionStageIdx: 0,
    missionTimer: 180,
    missionEnemiesRemaining: 0,
    completedMissions: {}, // { m1: 'GOLD', ... }

    completedRaces: new Set(),
    completedStunts: new Set(),
    collectedShells: new Set(),
    unlockedResprays: ['#ff6138', '#2ec4b6', '#ffbe55', '#e84393', '#4ba3ff'],

    radioStationIdx: 0,
    radioTrackIdx: 0,
    radioMuted: false,

    crewCooldowns: { nadia: 0, toma: 0, sora: 0 },

    customWaypoint: null, // { x, z, label }
    dialogue: null, // { speaker, portrait, text, timer }
    toast: null, // { text, timer }

    careerStats: {
      cashEarned: 48200,
      pursuitsEvaded: 4,
      topSpeedMph: 132,
      stuntsLanded: 2,
      takedowns: 19,
      playtimeSec: 1840,
      distanceKm: 14.6,
    },

    settings: {
      sfxVolume: 0.75,
      radioVolume: 0.55,
      cameraMode: 'chase', // 'chase' | 'action' | 'hood'
      shadows: true,
    },
  };
}

export function getRankInfo(rp) {
  let current = RANKS[0];
  let next = RANKS[1];
  for (let i = 0; i < RANKS.length; i++) {
    if (rp >= RANKS[i].rp) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? { rank: current.rank + 1, rp: current.rp + 4000, title: current.title };
    }
  }
  const span = Math.max(1, next.rp - current.rp);
  const frac = Math.min(1, Math.max(0, (rp - current.rp) / span));
  return {
    rank: current.rank,
    title: current.title,
    rp,
    nextRp: next.rp,
    progress: frac,
  };
}

export function computeCompletionPercent(state) {
  const mDone = Object.keys(state.completedMissions).length;
  const rDone = state.completedRaces.size;
  const sDone = state.completedStunts.size;
  const gDone = state.collectedShells.size;
  const dTrusted = Object.values(state.districtStanding).filter((v) => v >= 70).length;

  const pct =
    (mDone / MISSIONS.length) * 52 +
    (rDone / 4) * 14 +
    (sDone / 8) * 14 +
    (gDone / 20) * 12 +
    (dTrusted / DISTRICTS.length) * 8;
  return Math.min(100, Math.round(pct * 10) / 10);
}

export function getStandingTier(val) {
  if (val >= 85) return 'SYNDICATE';
  if (val >= 75) return 'TRUSTED';
  if (val >= 55) return 'FRIENDLY';
  return 'NEUTRAL';
}

export function formatTimeClock(hoursFloat) {
  const h = Math.floor(((hoursFloat % 24) + 24) % 24);
  const m = Math.floor((hoursFloat - Math.floor(hoursFloat)) * 60);
  const pad = (n) => String(n).padStart(2, '0');
  let phase = 'DAYLIGHT';
  if (h >= 17 && h < 20) phase = 'GOLDEN HOUR';
  else if (h >= 20 || h < 5) phase = 'NEON NIGHT';
  else if (h >= 5 && h < 8) phase = 'SUNRISE';
  return { text: `${pad(h)}:${pad(m)}`, phase };
}

export function serializeStateForSave(state) {
  const mission = MISSIONS.find((m) => m.id === state.activeMissionId) ?? MISSIONS[0];
  const dist = DISTRICTS.find((d) => d.id === state.currentDistrictId) ?? DISTRICTS[0];
  return {
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    savedDate: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
    completion: computeCompletionPercent(state),
    act: mission.act,
    missionTitle: mission.title,
    districtName: dist.name,
    cash: Math.round(state.cash),
    rp: Math.round(state.rp),
    timeOfDay: state.timeOfDay,
    activeMissionId: state.activeMissionId,
    missionStageIdx: state.missionStageIdx,
    completedMissions: { ...state.completedMissions },
    completedRaces: [...state.completedRaces],
    completedStunts: [...state.completedStunts],
    collectedShells: [...state.collectedShells],
    districtStanding: { ...state.districtStanding },
    careerStats: { ...state.careerStats },
  };
}

export function applySavedData(state, data) {
  if (!data) return;
  state.cash = data.cash ?? state.cash;
  state.rp = data.rp ?? state.rp;
  state.timeOfDay = data.timeOfDay ?? state.timeOfDay;
  state.activeMissionId = data.activeMissionId ?? state.activeMissionId;
  state.missionStageIdx = data.missionStageIdx ?? 0;
  state.completedMissions = { ...(data.completedMissions ?? {}) };
  state.completedRaces = new Set(data.completedRaces ?? []);
  state.completedStunts = new Set(data.completedStunts ?? []);
  state.collectedShells = new Set(data.collectedShells ?? []);
  if (data.districtStanding) Object.assign(state.districtStanding, data.districtStanding);
  if (data.careerStats) Object.assign(state.careerStats, data.careerStats);
}
