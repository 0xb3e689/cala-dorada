// City layout, road grid, public facilities (Hospital, Police Precinct, Central Park), GPS pathfinder, races, shells, and shops.

import { DISTRICTS, PROPERTIES } from '../core/config.js';

export const ROAD_X = [-340, -180, 0, 180, 340];
export const ROAD_Z = [-340, -180, 0, 120, 200];

// Real Public Urban Facilities (integrated cleanly into city blocks, zero mid-street stunt ramps!)
export const PUBLIC_FACILITIES = {
  hospital: {
    id: 'cala-hospital',
    name: 'Cala Dorada General Hospital',
    shortName: 'HOSPITAL',
    x: -102,
    z: -124,
    spawnX: -102,
    spawnZ: -96,
    spawnYaw: 0,
    carX: -84,
    carZ: -96,
    color: '#ff4b5c',
  },
  police: {
    id: 'cdpd-precinct',
    name: 'CDPD Precinct HQ',
    shortName: 'CDPD HQ',
    x: 118,
    z: -124,
    spawnX: 118,
    spawnZ: -96,
    spawnYaw: 0,
    carX: 136,
    carZ: -96,
    color: '#4ba3ff',
  },
  park: {
    id: 'parque-dorado',
    name: 'Central Parque Dorado',
    shortName: 'PARQUE DORADO',
    x: -90,
    z: 60,
    w: 112,
    d: 76,
    color: '#2ecc71',
  },
};

export const LANDMARKS = [
  { id: 'hotel-solsticio', name: 'HOTEL SOLSTICIO', x: -120, z: 162, district: 'paseo-dorado', type: 'landmark' },
  { id: 'casa-ambar', name: 'CASA AMBAR', x: -255, z: 162, district: 'paseo-dorado', type: 'landmark' },
  { id: 'mirador-plaza', name: 'MIRADOR PLAZA', x: 52, z: -40, district: 'distrito-torre', type: 'vault' },
  { id: 'puente-del-sol', name: 'PUENTE DEL SOL', x: 110, z: 200, district: 'distrito-torre', type: 'bridge' },
  { id: 'mercado-arch', name: 'MERCADO NOCTURNO', x: -310, z: -55, district: 'mercado-nocturno', type: 'landmark' },
  { id: 'cala-hospital', name: 'GENERAL HOSPITAL', x: -102, z: -124, district: 'distrito-torre', type: 'hospital' },
  { id: 'cdpd-precinct', name: 'CDPD PRECINCT HQ', x: 118, z: -124, district: 'distrito-torre', type: 'police' },
  { id: 'parque-dorado', name: 'PARQUE DORADO', x: -90, z: 60, district: 'distrito-torre', type: 'park' },
  { id: 'rafas-garage', name: "RAFA'S GARAGE", x: 150, z: -242, district: 'barrio-viejo', type: 'garage' },
  { id: 'el-taller', name: 'EL TALLER ARMORY', x: -244, z: -124, district: 'mercado-nocturno', type: 'gunsmith' },
  { id: 'safehouse', name: 'ESMERALDA DOCK', x: 264, z: 182, district: 'bahia-esmeralda', type: 'marina' },
];

export const SHOPS = PROPERTIES;

// All out-of-nowhere mid-street stunt jumps removed for realistic drivable city streets!
export const STUNT_RAMPS = [];

export const STREET_RACES = [
  {
    id: 'race-1', name: 'Paseo Sunset Sprint', payout: 7500, rp: 320,
    start: { x: -320, z: 200 },
    checkpoints: [
      { x: -180, z: 200 }, { x: 0, z: 200 }, { x: 180, z: 200 }, { x: 180, z: 120 }, { x: 0, z: 120 },
    ],
  },
  {
    id: 'race-2', name: 'Distrito Torre Circuit', payout: 9500, rp: 420,
    start: { x: 0, z: -180 },
    checkpoints: [
      { x: 180, z: -180 }, { x: 180, z: 0 }, { x: 0, z: 0 }, { x: -180, z: 0 }, { x: -180, z: -180 },
    ],
  },
  {
    id: 'race-3', name: 'Lantern Alley Dash', payout: 8800, rp: 380,
    start: { x: -340, z: 0 },
    checkpoints: [
      { x: -340, z: -180 }, { x: -180, z: -180 }, { x: -180, z: 120 }, { x: -340, z: 120 },
    ],
  },
  {
    id: 'race-4', name: 'Gold Coast Grand Loop', payout: 14000, rp: 600,
    start: { x: 340, z: 0 },
    checkpoints: [
      { x: 340, z: -180 }, { x: 180, z: -340 }, { x: -180, z: -340 }, { x: -340, z: 200 }, { x: 180, z: 200 },
    ],
  },
];

export const GOLDEN_SHELLS = [
  { id: 'sh1', x: -300, z: 238 }, { id: 'sh2', x: -210, z: 244 }, { id: 'sh3', x: -95, z: 242 },
  { id: 'sh4', x: -15, z: 235 }, { id: 'sh5', x: 225, z: 242 }, { id: 'sh6', x: 320, z: 232 },
  { id: 'sh7', x: -355, z: -85 }, { id: 'sh8', x: -275, z: -120 }, { id: 'sh9', x: -230, z: 50 },
  { id: 'sh10', x: -85, z: -85 }, { id: 'sh11', x: 75, z: -90 }, { id: 'sh12', x: 85, z: 45 },
  { id: 'sh13', x: 280, z: -40 }, { id: 'sh14', x: 385, z: -125 }, { id: 'sh15', x: 375, z: 65 },
  { id: 'sh16', x: -260, z: -290 }, { id: 'sh17', x: -90, z: -310 }, { id: 'sh18', x: 110, z: -310 },
  { id: 'sh19', x: 255, z: -285 }, { id: 'sh20', x: 110, z: 165 },
];

export const FISHING_SPOTS = [
  { id: 'fish-marina', name: 'Bahia Esmeralda Pier', district: 'bahia-esmeralda', x: 225, z: 274, facing: 0 },
  { id: 'fish-paseo', name: 'Paseo Dorado Pier', district: 'paseo-dorado', x: -210, z: 266, facing: 0 },
];

export const GARDEN_SITES = [
  { id: 'garden-villas', name: 'Villas del Cabo Terrace', district: 'villas-del-cabo', x: -126, z: -242 },
  { id: 'garden-loft', name: "Dante's Courtyard", district: 'barrio-viejo', x: 74, z: -242 },
];

export const ROOF_REPAIR_SITES = [
  { id: 'roof-viejo-1', name: 'Barrio Viejo Plaza Roof', district: 'barrio-viejo', x: 118, z: -242, totalTiles: 6, payout: 1800 },
  { id: 'roof-viejo-2', name: 'Barrio Viejo Courtyard Roof', district: 'barrio-viejo', x: 198, z: -244, totalTiles: 6, payout: 2100 },
];

// Canonical 100%-synced Map Legend definitions shared by full Pause Map & Minimap
export const MAP_LEGEND = [
  { id: 'player',   label: 'Player',      color: '#ffffff', shape: 'player' },
  { id: 'mission',  label: 'Mission',     color: '#ffbe55', shape: 'circle' },
  { id: 'hospital', label: 'Hospital',    color: '#ff4b5c', shape: 'cross' },
  { id: 'police',   label: 'Police',      color: '#4ba3ff', shape: 'shield' },
  { id: 'garage',   label: 'Garage',      color: '#34e0c8', shape: 'house' },
  { id: 'wardrobe', label: 'Wardrobe',    color: '#e879f9', shape: 'house' },
  { id: 'gunsmith', label: 'Gunsmith',    color: '#ff7846', shape: 'house' },
  { id: 'property', label: 'Property',    color: '#42e38c', shape: 'house' },
  { id: 'fishing',  label: 'Fishing',     color: '#38bdf8', shape: 'circle' },
  { id: 'garden',   label: 'Garden',      color: '#a3e635', shape: 'diamond' },
  { id: 'roof',     label: 'Roof Repair', color: '#fb923c', shape: 'triangle' },
];

export function getDistrictAt(x, z) {
  for (const d of DISTRICTS) {
    const b = d.bounds;
    if (x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2) return d;
  }
  let best = DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    const dd = Math.hypot(x - d.center.x, z - d.center.z);
    if (dd < bestDist) {
      bestDist = dd;
      best = d;
    }
  }
  return best;
}

export function isOnRoad(x, z, margin = 12) {
  for (const rx of ROAD_X) {
    if (Math.abs(x - rx) <= margin && z >= -365 && z <= 220) return true;
  }
  for (const rz of ROAD_Z) {
    if (Math.abs(z - rz) <= margin && x >= -365 && x <= 375) return true;
  }
  return false;
}

// Compute crisp Manhattan-grid GPS path along intersections from start to goal
export function computeGpsPath(start, goal) {
  if (!start || !goal) return [];
  const nearestIdx = (arr, val) => {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const d = Math.abs(arr[i] - val);
      if (d < best) { best = d; idx = i; }
    }
    return idx;
  };

  const sx = nearestIdx(ROAD_X, start.x);
  const sz = nearestIdx(ROAD_Z, start.z);
  const gx = nearestIdx(ROAD_X, goal.x);
  const gz = nearestIdx(ROAD_Z, goal.z);

  const pts = [{ x: start.x, z: start.z }];
  let cx = sx;
  let cz = sz;
  pts.push({ x: ROAD_X[cx], z: ROAD_Z[cz] });

  while (cx !== gx) {
    cx += Math.sign(gx - cx);
    pts.push({ x: ROAD_X[cx], z: ROAD_Z[cz] });
  }
  while (cz !== gz) {
    cz += Math.sign(gz - cz);
    pts.push({ x: ROAD_X[cx], z: ROAD_Z[cz] });
  }
  pts.push({ x: goal.x, z: goal.z });
  return pts;
}
