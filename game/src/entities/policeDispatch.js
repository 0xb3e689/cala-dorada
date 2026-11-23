// 5-star CDPD police AI with solid building collisions, cruisers deploying uniformed on-foot officers,
// officer magazine reload cycles, hit reactions, car-impact knockdowns, and GTA BUSTED arrest pressure.

import * as THREE from '../../vendor/three.module.min.js';
import { createVehicleMesh, updatePoliceLightbar, createBurningWreck, animateBurningWreck } from './vehicleFactory.js';
import { buildCharacterMesh, poseHumanCombat, poseHumanStride, poseHumanReload, poseHumanFlinch } from './playerController.js';

const CALLSIGNS = ['SOL-14', 'SOL-07', 'SWAT-2', 'SOL-22', 'SOL-09', 'SOL-31'];

export class PoliceDispatch {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.units = [];        // Cruisers & SWAT vans
    this.footOfficers = []; // Uniformed CDPD officers who exited cruisers to fight on foot!
    this.wrecks = [];
  }

  clearAll() {
    for (const u of this.units) this.group.remove(u.mesh);
    for (const o of this.footOfficers) this.group.remove(o.mesh);
    for (const w of this.wrecks) this.group.remove(w);
    this.units = [];
    this.footOfficers = [];
    this.wrecks = [];
  }

  addHeat(state, amount) {
    state.wantedHeat = Math.min(500, state.wantedHeat + amount);
    const stars = Math.min(5, Math.ceil(state.wantedHeat / 95));
    state.wantedLevel = Math.max(state.wantedLevel, stars);
    state.airUnitDeployed = state.wantedLevel >= 4;
    state.evadeTimer = 18;
  }

  dropStars(state, drop = 2) {
    state.wantedLevel = Math.max(0, state.wantedLevel - drop);
    state.wantedHeat = state.wantedLevel * 85;
    state.airUnitDeployed = state.wantedLevel >= 4;
    if (state.wantedLevel === 0) {
      this.clearAll();
      state.bustProgress = 0;
      state.careerStats.pursuitsEvaded += 1;
    }
  }

  spawnUnit(callsign, isSwat, x, z, yaw, tactic) {
    const mesh = createVehicleMesh(isSwat ? 'cdpd_enforcer' : 'cdpd_interceptor');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    this.group.add(mesh);
    const u = {
      callsign,
      mesh,
      isSwat,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw,
      speed: isSwat ? 18 : 30,
      tactic,
      hp: isSwat ? 220 : 125,
      maxHp: isSwat ? 220 : 125,
      phase: Math.random() * 6.28,
      deployedOfficers: false,
      disabled: false,
    };
    this.units.push(u);
    return u;
  }

  spawnFootOfficer(x, z, yaw) {
    const mesh = buildCharacterMesh({
      jacket: 0x1b335c, accent: 0xdbe6f6, pants: 0x101c34, skin: 0xd9a27c, hair: 0x1e1918,
      outfitStyle: 'tactical', hairStyle: 'fade', accessory: 'aviators', withWeapon: true, role: 'officer',
    });
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    poseHumanCombat(mesh, true);
    this.group.add(mesh);
    const off = {
      mesh,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw,
      hp: 85,
      maxHp: 85,
      downed: false,
      attacking: true,
      isPolice: true,
      clip: 10,
      maxClip: 10,
      reloadTimer: 0,
      reloadDuration: 1.65,
      fireCd: 0.7 + Math.random() * 0.7,
      muzzleTimer: 0,
      flinchTimer: 0,
      knockdownTimer: 0,
      knockVel: new THREE.Vector3(),
      stridePhase: Math.random() * 6,
    };
    this.footOfficers.push(off);
    return off;
  }

  deployOfficersFromCruiser(u) {
    if (u.deployedOfficers || this.footOfficers.length >= 6) return;
    u.deployedOfficers = true;
    const rtX = Math.cos(u.yaw);
    const rtZ = -Math.sin(u.yaw);
    const count = u.isSwat ? 2 : (Math.random() < 0.65 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const side = i === 0 ? -1 : 1;
      const ox = u.pos.x + rtX * side * 2.1;
      const oz = u.pos.z + rtZ * side * 2.1;
      this.spawnFootOfficer(ox, oz, u.yaw);
    }
  }

  applyOfficerVehicleImpact(off, dirX, dirZ, speed, state) {
    if (!off || off.downed) return;
    const force = Math.min(18, Math.max(6, speed * 0.75));
    off.knockVel.set(dirX * force, 0, dirZ * force);
    off.knockdownTimer = 1.6;
    off.flinchTimer = 0.35;
    const dmg = Math.round(speed * 2.4);
    off.hp = Math.max(0, off.hp - dmg);
    if (off.hp <= 0) {
      off.downed = true;
      off.attacking = false;
      off.mesh.rotation.x = -Math.PI / 2;
      off.mesh.position.y = 0.18;
      if (off.mesh.userData.muzzleFlash) off.mesh.userData.muzzleFlash.visible = false;
      if (state) state.careerStats.takedowns += 1;
    }
  }

  spawnBurningWreckAt(x, z, yaw = 0.6) {
    const w = createBurningWreck();
    w.position.set(x, 0, z);
    w.rotation.y = yaw;
    this.group.add(w);
    this.wrecks.push(w);
    return w;
  }

  update(dt, elapsed, state, playerPos, playerYaw, heliUnit, combatSystem, playerSpeed = 0, onPlayerHit = null, audio = null) {
    for (const w of this.wrecks) animateBurningWreck(w, elapsed);

    const desiredCount = state.wantedLevel === 0 ? 0 : Math.min(5, state.wantedLevel + 1);
    while (this.units.length < desiredCount) {
      const idx = this.units.length;
      const isSwat = state.wantedLevel >= 4 && idx === 2;
      const angle = playerYaw + Math.PI + (idx - 1.5) * 0.65;
      const dist = 54 + idx * 14;
      const sx = Math.max(-420, Math.min(420, playerPos.x + Math.sin(angle) * dist));
      const sz = Math.max(-410, Math.min(235, playerPos.z + Math.cos(angle) * dist));
      const tactic = isSwat ? 'ROADBLOCK' : idx === 0 ? 'RAMMING' : idx % 2 === 1 ? 'FLANKING' : 'CLOSING IN';
      const u = this.spawnUnit(CALLSIGNS[idx % CALLSIGNS.length], isSwat, sx, sz, playerYaw, tactic);
      if (this.collisionWorld) {
        this.collisionWorld.resolveCircle(u.pos, null, 2.6);
      }
    }
    while (this.units.length > desiredCount) {
      const popped = this.units.pop();
      this.group.remove(popped.mesh);
    }

    const jammed = state.signalJamTimer > 0;
    const fwdX = Math.sin(playerYaw);
    const fwdZ = Math.cos(playerYaw);
    const rtX = Math.cos(playerYaw);
    const rtZ = -Math.sin(playerYaw);

    let closestPoliceDist = 999;

    this.units.forEach((u, idx) => {
      updatePoliceLightbar(u.mesh, elapsed, u.phase);
      const distToPlayer = Math.hypot(playerPos.x - u.pos.x, playerPos.z - u.pos.z);
      if (distToPlayer < closestPoliceDist) closestPoliceDist = distToPlayer;

      // Deploy 1-2 uniformed CDPD officers on foot when close to an on-foot or stopped player (or cruiser disabled)
      const playerSlowOrFoot = !state.inVehicle || playerSpeed < 3.2;
      if (!jammed && !u.deployedOfficers && ((playerSlowOrFoot && distToPlayer < 26) || u.disabled || u.hp <= 0)) {
        this.deployOfficersFromCruiser(u);
      }

      if (u.disabled || (u.deployedOfficers && playerSlowOrFoot && distToPlayer < 28)) {
        // Cruiser parks/brakes while officers engage on foot
        u.speed = THREE.MathUtils.lerp(u.speed, 0, Math.min(1, dt * 4));
      } else {
        let tx = playerPos.x;
        let tz = playerPos.z;
        if (jammed) {
          tx = u.pos.x + Math.sin(u.yaw + 0.4) * 20;
          tz = u.pos.z + Math.cos(u.yaw + 0.4) * 20;
        } else if (!state.inVehicle) {
          tx = playerPos.x - fwdX * (16 + idx * 5);
          tz = playerPos.z - fwdZ * (16 + idx * 5);
        } else if (u.isSwat) {
          tx = playerPos.x + fwdX * 36;
          tz = playerPos.z + fwdZ * 36;
        } else if (idx === 0) {
          tx = playerPos.x + fwdX * 5;
          tz = playerPos.z + fwdZ * 5;
        } else if (idx === 1 || idx === 4) {
          const side = idx === 1 ? 1 : -1;
          tx = playerPos.x + rtX * side * 9 + fwdX * 4;
          tz = playerPos.z + rtZ * side * 9 + fwdZ * 4;
        } else {
          tx = playerPos.x - fwdX * 12;
          tz = playerPos.z - fwdZ * 12;
        }

        const dx = tx - u.pos.x;
        const dz = tz - u.pos.z;
        const dist = Math.hypot(dx, dz) || 1;
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - u.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        u.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3.4 * dt));

        const targetSpd = jammed ? 12 : dist > 10 ? (u.isSwat ? 28 : 42) : 10;
        u.speed = THREE.MathUtils.lerp(u.speed, targetSpd, Math.min(1, dt * 3));
      }

      u.vel.set(Math.sin(u.yaw) * u.speed, 0, Math.cos(u.yaw) * u.speed);
      if (this.collisionWorld) {
        const hit = this.collisionWorld.moveAndSlide(u.pos, u.vel, u.isSwat ? 2.6 : 2.1, dt, { bounce: 0.25 });
        if (hit.hit) {
          // Steer cleanly around building corner
          u.yaw += 0.9 * dt;
          u.speed = Math.hypot(u.vel.x, u.vel.z);
        }
      } else {
        u.pos.x += u.vel.x * dt;
        u.pos.z += u.vel.z * dt;
      }
      u.mesh.rotation.y = u.yaw;
      for (const w of u.mesh.userData.wheels ?? []) w.rotation.x += u.speed * dt * 1.8;
    });

    // Update uniformed on-foot CDPD officers (pursue on foot, fire, reload with 3D animation, flinch, knockdown!)
    let officerArrestNearby = false;
    for (let i = this.footOfficers.length - 1; i >= 0; i--) {
      const o = this.footOfficers[i];
      if (o.downed) continue;

      if (o.flinchTimer > 0) o.flinchTimer = Math.max(0, o.flinchTimer - dt);
      if (o.muzzleTimer > 0) {
        o.muzzleTimer -= dt;
        if (o.muzzleTimer <= 0 && o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = false;
      }

      // Car-hit knockdown recovery
      if (o.knockdownTimer > 0) {
        o.knockdownTimer = Math.max(0, o.knockdownTimer - dt);
        o.knockVel.multiplyScalar(Math.pow(0.08, dt));
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(o.pos, o.knockVel, 0.55, dt);
        else { o.pos.x += o.knockVel.x * dt; o.pos.z += o.knockVel.z * dt; }
        const f = o.knockdownTimer < 0.45 ? o.knockdownTimer / 0.45 : 1.0;
        o.mesh.position.y = 0.18 * f;
        o.mesh.rotation.x = -Math.PI * 0.48 * f;
        continue;
      }
      o.mesh.rotation.x = 0;
      o.mesh.position.y = 0;

      const dx = playerPos.x - o.pos.x;
      const dz = playerPos.z - o.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist < closestPoliceDist) closestPoliceDist = dist;
      if (dist < 8.5) officerArrestNearby = true;

      // Remove very distant officers if player sped away
      if (dist > 140) {
        this.group.remove(o.mesh);
        this.footOfficers.splice(i, 1);
        continue;
      }

      o.yaw = Math.atan2(dx, dz);
      o.mesh.rotation.y = o.yaw;

      // Reload cycle with visible 3D arm animation
      if (o.reloadTimer > 0) {
        o.reloadTimer = Math.max(0, o.reloadTimer - dt);
        const prog = 1 - o.reloadTimer / o.reloadDuration;
        poseHumanReload(o.mesh, prog);
        if (o.reloadTimer <= 0) {
          o.clip = o.maxClip;
        }
        if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
        continue;
      }

      // Pursue player on foot to optimal firing/arrest range (~12-18m)
      if (!jammed && dist > 12.5) {
        const runSpd = 4.3;
        o.vel.set((dx / dist) * runSpd, 0, (dz / dist) * runSpd);
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(o.pos, o.vel, 0.55, dt);
        else { o.pos.x += o.vel.x * dt; o.pos.z += o.vel.z * dt; }
        o.stridePhase += dt * 9.5;
        poseHumanStride(o.mesh, o.stridePhase, false);
      } else {
        poseHumanCombat(o.mesh, true);
      }

      // Aim & fire at player within 36m
      if (!jammed && dist < 36) {
        o.fireCd -= dt;
        if (o.fireCd <= 0) {
          if (o.clip <= 0) {
            o.reloadTimer = o.reloadDuration;
            continue;
          }
          o.clip -= 1;
          o.fireCd = 0.9 + Math.random() * 0.7;
          o.muzzleTimer = 0.08;
          if (o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = true;
          if (audio) audio.playGunshot('pistol');
          const orig = o.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
          const tgt = playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 1.15, (Math.random() - 0.5) * 1.8));
          if (combatSystem) combatSystem.spawnTracer(orig, tgt, 0x62b4ff, 0.036, 0.14);
          if (Math.random() < 0.36 && onPlayerHit) onPlayerHit(8);
          if (o.clip <= 0) o.reloadTimer = o.reloadDuration;
        }
      }

      if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
    }

    // GTA BUSTED arrest check: wanted + cornered at very low speed / on foot with police close for 2.5s
    const cruiserClose = this.units.some((u) => !u.disabled && u.pos.distanceTo(playerPos) < 10.5);
    const arrestable = state.wantedLevel > 0 && !jammed && !state.statusOverlay &&
      (!state.inVehicle || playerSpeed < 2.2) && (officerArrestNearby || cruiserClose);
    if (arrestable) {
      state.bustProgress = Math.min(2.5, (state.bustProgress ?? 0) + dt);
    } else {
      state.bustProgress = Math.max(0, (state.bustProgress ?? 0) - dt * 1.6);
    }

    // Cooldown wanted evasion if player escapes far enough
    if (state.wantedLevel > 0 && !state.statusOverlay) {
      if (closestPoliceDist > 110 || jammed) {
        state.evadeTimer -= dt;
        if (state.evadeTimer <= 0) {
          this.dropStars(state, 5);
        }
      } else {
        state.evadeTimer = Math.min(18, state.evadeTimer + dt * 2);
      }
    }

    return { active: state.wantedLevel > 0, bustedReady: (state.bustProgress ?? 0) >= 2.5 };
  }
}
