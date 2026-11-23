// Need-for-Speed arcade vehicle physics, solid sub-stepped AABB collisions, natural shoreline water drag,
// gradual damage -> smoke -> fire -> 5.0s humane bail-out countdown -> fireball explosion & blackened wreck.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, VEHICLES } from '../core/config.js';
import { updateVehicleDamageVisuals } from './vehicleFactory.js';

export class VehiclePhysics {
  constructor(scene, collisionWorld) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.particles = [];
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.smokeGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.sparkGeo = new THREE.BoxGeometry(0.14, 0.14, 0.42);
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
      vFwd: 0,
      vy: 0,
      grounded: true,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      condition: 100,
      nitro: 100,
      boosting: false,
      drifting: false,
      inWater: false,
      burning: false,
      fireCountdown: 0,
      exploded: false,
      crackleTimer: 0,
      coughTimer: 0,
      smokeTimer: 0,
      turboLevel: 1,
    };
  }

  repairVehicle(v, paintHex = null) {
    v.hp = v.maxHp;
    v.condition = 100;
    v.nitro = 100;
    v.burning = false;
    v.fireCountdown = 0;
    v.exploded = false;
    v.mesh.rotation.z = 0;
    v.mesh.rotation.x = 0;
    if (v.mesh.userData?.paintMat) {
      v.mesh.userData.paintMat.color.set(paintHex ?? v.mesh.userData.baseColorHex ?? v.spec.color);
      v.mesh.userData.paintMat.roughness = 0.2;
      v.mesh.userData.paintMat.metalness = 0.68;
    }
    updateVehicleDamageVisuals(v, 0);
  }

  applyDamage(v, amount, callbacks = {}) {
    if (!v || v.exploded) return;
    v.hp = Math.max(0, v.hp - amount);
    v.condition = Math.round((v.hp / Math.max(1, v.maxHp)) * 100);
    if (v.hp <= 0 && !v.burning) {
      v.burning = true;
      v.fireCountdown = 5.0; // Humane 5.0-second bail-out countdown before detonation!
      v.crackleTimer = 0;
      if (callbacks.onIgnite) callbacks.onIgnite(v);
    }
  }

  spawnSmoke(pos, color = 0xdedede, scale = 1.0, life = 0.65) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 });
    const m = new THREE.Mesh(this.smokeGeo, mat);
    m.position.copy(pos);
    m.scale.setScalar(scale);
    this.particleGroup.add(m);
    this.particles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.4 + Math.random() * 2.0, (Math.random() - 0.5) * 2.2),
      life,
      maxLife: life,
      grow: 1.85,
    });
  }

  spawnCollisionSparks(pos, normalX, normalZ, count = 10) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffe073 : 0xff8a30,
        transparent: true,
        opacity: 0.95,
      });
      const m = new THREE.Mesh(this.sparkGeo, mat);
      m.position.copy(pos);
      const spread = (Math.random() - 0.5) * 1.4;
      const spd = 6 + Math.random() * 11;
      const vx = (normalX + spread) * spd;
      const vz = (normalZ + spread) * spd;
      const vy = 2.5 + Math.random() * 6.5;
      m.lookAt(pos.x + vx, pos.y + vy, pos.z + vz);
      this.particleGroup.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0.25 + Math.random() * 0.22,
        maxLife: 0.45,
        grow: -0.4,
        gravity: 22,
      });
    }
  }

  spawnExplosion(pos) {
    for (let i = 0; i < 24; i++) {
      const col = i % 3 === 0 ? 0xffe066 : i % 2 === 0 ? 0xff6b24 : 0x222026;
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.94 });
      const m = new THREE.Mesh(this.smokeGeo, mat);
      m.position.copy(pos).add(new THREE.Vector3(0, 1.1, 0));
      m.scale.setScalar(1.3 + Math.random() * 2.1);
      this.particleGroup.add(m);
      const ang = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 16;
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(ang) * spd, 4.5 + Math.random() * 12, Math.sin(ang) * spd),
        life: 0.9 + Math.random() * 0.7,
        maxLife: 1.5,
        grow: 1.8,
      });
    }
  }

  // Always tick vehicle fire countdown & smoke even if the player already bailed out!
  updateVehicleLifecycle(v, dt, elapsed, callbacks = {}) {
    if (!v) return;
    const cond = v.hp / Math.max(1, v.maxHp);
    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const hoodPos = v.pos.clone().add(new THREE.Vector3(fwdX * (v.spec.length * 0.34), 1.12, fwdZ * (v.spec.length * 0.34)));

    // 1. Gradual Damage Smoke Stages
    v.smokeTimer -= dt;
    if (v.exploded) {
      // Lingering dark smoke on blackened wreck
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.26;
        this.spawnSmoke(hoodPos, 0x1c1c20, 0.95, 1.3);
      }
    } else if (v.burning) {
      // ON FIRE: bright flames + dark smoke + crackling SFX + 5.0-second humane countdown!
      v.fireCountdown = Math.max(0, v.fireCountdown - dt);
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.09;
        this.spawnSmoke(hoodPos, Math.random() < 0.45 ? 0xff7824 : 0x1e1d22, 0.95, 0.95);
      }
      v.crackleTimer -= dt;
      if (v.crackleTimer <= 0) {
        v.crackleTimer = 0.26;
        if (callbacks.audio) callbacks.audio.playFireCrackle();
      }
      if (v.fireCountdown <= 0) {
        v.exploded = true;
        v.burning = false;
        v.vel.multiplyScalar(0.1);
        v.speed = 0;
        v.mesh.rotation.z = 0.14;
        this.spawnExplosion(v.pos);
        if (callbacks.audio) callbacks.audio.playExplosion();
        if (callbacks.onExplode) callbacks.onExplode(v);
      }
    } else if (cond <= 0.35 && cond > 0) {
      // 35% - 1%: Thick dark black smoke + intermittent engine cough
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.14;
        this.spawnSmoke(hoodPos, 0x26262c, 0.88, 0.9);
      }
    } else if (cond <= 0.60 && cond > 0.35) {
      // 60% - 35%: Light white/gray smoke puffs rising from engine bay
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.24;
        this.spawnSmoke(hoodPos, 0xd4dae3, 0.62, 0.72);
      }
    }

    updateVehicleDamageVisuals(v, elapsed);
  }

  updatePlayerVehicle(v, input, dt, elapsed, callbacks = {}) {
    if (v.exploded) {
      v.boosting = false;
      v.drifting = false;
      v.vel.multiplyScalar(Math.pow(0.05, dt));
      v.speed = Math.hypot(v.vel.x, v.vel.z);
      if (v.mesh.userData?.nitroFlames) v.mesh.userData.nitroFlames.visible = false;
      return;
    }

    const { forward, right } = input.getMoveAxes();
    const handbrake = input.isDown('Space');
    const cond = v.hp / Math.max(1, v.maxHp);
    const canDrive = !v.burning;
    const boost = canDrive && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && v.nitro > 4 && forward > 0;
    v.boosting = boost;

    const spec = v.spec;
    const turboMul = 1 + ((v.turboLevel ?? 1) - 1) * 0.08;
    const damageSpeedMul = v.burning ? 0.35 : cond <= 0.35 ? 0.84 : 1.0;

    // Intermittent engine cough when heavily damaged (35%-1%)
    let coughMul = 1.0;
    if (!v.burning && cond <= 0.35) {
      v.coughTimer -= dt;
      if (v.coughTimer <= 0) v.coughTimer = 1.8 + Math.random() * 1.4;
      if (v.coughTimer < 0.28) coughMul = 0.25;
    }

    const maxSpd = (boost ? spec.maxSpeed * 1.14 : spec.maxSpeed) * turboMul * damageSpeedMul;

    if (boost) {
      v.nitro = Math.max(0, v.nitro - dt * 26);
    } else {
      v.nitro = Math.min(100, v.nitro + dt * 8.5);
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);

    // Decompose horizontal velocity into forward and lateral components
    let vFwd = v.vel.x * fwdX + v.vel.z * fwdZ;
    let vLat = v.vel.x * rightX + v.vel.z * rightZ;

    // Need-for-Speed progressive torque curve: punchy launch at low speeds, smooth top-end pull
    const speedRatio = Math.min(1, Math.abs(vFwd) / Math.max(1, maxSpd));
    const torqueCurve = 1.32 - 0.62 * speedRatio * speedRatio;
    const effAccel = (boost ? spec.accel * 1.62 : spec.accel) * turboMul * torqueCurve * coughMul;

    if (forward > 0 && canDrive) {
      vFwd += effAccel * dt;
    } else if (forward < 0 && canDrive) {
      vFwd -= (vFwd > 1.5 ? spec.brake : spec.accel * 0.56) * dt;
    } else {
      vFwd *= Math.pow(v.burning ? 0.18 : 0.46, dt);
    }

    if (handbrake) {
      vFwd *= Math.pow(0.54, dt);
    }

    // Natural water depth drag (respecting elevated bridge deck height!)
    const waterDepth = this.collisionWorld ? this.collisionWorld.getWaterDepth(v.pos.x, v.pos.z, v.pos.y) : 0;
    v.inWater = waterDepth > 0.05;
    if (waterDepth > 0.05) {
      vFwd *= Math.pow(waterDepth > 0.9 ? 0.12 : 0.38, dt);
      if (waterDepth > 1.0 && this.collisionWorld) {
        const ret = this.collisionWorld.getShoreReturnVector(v.pos.x, v.pos.z);
        v.vel.x += ret.x * 9.0 * dt;
        v.vel.z += ret.z * 9.0 * dt;
      }
    }

    vFwd = Math.max(-spec.maxSpeed * 0.34, Math.min(maxSpd, vFwd));

    // Speed-sensitive steering (agile at low/mid speed, composed & weighty at 140+ MPH)
    const lowSpeedRamp = Math.min(1, Math.abs(vFwd) / 7.5);
    const highSpeedStability = 1.0 - 0.42 * Math.min(1, Math.abs(vFwd) / Math.max(1, spec.maxSpeed));
    const steerDir = vFwd >= -0.4 ? 1 : -1;
    const turnMul = handbrake ? 1.46 : 1.0;
    v.yaw -= right * spec.turnRate * turnMul * lowSpeedRamp * highSpeedStability * steerDir * dt;

    // Clean arcade drift slip angle on handbrake or high-speed cornering
    const grip = handbrake ? 0.52 : spec.driftGrip;
    vLat *= Math.pow(1 - grip, dt * 6.5);
    v.drifting = (handbrake || Math.abs(vLat) > 6.0) && Math.abs(vFwd) > 11;

    const nFwdX = Math.sin(v.yaw);
    const nFwdZ = Math.cos(v.yaw);
    const nRightX = Math.cos(v.yaw);
    const nRightZ = -Math.sin(v.yaw);

    v.vel.x = nFwdX * vFwd + nRightX * vLat;
    v.vel.z = nFwdZ * vFwd + nRightZ * vLat;
    v.vFwd = vFwd;

    // Solid sub-stepped building, bridge rail, seawall & prop collision resolution
    const radius = Math.max(spec.width * 0.62, spec.length * 0.38);
    if (this.collisionWorld) {
      const hit = this.collisionWorld.moveAndSlide(v.pos, v.vel, radius, dt, {
        bounce: 0.22,
        tangentDamp: 0.14,
      });
      if (hit.hit && hit.impactSpeed > 6.5) {
        const contactPt = v.pos.clone().add(new THREE.Vector3(-hit.normalX * radius, 0.85, -hit.normalZ * radius));
        this.spawnCollisionSparks(contactPt, hit.normalX, hit.normalZ, Math.min(16, Math.round(hit.impactSpeed * 0.45)));
        if (callbacks.audio) callbacks.audio.playCrash(hit.impactSpeed);
        if (hit.impactSpeed > 10) {
          const dmg = (hit.impactSpeed - 8) * 1.15;
          this.applyDamage(v, dmg, callbacks);
          if (callbacks.onCrash) callbacks.onCrash(hit.impactSpeed);
        }
      }
    } else {
      v.pos.x += v.vel.x * dt;
      v.pos.z += v.vel.z * dt;
    }

    v.speed = Math.hypot(v.vel.x, v.vel.z);

    // Vertical elevation: smoothly ride up & over elevated bridges, OR drive underneath along embankments!
    const surfaceY = this.collisionWorld ? this.collisionWorld.getSurfaceY(v.pos.x, v.pos.z, v.pos.y) : 0;
    if (v.grounded) {
      v.pos.y = THREE.MathUtils.lerp(v.pos.y, surfaceY, Math.min(1, dt * 16));
      if (Math.abs(v.pos.y - surfaceY) < 0.06) v.pos.y = surfaceY;
    } else {
      v.vy -= WORLD.gravity * dt;
      v.pos.y += v.vy * dt;
      if (v.pos.y <= surfaceY) {
        v.pos.y = surfaceY;
        v.vy = 0;
        v.grounded = true;
      }
    }

    // Apply transform & responsive suspension pitch/roll + bridge ramp pitch + wheel spin
    v.mesh.position.copy(v.pos);
    v.mesh.rotation.y = v.yaw;
    let rampPitch = 0;
    if (this.collisionWorld && surfaceY > 0.05) {
      const aheadY = this.collisionWorld.getSurfaceY(v.pos.x + nFwdX * 2.2, v.pos.z + nFwdZ * 2.2, v.pos.y);
      const behindY = this.collisionWorld.getSurfaceY(v.pos.x - nFwdX * 2.2, v.pos.z - nFwdZ * 2.2, v.pos.y);
      rampPitch = -Math.atan2(aheadY - behindY, 4.4);
    }
    const targetRoll = right * Math.min(0.085, v.speed * 0.0022) * (handbrake ? 1.3 : 1.0);
    const targetPitch = rampPitch + (boost ? -0.042 : -forward * 0.025);
    v.mesh.rotation.z = THREE.MathUtils.lerp(v.mesh.rotation.z, targetRoll, Math.min(1, dt * 8));
    v.mesh.rotation.x = THREE.MathUtils.lerp(v.mesh.rotation.x, targetPitch, Math.min(1, dt * 8));

    const wheels = v.mesh.userData?.wheels ?? [];
    for (const w of wheels) w.rotation.x += vFwd * dt * 1.9;
    if (v.mesh.userData?.nitroFlames) {
      v.mesh.userData.nitroFlames.visible = boost;
    }

    // Tire drift smoke & nitro puffs
    if ((v.drifting || boost) && Math.random() < 0.65) {
      const rearPos = v.pos.clone().add(new THREE.Vector3(-nFwdX * 2.2, 0.35, -nFwdZ * 2.2));
      this.spawnSmoke(rearPos, boost ? 0xff9238 : 0xe8ecf5, boost ? 0.62 : 0.88, 0.55);
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
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.addScalar(dt * p.grow);
      if (p.mesh.scale.x < 0.05) p.mesh.scale.setScalar(0.05);
      p.mesh.material.opacity = Math.max(0, (p.life / p.maxLife) * 0.78);
    }
  }
}
