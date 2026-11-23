// Ambient civilian traffic (cars & scooters) following road lanes and reactive sidewalk pedestrians.

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
    const types = ['cabo_gt', 'baja_runner', 'scooter', 'cabo_gt'];
    const palette = [0x39c2b8, 0xf2b138, 0xe85a4f, 0x5c80bc, 0xf4f4f6, 0x8ac926];
    let idx = 0;

    // Horizontal road cruisers (including Paseo Dorado z=200)
    for (const rz of ROAD_Z) {
      for (let i = 0; i < 3; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const type = types[idx % types.length];
        const color = palette[idx % palette.length];
        const mesh = createVehicleMesh(type, color);
        const x = -280 + i * 210 + (idx % 3) * 18;
        const z = rz + (dir > 0 ? 4.8 : -4.8);
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.group.add(mesh);
        this.cars.push({
          mesh, type, axis: 'x', dir, laneCoord: z,
          speed: type === 'scooter' ? 12 : 16 + (idx % 4) * 2.5,
          min: -350, max: 350,
        });
        idx++;
      }
    }

    // Vertical road cruisers
    for (const rx of ROAD_X) {
      for (let i = 0; i < 2; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const type = types[(idx + 1) % types.length];
        const mesh = createVehicleMesh(type, palette[(idx + 2) % palette.length]);
        const x = rx + (dir > 0 ? -4.8 : 4.8);
        const z = -260 + i * 290;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        this.cars.push({
          mesh, type, axis: 'z', dir, laneCoord: x,
          speed: 15 + (idx % 3) * 2.5,
          min: -340, max: 205,
        });
        idx++;
      }
    }
  }

  _spawnPedestrians() {
    const shirtColors = [0xff6b4a, 0x34e0c8, 0xffbe55, 0x6c8cff, 0xf2f4f8, 0xff5992, 0x70e08b];
    const spawnSpots = [
      // Paseo Dorado boardwalk & sidewalk pedestrians
      ...Array.from({ length: 14 }, (_, i) => ({ x: -290 + i * 40, z: 217 + (i % 2) * 5, axis: 'x' })),
      // Mercado Nocturno shoppers
      ...Array.from({ length: 10 }, (_, i) => ({ x: -318 + (i % 2) * 16, z: -85 + i * 7, axis: 'z' })),
      // Distrito Torre commuters
      ...Array.from({ length: 8 }, (_, i) => ({ x: -120 + i * 35, z: 14, axis: 'x' })),
    ];

    spawnSpots.forEach((sp, i) => {
      const ped = createPedMesh(shirtColors[i % shirtColors.length]);
      ped.position.set(sp.x, 0, sp.z);
      this.group.add(ped);
      this.peds.push({
        mesh: ped,
        axis: sp.axis,
        dir: i % 2 === 0 ? 1 : -1,
        baseSpeed: 2.2 + (i % 3) * 0.45,
        panicTimer: 0,
        fleeYaw: 0,
        phase: i * 1.1,
      });
    });
  }

  triggerPanicNear(pos, radius = 45) {
    for (const p of this.peds) {
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
    }

    // Update pedestrians
    for (const p of this.peds) {
      if (panicActive) {
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
      } else {
        const spd = p.baseSpeed;
        if (p.axis === 'x') {
          p.mesh.position.x += p.dir * spd * dt;
          p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (p.mesh.position.x > 300 || p.mesh.position.x < -330) p.dir *= -1;
        } else {
          p.mesh.position.z += p.dir * spd * dt;
          p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
          if (p.mesh.position.z > 90 || p.mesh.position.z < -120) p.dir *= -1;
        }
        animatePedLimbs(p.mesh, elapsed * 5.5 + p.phase, false);
      }
    }
  }
}

export function createPedMesh(shirtColor, pantsColor = 0x263145) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a27c, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.65 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1918, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), shirtMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat);
  head.position.y = 1.74;
  g.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.14, 0.37), hairMat);
  hair.position.y = 1.92;
  g.add(hair);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), pantsMat);
  legL.position.set(-0.15, 0.42, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), pantsMat);
  legR.position.set(0.15, 0.42, 0);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), shirtMat);
  armL.position.set(-0.38, 1.16, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), shirtMat);
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
