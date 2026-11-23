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
      inWater: Boolean(spec.isBoat),
      engineStalled: false,
      headlightsOn: true,
      sirenActive: false,
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
    v.engineStalled = false;
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

    if (v.spec?.isBoat) {
      this._updatePlayerBoat(v, input, dt, elapsed, callbacks);
      return;
    }

    const { forward, right } = input.getMoveAxes();
    const handbrake = input.isDown('Space');
    const cond = v.hp / Math.max(1, v.maxHp);

    // Check water depth BEFORE throttle so flooded cars stall cleanly and let player bail out into swimming mode!
    const waterDepth = this.collisionWorld ? this.collisionWorld.getWaterDepth(v.pos.x, v.pos.z, v.pos.y) : 0;
    v.inWater = waterDepth > 0.05;
    if (waterDepth >= 1.05 && !v.engineStalled) {
      v.engineStalled = true;
      if (callbacks.audio) callbacks.audio.playWaterSplash(1.0);
      if (callbacks.onEngineStalled) callbacks.onEngineStalled(v);
    } else if (waterDepth < 0.65 && v.engineStalled) {
      v.engineStalled = false;
    }

    const canDrive = !v.burning && !v.engineStalled;
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
      vFwd *= Math.pow(v.engineStalled ? 0.06 : v.burning ? 0.18 : 0.46, dt);
    }

    if (handbrake) {
      vFwd *= Math.pow(0.54, dt);
    }

    // Natural water depth drag
    if (waterDepth > 0.05) {
      vFwd *= Math.pow(waterDepth > 0.9 ? 0.08 : 0.38, dt);
      vLat *= Math.pow(0.2, dt);
    }

    vFwd = Math.max(-spec.maxSpeed * 0.34, Math.min(maxSpd, vFwd));

    // Speed-sensitive steering (agile at low/mid speed, composed & weighty at 140+ MPH)
    const lowSpeedRamp = Math.min(1, Math.abs(vFwd) / 7.5);
    const highSpeedStability = 1.0 - 0.42 * Math.min(1, Math.abs(vFwd) / Math.max(1, spec.maxSpeed));
    const steerDir = vFwd >= -0.4 ? 1 : -1;
    const turnMul = handbrake ? 1.46 : 1.0;
    if (!v.engineStalled) {
      v.yaw -= right * spec.turnRate * turnMul * lowSpeedRamp * highSpeedStability * steerDir * dt;
    }

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
    const radius = Math.max(spec.width * 0.58, spec.length * 0.36);
    if (this.collisionWorld) {
      const hit = this.collisionWorld.moveAndSlide(v.pos, v.vel, radius, dt, {
        bounce: 0.22,
        tangentDamp: 0.14,
        entityHeight: spec.height ?? 1.5,
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

    // Vertical elevation: smoothly ride up & over elevated bridges, OR drive underneath along embankments, OR sink slightly if flooded!
    const rawSurfaceY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(v.pos.x, v.pos.z, v.pos.y) : 0;
    const surfaceY = v.engineStalled ? -0.32 : rawSurfaceY;
    if (v.grounded) {
      if (surfaceY > v.pos.y) {
        // Immediate climb lock on ramps so high-speed cars NEVER lag behind bridge elevation!
        v.pos.y = surfaceY;
      } else {
        v.pos.y = THREE.MathUtils.lerp(v.pos.y, surfaceY, Math.min(1, dt * 22));
        if (Math.abs(v.pos.y - surfaceY) < 0.05) v.pos.y = surfaceY;
      }
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
    if (this.collisionWorld && rawSurfaceY > 0.02) {
      const aheadY = this.collisionWorld.getSurfaceHeight(v.pos.x + nFwdX * 2.2, v.pos.z + nFwdZ * 2.2, v.pos.y);
      const behindY = this.collisionWorld.getSurfaceHeight(v.pos.x - nFwdX * 2.2, v.pos.z - nFwdZ * 2.2, v.pos.y);
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

  _updatePlayerBoat(v, input, dt, elapsed, callbacks = {}) {
    const { forward, right } = input.getMoveAxes();
    const spec = v.spec;
    const boost = !v.burning && (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && v.nitro > 4 && forward > 0;
    v.boosting = boost;
    if (boost) v.nitro = Math.max(0, v.nitro - dt * 20);
    else v.nitro = Math.min(100, v.nitro + dt * 10);

    const maxSpd = boost ? spec.maxSpeed * 1.18 : spec.maxSpeed;
    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);

    let vFwd = v.vel.x * fwdX + v.vel.z * fwdZ;
    let vLat = v.vel.x * rightX + v.vel.z * rightZ;

    if (forward > 0 && !v.burning) {
      vFwd += (boost ? spec.accel * 1.45 : spec.accel) * dt;
    } else if (forward < 0 && !v.burning) {
      vFwd -= spec.brake * dt;
    } else {
      vFwd *= Math.pow(0.42, dt);
    }
    vFwd = Math.max(-spec.maxSpeed * 0.32, Math.min(maxSpd, vFwd));

    const turnAmt = Math.max(0.35, Math.min(1, Math.abs(vFwd) / 5.5));
    const steerDir = vFwd >= -0.3 ? 1 : -1;
    v.yaw -= right * spec.turnRate * turnAmt * steerDir * dt;
    vLat *= Math.pow(0.18, dt * 4.0);

    const nFwdX = Math.sin(v.yaw);
    const nFwdZ = Math.cos(v.yaw);
    const nRightX = Math.cos(v.yaw);
    const nRightZ = -Math.sin(v.yaw);
    v.vel.x = nFwdX * vFwd + nRightX * vLat;
    v.vel.z = nFwdZ * vFwd + nRightZ * vLat;
    v.vFwd = vFwd;

    const prevX = v.pos.x;
    const prevZ = v.pos.z;
    // Sub-step move while staying under bridges (followSurface: false so boat ALWAYS stays on water underneath bridges!)
    if (this.collisionWorld) {
      v.pos.y = 0.08;
      this.collisionWorld.moveAndSlide(v.pos, v.vel, 1.55, dt, {
        bounce: 0.25,
        entityHeight: 1.45,
        followSurface: false,
      });
      // Keep boat within navigable water (ocean, Marina Bay, Río Dorado — cleanly passing underneath all bridges!)
      const nextDepth = this.collisionWorld.getWaterDepth(v.pos.x, v.pos.z, 0);
      if (nextDepth < 0.14) {
        // Test sliding along X or Z independently along shoreline/riverbank
        const tryXDepth = this.collisionWorld.getWaterDepth(v.pos.x, prevZ, 0);
        const tryZDepth = this.collisionWorld.getWaterDepth(prevX, v.pos.z, 0);
        if (tryXDepth >= 0.14) {
          v.pos.z = prevZ;
          v.vel.z *= -0.25;
        } else if (tryZDepth >= 0.14) {
          v.pos.x = prevX;
          v.vel.x *= -0.25;
        } else {
          v.pos.x = prevX;
          v.pos.z = prevZ;
          v.vel.multiplyScalar(-0.2);
        }
      }
      // Keep within coastal ocean play area
      if (v.pos.z > 395) { v.pos.z = 395; v.vel.z = Math.min(0, v.vel.z); }
      if (v.pos.x < -445) { v.pos.x = -445; v.vel.x = Math.max(0, v.vel.x); }
      if (v.pos.x > 450) { v.pos.x = 450; v.vel.x = Math.min(0, v.vel.x); }
    } else {
      v.pos.x += v.vel.x * dt;
      v.pos.z += v.vel.z * dt;
    }

    v.inWater = true;
    v.speed = Math.hypot(v.vel.x, v.vel.z);
    v.pos.y = 0.08 + Math.sin(elapsed * 3.1 + v.pos.x * 0.08) * 0.06;
    v.mesh.position.copy(v.pos);
    v.mesh.rotation.y = v.yaw;
    const targetPitch = -Math.min(0.16, Math.max(-0.06, vFwd * 0.0055));
    const targetRoll = -right * Math.min(0.22, v.speed * 0.008);
    v.mesh.rotation.x = THREE.MathUtils.lerp(v.mesh.rotation.x, targetPitch, Math.min(1, dt * 6));
    v.mesh.rotation.z = THREE.MathUtils.lerp(v.mesh.rotation.z, targetRoll, Math.min(1, dt * 6));

    // Frothy white water wake spray behind the stern!
    if (v.speed > 3.0 && Math.random() < 0.72) {
      const sternL = v.pos.clone().add(new THREE.Vector3(-nFwdX * 3.0 - nRightX * 0.7, 0.18, -nFwdZ * 3.0 - nRightZ * 0.7));
      const sternR = v.pos.clone().add(new THREE.Vector3(-nFwdX * 3.0 + nRightX * 0.7, 0.18, -nFwdZ * 3.0 + nRightZ * 0.7));
      this.spawnSmoke(sternL, 0xe8fbff, 0.55 + v.speed * 0.015, 0.55);
      this.spawnSmoke(sternR, 0xd8f6ff, 0.55 + v.speed * 0.015, 0.55);
    }
  }

  // Genuine Solid Vehicle-vs-Vehicle Collision Detection & Impulse Response across ALL active vehicles!
  // Uses oriented 2-circle capsule separation (front + rear bumper spheres), realistic momentum transfer,
  // off-center yaw spin, metallic crunch SFX, bright impact sparks & speed-proportional hull damage!
  resolveVehicleCollisions(allVehicles, dt, callbacks = {}) {
    const n = allVehicles.length;
    if (n < 2) return;

    const getMass = (v) => {
      if (v.spec?.isSwat) return 3.4;
      if (v.typeKey === 'baja_runner') return 1.8;
      if (v.spec?.isBoat) return 1.5;
      if (v.typeKey === 'scooter') return 0.45;
      if (v.spec?.isPolice) return 1.45;
      return 1.25;
    };

    const getVel = (v) => {
      if (v.vel && (v.vel.lengthSq() > 1e-4 || !v.isTraffic)) {
        return { x: v.vel.x, z: v.vel.z };
      }
      if (v.isTraffic) {
        const spd = v.curSpeed ?? 0;
        return {
          x: v.axis === 'x' ? v.dir * spd : 0,
          z: v.axis === 'z' ? v.dir * spd : 0,
        };
      }
      return { x: 0, z: 0 };
    };

    const getCircles = (v) => {
      const w = v.spec?.width ?? 2.1;
      const l = v.spec?.length ?? 4.6;
      const r = Math.max(0.55, w * 0.50);
      const off = Math.max(0.2, l * 0.5 - r * 0.92);
      const yaw = v.yaw ?? v.mesh?.rotation?.y ?? 0;
      const fx = Math.sin(yaw) * off;
      const fz = Math.cos(yaw) * off;
      const px = v.pos.x;
      const pz = v.pos.z;
      return [
        { x: px + fx, z: pz + fz, r, end: 1 },
        { x: px - fx, z: pz - fz, r, end: -1 },
      ];
    };

    for (let i = 0; i < n; i++) {
      const a = allVehicles[i];
      if (!a || !a.pos) continue;
      const aCircles = getCircles(a);
      const aMass = getMass(a);

      for (let j = i + 1; j < n; j++) {
        const b = allVehicles[j];
        if (!b || !b.pos) continue;

        // Vertical separation check so cars driving OVER a bridge never collide with cars/boats UNDERNEATH!
        if (Math.abs((a.pos.y ?? 0) - (b.pos.y ?? 0)) > 2.2) continue;

        // Quick broad-phase reject
        const bdx = b.pos.x - a.pos.x;
        const bdz = b.pos.z - a.pos.z;
        if (bdx * bdx + bdz * bdz > 64) continue;

        const bCircles = getCircles(b);
        let bestPen = 0;
        let bestNx = 0;
        let bestNz = 0;
        let bestContactX = 0;
        let bestContactZ = 0;
        let hitEndA = 0;
        let hitEndB = 0;

        for (let ci = 0; ci < 2; ci++) {
          const ca = aCircles[ci];
          for (let cj = 0; cj < 2; cj++) {
            const cb = bCircles[cj];
            const dx = cb.x - ca.x;
            const dz = cb.z - ca.z;
            const minD = ca.r + cb.r;
            const d2 = dx * dx + dz * dz;
            if (d2 < minD * minD) {
              const d = Math.sqrt(d2) || 0.001;
              const pen = minD - d;
              if (pen > bestPen) {
                bestPen = pen;
                bestNx = dx / d; // points from A to B
                bestNz = dz / d;
                bestContactX = ca.x + bestNx * ca.r;
                bestContactZ = ca.z + bestNz * ca.r;
                hitEndA = ca.end;
                hitEndB = cb.end;
              }
            }
          }
        }

        if (bestPen <= 0.001) continue;

        const bMass = getMass(b);
        const invA = 1 / aMass;
        const invB = 1 / bMass;
        const invSum = invA + invB;

        // Positional separation so vehicles NEVER phase through each other!
        const sepA = bestPen * (invA / invSum);
        const sepB = bestPen * (invB / invSum);
        a.pos.x -= bestNx * sepA;
        a.pos.z -= bestNz * sepA;
        b.pos.x += bestNx * sepB;
        b.pos.z += bestNz * sepB;
        if (a.mesh && a.mesh.position !== a.pos) a.mesh.position.copy(a.pos);
        if (b.mesh && b.mesh.position !== b.pos) b.mesh.position.copy(b.pos);

        // Relative velocity along collision normal (A -> B)
        const va = getVel(a);
        const vb = getVel(b);
        const rvx = vb.x - va.x;
        const rvz = vb.z - va.z;
        const velAlongNormal = rvx * bestNx + rvz * bestNz;

        if (velAlongNormal < 0) {
          const impactSpeed = -velAlongNormal;
          const restitution = 0.34;
          const impulse = (-(1 + restitution) * velAlongNormal) / invSum;

          const impAx = -bestNx * impulse * invA;
          const impAz = -bestNz * impulse * invA;
          const impBx = bestNx * impulse * invB;
          const impBz = bestNz * impulse * invB;

          const applyKnock = (veh, kx, kz, endSign) => {
            if (!veh.vel) veh.vel = new THREE.Vector3();
            veh.vel.x += kx;
            veh.vel.z += kz;
            // Realistic yaw spin impulse when struck near front or rear bumper
            const yaw = veh.yaw ?? 0;
            const rtX = Math.cos(yaw);
            const rtZ = -Math.sin(yaw);
            const sideTorque = (kx * rtX + kz * rtZ) * endSign;
            const spinDelta = Math.max(-0.55, Math.min(0.55, sideTorque * 0.022));
            if (veh.isTraffic) {
              veh.knockVel = veh.knockVel ?? new THREE.Vector3();
              veh.knockVel.x += kx * 1.15;
              veh.knockVel.z += kz * 1.15;
              veh.yawSpin = (veh.yawSpin ?? 0) + spinDelta * 6.0;
              veh.displacedTimer = Math.max(veh.displacedTimer ?? 0, Math.min(3.5, 0.8 + impactSpeed * 0.08));
              veh.curSpeed = Math.max(0, (veh.curSpeed ?? 0) * 0.35);
            } else if (veh.isParked) {
              veh.knockVel = veh.knockVel ?? new THREE.Vector3();
              veh.knockVel.x += kx * 1.1;
              veh.knockVel.z += kz * 1.1;
              veh.yawSpin = (veh.yawSpin ?? 0) + spinDelta * 5.0;
            } else {
              veh.yaw = (veh.yaw ?? 0) + spinDelta;
              veh.speed = Math.hypot(veh.vel.x, veh.vel.z);
              if (veh.mesh) veh.mesh.rotation.y = veh.yaw;
            }
          };

          applyKnock(a, impAx, impAz, hitEndA);
          applyKnock(b, impBx, impBz, hitEndB);

          // Collision sparks, metallic crunch SFX, damage & wanted heat!
          if (impactSpeed > 4.2) {
            const contactPt = new THREE.Vector3(bestContactX, (a.pos.y ?? 0) + 0.85, bestContactZ);
            this.spawnCollisionSparks(contactPt, bestNx, bestNz, Math.min(18, Math.round(impactSpeed * 0.55)));
            if (callbacks.audio) callbacks.audio.playCrash(impactSpeed);

            if (impactSpeed > 6.5) {
              const baseDmg = (impactSpeed - 5.0) * 1.25;
              // Heavier vehicle deals more damage to lighter vehicle
              this.applyDamage(a, baseDmg * Math.min(1.8, bMass / aMass), callbacks);
              this.applyDamage(b, baseDmg * Math.min(1.8, aMass / bMass), callbacks);
            }

            if (callbacks.onVehicleCollide) {
              callbacks.onVehicleCollide(a, b, impactSpeed, contactPt);
            }
          }
        }
      }
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
