// Dedicated spatial-hashed solid AABB collision world + natural coastal water depth queries for Cala Dorada.
// Prevents vehicles, player, police, and NPCs from ever clipping through buildings, bridge rails, walls, or large props.

export class CollisionWorld {
  constructor(cellSize = 48) {
    this.cellSize = cellSize;
    this.colliders = [];
    this.grid = new Map();
  }

  addBox(minX, maxX, minZ, maxZ, height = 10, tag = 'building') {
    if (maxX <= minX || maxZ <= minZ) return null;
    const box = { minX, maxX, minZ, maxZ, height, tag };
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

  addRect(cx, cz, width, depth, height = 10, tag = 'building') {
    return this.addBox(cx - width * 0.5, cx + width * 0.5, cz - depth * 0.5, cz + depth * 0.5, height, tag);
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

  // Resolve a circle (x, z, radius) against all nearby AABB colliders.
  // Returns { hit, normalX, normalZ, impactSpeed, tag }
  resolveCircle(pos, vel, radius, opts = {}) {
    const bounce = opts.bounce ?? 0;
    const entityY = pos.y ?? 0;
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
        if (entityY >= c.height) continue;

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
          // Center is inside the box; push out along minimum axis
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
            // Friction along tangent on scrape
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

    return { hit: anyHit, normalX: outNx, normalZ: outNz, impactSpeed: bestImpact, tag: hitTag };
  }

  // Sub-stepped movement + solid collision resolution so fast cars or running characters NEVER tunnel through walls.
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

  // Check if a point is on the Puente del Sol bridge roadway deck (dry road over the marina bay channel)
  isOnBridgeDeck(x, z) {
    return x >= 37 && x <= 183 && z >= 188.0 && z <= 212.0;
  }

  // Check if a point is on a wooden fishing pier
  isOnPier(x, z) {
    // Paseo Dorado fishing pier (x=-210, width 5.2, z=249..291)
    if (Math.abs(x - (-210)) <= 3.0 && z >= 245 && z <= 292) return true;
    // Bahia Esmeralda marina pier (x=225, width 6.5, z=272..324)
    if (Math.abs(x - 225) <= 3.6 && z >= 268 && z <= 325) return true;
    return false;
  }

  // Natural physical water boundary depth (0 = dry land/sand/bridge/pier, 0..1.1 = shallow surf, >1.1 = deep water)
  getWaterDepth(x, z) {
    if (this.isOnBridgeDeck(x, z) || this.isOnPier(x, z)) return 0;

    let depth = 0;
    // South open ocean shoreline (gentle surf starting at z = 276)
    if (z > 276) {
      depth = Math.max(depth, (z - 276) * 0.085);
    }

    // Marina Bay channel cutting north under Puente del Sol (x in [40..180], z in [156..276])
    if (x > 40 && x < 180 && z > 156 && z <= 278) {
      const edgeDist = Math.min(x - 40, 180 - x, z - 156);
      depth = Math.max(depth, Math.min(2.6, edgeDist * 0.14));
    }

    return depth;
  }

  // Direction pointing smoothly back toward nearest dry shoreline when wading/swimming in deep water
  getShoreReturnVector(x, z) {
    // Inside Marina Bay channel
    if (x > 40 && x < 180 && z > 156 && z <= 278) {
      const dWest = x - 40;
      const dEast = 180 - x;
      const dNorth = z - 156;
      if (dNorth <= dWest && dNorth <= dEast) return { x: 0, z: -1 };
      return dWest < dEast ? { x: -1, z: 0 } : { x: 1, z: 0 };
    }
    // South ocean: push north toward golden beach
    return { x: 0, z: -1 };
  }
}
