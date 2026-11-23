// City layout, road grid, GPS pathfinder, landmarks, races, stunt ramps, shells, and shops.

import { DISTRICTS, PROPERTIES } from '../core/config.js';

export const ROAD_X = [-340, -180, 0, 180, 340];
export const ROAD_Z = [-340, -180, 0, 120, 200];

export const LANDMARKS = [
  { id: 'hotel-solsticio', name: 'HOTEL SOLSTICIO', x: -120, z: 162, district: 'paseo-dorado', type: 'landmark' },
  { id: 'casa-ambar', name: 'CASA AMBAR', x: -255, z: 162, district: 'paseo-dorado', type: 'landmark' },
  { id: 'mirador-plaza', name: 'MIRADOR VAULT', x: 52, z: -40, district: 'distrito-torre', type: 'vault' },
  { id: 'puente-del-sol', name: 'PUENTE DEL SOL', x: 110, z: 200, district: 'distrito-torre', type: 'bridge' },
  { id: 'mercado-arch', name: 'MERCADO NOCTURNO', x: -310, z: -55, district: 'mercado-nocturno', type: 'landmark' },
  { id: 'rafas-garage', name: "RAFA'S GARAGE", x: 150, z: -242, district: 'barrio-viejo', type: 'garage' },
  { id: 'el-taller', name: 'EL TALLER ARMORY', x: -244, z: -124, district: 'mercado-nocturno', type: 'gunsmith' },
  { id: 'safehouse', name: 'ESMERALDA DOCK', x: 264, z: 182, district: 'bahia-esmeralda', type: 'marina' },
];

export const SHOPS = PROPERTIES;

export const STUNT_RAMPS = [
  { id: 'stunt-1', name: 'Solsticio Boardwalk Leap', x: -185, z: 214, yaw: Math.PI * 0.5, targetDist: 38 },
  { id: 'stunt-2', name: 'Puente Approach Launch', x: 215, z: 196, yaw: Math.PI * 0.5, targetDist: 44 },
  { id: 'stunt-3', name: 'Mirador Fountain Vault', x: 0, z: -90, yaw: 0, targetDist: 36 },
  { id: 'stunt-4', name: 'Puerto Cenit Crane Hop', x: 340, z: -95, yaw: 0, targetDist: 42 },
  { id: 'stunt-5', name: 'Mercado Alley Skyway', x: -260, z: 0, yaw: Math.PI * 0.5, targetDist: 34 },
  { id: 'stunt-6', name: 'Villas Terraces Drop', x: -180, z: -260, yaw: Math.PI, targetDist: 46 },
  { id: 'stunt-7', name: 'Barrio Viejo Plaza Flight', x: 180, z: -220, yaw: 0, targetDist: 38 },
  { id: 'stunt-8', name: 'Esmeralda Marina Pier Jump', x: 285, z: 196, yaw: Math.PI * 0.5, targetDist: 40 },
];

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
