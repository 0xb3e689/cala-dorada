// High-density living city traffic (coupes, SUVs, convertibles, coastal scooters) and diverse reactive NPCs (beachgoers, joggers, tourists, market vendors, commuters, enforcers, CDPD officers).

import * as THREE from '../../vendor/three.module.min.js';
import { ROAD_X, ROAD_Z } from './cityPlan.js';
import { createVehicleMesh } from '../entities/vehicleFactory.js';

export class TrafficAndPeds {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.peds = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this._spawnTraffic();
    this._spawnPedestrians();
  }

  _spawnTraffic() {
    const types = ['cabo_gt', 'convertible', 'baja_runner', 'scooter', 'cabo_gt', 'convertible'];
    const palette = [
      0x39c2b8, 0xf2b138, 0xe85a4f, 0x5c80bc, 0xf4f4f6,
      0xff5e7e, 0x8ac926, 0xff8c42, 0x3b82f6, 0xe6c229,
    ];
    let idx = 0;

    // Dense Horizontal Road Cruisers (especially lively on Paseo Dorado z=200 & downtown avenues)
    for (const rz of ROAD_Z) {
      const count = rz === 200 ? 8 : rz === 120 || rz === 0 ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const type = types[idx % types.length];
        const color = palette[idx % palette.length];
        const mesh = createVehicleMesh(type, color);
        const span = 680 / count;
        const x = -335 + i * span + (idx % 3) * 14;
        const z = rz + (dir > 0 ? 4.8 : -4.8);
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.group.add(mesh);
        this.cars.push({
          mesh, type, axis: 'x', dir, laneCoord: z,
          speed: type === 'scooter' ? 12.5 : 15.5 + (idx % 5) * 2.4,
          min: -355, max: 355,
        });
        idx++;
      }
    }

    // Dense Vertical Road Cruisers
    for (const rx of ROAD_X) {
      const count = Math.abs(rx) <= 180 ? 5 : 4;
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const type = types[(idx + 1) % types.length];
        const mesh = createVehicleMesh(type, palette[(idx + 3) % palette.length]);
        const x = rx + (dir > 0 ? -4.8 : 4.8);
        const span = 530 / count;
        const z = -325 + i * span + (idx % 3) * 10;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        this.cars.push({
          mesh, type, axis: 'z', dir, laneCoord: x,
          speed: type === 'scooter' ? 12 : 14.5 + (idx % 4) * 2.5,
          min: -345, max: 205,
        });
        idx++;
      }
    }
  }

  _spawnPedestrians() {
    const brightColors = [0xff6b4a, 0x34e0c8, 0xffbe55, 0x6c8cff, 0xf2f4f8, 0xff5992, 0x70e08b, 0xff9248, 0x5be3ff];
    const spawnList = [];

    // 1. Sandy Beach Beachgoers & Tourists (Paseo Dorado west beach & Bahia Esmeralda east beach)
    for (let i = 0; i < 24; i++) {
      const onEast = i >= 16;
      const x = onEast ? 186 + (i - 16) * 22 : -320 + i * 22;
      const z = 234 + (i % 4) * 7.5;
      spawnList.push({
        x, z, axis: 'x', role: i % 3 === 0 ? 'tourist' : 'beachgoer',
        stationary: i % 3 === 1, min: onEast ? 182 : -335, max: onEast ? 355 : 38,
      });
    }

    // 2. Paseo Dorado Boardwalk Joggers, Tourists & CDPD Foot Officers
    for (let i = 0; i < 26; i++) {
      const onEast = i >= 19;
      const x = onEast ? 186 + (i - 19) * 23 : -325 + i * 19;
      const z = 221 + (i % 3) * 2.2;
      const role = i % 7 === 0 ? 'officer' : i % 3 === 0 ? 'jogger' : i % 2 === 0 ? 'tourist' : 'beachgoer';
      spawnList.push({
        x, z, axis: 'x', role,
        min: onEast ? 182 : -335, max: onEast ? 355 : 38,
      });
    }

    // 3. Paseo Dorado North Sidewalk Commuters & Shoppers (outside Hotel Solsticio, Casa Ambar, Solsticio Club)
    for (let i = 0; i < 16; i++) {
      const x = -315 + i * 22;
      if (x > 28 && x < 185) continue;
      const role = i % 5 === 0 ? 'officer' : i % 2 === 0 ? 'tourist' : 'commuter';
      spawnList.push({ x, z: 184 + (i % 2) * 2.2, axis: 'x', role, min: -330, max: 32 });
    }

    // 4. Mercado Nocturno: 12 Street Vendors stationed behind all 12 stalls + 18 shoppers/enforcers/officers
    const mCx = -310;
    const mCz = -55;
    for (let i = 0; i < 6; i++) {
      const zPos = mCz - 30 + i * 12.2;
      spawnList.push({ x: mCx - 14.3, z: zPos, axis: 'z', role: 'vendor', stationary: true, facing: Math.PI / 2 });
      spawnList.push({ x: mCx + 14.3, z: zPos, axis: 'z', role: 'vendor', stationary: true, facing: -Math.PI / 2 });
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const role = i % 6 === 0 ? 'officer' : i % 5 === 0 ? 'enforcer' : i % 3 === 0 ? 'tourist' : 'commuter';
      spawnList.push({
        x: mCx + side * (7.2 + (i % 3) * 1.4),
        z: mCz - 32 + i * 4.1,
        axis: 'z', role, min: mCz - 36, max: mCz + 38,
      });
    }

    // 5. Distrito Torre, Barrio Viejo & Puerto Cenit Commuters, Enforcers & CDPD Officers
    for (let i = 0; i < 20; i++) {
      const laneZ = i < 10 ? 14 : -14;
      const x = -170 + (i % 10) * 44;
      const role = i % 5 === 0 ? 'officer' : i % 4 === 0 ? 'enforcer' : 'commuter';
      spawnList.push({ x, z: laneZ, axis: 'x', role, min: -260, max: 320 });
    }

    spawnList.forEach((sp, i) => {
      const shirt = brightColors[i % brightColors.length];
      const ped = createPedMesh(shirt, 0x263145, sp.role);
      ped.position.set(sp.x, 0, sp.z);
      if (sp.facing !== undefined) ped.rotation.y = sp.facing;
      else if (sp.stationary) ped.rotation.y = (i % 6) * 1.05;
      this.group.add(ped);
      this.peds.push({
        mesh: ped,
        role: sp.role,
        axis: sp.axis,
        dir: i % 2 === 0 ? 1 : -1,
        stationary: Boolean(sp.stationary),
        min: sp.min ?? -330,
        max: sp.max ?? 330,
        baseSpeed: sp.role === 'jogger' ? 4.4 : sp.role === 'officer' ? 2.1 : 2.1 + (i % 3) * 0.42,
        panicTimer: 0,
        fleeYaw: 0,
        phase: i * 1.1,
      });
    });
  }

  triggerPanicNear(pos, radius = 45) {
    for (const p of this.peds) {
      if (p.role === 'vendor') continue;
      const dx = p.mesh.position.x - pos.x;
      const dz = p.mesh.position.z - pos.z;
      if (dx * dx + dz * dz < radius * radius) {
        p.panicTimer = 6.0;
        p.fleeYaw = Math.atan2(dx, dz);
      }
    }
  }

  update(dt, elapsed, playerPos, panicActive) {
    // Update civilian cars
    for (const c of this.cars) {
      const dx = c.mesh.position.x - playerPos.x;
      const dz = c.mesh.position.z - playerPos.z;
      const nearPlayer = dx * dx + dz * dz < 110;
      const spd = nearPlayer ? c.speed * 0.25 : c.speed;

      if (c.axis === 'x') {
        c.mesh.position.x += c.dir * spd * dt;
        if (c.mesh.position.x > c.max) c.mesh.position.x = c.min;
        if (c.mesh.position.x < c.min) c.mesh.position.x = c.max;
      } else {
        c.mesh.position.z += c.dir * spd * dt;
        if (c.mesh.position.z > c.max) c.mesh.position.z = c.min;
        if (c.mesh.position.z < c.min) c.mesh.position.z = c.max;
      }
      for (const w of c.mesh.userData?.wheels ?? []) {
        w.rotation.x += spd * dt * 1.6;
      }
    }

    // Update pedestrians
    for (const p of this.peds) {
      if (panicActive && p.role !== 'vendor') {
        const d2 = (p.mesh.position.x - playerPos.x) ** 2 + (p.mesh.position.z - playerPos.z) ** 2;
        if (d2 < 900 && p.panicTimer <= 0) {
          p.panicTimer = 4.5;
          p.fleeYaw = Math.atan2(p.mesh.position.x - playerPos.x, p.mesh.position.z - playerPos.z);
        }
      }

      if (p.panicTimer > 0) {
        p.panicTimer -= dt;
        const spd = 6.2;
        p.mesh.position.x += Math.sin(p.fleeYaw) * spd * dt;
        p.mesh.position.z += Math.cos(p.fleeYaw) * spd * dt;
        p.mesh.rotation.y = p.fleeYaw;
        animatePedLimbs(p.mesh, elapsed * 13 + p.phase, true);
      } else if (p.stationary) {
        // Gentle idle arm gesture for vendors & relaxing beachgoers
        const l = p.mesh.userData.limbs;
        if (l) {
          l.armR.rotation.x = Math.sin(elapsed * 2.2 + p.phase) * 0.16;
          l.armL.rotation.x = -Math.sin(elapsed * 1.9 + p.phase) * 0.12;
        }
      } else {
        const spd = p.baseSpeed;
        if (p.axis === 'x') {
          p.mesh.position.x += p.dir * spd * dt;
          p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (p.mesh.position.x > p.max || p.mesh.position.x < p.min) p.dir *= -1;
        } else {
          p.mesh.position.z += p.dir * spd * dt;
          p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
          if (p.mesh.position.z > p.max || p.mesh.position.z < p.min) p.dir *= -1;
        }
        animatePedLimbs(p.mesh, elapsed * (p.role === 'jogger' ? 9.5 : 5.5) + p.phase, false);
      }
    }
  }
}

export function createPedMesh(shirtColor, pantsColor = 0x263145, role = 'commuter') {
  const g = new THREE.Group();

  let topCol = shirtColor;
  let botCol = pantsColor;
  let skinCol = role === 'beachgoer' ? 0xcf8e64 : 0xd9a27c;

  if (role === 'officer') {
    topCol = 0x1b335c;
    botCol = 0x101c34;
  } else if (role === 'enforcer') {
    topCol = 0x173c4a;
    botCol = 0x141720;
  } else if (role === 'beachgoer') {
    botCol = shirtColor;
  } else if (role === 'jogger') {
    botCol = 0x1a202e;
  } else if (role === 'vendor') {
    botCol = 0x2a2420;
  }

  const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.68 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: topCol, roughness: 0.62 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: botCol, roughness: 0.74 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1918, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), shirtMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skinMat);
  head.position.y = 1.74;
  g.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.36), hairMat);
  hair.position.y = 1.9;
  g.add(hair);

  // Archetype accessories for unmistakable visual variety!
  if (role === 'tourist') {
    // Wide-brim straw sun hat + colorful shoulder bag
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xe8c987, roughness: 0.8 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.05, 10), hatMat);
    brim.position.y = 1.92;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 10), hatMat);
    crown.position.y = 1.99;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.28), new THREE.MeshStandardMaterial({ color: 0xffbe55 }));
    bag.position.set(0.36, 1.0, 0);
    g.add(brim, crown, bag);
  } else if (role === 'officer') {
    // CDPD peaked police cap + gold chest badge
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x13264a }));
    cap.position.y = 1.96;
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.04), new THREE.MeshBasicMaterial({ color: 0xffd24d }));
    badge.position.set(0.14, 1.32, 0.17);
    g.add(cap, badge);
  } else if (role === 'vendor') {
    // Market vendor apron + red/gold bandana cap
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.06), new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.8 }));
    apron.position.set(0, 1.02, 0.17);
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), new THREE.MeshStandardMaterial({ color: 0xff5252 }));
    bandana.position.y = 1.91;
    g.add(apron, bandana);
  } else if (role === 'commuter') {
    // Briefcase / satchel
    const brief = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.38), new THREE.MeshStandardMaterial({ color: 0x3b2a20 }));
    brief.position.set(0.42, 0.78, 0.04);
    g.add(brief);
  } else if (role === 'jogger') {
    // Neon sweatband
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.38), new THREE.MeshBasicMaterial({ color: 0x34e0c8 }));
    band.position.y = 1.85;
    g.add(band);
  } else if (role === 'enforcer') {
    // Crimson Los Caimanes stripe + aviator shades
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.05), new THREE.MeshStandardMaterial({ color: 0xff4b5c }));
    lapel.position.set(0, 1.18, 0.16);
    g.add(lapel);
  }

  const legMat = role === 'beachgoer' || role === 'jogger' ? skinMat : pantsMat;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), legMat);
  legL.position.set(-0.15, 0.42, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), legMat);
  legR.position.set(0.15, 0.42, 0);

  const armMat = role === 'beachgoer' || role === 'jogger' ? skinMat : shirtMat;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.18), armMat);
  armL.position.set(-0.38, 1.16, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.18), armMat);
  armR.position.set(0.38, 1.16, 0);

  g.add(legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

export function animatePedLimbs(mesh, t, panicked = false) {
  const l = mesh.userData.limbs;
  if (!l) return;
  const swing = Math.sin(t) * (panicked ? 0.85 : 0.45);
  l.legL.rotation.x = swing;
  l.legR.rotation.x = -swing;
  l.armL.rotation.x = panicked ? -2.4 + swing * 0.4 : -swing * 0.7;
  l.armR.rotation.x = panicked ? -2.4 - swing * 0.4 : swing * 0.7;
}
