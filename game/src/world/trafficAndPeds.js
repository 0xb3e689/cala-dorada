// High-density living city traffic (shootable/destructible, riding elevated bridges cleanly) and reactive killable NPCs
// with solid building collisions, realistic panicked speeds, vehicle-hit kills, bullet kills, collapse death animations & crimson marks.

import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLES } from '../core/config.js';
import { ROAD_X, ROAD_Z } from './cityPlan.js';
import { createVehicleMesh } from '../entities/vehicleFactory.js';
import { buildCharacterMesh, poseHumanStride, poseHumanFlinch, poseHumanCollapse } from '../entities/playerController.js';

export class TrafficAndPeds {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.cars = [];
    this.peds = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._bloodGeo = new THREE.CircleGeometry(0.56, 16);
    this._bloodMat = new THREE.MeshBasicMaterial({
      color: 0x6b0b16, transparent: true, opacity: 0.74, depthWrite: false,
    });

    this._spawnTraffic();
    this._spawnPedestrians();
  }

  _spawnTraffic() {
    const types = ['cabo_gt', 'convertible', 'cala_cab', 'baja_runner', 'scooter', 'cabo_gt', 'cala_cab', 'convertible'];
    const palette = [
      0x39c2b8, 0xf2b138, 0xffc824, 0xe85a4f, 0x5c80bc, 0xf4f4f6,
      0xff5e7e, 0x8ac926, 0xff8c42, 0x3b82f6, 0xe6c229,
    ];
    let idx = 0;

    const pushCar = (mesh, type, axis, dir, laneCoord, speed, min, max) => {
      const spec = VEHICLES[type] ?? VEHICLES.cabo_gt;
      this.cars.push({
        mesh,
        type,
        typeKey: type,
        spec,
        pos: mesh.position,
        yaw: mesh.rotation.y,
        vel: new THREE.Vector3(),
        knockVel: new THREE.Vector3(),
        yawSpin: 0,
        displacedTimer: 0,
        yieldOffset: 0,
        axis,
        dir,
        laneCoord,
        speed,
        curSpeed: speed,
        min,
        max,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        condition: 100,
        nitro: 100,
        burning: false,
        fireCountdown: 0,
        exploded: false,
        smokeTimer: 0,
        crackleTimer: 0,
        coughTimer: 0,
        headlightsOn: true,
        sirenActive: false,
        turboLevel: 1,
        isTraffic: true,
        playerDriven: false,
      });
    };

    for (const rz of ROAD_Z) {
      const count = rz === 200 ? 8 : rz === 120 || rz === 0 ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const type = types[idx % types.length];
        const color = type === 'cala_cab' ? 0xffc824 : palette[idx % palette.length];
        const mesh = createVehicleMesh(type, color);
        const span = 680 / count;
        const x = -335 + i * span + (idx % 3) * 14;
        const z = rz + (dir > 0 ? 4.8 : -4.8);
        const y = this.collisionWorld ? this.collisionWorld.getBridgeDeckY(x, z) : 0;
        mesh.position.set(x, y, z);
        mesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.group.add(mesh);
        pushCar(mesh, type, 'x', dir, z, type === 'scooter' ? 11.5 : 14.5 + (idx % 5) * 2.2, -355, 355);
        idx++;
      }
    }

    for (const rx of ROAD_X) {
      const count = Math.abs(rx) <= 180 ? 5 : 4;
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const type = types[(idx + 1) % types.length];
        const color = type === 'cala_cab' ? 0xffc824 : palette[(idx + 3) % palette.length];
        const mesh = createVehicleMesh(type, color);
        const x = rx + (dir > 0 ? -4.8 : 4.8);
        const span = 530 / count;
        const z = -325 + i * span + (idx % 3) * 10;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = dir > 0 ? 0 : Math.PI;
        this.group.add(mesh);
        pushCar(mesh, type, 'z', dir, x, type === 'scooter' ? 11.0 : 13.5 + (idx % 4) * 2.2, -345, 205);
        idx++;
      }
    }
  }

  _spawnPedestrians() {
    const brightColors = [0xff6b4a, 0x34e0c8, 0xffbe55, 0x6c8cff, 0xf2f4f8, 0xff5992, 0x70e08b, 0xff9248, 0x5be3ff];
    const spawnList = [];

    for (let i = 0; i < 24; i++) {
      const onEast = i >= 16;
      const x = onEast ? 186 + (i - 16) * 22 : -320 + i * 22;
      const z = 234 + (i % 4) * 7.5;
      spawnList.push({
        x, z, axis: 'x', role: i % 3 === 0 ? 'tourist' : 'beachgoer',
        stationary: i % 3 === 1, min: onEast ? 182 : -335, max: onEast ? 355 : 38,
      });
    }

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

    for (let i = 0; i < 16; i++) {
      const x = -315 + i * 22;
      if (x > 28 && x < 185) continue;
      const role = i % 5 === 0 ? 'officer' : i % 2 === 0 ? 'tourist' : 'commuter';
      spawnList.push({ x, z: 184 + (i % 2) * 2.2, axis: 'x', role, min: -330, max: 32 });
    }

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

    for (let i = 0; i < 20; i++) {
      const laneZ = i < 10 ? 14 : -14;
      const x = -170 + (i % 10) * 44;
      if (x > 125 && x < 170) continue; // Keep clear of Río Dorado river channel
      const role = i % 5 === 0 ? 'officer' : i % 4 === 0 ? 'enforcer' : 'commuter';
      spawnList.push({ x, z: laneZ, axis: 'x', role, min: -260, max: 120 });
    }

    spawnList.forEach((sp, i) => {
      const shirt = brightColors[i % brightColors.length];
      const ped = createPedMesh(shirt, 0x263145, sp.role);
      ped.position.set(sp.x, 0, sp.z);
      if (sp.facing !== undefined) ped.rotation.y = sp.facing;
      else if (sp.stationary) ped.rotation.y = (i % 6) * 1.05;
      this.group.add(ped);
      const maxHp = sp.role === 'officer' ? 90 : 55;
      this.peds.push({
        mesh: ped,
        pos: ped.position,
        role: sp.role,
        axis: sp.axis,
        dir: i % 2 === 0 ? 1 : -1,
        stationary: Boolean(sp.stationary),
        min: sp.min ?? -330,
        max: sp.max ?? 330,
        baseSpeed: sp.role === 'jogger' ? 3.5 : sp.role === 'officer' ? 1.9 : 1.7 + (i % 3) * 0.25,
        fleeSpeed: 3.8 + (i % 5) * 0.2,
        hp: maxHp,
        maxHp,
        dead: false,
        downed: false,
        deathTimer: 0,
        fallSide: i % 2 === 0 ? 1 : -1,
        bloodMark: null,
        panicTimer: 0,
        fleeYaw: 0,
        flinchTimer: 0,
        knockdownTimer: 0,
        knockVel: new THREE.Vector3(),
        phase: i * 1.1,
      });
    });
  }

  _killPed(ped) {
    if (ped.dead) return;
    ped.hp = 0;
    ped.dead = true;
    ped.downed = true;
    ped.deathTimer = 0.001;
    ped.deathBaseY = ped.mesh.position.y ?? 0;
    ped.knockdownTimer = 0;
    if (!ped.bloodMark) {
      const mark = new THREE.Mesh(this._bloodGeo, this._bloodMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(ped.mesh.position.x, ped.deathBaseY + 0.04, ped.mesh.position.z);
      this.group.add(mark);
      ped.bloodMark = mark;
    }
    poseHumanCollapse(ped.mesh, 0.12, ped.fallSide, ped.deathBaseY);
  }

  reactToHorn(originPos, radius = 22) {
    let reacted = 0;
    for (const p of this.peds) {
      if (p.role === 'vendor' || p.dead || p.downed) continue;
      const dx = p.mesh.position.x - originPos.x;
      const dz = p.mesh.position.z - originPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        p.panicTimer = Math.max(p.panicTimer, 1.8);
        p.fleeYaw = Math.atan2(dx, dz);
        reacted++;
      }
    }
    return reacted;
  }

  triggerPanicNear(pos, radius = 48) {
    for (const p of this.peds) {
      if (p.role === 'vendor' || p.dead || p.downed) continue;
      const dx = p.mesh.position.x - pos.x;
      const dz = p.mesh.position.z - pos.z;
      if (dx * dx + dz * dz < radius * radius) {
        p.panicTimer = 6.5;
        p.fleeYaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.35;
      }
    }
  }

  applyPedShot(ped, dmg, dir) {
    if (!ped || ped.dead || ped.downed) return { killed: false };
    ped.hp = Math.max(0, ped.hp - Math.max(1, Math.round(dmg)));
    ped.flinchTimer = 0.28;
    ped.panicTimer = 7.0;
    if (dir) {
      ped.fleeYaw = Math.atan2(dir.x, dir.z);
      ped.mesh.position.x += dir.x * 0.22;
      ped.mesh.position.z += dir.z * 0.22;
    }
    if (ped.hp <= 0) {
      this._killPed(ped);
      return { killed: true };
    }
    return { killed: false };
  }

  applyPedVehicleImpact(ped, dirX, dirZ, speed) {
    if (!ped || ped.dead || ped.downed) return { hit: false, killed: false };
    const force = Math.min(18, Math.max(5.5, speed * 0.72));
    ped.knockVel.set(dirX * force, 0, dirZ * force);
    ped.knockdownTimer = 1.65;
    ped.flinchTimer = 0.32;
    ped.panicTimer = 7.0;
    ped.fleeYaw = Math.atan2(dirX, dirZ);
    const dmg = Math.round(speed * 3.2);
    ped.hp = Math.max(0, ped.hp - dmg);
    if (ped.hp <= 0) {
      this._killPed(ped);
      return { hit: true, killed: true };
    }
    return { hit: true, killed: false };
  }

  update(dt, elapsed, playerPos, panicActive, sirenSource = null) {
    // Update civilian cars (with solid collision knockback/spin, bridge elevation & siren pull-aside yielding!)
    for (const c of this.cars) {
      if (c.playerDriven) continue;
      if (c.exploded || c.burning) {
        c.curSpeed = 0;
        if (c.knockVel && c.knockVel.lengthSq() > 0.02) {
          c.knockVel.multiplyScalar(Math.pow(0.08, dt));
          if (this.collisionWorld) this.collisionWorld.moveAndSlide(c.mesh.position, c.knockVel, 1.6, dt, { bounce: 0.2 });
          else { c.mesh.position.x += c.knockVel.x * dt; c.mesh.position.z += c.knockVel.z * dt; }
        }
        continue;
      }

      // Apply collision knockback velocity & yaw spin impulse when rammed!
      if ((c.displacedTimer ?? 0) > 0 || (c.knockVel && c.knockVel.lengthSq() > 0.04)) {
        c.displacedTimer = Math.max(0, (c.displacedTimer ?? 0) - dt);
        if (c.knockVel) {
          c.knockVel.multiplyScalar(Math.pow(0.08, dt));
          if (this.collisionWorld) {
            this.collisionWorld.moveAndSlide(c.mesh.position, c.knockVel, 1.55, dt, { bounce: 0.22 });
          } else {
            c.mesh.position.x += c.knockVel.x * dt;
            c.mesh.position.z += c.knockVel.z * dt;
          }
          c.vel.copy(c.knockVel);
        }
        if (Math.abs(c.yawSpin ?? 0) > 0.01) {
          c.mesh.rotation.y += c.yawSpin * dt;
          c.yawSpin *= Math.pow(0.07, dt);
        }
        if (this.collisionWorld) {
          c.mesh.position.y = this.collisionWorld.getSurfaceHeight(c.mesh.position.x, c.mesh.position.z, c.mesh.position.y);
        }
        c.yaw = c.mesh.rotation.y;
        c.curSpeed = c.knockVel ? Math.hypot(c.knockVel.x, c.knockVel.z) : 0;
        continue;
      }

      const dx = c.mesh.position.x - playerPos.x;
      const dz = c.mesh.position.z - playerPos.z;
      const nearPlayer = dx * dx + dz * dz < 85;
      const condMul = c.hp / Math.max(1, c.maxHp) < 0.45 ? 0.55 : 1.0;

      // Police siren pull-aside yield when player drives a police cruiser with active siren!
      let sirenYield = false;
      if (sirenSource) {
        const sdx = c.mesh.position.x - sirenSource.pos.x;
        const sdz = c.mesh.position.z - sirenSource.pos.z;
        const sDist = Math.hypot(sdx, sdz);
        if (sDist < 42) {
          const fwdDot = (sdx * Math.sin(sirenSource.yaw) + sdz * Math.cos(sirenSource.yaw)) / Math.max(1, sDist);
          if (fwdDot > 0.15) sirenYield = true;
        }
      }
      const targetYield = sirenYield ? 3.2 : 0;
      c.yieldOffset = THREE.MathUtils.lerp(c.yieldOffset ?? 0, targetYield, Math.min(1, dt * 3.5));

      const spd = (sirenYield ? c.speed * 0.22 : nearPlayer ? c.speed * 0.32 : c.speed) * condMul;
      c.curSpeed = spd;

      if (c.axis === 'x') {
        const targetYaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        c.mesh.rotation.y = THREE.MathUtils.lerp(c.mesh.rotation.y, targetYaw, Math.min(1, dt * 5));
        const targetZ = c.laneCoord + (c.dir > 0 ? c.yieldOffset : -c.yieldOffset);
        c.mesh.position.z = THREE.MathUtils.lerp(c.mesh.position.z, targetZ, Math.min(1, dt * 3.5));
        c.mesh.position.x += c.dir * spd * dt;
        if (c.mesh.position.x > c.max) c.mesh.position.x = c.min;
        if (c.mesh.position.x < c.min) c.mesh.position.x = c.max;
        c.vel.set(c.dir * spd, 0, 0);
        if (this.collisionWorld) {
          const yNow = this.collisionWorld.getBridgeDeckY(c.mesh.position.x, c.mesh.position.z);
          const yAhead = this.collisionWorld.getBridgeDeckY(c.mesh.position.x + c.dir * 2.2, c.mesh.position.z);
          c.mesh.position.y = yNow;
          c.mesh.rotation.x = -Math.atan2(yAhead - yNow, 2.2);
        }
      } else {
        const targetYaw = c.dir > 0 ? 0 : Math.PI;
        c.mesh.rotation.y = THREE.MathUtils.lerp(c.mesh.rotation.y, targetYaw, Math.min(1, dt * 5));
        const targetX = c.laneCoord + (c.dir > 0 ? -c.yieldOffset : c.yieldOffset);
        c.mesh.position.x = THREE.MathUtils.lerp(c.mesh.position.x, targetX, Math.min(1, dt * 3.5));
        c.mesh.position.z += c.dir * spd * dt;
        if (c.mesh.position.z > c.max) c.mesh.position.z = c.min;
        if (c.mesh.position.z < c.min) c.mesh.position.z = c.max;
        c.vel.set(0, 0, c.dir * spd);
      }
      c.yaw = c.mesh.rotation.y;
      for (const w of c.mesh.userData?.wheels ?? []) {
        w.rotation.x += spd * dt * 1.6;
      }
    }

    const tmpVel = new THREE.Vector3();

    // Update pedestrians (including smooth death collapse animation & 25s despawn cleanup)
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.dead || p.downed) {
        p.deathTimer += dt;
        if (p.deathTimer <= 0.6) {
          poseHumanCollapse(p.mesh, Math.min(1, p.deathTimer / 0.46), p.fallSide, p.deathBaseY ?? 0);
        }
        if (p.deathTimer >= 25) {
          this.group.remove(p.mesh);
          if (p.bloodMark) this.group.remove(p.bloodMark);
          this.peds.splice(i, 1);
        }
        continue;
      }

      if (p.flinchTimer > 0) p.flinchTimer = Math.max(0, p.flinchTimer - dt);

      // Car-hit tumble/knockdown & smooth get-up recovery
      if (p.knockdownTimer > 0) {
        p.knockdownTimer = Math.max(0, p.knockdownTimer - dt);
        p.knockVel.multiplyScalar(Math.pow(0.08, dt));
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(p.mesh.position, p.knockVel, 0.5, dt);
        else { p.mesh.position.x += p.knockVel.x * dt; p.mesh.position.z += p.knockVel.z * dt; }
        const baseY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y) : 0;
        const f = p.knockdownTimer < 0.45 ? p.knockdownTimer / 0.45 : 1.0;
        p.mesh.position.y = baseY + 0.18 * f;
        p.mesh.rotation.x = -Math.PI * 0.48 * f;
        continue;
      }
      p.mesh.rotation.x = 0;
      p.mesh.rotation.z = 0;
      p.mesh.position.y = this.collisionWorld
        ? this.collisionWorld.getSurfaceHeight(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y)
        : 0;

      if (panicActive && p.role !== 'vendor') {
        const d2 = (p.mesh.position.x - playerPos.x) ** 2 + (p.mesh.position.z - playerPos.z) ** 2;
        if (d2 < 900 && p.panicTimer <= 0) {
          p.panicTimer = 5.0;
          p.fleeYaw = Math.atan2(p.mesh.position.x - playerPos.x, p.mesh.position.z - playerPos.z);
        }
      }

      if (p.panicTimer > 0) {
        p.panicTimer -= dt;
        const spd = p.fleeSpeed;
        tmpVel.set(Math.sin(p.fleeYaw) * spd, 0, Math.cos(p.fleeYaw) * spd);
        if (this.collisionWorld) {
          const hit = this.collisionWorld.moveAndSlide(p.mesh.position, tmpVel, 0.5, dt);
          if (hit.hit) p.fleeYaw += 1.2;
          if (this.collisionWorld.getWaterDepth(p.mesh.position.x, p.mesh.position.z, 0) > 0.4) {
            p.fleeYaw += Math.PI * 0.75;
          }
        } else {
          p.mesh.position.x += tmpVel.x * dt;
          p.mesh.position.z += tmpVel.z * dt;
        }
        p.mesh.rotation.y = p.fleeYaw;
        animatePedLimbs(p.mesh, elapsed * 10.2 + p.phase, true);
      } else if (p.stationary) {
        const l = p.mesh.userData.limbs;
        if (l) {
          l.armR.rotation.x = Math.sin(elapsed * 2.2 + p.phase) * 0.16;
          l.armL.rotation.x = -Math.sin(elapsed * 1.9 + p.phase) * 0.12;
        }
      } else {
        const spd = p.baseSpeed;
        if (p.axis === 'x') {
          tmpVel.set(p.dir * spd, 0, 0);
          p.mesh.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (this.collisionWorld) {
            const hit = this.collisionWorld.moveAndSlide(p.mesh.position, tmpVel, 0.5, dt);
            if (hit.hit || this.collisionWorld.getWaterDepth(p.mesh.position.x, p.mesh.position.z, 0) > 0.35) p.dir *= -1;
          } else {
            p.mesh.position.x += tmpVel.x * dt;
          }
          if (p.mesh.position.x > p.max || p.mesh.position.x < p.min) p.dir *= -1;
        } else {
          tmpVel.set(0, 0, p.dir * spd);
          p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
          if (this.collisionWorld) {
            const hit = this.collisionWorld.moveAndSlide(p.mesh.position, tmpVel, 0.5, dt);
            if (hit.hit || this.collisionWorld.getWaterDepth(p.mesh.position.x, p.mesh.position.z, 0) > 0.35) p.dir *= -1;
          } else {
            p.mesh.position.z += tmpVel.z * dt;
          }
          if (p.mesh.position.z > p.max || p.mesh.position.z < p.min) p.dir *= -1;
        }
        animatePedLimbs(p.mesh, elapsed * (p.role === 'jogger' ? 8.8 : 5.2) + p.phase, false);
      }

      if (p.flinchTimer > 0) {
        poseHumanFlinch(p.mesh, p.flinchTimer / 0.28);
      }
    }
  }
}

export function createPedMesh(shirtColor, pantsColor = 0x263145, role = 'commuter') {
  let topCol = shirtColor;
  let botCol = pantsColor;
  let skinCol = role === 'beachgoer' ? 0xcf8e64 : 0xd9a27c;
  let accentCol = 0xf4eee4;
  let outfitStyle = 'coastal';
  let accessory = 'none';
  let isFemale = false;

  if (role === 'officer') {
    topCol = 0x1b335c;
    botCol = 0x101c34;
    accentCol = 0xdbe6f6;
    outfitStyle = 'tactical';
    accessory = 'aviators';
  } else if (role === 'enforcer') {
    topCol = 0x173c4a;
    botCol = 0x141720;
    accentCol = 0xff4b5c;
    outfitStyle = 'bomber';
    accessory = 'aviators';
  } else if (role === 'beachgoer') {
    botCol = shirtColor;
    isFemale = (shirtColor % 2 === 0);
  } else if (role === 'jogger') {
    botCol = 0x1a202e;
    isFemale = (shirtColor % 3 === 0);
  } else if (role === 'vendor') {
    botCol = 0x2a2420;
    outfitStyle = 'coastal';
  } else if (role === 'tourist') {
    isFemale = (shirtColor % 2 === 1);
    accessory = 'aviators';
  } else {
    outfitStyle = 'blazer';
    isFemale = (shirtColor % 2 === 0);
  }

  return buildCharacterMesh({
    jacket: topCol,
    accent: accentCol,
    pants: botCol,
    skin: skinCol,
    hair: isFemale ? 0x2c1b18 : 0x1e1918,
    isFemale,
    outfitStyle,
    hairStyle: isFemale ? 'ponytail' : (role === 'officer' ? 'fade' : 'swept'),
    accessory,
    shortSleeves: role === 'beachgoer' || role === 'jogger' || role === 'tourist',
    shorts: role === 'beachgoer' || role === 'jogger',
    withWeapon: false,
    role,
  });
}

export function animatePedLimbs(mesh, t, panicked = false) {
  poseHumanStride(mesh, t, panicked);
}
