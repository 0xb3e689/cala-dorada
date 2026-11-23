// Gradual 5-Star CDPD Police AI (heat thresholds: 1★=60, 2★=160, 3★=290, 4★=420, 5★=560) with true 3D LOS cover hiding,
// raycast-occluded police gunfire, destructible cruisers, killable uniformed on-foot officers with collapse death animations,
// and GTA BUSTED arrest pressure.

import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLES } from '../core/config.js';
import { createVehicleMesh, updatePoliceLightbar, createBurningWreck, animateBurningWreck } from './vehicleFactory.js';
import {
  buildCharacterMesh, setCharacterWeaponMesh, poseHumanCombat, poseHumanStride, poseHumanReload, poseHumanFlinch, poseHumanCollapse,
} from './playerController.js';

const CALLSIGNS = ['SOL-14', 'SOL-07', 'SWAT-2', 'SOL-22', 'SOL-09', 'SOL-31'];

export function computeWantedStars(heat) {
  if (heat >= 560) return 5;
  if (heat >= 420) return 4;
  if (heat >= 290) return 3;
  if (heat >= 160) return 2;
  if (heat >= 60) return 1;
  return 0;
}

export class PoliceDispatch {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.units = [];        // Cruisers & SWAT vans
    this.footOfficers = []; // Uniformed CDPD officers on foot
    this.wrecks = [];
    this.lastSeenPos = new THREE.Vector3(-120, 0, 200);
    this.hiddenTimer = 0;

    this._bloodGeo = new THREE.CircleGeometry(0.56, 16);
    this._bloodMat = new THREE.MeshBasicMaterial({
      color: 0x6b0b16, transparent: true, opacity: 0.74, depthWrite: false,
    });
  }

  clearAll() {
    for (const u of this.units) this.group.remove(u.mesh);
    for (const o of this.footOfficers) {
      this.group.remove(o.mesh);
      if (o.bloodMark) this.group.remove(o.bloodMark);
    }
    for (const w of this.wrecks) this.group.remove(w);
    this.units = [];
    this.footOfficers = [];
    this.wrecks = [];
    this.hiddenTimer = 0;
  }

  // Gradual GTA-style wanted escalation via continuous heat meter (0..600)
  addHeat(state, amount) {
    state.wantedHeat = Math.min(600, Math.max(0, (state.wantedHeat ?? 0) + amount));
    state.wantedLevel = computeWantedStars(state.wantedHeat);
    state.airUnitDeployed = state.wantedLevel >= 4;
    state.evadeTimer = 18;
    state.hiddenFromPolice = false;
    this.hiddenTimer = 0;
  }

  dropStars(state, drop = 2) {
    const newLevel = Math.max(0, state.wantedLevel - drop);
    const levelHeats = [0, 75, 180, 310, 440, 570];
    state.wantedLevel = newLevel;
    state.wantedHeat = levelHeats[newLevel] ?? 0;
    state.airUnitDeployed = state.wantedLevel >= 4;
    if (state.wantedLevel === 0) {
      this.clearAll();
      state.bustProgress = 0;
      state.hiddenFromPolice = false;
      state.careerStats.pursuitsEvaded += 1;
    }
  }

  spawnUnit(callsign, isSwat, x, z, yaw, tactic) {
    const typeKey = isSwat ? 'cdpd_enforcer' : 'cdpd_interceptor';
    const spec = VEHICLES[typeKey];
    const mesh = createVehicleMesh(typeKey);
    const y = this.collisionWorld ? this.collisionWorld.getBridgeDeckY(x, z) : 0;
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    this.group.add(mesh);
    const maxHp = isSwat ? 220 : 125;
    const u = {
      callsign,
      mesh,
      typeKey,
      spec,
      isSwat,
      isPoliceVehicle: true,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw,
      speed: isSwat ? 18 : 30,
      tactic,
      hp: maxHp,
      maxHp,
      condition: 100,
      burning: false,
      fireCountdown: 0,
      exploded: false,
      smokeTimer: 0,
      crackleTimer: 0,
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
    setCharacterWeaponMesh(mesh, 'pistol');
    const y = this.collisionWorld ? this.collisionWorld.getSurfaceY(x, z, 0) : 0;
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    poseHumanCombat(mesh, true);
    this.group.add(mesh);
    const off = {
      mesh,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw,
      hp: 90,
      maxHp: 90,
      dead: false,
      downed: false,
      deathTimer: 0,
      fallSide: Math.random() < 0.5 ? 1 : -1,
      bloodMark: null,
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
    if (u.deployedOfficers || this.footOfficers.filter((o) => !o.dead).length >= 6) return;
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
    if (!off || off.dead || off.downed) return { killed: false };
    const force = Math.min(18, Math.max(6, speed * 0.75));
    off.knockVel.set(dirX * force, 0, dirZ * force);
    off.knockdownTimer = 1.6;
    off.flinchTimer = 0.35;
    const dmg = Math.round(speed * 3.0);
    off.hp = Math.max(0, off.hp - dmg);
    if (off.hp <= 0) {
      off.dead = true;
      off.downed = true;
      off.attacking = false;
      off.deathTimer = 0.001;
      off.deathBaseY = off.pos.y ?? 0;
      off.knockdownTimer = 0;
      if (off.mesh.userData.muzzleFlash) off.mesh.userData.muzzleFlash.visible = false;
      if (!off.bloodMark) {
        const mark = new THREE.Mesh(this._bloodGeo, this._bloodMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(off.pos.x, off.deathBaseY + 0.04, off.pos.z);
        this.group.add(mark);
        off.bloodMark = mark;
      }
      poseHumanCollapse(off.mesh, 0.12, off.fallSide ?? 1, off.deathBaseY);
      if (state) state.careerStats.takedowns += 1;
      return { killed: true };
    }
    return { killed: false };
  }

  spawnBurningWreckAt(x, z, yaw = 0.6) {
    const w = createBurningWreck();
    const y = this.collisionWorld ? this.collisionWorld.getBridgeDeckY(x, z) : 0;
    w.position.set(x, y, z);
    w.rotation.y = yaw;
    this.group.add(w);
    this.wrecks.push(w);
    return w;
  }

  update(dt, elapsed, state, playerPos, playerYaw, heliUnit, combatSystem, playerSpeed = 0, onPlayerHit = null, audio = null, vehicles = []) {
    for (const w of this.wrecks) animateBurningWreck(w, elapsed);

    const desiredCount = state.wantedLevel === 0 ? 0 : Math.min(5, state.wantedLevel + 1);
    while (this.units.length < desiredCount) {
      const idx = this.units.length;
      const isSwat = state.wantedLevel >= 4 && idx === 2;
      const angle = playerYaw + Math.PI + (idx - 1.5) * 0.65;
      const dist = 54 + idx * 14;
      let sx = Math.max(-420, Math.min(420, playerPos.x + Math.sin(angle) * dist));
      let sz = Math.max(-410, Math.min(212, playerPos.z + Math.cos(angle) * dist));
      // Ensure cruisers NEVER spawn floating over Río Dorado or Marina Bay water!
      if (this.collisionWorld && this.collisionWorld.getWaterDepth(sx, sz, this.collisionWorld.getBridgeDeckY(sx, sz)) > 0.25) {
        sx = sx < 145 ? 102 : 182;
      }
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
    const isBustedAnim = state.statusOverlay?.type === 'BUSTED';
    const playerEye = { x: playerPos.x, y: (playerPos.y ?? 0) + 1.25, z: playerPos.z };
    let anyPoliceLOS = false;

    // Check helicopter 3D visual lock
    if (!jammed && state.airUnitDeployed && heliUnit && heliUnit.hasVisualLock) {
      anyPoliceLOS = true;
    }

    const fwdX = Math.sin(playerYaw);
    const fwdZ = Math.cos(playerYaw);
    const rtX = Math.cos(playerYaw);
    const rtZ = -Math.sin(playerYaw);
    let closestPoliceDist = 999;

    this.units.forEach((u, idx) => {
      if (u.playerDriven) return;
      if (u.exploded) {
        u.speed = 0;
        u.disabled = true;
        return;
      }
      if (u.burning) {
        u.disabled = true;
        if (!u.deployedOfficers) this.deployOfficersFromCruiser(u);
      }
      updatePoliceLightbar(u.mesh, elapsed, u.phase);
      const distToPlayer = Math.hypot(playerPos.x - u.pos.x, playerPos.z - u.pos.z);
      if (distToPlayer < closestPoliceDist) closestPoliceDist = distToPlayer;

      // True 3D LOS check from cruiser windshield to player (blocked by cover buildings, walls & bridge decks!)
      let cruiserSeesPlayer = false;
      if (!jammed && !u.disabled && distToPlayer < 70 && !state.diving) {
        const fromPt = { x: u.pos.x, y: u.pos.y + 1.5, z: u.pos.z };
        cruiserSeesPlayer = this.collisionWorld
          ? this.collisionWorld.hasLineOfSight(fromPt, playerEye, { ignoreTags: ['bus-stop'] })
          : true;
        if (cruiserSeesPlayer) anyPoliceLOS = true;
      }

      const playerSlowOrFoot = !state.inVehicle || playerSpeed < 3.2;
      if (!jammed && !u.deployedOfficers && ((cruiserSeesPlayer && playerSlowOrFoot && distToPlayer < 26) || u.disabled || u.hp <= 0)) {
        this.deployOfficersFromCruiser(u);
      }

      if (u.disabled || isBustedAnim || (u.deployedOfficers && playerSlowOrFoot && distToPlayer < 28)) {
        u.speed = THREE.MathUtils.lerp(u.speed, 0, Math.min(1, dt * 4));
      } else {
        const tgtBase = cruiserSeesPlayer || anyPoliceLOS ? playerPos : this.lastSeenPos;
        let tx = tgtBase.x;
        let tz = tgtBase.z;
        if (jammed) {
          tx = u.pos.x + Math.sin(u.yaw + 0.4) * 20;
          tz = u.pos.z + Math.cos(u.yaw + 0.4) * 20;
        } else if (!state.inVehicle) {
          tx = tgtBase.x - fwdX * (16 + idx * 5);
          tz = tgtBase.z - fwdZ * (16 + idx * 5);
        } else if (u.isSwat) {
          tx = tgtBase.x + fwdX * 36;
          tz = tgtBase.z + fwdZ * 36;
        } else if (idx === 0) {
          tx = tgtBase.x + fwdX * 5;
          tz = tgtBase.z + fwdZ * 5;
        } else if (idx === 1 || idx === 4) {
          const side = idx === 1 ? 1 : -1;
          tx = tgtBase.x + rtX * side * 9 + fwdX * 4;
          tz = tgtBase.z + rtZ * side * 9 + fwdZ * 4;
        } else {
          tx = tgtBase.x - fwdX * 12;
          tz = tgtBase.z - fwdZ * 12;
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
        const prevX = u.pos.x;
        const prevZ = u.pos.z;
        const hit = this.collisionWorld.moveAndSlide(u.pos, u.vel, u.isSwat ? 2.6 : 2.1, dt, { bounce: 0.25 });
        if (hit.hit) {
          u.yaw += 0.9 * dt;
          u.speed = Math.hypot(u.vel.x, u.vel.z);
        }
        const surfY = this.collisionWorld.getSurfaceHeight(u.pos.x, u.pos.z, u.pos.y);
        // Prevent AI cruisers from driving straight into deep river/ocean water off bridges!
        if (this.collisionWorld.getWaterDepth(u.pos.x, u.pos.z, surfY) > 0.65) {
          u.pos.x = prevX;
          u.pos.z = prevZ;
          u.yaw += 1.6 * dt;
          u.speed *= 0.5;
        } else {
          u.pos.y = surfY > u.pos.y ? surfY : THREE.MathUtils.lerp(u.pos.y, surfY, Math.min(1, dt * 18));
        }
        if (surfY > 0.05) {
          const nfx = Math.sin(u.yaw);
          const nfz = Math.cos(u.yaw);
          const aY = this.collisionWorld.getSurfaceHeight(u.pos.x + nfx * 2.2, u.pos.z + nfz * 2.2, u.pos.y);
          const bY = this.collisionWorld.getSurfaceHeight(u.pos.x - nfx * 2.2, u.pos.z - nfz * 2.2, u.pos.y);
          u.mesh.rotation.x = THREE.MathUtils.lerp(u.mesh.rotation.x, -Math.atan2(aY - bY, 4.4), Math.min(1, dt * 10));
        } else {
          u.mesh.rotation.x = THREE.MathUtils.lerp(u.mesh.rotation.x, 0, Math.min(1, dt * 10));
        }
      } else {
        u.pos.x += u.vel.x * dt;
        u.pos.z += u.vel.z * dt;
      }
      u.mesh.rotation.y = u.yaw;
      for (const w of u.mesh.userData.wheels ?? []) w.rotation.x += u.speed * dt * 1.8;
    });

    // Update uniformed on-foot CDPD officers (with 3D LOS, raycast gunfire occlusion, collapse death animation & 25s despawn!)
    let officerArrestNearby = false;
    for (let i = this.footOfficers.length - 1; i >= 0; i--) {
      const o = this.footOfficers[i];
      if (o.dead || o.downed) {
        o.deathTimer = (o.deathTimer ?? 0) + dt;
        if (o.deathTimer <= 0.6) {
          poseHumanCollapse(o.mesh, Math.min(1, o.deathTimer / 0.46), o.fallSide ?? 1, o.deathBaseY ?? 0);
        }
        if (o.deathTimer >= 25) {
          this.group.remove(o.mesh);
          if (o.bloodMark) this.group.remove(o.bloodMark);
          this.footOfficers.splice(i, 1);
        }
        continue;
      }

      if (o.flinchTimer > 0) o.flinchTimer = Math.max(0, o.flinchTimer - dt);
      if (o.muzzleTimer > 0) {
        o.muzzleTimer -= dt;
        if (o.muzzleTimer <= 0 && o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = false;
      }

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
      o.mesh.rotation.z = 0;

      const dx = playerPos.x - o.pos.x;
      const dz = playerPos.z - o.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist < closestPoliceDist) closestPoliceDist = dist;

      // Remove very distant officers if player sped away
      if (dist > 140) {
        this.group.remove(o.mesh);
        this.footOfficers.splice(i, 1);
        continue;
      }

      // During BUSTED animation, hold aim straight at kneeling player
      if (isBustedAnim) {
        o.yaw = Math.atan2(dx, dz);
        o.mesh.rotation.y = o.yaw;
        poseHumanCombat(o.mesh, true);
        continue;
      }

      const offEye = { x: o.pos.x, y: o.pos.y + 1.45, z: o.pos.z };
      const hasLOS = !jammed && !state.diving && dist < 52 && (
        this.collisionWorld
          ? this.collisionWorld.hasLineOfSight(offEye, playerEye, { ignoreTags: ['bus-stop'] })
          : true
      );
      if (hasLOS) anyPoliceLOS = true;
      if (hasLOS && dist < 8.5) officerArrestNearby = true;

      o.yaw = Math.atan2(dx, dz);
      o.mesh.rotation.y = o.yaw;

      if (o.reloadTimer > 0) {
        o.reloadTimer = Math.max(0, o.reloadTimer - dt);
        poseHumanReload(o.mesh, 1 - o.reloadTimer / o.reloadDuration);
        if (o.reloadTimer <= 0) o.clip = o.maxClip;
        if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
        continue;
      }

      if (!jammed && dist > 12.5 && (hasLOS || dist < 35)) {
        const runSpd = 4.3;
        o.vel.set((dx / dist) * runSpd, 0, (dz / dist) * runSpd);
        if (this.collisionWorld) {
          this.collisionWorld.moveAndSlide(o.pos, o.vel, 0.55, dt);
          const surfY = this.collisionWorld.getSurfaceY(o.pos.x, o.pos.z, o.pos.y);
          o.pos.y = THREE.MathUtils.lerp(o.pos.y, surfY, Math.min(1, dt * 14));
        } else {
          o.pos.x += o.vel.x * dt;
          o.pos.z += o.vel.z * dt;
        }
        o.stridePhase += dt * 9.5;
        poseHumanStride(o.mesh, o.stridePhase, false);
      } else {
        poseHumanCombat(o.mesh, true);
      }

      // Aim & fire at player ONLY with clear raycast LOS (cannot pierce walls, cars, or bridge decks!)
      if (!jammed && hasLOS && dist < 38) {
        o.fireCd -= dt;
        if (o.fireCd <= 0) {
          if (o.clip <= 0) {
            o.reloadTimer = o.reloadDuration;
            continue;
          }
          const orig = o.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
          const tgt = playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.15, (Math.random() - 0.5) * 1.6));
          const shotVec = tgt.clone().sub(orig);
          const shotDist = shotVec.length() || 1;
          const shotDir = shotVec.clone().divideScalar(shotDist);

          const envHit = this.collisionWorld
            ? this.collisionWorld.raycast(orig, shotDir, shotDist, { vehicles })
            : null;
          if (envHit && envHit.dist < shotDist - 0.45) {
            // Shot hits wall or car cover cleanly — NEVER pierces cover to hurt player!
            o.fireCd = 0.9 + Math.random() * 0.6;
            const stopPt = new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z);
            if (combatSystem) {
              combatSystem.spawnTracer(orig, stopPt, 0x62b4ff, 0.036, 0.14);
              combatSystem.spawnSparks(stopPt, 4, 0xffd27a);
            }
            continue;
          }

          o.clip -= 1;
          o.fireCd = 0.9 + Math.random() * 0.7;
          o.muzzleTimer = 0.08;
          if (o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = true;
          if (audio) audio.playGunshot('pistol');
          if (combatSystem) combatSystem.spawnTracer(orig, tgt, 0x62b4ff, 0.036, 0.14);
          if (Math.random() < 0.36 && onPlayerHit) onPlayerHit(8);
          if (o.clip <= 0) o.reloadTimer = o.reloadDuration;
        }
      }

      if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
    }

    if (anyPoliceLOS) {
      this.lastSeenPos.copy(playerPos);
      this.hiddenTimer = 0;
    }

    // Update HIDDEN state & smooth GTA wanted heat cooldown when out of ALL police & helicopter LOS!
    if (state.wantedLevel > 0 && !state.statusOverlay) {
      const hidden = !anyPoliceLOS || jammed;
      state.hiddenFromPolice = hidden;
      if (hidden) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer >= 1.8 || jammed) {
          const decayRate = jammed ? 42 : 24;
          state.wantedHeat = Math.max(0, state.wantedHeat - decayRate * dt);
          const nextStars = computeWantedStars(state.wantedHeat);
          if (nextStars !== state.wantedLevel) {
            state.wantedLevel = nextStars;
            state.airUnitDeployed = state.wantedLevel >= 4;
          }
          if (state.wantedHeat <= 0) {
            state.wantedLevel = 0;
            state.airUnitDeployed = false;
            state.hiddenFromPolice = false;
            this.clearAll();
            state.bustProgress = 0;
            state.careerStats.pursuitsEvaded += 1;
          }
        }
      }
    } else {
      state.hiddenFromPolice = false;
      this.hiddenTimer = 0;
    }

    // GTA BUSTED arrest check: wanted + visible to police + cornered at low speed/on foot for 2.5s
    const cruiserClose = this.units.some((u) => !u.disabled && !u.exploded && u.pos.distanceTo(playerPos) < 10.5 && anyPoliceLOS);
    const arrestable = state.wantedLevel > 0 && !jammed && !state.statusOverlay && !state.swimming &&
      (!state.inVehicle || playerSpeed < 2.2) && (officerArrestNearby || cruiserClose);
    if (arrestable) {
      state.bustProgress = Math.min(2.5, (state.bustProgress ?? 0) + dt);
    } else {
      state.bustProgress = Math.max(0, (state.bustProgress ?? 0) - dt * 1.6);
    }

    return { active: state.wantedLevel > 0, bustedReady: (state.bustProgress ?? 0) >= 2.5, hidden: state.hiddenFromPolice };
  }
}
