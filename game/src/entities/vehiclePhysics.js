// Arcade-drift vehicle physics, nitro boost, collisions, stunt ramp launches, tire smoke, and explosions.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, VEHICLES } from '../core/config.js';
import { STUNT_RAMPS } from '../world/cityPlan.js';

export class VehiclePhysics {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.particles = [];
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.smokeGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.sparkGeo = new THREE.BoxGeometry(0.18, 0.18, 0.45);
  }

  createDriverState(mesh, typeKey = 'apex_gt') {
    const spec = VEHICLES[typeKey] ?? VEHICLES.apex_gt;
    return {
      mesh,
      typeKey,
      spec,
      pos: mesh.position.clone(),
      vel: new THREE.Vector3(),
      yaw: mesh.rotation.y,
      speed: 0,
      vy: 0,
      grounded: true,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      nitro: 100,
      drifting: false,
      airStart: null,
      airRampId: null,
      burning: false,
    };
  }

  spawnSmoke(pos, color = 0xdedede, scale = 1.0, life = 0.65) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58 });
    const m = new THREE.Mesh(this.smokeGeo, mat);
    m.position.copy(pos);
    m.scale.setScalar(scale);
    this.particleGroup.add(m);
    this.particles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.2 + Math.random() * 1.8, (Math.random() - 0.5) * 2.2),
      life,
      maxLife: life,
      grow: 1.9,
    });
  }

  spawnExplosion(pos) {
    for (let i = 0; i < 18; i++) {
      const col = i % 3 === 0 ? 0xffe066 : i % 2 === 0 ? 0xff6b24 : 0x26242a;
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 });
      const m = new THREE.Mesh(this.smokeGeo, mat);
      m.position.copy(pos).add(new THREE.Vector3(0, 1.1, 0));
      m.scale.setScalar(1.2 + Math.random() * 1.8);
      this.particleGroup.add(m);
      const ang = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 14;
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(ang) * spd, 4 + Math.random() * 11, Math.sin(ang) * spd),
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.3,
        grow: 1.6,
      });
    }
  }

  updatePlayerVehicle(v, input, dt, callbacks = {}) {
    const { forward, right } = input.getMoveAxes();
    const handbrake = input.isDown('Space');
    const boost = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && v.nitro > 4 && forward > 0;

    const spec = v.spec;
    const maxSpd = boost ? spec.maxSpeed * 1.34 : spec.maxSpeed;
    const accel = boost ? spec.accel * 1.65 : spec.accel;

    if (boost) {
      v.nitro = Math.max(0, v.nitro - dt * 28);
    } else {
      v.nitro = Math.min(100, v.nitro + dt * 9);
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);

    // Decompose horizontal velocity into forward and lateral components
    let vFwd = v.vel.x * fwdX + v.vel.z * fwdZ;
    let vLat = v.vel.x * rightX + v.vel.z * rightZ;

    if (forward > 0) {
      vFwd += accel * dt;
    } else if (forward < 0) {
      vFwd -= (vFwd > 2 ? spec.brake : spec.accel * 0.62) * dt;
    } else {
      vFwd *= Math.pow(0.42, dt);
    }

    if (handbrake) {
      vFwd *= Math.pow(0.55, dt);
    }

    vFwd = Math.max(-spec.maxSpeed * 0.42, Math.min(maxSpd, vFwd));

    // Steering responsiveness scales with speed
    const speedFrac = Math.min(1, Math.abs(vFwd) / 14);
    const steerDir = vFwd >= -0.5 ? 1 : -1;
    const turnMul = handbrake ? 1.48 : 1.0;
    v.yaw -= right * spec.turnRate * turnMul * speedFrac * steerDir * dt;

    // Lateral grip (drift when handbraking or hard cornering at high speed)
    const grip = handbrake ? 0.94 : spec.driftGrip;
    vLat *= Math.pow(1 - grip, dt * 6);
    v.drifting = (handbrake || Math.abs(vLat) > 6.5) && Math.abs(vFwd) > 12;

    const nFwdX = Math.sin(v.yaw);
    const nFwdZ = Math.cos(v.yaw);
    const nRightX = Math.cos(v.yaw);
    const nRightZ = -Math.sin(v.yaw);

    v.vel.x = nFwdX * vFwd + nRightX * vLat;
    v.vel.z = nFwdZ * vFwd + nRightZ * vLat;
    v.speed = Math.hypot(v.vel.x, v.vel.z);

    // Integrate position & handle stunt ramps
    v.pos.x += v.vel.x * dt;
    v.pos.z += v.vel.z * dt;

    // World bounds clamp (keep out of deep ocean & far edge)
    v.pos.x = Math.max(-445, Math.min(445, v.pos.x));
    v.pos.z = Math.max(-435, Math.min(250, v.pos.z));

    // Building AABB collision
    const radius = Math.max(spec.width, spec.length) * 0.44;
    for (const c of this.colliders) {
      if (v.pos.x + radius > c.minX && v.pos.x - radius < c.maxX &&
          v.pos.z + radius > c.minZ && v.pos.z - radius < c.maxZ) {
        const dxL = Math.abs(v.pos.x + radius - c.minX);
        const dxR = Math.abs(c.maxX - (v.pos.x - radius));
        const dzT = Math.abs(v.pos.z + radius - c.minZ);
        const dzB = Math.abs(c.maxZ - (v.pos.z - radius));
        const minPen = Math.min(dxL, dxR, dzT, dzB);
        if (minPen === dxL) { v.pos.x = c.minX - radius; v.vel.x *= -0.35; }
        else if (minPen === dxR) { v.pos.x = c.maxX + radius; v.vel.x *= -0.35; }
        else if (minPen === dzT) { v.pos.z = c.minZ - radius; v.vel.z *= -0.35; }
        else { v.pos.z = c.maxZ + radius; v.vel.z *= -0.35; }

        if (v.speed > 18) {
          v.hp = Math.max(10, v.hp - v.speed * 0.25);
          if (callbacks.onCrash) callbacks.onCrash(v.speed);
        }
      }
    }

    // Stunt ramp detection
    if (v.grounded && v.speed > 20) {
      for (const r of STUNT_RAMPS) {
        if (Math.hypot(v.pos.x - r.x, v.pos.z - r.z) < 6.2) {
          v.vy = Math.min(18, v.speed * 0.34);
          v.grounded = false;
          v.airStart = v.pos.clone();
          v.airRampId = r.id;
          break;
        }
      }
    }

    // Vertical gravity & landing
    if (!v.grounded) {
      v.vy -= WORLD.gravity * dt;
      v.pos.y += v.vy * dt;
      if (v.pos.y <= 0) {
        v.pos.y = 0;
        v.vy = 0;
        v.grounded = true;
        if (v.airStart && callbacks.onStuntLand) {
          const dist = Math.hypot(v.pos.x - v.airStart.x, v.pos.z - v.airStart.z);
          callbacks.onStuntLand(v.airRampId, dist);
        }
        v.airStart = null;
      }
    }

    // Apply transform & visual body lean + wheel spin
    v.mesh.position.copy(v.pos);
    v.mesh.rotation.y = v.yaw;
    v.mesh.rotation.z = THREE.MathUtils.lerp(v.mesh.rotation.z, right * Math.min(0.08, v.speed * 0.002), dt * 8);
    v.mesh.rotation.x = v.grounded ? THREE.MathUtils.lerp(v.mesh.rotation.x, -forward * 0.03, dt * 8) : -v.vy * 0.02;

    const wheels = v.mesh.userData?.wheels ?? [];
    for (const w of wheels) w.rotation.x += vFwd * dt * 1.9;

    // Tire drift smoke & nitro flame puffs
    if ((v.drifting || boost) && Math.random() < 0.65) {
      const rearPos = v.pos.clone().add(new THREE.Vector3(-nFwdX * 2.2, 0.35, -nFwdZ * 2.2));
      this.spawnSmoke(rearPos, boost ? 0xff9238 : 0xe8ecf5, boost ? 0.65 : 0.9, 0.55);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.addScalar(dt * p.grow);
      p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.72);
    }
  }
}
