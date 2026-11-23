// Spatial-hashed 3D AABB collision world with overhead ceiling/bridge-deck slabs, true 3D raycast occlusion
// (buildings, roofs, walls, pillars & vehicles), elevated bridge decks with hollow passable underpasses,
// and navigable Río Dorado river + Marina Bay + coastal ocean depth queries.

import { getRiverCenterX, getRiverHalfWidth, RIVER_BRIDGES } from './cityPlan.js';

export class CollisionWorld {
  constructor(cellSize = 48) {
    this.cellSize = cellSize;
    this.colliders = [];
    this.grid = new Map();
  }

  addBox(minX, maxX, minZ, maxZ, height = 10, tag = 'building', minY = 0) {
    if (maxX <= minX || maxZ <= minZ || height <= minY) return null;
    const box = { minX, maxX, minY, maxY: height, height, minZ, maxZ, tag };
    this.colliders.push(box);

    const cx0 = Math.floor(minX / this.cellSize);
    const cx1 = Math.floor(maxX / this.cellSize);
    const cz0 = Math.floor(minZ / this.cellSize);
    const cz1 = Math.floor(maxZ / this.cellSize);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const key = `${cx},${cz}`;
        let bucket = this.grid.get(key);
        if (!bucket) {
          bucket = [];
          this.grid.set(key, bucket);
        }
        bucket.push(box);
      }
    }
    return box;
  }

  addBox3D(minX, maxX, minY, maxY, minZ, maxZ, tag = 'roof') {
    return this.addBox(minX, maxX, minZ, maxZ, maxY, tag, minY);
  }

  addRect(cx, cz, width, depth, height = 10, tag = 'building', minY = 0) {
    return this.addBox(cx - width * 0.5, cx + width * 0.5, cz - depth * 0.5, cz + depth * 0.5, height, tag, minY);
  }

  queryNearby(minX, maxX, minZ, maxZ) {
    const cx0 = Math.floor(minX / this.cellSize);
    const cx1 = Math.floor(maxX / this.cellSize);
    const cz0 = Math.floor(minZ / this.cellSize);
    const cz1 = Math.floor(maxZ / this.cellSize);
    const out = [];
    const seen = new Set();
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const bucket = this.grid.get(`${cx},${cz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const b = bucket[i];
          if (!seen.has(b)) {
            seen.add(b);
            out.push(b);
          }
        }
      }
    }
    return out;
  }

  // Exact 3D Ray-vs-AABB slab intersection returning { dist, normalX, normalY, normalZ } or null
  _intersectRayAABB(ox, oy, oz, dx, dy, dz, minX, maxX, minY, maxY, minZ, maxZ, maxDist) {
    let tMin = 0;
    let tMax = maxDist;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    // X slab
    if (Math.abs(dx) < 1e-8) {
      if (ox < minX || ox > maxX) return null;
    } else {
      const inv = 1 / dx;
      let t1 = (minX - ox) * inv;
      let t2 = (maxX - ox) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tMin) { tMin = t1; nx = s; ny = 0; nz = 0; }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    // Y slab
    if (Math.abs(dy) < 1e-8) {
      if (oy < minY || oy > maxY) return null;
    } else {
      const inv = 1 / dy;
      let t1 = (minY - oy) * inv;
      let t2 = (maxY - oy) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tMin) { tMin = t1; nx = 0; ny = s; nz = 0; }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    // Z slab
    if (Math.abs(dz) < 1e-8) {
      if (oz < minZ || oz > maxZ) return null;
    } else {
      const inv = 1 / dz;
      let t1 = (minZ - oz) * inv;
      let t2 = (maxZ - oz) * inv;
      let s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tMin) { tMin = t1; nx = 0; ny = 0; nz = s; }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }

    if (tMin < 0 || tMin > maxDist) return null;
    return { dist: tMin, normalX: nx, normalY: ny, normalZ: nz };
  }

  // Rock-solid 3D Raycast against all world AABBs (buildings, overhead roofs, bridge decks, walls, pillars)
  // AND optional oriented vehicle bounding boxes (opts.vehicles).
  // Returns null or { dist, point: { x, y, z }, normal: { x, y, z }, tag, box, vehicle }
  raycast(origin, dir, maxDist = 120, opts = {}) {
    const ox = origin.x;
    const oy = origin.y;
    const oz = origin.z;
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / len;
    const dy = dir.y / len;
    const dz = dir.z / len;

    const ex = ox + dx * maxDist;
    const ez = oz + dz * maxDist;
    const candidates = this.queryNearby(
      Math.min(ox, ex) - 2,
      Math.max(ox, ex) + 2,
      Math.min(oz, ez) - 2,
      Math.max(oz, ez) + 2
    );

    const ignoreTags = opts.ignoreTags ?? null;
    let best = null;
    let bestDist = maxDist;

    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (ignoreTags && (Array.isArray(ignoreTags) ? ignoreTags.includes(b.tag) : ignoreTags.has(b.tag))) continue;
      const hit = this._intersectRayAABB(ox, oy, oz, dx, dy, dz, b.minX, b.maxX, b.minY, b.maxY, b.minZ, b.maxZ, bestDist);
      if (hit && hit.dist < bestDist) {
        bestDist = hit.dist;
        best = {
          dist: hit.dist,
          point: { x: ox + dx * hit.dist, y: oy + dy * hit.dist, z: oz + dz * hit.dist },
          normal: { x: hit.normalX, y: hit.normalY, z: hit.normalZ },
          tag: b.tag,
          box: b,
          vehicle: null,
        };
      }
    }

    // Optional oriented bounding box raycast against all active vehicles
    const vehicles = opts.vehicles;
    if (vehicles && vehicles.length > 0) {
      const ignoreVeh = opts.ignoreVehicle ?? null;
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        if (!v || v === ignoreVeh) continue;
        const vPos = v.pos ?? v.mesh?.position;
        if (!vPos) continue;
        const spec = v.spec ?? v.mesh?.userData?.spec ?? { width: 2.2, length: 4.8, height: 1.5 };
        const yaw = v.yaw ?? v.mesh?.rotation?.y ?? 0;

        // Broad-phase sphere reject
        const rx = vPos.x - ox;
        const ry = (vPos.y + spec.height * 0.5) - oy;
        const rz = vPos.z - oz;
        const proj = rx * dx + ry * dy + rz * dz;
        if (proj < -4 || proj > bestDist + 4) continue;

        // Transform ray into vehicle local frame (inverse of Three.js Y-rotation by +yaw)
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const relX = ox - vPos.x;
        const relY = oy - vPos.y;
        const relZ = oz - vPos.z;
        const lox = relX * cosY - relZ * sinY;
        const loz = relX * sinY + relZ * cosY;
        const ldx = dx * cosY - dz * sinY;
        const ldz = dx * sinY + dz * cosY;

        const hw = (spec.width ?? 2.2) * 0.56;
        const hl = (spec.length ?? 4.8) * 0.54;
        const hh = (spec.height ?? 1.5) + 0.25;
        const hit = this._intersectRayAABB(lox, relY, loz, ldx, dy, ldz, -hw, hw, 0.05, hh, -hl, hl, bestDist);
        if (hit && hit.dist < bestDist) {
          bestDist = hit.dist;
          const wnx = hit.normalX * cosY + hit.normalZ * sinY;
          const wnz = -hit.normalX * sinY + hit.normalZ * cosY;
          best = {
            dist: hit.dist,
            point: { x: ox + dx * hit.dist, y: oy + dy * hit.dist, z: oz + dz * hit.dist },
            normal: { x: wnx, y: hit.normalY, z: wnz },
            tag: 'vehicle',
            box: null,
            vehicle: v,
          };
        }
      }
    }

    return best;
  }

  hasLineOfSight(from, to, opts = {}) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.2) return true;
    const hit = this.raycast(from, { x: dx / dist, y: dy / dist, z: dz / dist }, Math.max(0.1, dist - 0.2), opts);
    return hit === null;
  }

  // Resolve a circle (x, z, radius) against all nearby AABB colliders respecting strict 3D vertical overlap:
  // (y + height > box.minY && y < box.maxY). Supports both (pos, vel, radius, opts) and (x, z, radius, y, height).
  resolveCircle(posOrX, velOrZ, radius, optsOrY = {}, heightArg = 1.85) {
    let pos;
    let vel;
    let opts;
    let numericMode = false;
    if (typeof posOrX === 'number') {
      numericMode = true;
      pos = { x: posOrX, y: typeof optsOrY === 'number' ? optsOrY : 0, z: velOrZ };
      vel = null;
      opts = { entityHeight: heightArg };
    } else {
      pos = posOrX;
      vel = velOrZ;
      opts = optsOrY || {};
    }

    const bounce = opts.bounce ?? 0;
    const entityY = pos.y ?? 0;
    const entityHeight = opts.entityHeight ?? 1.85;
    let anyHit = false;
    let bestImpact = 0;
    let outNx = 0;
    let outNz = 0;
    let hitTag = null;

    for (let iter = 0; iter < 3; iter++) {
      const candidates = this.queryNearby(pos.x - radius - 1, pos.x + radius + 1, pos.z - radius - 1, pos.z + radius + 1);
      let resolvedAny = false;

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        // Overhead bridge deck slabs are raycast/LOS blockers (e.g., HALCÓN-1), NEVER horizontal road walls!
        if (c.tag === 'bridge-deck') continue;
        // Strict 3D vertical overlap check: skip boxes strictly above or strictly below the entity!
        if (!((entityY + entityHeight) > c.minY + 0.05 && entityY < c.maxY - 0.05)) continue;

        const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq >= radius * radius) continue;

        let nx = 0;
        let nz = 0;
        let pen = 0;

        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          nx = dx / dist;
          nz = dz / dist;
          pen = radius - dist;
        } else {
          const dl = Math.abs(pos.x - c.minX);
          const dr = Math.abs(c.maxX - pos.x);
          const dt = Math.abs(pos.z - c.minZ);
          const db = Math.abs(c.maxZ - pos.z);
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) { nx = -1; pen = dl + radius; }
          else if (m === dr) { nx = 1; pen = dr + radius; }
          else if (m === dt) { nz = -1; pen = dt + radius; }
          else { nz = 1; pen = db + radius; }
        }

        pos.x += nx * pen;
        pos.z += nz * pen;
        anyHit = true;
        resolvedAny = true;

        if (vel) {
          const vn = vel.x * nx + vel.z * nz;
          if (vn < 0) {
            const imp = -vn;
            if (imp > bestImpact) {
              bestImpact = imp;
              outNx = nx;
              outNz = nz;
              hitTag = c.tag;
            }
            vel.x -= (1 + bounce) * vn * nx;
            vel.z -= (1 + bounce) * vn * nz;
            if (opts.tangentDamp) {
              const tx = -nz;
              const tz = nx;
              const vt = vel.x * tx + vel.z * tz;
              vel.x -= vt * opts.tangentDamp * tx;
              vel.z -= vt * opts.tangentDamp * tz;
            }
          }
        }
      }

      if (!resolvedAny) break;
    }

    if (numericMode) {
      return { hit: anyHit, x: pos.x, z: pos.z, normalX: outNx, normalZ: outNz, impactSpeed: bestImpact, tag: hitTag };
    }
    return { hit: anyHit, normalX: outNx, normalZ: outNz, impactSpeed: bestImpact, tag: hitTag };
  }

  moveAndSlide(pos, vel, radius, dt, opts = {}) {
    const dx = vel.x * dt;
    const dz = vel.z * dt;
    const dist = Math.hypot(dx, dz);
    const maxStep = Math.max(0.35, radius * 0.42);
    const steps = Math.min(12, Math.max(1, Math.ceil(dist / maxStep)));
    const subDt = dt / steps;

    let result = { hit: false, normalX: 0, normalZ: 0, impactSpeed: 0, tag: null };
    for (let s = 0; s < steps; s++) {
      pos.x += vel.x * subDt;
      pos.z += vel.z * subDt;
      // Continuously update elevation along bridge ramps during sub-stepping so fast vehicles NEVER lag behind the deck!
      if (opts.followSurface !== false) {
        const surfY = this.getSurfaceHeight(pos.x, pos.z, pos.y ?? 0);
        if (surfY > (pos.y ?? 0)) pos.y = surfY;
      }
      const r = this.resolveCircle(pos, vel, radius, opts);
      if (r.hit) {
        result.hit = true;
        if (r.impactSpeed >= result.impactSpeed) {
          result.impactSpeed = r.impactSpeed;
          result.normalX = r.normalX;
          result.normalZ = r.normalZ;
          result.tag = r.tag;
        }
      }
    }
    return result;
  }

  // Smooth elevated roadway deck height for Puente del Sol and all Río Dorado river bridges
  getBridgeDeckY(x, z) {
    for (let i = 0; i < RIVER_BRIDGES.length; i++) {
      const b = RIVER_BRIDGES[i];
      if (Math.abs(z - b.z) > b.halfZ) continue;
      if (x < b.x1 || x > b.x2) continue;
      const distFromWest = x - b.x1;
      const distFromEast = b.x2 - x;
      const minEdge = Math.min(distFromWest, distFromEast);
      if (minEdge >= b.rampLen) return b.deckY;
      const t = Math.max(0, Math.min(1, minEdge / b.rampLen));
      // Smooth Hermite S-curve ramp
      return b.deckY * (t * t * (3 - 2 * t));
    }
    return 0;
  }

  // Smooth continuous surface elevation query:
  // - Approaching a bridge from street level along the ramp lifts entity smoothly from y = 0 up to y = deckY
  //   and down the far ramp back to y = 0.
  // - When ALREADY underneath the elevated span (currentY < deckY - 1.5), keeps entity cleanly underneath
  //   on the river/underpass floor (y = 0) — NEVER teleporting them up onto the bridge deck!
  getSurfaceHeight(x, z, currentY = 0) {
    const deckY = this.getBridgeDeckY(x, z);
    if (deckY <= 0.001) return 0;
    if (currentY < deckY - 1.5) return 0;
    return deckY;
  }

  // Alias preserved for existing callers
  getSurfaceY(x, z, currentY = 0) {
    return this.getSurfaceHeight(x, z, currentY);
  }

  // Check if a point is on top of a bridge deck
  isOnBridgeDeck(x, z, entityY = 6) {
    const deckY = this.getBridgeDeckY(x, z);
    return deckY > 0.15 && entityY >= deckY - 1.5;
  }

  // Check if a point is on a wooden fishing pier
  isOnPier(x, z) {
    if (Math.abs(x - (-210)) <= 3.0 && z >= 245 && z <= 292) return true;
    if (Math.abs(x - 225) <= 3.6 && z >= 268 && z <= 325) return true;
    return false;
  }

  // Physical water depth: 0 = dry land/sand/pier/on top of bridge, 0..1.0 = shallow bank/surf, 1.0..4.5 = swimmable/divable water!
  getWaterDepth(x, z, entityY = 0) {
    if (this.isOnBridgeDeck(x, z, entityY) || this.isOnPier(x, z)) return 0;

    let depth = 0;

    // 1. South open ocean shoreline (gentle beach slope starting at z = 274)
    if (z > 274) {
      depth = Math.max(depth, Math.min(4.8, (z - 274) * 0.14));
    }

    // 2. Marina Bay channel cutting north under Puente del Sol (x in [66..154], z in [156..278])
    // Leaves dry concrete underpass walkways under full 5.8m clearance on [56..66] and [154..164]!
    if (x > 66 && x < 154 && z > 156 && z <= 278) {
      const edgeDist = Math.min(x - 66, 154 - x, z - 156);
      depth = Math.max(depth, Math.min(3.8, edgeDist * 0.28));
    }

    // 3. Scenic Navigable River: RÍO DORADO (z from -438 to 165)
    if (z >= -438 && z <= 165) {
      const cx = getRiverCenterX(z);
      const hw = getRiverHalfWidth(z);
      const distFromCenter = Math.abs(x - cx);
      if (distFromCenter < hw) {
        const edgeDist = hw - distFromCenter;
        depth = Math.max(depth, Math.min(3.5, edgeDist * 0.42));
      }
    }

    return depth;
  }

  // Gentle push back ONLY if swimming way out into the far open ocean (z > 380) so river & bay are 100% freely navigable
  getShoreReturnVector(x, z) {
    if (z > 380) return { x: 0, z: -1 };
    return { x: 0, z: 0 };
  }
}
