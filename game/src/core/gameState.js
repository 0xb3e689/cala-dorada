// Central game state: progression, rank/RP, district standing, career stats, wanted heat, and mission progress.

import { DISTRICTS, WEAPONS, RANKS, MISSIONS, PROPERTIES } from './config.js';

export function createInitialState() {
  const standing = {};
  for (const d of DISTRICTS) standing[d.id] = d.standingInit;

  const weaponAmmo = {};
  for (const w of WEAPONS) {
    weaponAmmo[w.id] = { clip: w.clip, reserve: w.reserve };
  }

  const defaultOwned = PROPERTIES.filter((p) => p.ownedByDefault).map((p) => p.id);

  return {
    mode: 'title', // 'title' | 'playing' | 'paused' | 'shop'
    activeSlot: 1,
    timeOfDay: 18.7, // 0..24 (18.7 = golden hour sunset, 21.8 = neon night)
    clockPaused: false,

    cash: 28500,
    rp: 1450,
    health: 100,
    maxHealth: 100,
    armor: 80,
    maxArmor: 100,
    stamina: 100,
    maxStamina: 100,
    oxygen: 100,
    maxOxygen: 100,
    swimming: false,
    diving: false,
    submergeDepth: 0,
    exhausted: false,
    exhaustTimer: 0,
    damageFlash: 0,

    // WASTED / BUSTED cinematic status state
    statusOverlay: null, // null | { type: 'WASTED' | 'BUSTED', timer: 3.4, total: 3.4 }
    bustProgress: 0,     // 0..2.2s arrest timer when stationary & cornered by on-foot police (< 2.5m)

    wantedLevel: 0,
    wantedHeat: 0, // 0..600 (1★=60, 2★=160, 3★=290, 4★=420, 5★=560)
    shotAtPolice: false, // True once player fires weapons at police (disables 2★ arrest -> lethal force)
    inSight: false,
    evadeTimer: 0,
    hiddenFromPolice: false,
    airUnitDeployed: false,
    signalJamTimer: 0,

    activeWeaponIdx: 2, // 0..5
    activeWeaponId: WEAPONS[2].id,
    weaponAmmo,
    reloadTimer: 0,
    reloadDuration: 0,
    reloadingWeaponId: null,
    weaponWheelOpen: false,
    weaponWheelHoverIdx: 2,

    inVehicle: true,
    radioBannerTimer: 0,
    crewActive: false,
    currentDistrictId: 'paseo-dorado',
    districtStanding: standing,

    activeMissionId: 'm1',
    missionStageIdx: 0,
    missionTimer: 180,
    missionEnemiesRemaining: 0,
    completedMissions: {}, // { m1: 'GOLD', ... }

    ownedProperties: new Set(defaultOwned),
    vaultBalance: 2600,
    vehicleUpgrades: { nitroLevel: 1, armorLevel: 1 },
    carMods: {
      paint: '#ff6138',
      finish: 'metallic',
      spoiler: 'gt',
      underglow: 'off',
      rims: '#e6edf7',
      turboLevel: 1,
      armorLevel: 1,
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
    gardenPlots: [
      { id: 'v1', siteId: 'garden-villas', cropId: 'orchids', stage: 3, progress: 1 },
      { id: 'v2', siteId: 'garden-villas', cropId: 'hibiscus', stage: 2, progress: 0.65 },
      { id: 'v3', siteId: 'garden-villas', cropId: 'peppers', stage: 1, progress: 0.35 },
      { id: 'v4', siteId: 'garden-villas', cropId: null, stage: 0, progress: 0 },
      { id: 'l1', siteId: 'garden-loft', cropId: 'palms', stage: 3, progress: 1 },
      { id: 'l2', siteId: 'garden-loft', cropId: 'peppers', stage: 2, progress: 0.7 },
      { id: 'l3', siteId: 'garden-loft', cropId: null, stage: 0, progress: 0 },
      { id: 'l4', siteId: 'garden-loft', cropId: null, stage: 0, progress: 0 },
    ],
    roofProgress: {
      'roof-viejo-1': 0,
      'roof-viejo-2': 0,
    },
    fishLog: [],

    completedRaces: new Set(),
    completedStunts: new Set(),
    collectedShells: new Set(),
    unlockedResprays: ['#ff6138', '#2ec4b6', '#ffbe55', '#e84393', '#4ba3ff'],

    radioStationIdx: 0,
    radioTrackIdx: 0,
    radioMuted: false,

    crewCooldowns: { nadia: 0, toma: 0, sora: 0 },
    crewHealth: { nadia: 100, toma: 100, sora: 100 },

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
      carModsInstalled: 0,
      fishCaught: 0,
      cropsHarvested: 0,
      roofsRepaired: 0,
    },

    settings: {
      sfxVolume: 0.75,
      radioVolume: 0.55,
      cameraMode: 'medium', // 'close' | 'medium' | 'far'
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

export function getEmpireIncomePerHour(state) {
  let total = 0;
  for (const p of PROPERTIES) {
    if (state.ownedProperties?.has(p.id)) total += p.incomePerHr;
  }
  return total;
}

export function computeCompletionPercent(state) {
  const mDone = Object.keys(state.completedMissions).length;
  const pDone = state.ownedProperties ? state.ownedProperties.size : 0;
  const rDone = state.completedRaces.size;
  const gDone = state.collectedShells.size;
  const dTrusted = Object.values(state.districtStanding).filter((v) => v >= 70).length;

  const pct =
    (mDone / MISSIONS.length) * 48 +
    (pDone / PROPERTIES.length) * 18 +
    (rDone / 4) * 12 +
    (gDone / 20) * 12 +
    (dTrusted / DISTRICTS.length) * 10;
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

export function serializeStateForSave(state, worldSnap = null) {
  const mission = MISSIONS.find((m) => m.id === state.activeMissionId) ?? MISSIONS[0];
  const dist = DISTRICTS.find((d) => d.id === state.currentDistrictId) ?? DISTRICTS[0];
  const weaponAmmoCopy = {};
  for (const [wid, val] of Object.entries(state.weaponAmmo ?? {})) {
    weaponAmmoCopy[wid] = { clip: val.clip, reserve: val.reserve };
  }
  return {
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    savedDate: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
    completion: computeCompletionPercent(state),
    act: mission.act,
    missionTitle: mission.title,
    districtName: dist.name,
    cash: Math.round(state.cash),
    rp: Math.round(state.rp),
    health: Math.round(state.health ?? 100),
    armor: Math.round(state.armor ?? 0),
    timeOfDay: state.timeOfDay,
    inVehicle: Boolean(state.inVehicle),
    activeWeaponIdx: state.activeWeaponIdx ?? 2,
    weaponAmmo: weaponAmmoCopy,
    playerPos: worldSnap?.playerPos ?? state.savedPlayerPos ?? null,
    vehiclePos: worldSnap?.vehiclePos ?? state.savedVehiclePos ?? null,
    activeMissionId: state.activeMissionId,
    missionStageIdx: state.missionStageIdx,
    completedMissions: { ...state.completedMissions },
    ownedProperties: [...(state.ownedProperties ?? [])],
    vaultBalance: Math.round(state.vaultBalance ?? 0),
    vehicleUpgrades: { ...(state.vehicleUpgrades ?? { nitroLevel: 1, armorLevel: 1 }) },
    carMods: { ...(state.carMods ?? {}) },
    playerAppearance: { ...(state.playerAppearance ?? {}) },
    gardenPlots: (state.gardenPlots ?? []).map((p) => ({ ...p })),
    roofProgress: { ...(state.roofProgress ?? {}) },
    fishLog: [...(state.fishLog ?? [])].slice(-20),
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
  if (typeof data.health === 'number') state.health = Math.max(10, Math.min(state.maxHealth, data.health));
  if (typeof data.armor === 'number') state.armor = Math.max(0, Math.min(state.maxArmor, data.armor));
  state.timeOfDay = data.timeOfDay ?? state.timeOfDay;
  if (typeof data.inVehicle === 'boolean') state.inVehicle = data.inVehicle;
  if (typeof data.activeWeaponIdx === 'number') {
    state.activeWeaponIdx = Math.max(0, Math.min(WEAPONS.length - 1, data.activeWeaponIdx));
    state.activeWeaponId = WEAPONS[state.activeWeaponIdx]?.id ?? state.activeWeaponId;
  }
  if (data.weaponAmmo) {
    for (const [wid, val] of Object.entries(data.weaponAmmo)) {
      if (state.weaponAmmo[wid]) {
        state.weaponAmmo[wid] = { clip: val.clip, reserve: val.reserve };
      }
    }
  }
  state.savedPlayerPos = data.playerPos ? { ...data.playerPos } : null;
  state.savedVehiclePos = data.vehiclePos ? { ...data.vehiclePos } : null;
  state.activeMissionId = data.activeMissionId ?? state.activeMissionId;
  state.missionStageIdx = data.missionStageIdx ?? 0;
  state.completedMissions = { ...(data.completedMissions ?? {}) };
  if (Array.isArray(data.ownedProperties)) {
    state.ownedProperties = new Set(data.ownedProperties);
  }
  state.vaultBalance = data.vaultBalance ?? state.vaultBalance ?? 0;
  if (data.vehicleUpgrades) Object.assign(state.vehicleUpgrades, data.vehicleUpgrades);
  if (data.carMods) Object.assign(state.carMods, data.carMods);
  if (data.playerAppearance) Object.assign(state.playerAppearance, data.playerAppearance);
  if (Array.isArray(data.gardenPlots)) {
    state.gardenPlots = data.gardenPlots.map((p) => ({ ...p }));
  }
  if (data.roofProgress) Object.assign(state.roofProgress, data.roofProgress);
  if (Array.isArray(data.fishLog)) state.fishLog = [...data.fishLog];
  state.completedRaces = new Set(data.completedRaces ?? []);
  state.completedStunts = new Set(data.completedStunts ?? []);
  state.collectedShells = new Set(data.collectedShells ?? []);
  if (data.districtStanding) Object.assign(state.districtStanding, data.districtStanding);
  if (data.careerStats) Object.assign(state.careerStats, data.careerStats);
}
