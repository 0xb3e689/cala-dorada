// Authentic GTA 1★–5★ CDPD Police AI:
// - Strict per-star unit caps (1★: max 1 cruiser / 2 foot officers, calm pursuit, baton/arrest unless shot at; 2★..5★ progressive escalation)
// - True GTA BUSTED arrest rules (0★ never busts; 1★ or non-firing 2★ only; alive on-foot officer <2.5m + clear LOS + stationary non-resisting player; moving/sprinting/firing resets immediately)
// - Anti-water-walking officer pathing (routes around riverbanks / toward nearest bridge; enters real swimming state if knocked into water)
// - Complete cleanup on WASTED / BUSTED & respawn
// - Conditional emergent Gang-vs-Police street shootouts

import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLES } from '../core/config.js';
import { getRiverCenterX, getNearestBridgeForZ, isWaterAt } from '../world/cityPlan.js';
import { createVehicleMesh, updatePoliceLightbar, createBurningWreck, animateBurningWreck } from './vehicleFactory.js';
import {
  buildCharacterMesh, setCharacterWeaponMesh, poseHumanCombat, poseHumanStride,
  poseHumanReload, poseHumanFlinch, poseHumanCollapse, poseHumanSwim, poseHumanMeleeSwing,
} from './playerController.js';

const CALLSIGNS = ['SOL-14', 'SOL-07', 'SWAT-2', 'SOL-22', 'SOL-09', 'SWAT-5'];

export function computeWantedStars(heat) {
  if (heat >= 560) return 5;
  if (heat >= 420) return 4;
  if (heat >= 290) return 3;
  if (heat >= 160) return 2;
  if (heat >= 60) return 1;
  return 0;
}

// Strict authentic GTA per-star scaling caps
export function getPoliceCapsForStar(stars) {
  switch (stars) {
    case 1:
      return { maxCruisers: 1, maxFoot: 2, cruiserSpeed: 23, swatCount: 0, roadblocks: 0, heli: false, allowRam: false };
    case 2:
      return { maxCruisers: 2, maxFoot: 3, cruiserSpeed: 31, swatCount: 0, roadblocks: 0, heli: false, allowRam: false };
    case 3:
      return { maxCruisers: 3, maxFoot: 4, cruiserSpeed: 37, swatCount: 0, roadblocks: 1, heli: false, allowRam: true };
    case 4:
      return { maxCruisers: 4, maxFoot: 5, cruiserSpeed: 41, swatCount: 1, roadblocks: 1, heli: true, allowRam: true };
    case 5:
      return { maxCruisers: 6, maxFoot: 6, cruiserSpeed: 45, swatCount: 2, roadblocks: 2, heli: true, allowRam: true };
    default:
      return { maxCruisers: 0, maxFoot: 0, cruiserSpeed: 0, swatCount: 0, roadblocks: 0, heli: false, allowRam: false };
  }
}

export class PoliceDispatch {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.units = [];        // Cruisers & SWAT vans (including roadblocks)
    this.footOfficers = []; // Uniformed CDPD officers on foot
    this.wrecks = [];
    this.lastSeenPos = new THREE.Vector3(-120, 0, 200);
    this.hiddenTimer = 0;
    this.gangShootoutActive = false;
    this.policeVsGangShots = 0;

    this._bloodGeo = new THREE.CircleGeometry(0.56, 16);
    this._bloodMat = new THREE.MeshBasicMaterial({
      color: 0x6b0b16, transparent: true, opacity: 0.74, depthWrite: false,
    });
  }

  _getWaterDepth(x, z, y = 0) {
    if (this.collisionWorld) return this.collisionWorld.getWaterDepth(x, z, y);
    return isWaterAt(x, z, y) ? 1.6 : 0;
  }

  _isDryForStep(x, z, curY = 0) {
    const surfY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(x, z, curY) : 0;
    if (isWaterAt(x, z, surfY)) return false;
    return this._getWaterDepth(x, z, surfY) < 0.35;
  }

  clearAll(state = null) {
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
    this.gangShootoutActive = false;
    if (state) {
      state.wantedLevel = 0;
      state.wantedHeat = 0;
      state.bustProgress = 0;
      state.inSight = false;
      state.hiddenFromPolice = false;
      state.airUnitDeployed = false;
      state.shotAtPolice = false;
    }
  }

  // Gradual GTA-style wanted escalation via continuous heat meter (0..600)
  addHeat(state, amount, opts = {}) {
    if (state.statusOverlay) return;
    state.wantedHeat = Math.min(600, Math.max(0, (state.wantedHeat ?? 0) + amount));
    state.wantedLevel = computeWantedStars(state.wantedHeat);
    const caps = getPoliceCapsForStar(state.wantedLevel);
    state.airUnitDeployed = caps.heli;
    state.evadeTimer = 18;
    state.hiddenFromPolice = false;
    state.inSight = state.wantedLevel > 0;
    if (opts.shotAtPolice) state.shotAtPolice = true;
    this.hiddenTimer = 0;
  }

  dropStars(state, drop = 2) {
    const newLevel = Math.max(0, state.wantedLevel - drop);
    const levelHeats = [0, 75, 180, 310, 440, 570];
    state.wantedLevel = newLevel;
    state.wantedHeat = levelHeats[newLevel] ?? 0;
    const caps = getPoliceCapsForStar(state.wantedLevel);
    state.airUnitDeployed = caps.heli;
    if (state.wantedLevel === 0) {
      this.clearAll(state);
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
      isRoadblock: tactic === 'ROADBLOCK',
      isPoliceVehicle: true,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw,
      speed: tactic === 'ROADBLOCK' ? 0 : (isSwat ? 18 : 24),
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

  spawnFootOfficer(x, z, yaw, weaponId = 'pistol') {
    const mesh = buildCharacterMesh({
      jacket: 0x1b335c, accent: 0xdbe6f6, pants: 0x101c34, skin: 0xd9a27c, hair: 0x1e1918,
      outfitStyle: 'tactical', hairStyle: 'fade', accessory: 'aviators', withWeapon: true, role: 'officer',
    });
    setCharacterWeaponMesh(mesh, weaponId);
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
      weaponId,
      hp: 90,
      maxHp: 90,
      dead: false,
      downed: false,
      deathTimer: 0,
      fallSide: Math.random() < 0.5 ? 1 : -1,
      bloodMark: null,
      attacking: true,
      isPolice: true,
      swimming: false,
      clip: 10,
      maxClip: 10,
      reloadTimer: 0,
      reloadDuration: 1.65,
      fireCd: 0.7 + Math.random() * 0.7,
      meleeCd: 0,
      meleeSwingTimer: 0,
      muzzleTimer: 0,
      flinchTimer: 0,
      knockdownTimer: 0,
      knockVel: new THREE.Vector3(),
      stridePhase: Math.random() * 6,
      targetGang: null,
    };
    this.footOfficers.push(off);
    return off;
  }

  deployOfficersFromCruiser(u, state = null) {
    const stars = state?.wantedLevel ?? 1;
    const caps = getPoliceCapsForStar(stars);
    const maxFoot = Math.max(caps.maxFoot, this.gangShootoutActive ? 2 : 0);
    const aliveFoot = this.footOfficers.filter((o) => !o.dead && !o.downed).length;
    if (u.deployedOfficers || aliveFoot >= maxFoot) return;
    u.deployedOfficers = true;
    const rtX = Math.cos(u.yaw);
    const rtZ = -Math.sin(u.yaw);
    const wantCount = stars === 1 ? (aliveFoot === 0 ? 2 : 1) : (u.isSwat ? 2 : (Math.random() < 0.65 ? 2 : 1));
    const count = Math.min(wantCount, Math.max(0, maxFoot - aliveFoot));
    const weaponId = (stars === 1 && !state?.shotAtPolice && !this.gangShootoutActive) ? 'bat' : (stars >= 4 ? 'carbine' : 'pistol');
    for (let i = 0; i < count; i++) {
      const side = i === 0 ? -1 : 1;
      let ox = u.pos.x + rtX * side * 2.1;
      let oz = u.pos.z + rtZ * side * 2.1;
      // Ensure officers spawn on dry land/bridge deck, NEVER inside water!
      if (!this._isDryForStep(ox, oz, u.pos.y)) {
        const altX = u.pos.x - rtX * side * 2.1;
        const altZ = u.pos.z - rtZ * side * 2.1;
        if (this._isDryForStep(altX, altZ, u.pos.y)) {
          ox = altX;
          oz = altZ;
        } else {
          ox = u.pos.x;
          oz = u.pos.z;
        }
      }
      const off = this.spawnFootOfficer(ox, oz, u.yaw, weaponId);
      if (this.collisionWorld) this.collisionWorld.resolveCircle(off.pos, null, 0.55);
    }
  }

  applyOfficerDamage(off, amount, dir = null, state = null) {
    if (!off || off.dead || off.downed) return { killed: false };
    const dmg = Math.max(1, Math.round(amount));
    off.hp = Math.max(0, off.hp - dmg);
    off.flinchTimer = 0.28;
    if (dir) {
      off.pos.x += dir.x * 0.18;
      off.pos.z += dir.z * 0.18;
    }
    if (off.hp <= 0) {
      off.dead = true;
      off.downed = true;
      off.attacking = false;
      off.swimming = false;
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
      off.swimming = false;
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

  // Called when a gang member actively fires a weapon — notifies nearby police within 32m!
  notifyGangGunfire(gangMember, state = null) {
    if (!gangMember || gangMember.dead || gangMember.downed) return false;
    let engaged = false;
    const gx = gangMember.pos.x;
    const gz = gangMember.pos.z;

    for (const o of this.footOfficers) {
      if (o.dead || o.downed || o.swimming) continue;
      if (Math.hypot(o.pos.x - gx, o.pos.z - gz) <= 34) {
        o.targetGang = gangMember;
        if (o.weaponId === 'bat') {
          o.weaponId = 'pistol';
          setCharacterWeaponMesh(o.mesh, 'pistol');
        }
        engaged = true;
      }
    }

    for (const u of this.units) {
      if (u.disabled || u.exploded || u.playerDriven) continue;
      if (Math.hypot(u.pos.x - gx, u.pos.z - gz) <= 34) {
        this.gangShootoutActive = true;
        if (!u.deployedOfficers) this.deployOfficersFromCruiser(u, state);
        for (const o of this.footOfficers) {
          if (!o.dead && !o.downed && Math.hypot(o.pos.x - gx, o.pos.z - gz) <= 38) {
            o.targetGang = gangMember;
            if (o.weaponId === 'bat') {
              o.weaponId = 'pistol';
              setCharacterWeaponMesh(o.mesh, 'pistol');
            }
          }
        }
        engaged = true;
      }
    }

    if (engaged) this.gangShootoutActive = true;
    return engaged;
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

  _computeShoreExitDir(x, z) {
    // Ocean south of z = 274 -> swim north toward beach
    if (z > 272) return { x: 0, z: -1 };
    // Marina Bay channel (x in 66..154, z in 156..278) -> swim toward nearest quay wall
    if (x > 64 && x < 156 && z > 156 && z <= 278) {
      return x < 110 ? { x: -1, z: -0.15 } : { x: 1, z: -0.15 };
    }
    // Río Dorado river -> swim directly away from river centerline toward nearest dry bank
    const rCx = getRiverCenterX(z);
    return x < rCx ? { x: -1, z: 0 } : { x: 1, z: 0 };
  }

  // Move on-foot officer toward (tx, tz) while NEVER stepping onto water (steers along banks / toward nearest bridge!)
  _moveOfficerDry(o, tx, tz, runSpd, dt) {
    let navX = tx;
    let navZ = tz;

    // If target is across Río Dorado river and officer is not on a bridge deck, route along riverbank to nearest bridge!
    const onBridge = this.collisionWorld ? this.collisionWorld.isOnBridgeDeck(o.pos.x, o.pos.z, o.pos.y) : false;
    if (!onBridge && o.pos.z >= -430 && o.pos.z <= 165) {
      const rCx = getRiverCenterX(o.pos.z);
      const offSide = o.pos.x - rCx;
      const tgtSide = tx - getRiverCenterX(Math.max(-430, Math.min(165, tz)));
      if (offSide * tgtSide < 0 && Math.abs(offSide) < 60) {
        const br = getNearestBridgeForZ(o.pos.z);
        const approachX = offSide < 0 ? br.x1 - 3 : br.x2 + 3;
        if (Math.abs(o.pos.z - br.z) > br.halfZ * 0.8) {
          navX = approachX;
          navZ = br.z;
        }
      }
    }

    const dx = navX - o.pos.x;
    const dz = navZ - o.pos.z;
    const baseYaw = Math.atan2(dx, dz);
    const stepLen = Math.max(0.6, runSpd * dt * 2.2);
    const lookLen = 2.0;

    // Try direct heading, then progressively wider bank-following detours; reject any wet step!
    const offsets = [0, 0.55, -0.55, 1.05, -1.05, 1.55, -1.55, 2.05, -2.05];
    let chosenYaw = null;
    for (const ang of offsets) {
      const cand = baseYaw + ang;
      const sx = Math.sin(cand);
      const sz = Math.cos(cand);
      const p1x = o.pos.x + sx * stepLen;
      const p1z = o.pos.z + sz * stepLen;
      const p2x = o.pos.x + sx * lookLen;
      const p2z = o.pos.z + sz * lookLen;
      if (this._isDryForStep(p1x, p1z, o.pos.y) && this._isDryForStep(p2x, p2z, o.pos.y)) {
        chosenYaw = cand;
        break;
      }
    }

    if (chosenYaw === null) {
      // Surrounded by water on forward arc — stay dry at the shoreline!
      o.vel.set(0, 0, 0);
      return false;
    }

    const prevX = o.pos.x;
    const prevZ = o.pos.z;
    const prevY = o.pos.y;
    o.vel.set(Math.sin(chosenYaw) * runSpd, 0, Math.cos(chosenYaw) * runSpd);
    if (this.collisionWorld) {
      this.collisionWorld.moveAndSlide(o.pos, o.vel, 0.55, dt);
      const surfY = this.collisionWorld.getSurfaceHeight(o.pos.x, o.pos.z, o.pos.y);
      // Hard guard: revert if slide pushed officer into water!
      if (isWaterAt(o.pos.x, o.pos.z, surfY) || this._getWaterDepth(o.pos.x, o.pos.z, surfY) >= 0.4) {
        o.pos.set(prevX, prevY, prevZ);
        o.vel.set(0, 0, 0);
        return false;
      }
      o.pos.y = THREE.MathUtils.lerp(o.pos.y, surfY, Math.min(1, dt * 14));
    } else {
      const nx = o.pos.x + o.vel.x * dt;
      const nz = o.pos.z + o.vel.z * dt;
      if (isWaterAt(nx, nz, o.pos.y)) {
        o.vel.set(0, 0, 0);
        return false;
      }
      o.pos.x = nx;
      o.pos.z = nz;
    }
    o.yaw = chosenYaw;
    o.mesh.rotation.y = o.yaw;
    return true;
  }

  update(
    dt, elapsed, state, playerPos, playerYaw, heliUnit, combatSystem,
    playerSpeed = 0, onPlayerHit = null, audio = null, vehicles = [], extra = {}
  ) {
    for (const w of this.wrecks) animateBurningWreck(w, elapsed);

    // During WASTED / BUSTED overlay, never spawn units, fire, or build bust progress!
    if (state.statusOverlay) {
      state.bustProgress = 0;
      state.inSight = false;
      return { active: false, bustedReady: false, hidden: false };
    }

    const caps = getPoliceCapsForStar(state.wantedLevel);
    state.airUnitDeployed = caps.heli && !(heliUnit && (heliUnit.crashing || heliUnit.destroyed));

    const gangMembers = extra.gangMembers ?? [];
    const playerResisting = Boolean(extra.playerResisting);
    const onGangShotByPolice = extra.onGangShotByPolice ?? null;
    const onPoliceGunfireNear = extra.onPoliceGunfireNear ?? null;

    // Strictly enforce per-star cruiser cap (1★ NEVER spawns more than 1 cruiser!)
    const desiredCount = caps.maxCruisers;
    while (this.units.length < desiredCount) {
      const idx = this.units.length;
      const isSwat = caps.swatCount > 0 && idx >= (desiredCount - caps.swatCount);
      const isRoadblock = caps.roadblocks > 0 && (isSwat || (state.wantedLevel === 3 && idx === 2));
      const angle = isRoadblock
        ? playerYaw + (idx % 2 === 0 ? 0.14 : -0.14)
        : (playerYaw + Math.PI + (idx - 0.5) * 0.65);
      const dist = isRoadblock ? 68 + idx * 10 : 54 + idx * 14;
      let sx = Math.max(-420, Math.min(420, playerPos.x + Math.sin(angle) * dist));
      let sz = Math.max(-410, Math.min(212, playerPos.z + Math.cos(angle) * dist));
      // Ensure cruisers NEVER spawn floating over Río Dorado or Marina Bay water!
      if (this._getWaterDepth(sx, sz, this.collisionWorld ? this.collisionWorld.getBridgeDeckY(sx, sz) : 0) > 0.25) {
        sx = sx < 145 ? 102 : 182;
      }
      const tactic = isRoadblock
        ? 'ROADBLOCK'
        : state.wantedLevel === 1
          ? 'PATROL'
          : state.wantedLevel === 2
            ? (idx === 0 ? 'PURSUIT' : 'CLOSING IN')
            : (idx === 0 && caps.allowRam ? 'RAMMING' : idx % 2 === 1 ? 'FLANKING' : 'CLOSING IN');
      const spawnYaw = isRoadblock ? playerYaw + Math.PI * 0.5 : playerYaw;
      const u = this.spawnUnit(CALLSIGNS[idx % CALLSIGNS.length], isSwat, sx, sz, spawnYaw, tactic);
      if (this.collisionWorld) {
        this.collisionWorld.resolveCircle(u.pos, null, 2.6);
      }
    }
    while (this.units.length > desiredCount) {
      const popped = this.units.pop();
      this.group.remove(popped.mesh);
    }

    // Strictly enforce per-star foot officer cap while wanted (1★ <= 2, 2★ <= 3, ..., 5★ <= 6)
    if (state.wantedLevel > 0) {
      let aliveFootSeen = 0;
      for (let i = 0; i < this.footOfficers.length; i++) {
        const o = this.footOfficers[i];
        if (o.dead || o.downed) continue;
        aliveFootSeen++;
        if (aliveFootSeen > caps.maxFoot) {
          this.group.remove(o.mesh);
          if (o.bloodMark) this.group.remove(o.bloodMark);
          this.footOfficers.splice(i, 1);
          i--;
        }
      }
    }

    const jammed = state.signalJamTimer > 0;
    const playerEye = { x: playerPos.x, y: (playerPos.y ?? 0) + 1.25, z: playerPos.z };
    let anyPoliceLOS = false;

    // Check helicopter 3D visual lock
    if (!jammed && state.airUnitDeployed && heliUnit && heliUnit.hasVisualLock && heliUnit.isActiveHostile()) {
      anyPoliceLOS = true;
    }

    const fwdX = Math.sin(playerYaw);
    const fwdZ = Math.cos(playerYaw);
    const rtX = Math.cos(playerYaw);
    const rtZ = -Math.sin(playerYaw);

    this.units.forEach((u, idx) => {
      if (u.playerDriven) return;
      if (u.exploded) {
        u.speed = 0;
        u.disabled = true;
        return;
      }
      if (u.burning) {
        u.disabled = true;
        if (!u.deployedOfficers) this.deployOfficersFromCruiser(u, state);
      }
      updatePoliceLightbar(u.mesh, elapsed, u.phase);
      const distToPlayer = Math.hypot(playerPos.x - u.pos.x, playerPos.z - u.pos.z);

      // True 3D LOS check from cruiser windshield to player
      let cruiserSeesPlayer = false;
      if (!jammed && !u.disabled && distToPlayer < 70 && !state.diving) {
        const fromPt = { x: u.pos.x, y: u.pos.y + 1.5, z: u.pos.z };
        cruiserSeesPlayer = this.collisionWorld
          ? this.collisionWorld.hasLineOfSight(fromPt, playerEye, { ignoreTags: ['bus-stop'] })
          : true;
        if (cruiserSeesPlayer) anyPoliceLOS = true;
      }

      const playerSlowOrFoot = !state.inVehicle || playerSpeed < 3.2;
      if (!jammed && !u.deployedOfficers && ((cruiserSeesPlayer && playerSlowOrFoot && distToPlayer < 26) || u.isRoadblock && distToPlayer < 34 || u.disabled || u.hp <= 0)) {
        this.deployOfficersFromCruiser(u, state);
      }

      // Roadblock units hold blocking position; disabled or officer-deployed cruisers brake cleanly
      if (u.disabled || u.isRoadblock || (u.deployedOfficers && playerSlowOrFoot && distToPlayer < 28)) {
        u.speed = THREE.MathUtils.lerp(u.speed, 0, Math.min(1, dt * 4));
      } else {
        const tgtBase = cruiserSeesPlayer || anyPoliceLOS ? playerPos : this.lastSeenPos;
        let tx = tgtBase.x;
        let tz = tgtBase.z;
        if (jammed) {
          tx = u.pos.x + Math.sin(u.yaw + 0.4) * 20;
          tz = u.pos.z + Math.cos(u.yaw + 0.4) * 20;
        } else if (!state.inVehicle) {
          tx = tgtBase.x - fwdX * (13 + idx * 5);
          tz = tgtBase.z - fwdZ * (13 + idx * 5);
        } else if (state.wantedLevel === 1) {
          // 1★ Calm pursuit: trail politely behind the player with NO aggressive ramming!
          tx = tgtBase.x - fwdX * 14;
          tz = tgtBase.z - fwdZ * 14;
        } else if (state.wantedLevel === 2) {
          // 2★ Moderate chase without aggressive pit/ram
          tx = tgtBase.x - fwdX * (10 + idx * 6) + rtX * (idx === 1 ? 6 : 0);
          tz = tgtBase.z - fwdZ * (10 + idx * 6) + rtZ * (idx === 1 ? 6 : 0);
        } else if (idx === 0 && caps.allowRam) {
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

        const maxSpd = u.isSwat ? Math.min(30, caps.cruiserSpeed) : caps.cruiserSpeed;
        const targetSpd = jammed ? 12 : dist > 11 ? maxSpd : Math.min(10, maxSpd * 0.4);
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

    // Authentic GTA arrest eligibility: ONLY 1★, OR 2★ when player has NOT fired weapons at police!
    const arrestAllowed = state.wantedLevel === 1 || (state.wantedLevel === 2 && !state.shotAtPolice);
    const officerLethalToPlayer = state.wantedLevel >= 3 || Boolean(state.shotAtPolice) || (state.wantedLevel === 2 && playerResisting);

    // Update uniformed on-foot CDPD officers (water-safe pathing/swimming, arrest reach <2.5m, raycast gunfire & gang shootouts!)
    let officerWithinArrestReach = false;
    let anyActiveGangTarget = false;

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
      if (o.meleeCd > 0) o.meleeCd = Math.max(0, o.meleeCd - dt);
      if (o.meleeSwingTimer > 0) o.meleeSwingTimer = Math.max(0, o.meleeSwingTimer - dt);
      if (o.muzzleTimer > 0) {
        o.muzzleTimer -= dt;
        if (o.muzzleTimer <= 0 && o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = false;
      }

      // Knockdown physics (can knock an officer into the river/bay!)
      if (o.knockdownTimer > 0) {
        o.knockdownTimer = Math.max(0, o.knockdownTimer - dt);
        o.knockVel.multiplyScalar(Math.pow(0.08, dt));
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(o.pos, o.knockVel, 0.55, dt);
        else { o.pos.x += o.knockVel.x * dt; o.pos.z += o.knockVel.z * dt; }
        const kdDepth = this._getWaterDepth(o.pos.x, o.pos.z, o.pos.y);
        if (kdDepth >= 0.72) {
          // Immediately transition to swimming if knocked into deep water!
          o.knockdownTimer = 0;
          o.swimming = true;
        } else {
          const baseY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(o.pos.x, o.pos.z, o.pos.y) : 0;
          const f = o.knockdownTimer < 0.45 ? o.knockdownTimer / 0.45 : 1.0;
          o.mesh.position.y = baseY + 0.18 * f;
          o.mesh.rotation.x = -Math.PI * 0.48 * f;
          continue;
        }
      }

      // Check real water depth -> genuine swimming posture (NEVER walking upright on water!)
      const curDepth = this._getWaterDepth(o.pos.x, o.pos.z, o.pos.y);
      if (curDepth >= 0.72) {
        o.swimming = true;
      } else if (o.swimming && curDepth < 0.52) {
        o.swimming = false;
        o.mesh.rotation.x = 0;
        o.mesh.rotation.z = 0;
        if (o.mesh.userData.gunGroup) o.mesh.userData.gunGroup.visible = true;
      }

      if (o.swimming) {
        // Swimming state: lowered to water level, horizontal swim animation at ~1.7 m/s, unable to fire or arrest!
        const exitDir = this._computeShoreExitDir(o.pos.x, o.pos.z);
        const swimSpd = 1.7;
        o.vel.set(exitDir.x * swimSpd, 0, exitDir.z * swimSpd);
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(o.pos, o.vel, 0.55, dt, { followSurface: false });
        else { o.pos.x += o.vel.x * dt; o.pos.z += o.vel.z * dt; }
        o.pos.y = 0;
        o.yaw = Math.atan2(exitDir.x, exitDir.z);
        o.mesh.position.set(o.pos.x, -0.72, o.pos.z);
        o.mesh.rotation.y = o.yaw;
        o.mesh.rotation.z = 0;
        if (o.mesh.userData.gunGroup) o.mesh.userData.gunGroup.visible = false;
        if (o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = false;
        poseHumanSwim(o.mesh, elapsed + o.stridePhase, true, false);
        continue;
      }

      o.mesh.rotation.x = 0;
      o.mesh.rotation.z = 0;
      if (o.mesh.userData.gunGroup) o.mesh.userData.gunGroup.visible = true;

      // Keep officer weapon consistent with star level & gunfire escalation
      const wantWeapon = (o.targetGang || officerLethalToPlayer)
        ? (state.wantedLevel >= 4 ? 'carbine' : 'pistol')
        : 'bat';
      if (o.weaponId !== wantWeapon) {
        o.weaponId = wantWeapon;
        setCharacterWeaponMesh(o.mesh, wantWeapon);
      }

      // Check for nearby firing gang members (emergent Gang-vs-Police shootout!)
      if (o.targetGang && (o.targetGang.dead || o.targetGang.downed || Math.hypot(o.targetGang.pos.x - o.pos.x, o.targetGang.pos.z - o.pos.z) > 45)) {
        o.targetGang = null;
      }
      if (!o.targetGang && gangMembers.length > 0) {
        for (const gm of gangMembers) {
          if (gm.dead || gm.downed) continue;
          if ((gm.recentFireTimer > 0 || gm.fightingPolice) && Math.hypot(gm.pos.x - o.pos.x, gm.pos.z - o.pos.z) < 34) {
            o.targetGang = gm;
            break;
          }
        }
      }
      if (o.targetGang) anyActiveGangTarget = true;

      const dxP = playerPos.x - o.pos.x;
      const dzP = playerPos.z - o.pos.z;
      const distP = Math.hypot(dxP, dzP) || 1;

      // Remove very distant officers if player sped away (and not in an active gang shootout)
      if (distP > 140 && !o.targetGang) {
        this.group.remove(o.mesh);
        this.footOfficers.splice(i, 1);
        continue;
      }

      const offEye = { x: o.pos.x, y: o.pos.y + 1.45, z: o.pos.z };
      const hasPlayerLOS = state.wantedLevel > 0 && !jammed && !state.diving && distP < 52 && (
        this.collisionWorld
          ? this.collisionWorld.hasLineOfSight(offEye, playerEye, { ignoreTags: ['bus-stop'] })
          : true
      );
      if (hasPlayerLOS) anyPoliceLOS = true;

      // True GTA arrest check: alive non-swimming on-foot officer within arm's reach (< 2.5m) with clear LOS!
      if (hasPlayerLOS && distP < 2.5) {
        officerWithinArrestReach = true;
      }

      if (o.reloadTimer > 0) {
        o.reloadTimer = Math.max(0, o.reloadTimer - dt);
        poseHumanReload(o.mesh, 1 - o.reloadTimer / o.reloadDuration);
        if (o.reloadTimer <= 0) o.clip = o.maxClip;
        if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
        continue;
      }

      // Engage armed gang target if present (prioritize gang if wantedLevel===0 or gang is closer/actively shooting!)
      if (o.targetGang && (state.wantedLevel === 0 || Math.hypot(o.targetGang.pos.x - o.pos.x, o.targetGang.pos.z - o.pos.z) <= distP + 8)) {
        const gm = o.targetGang;
        const gdx = gm.pos.x - o.pos.x;
        const gdz = gm.pos.z - o.pos.z;
        const gDist = Math.hypot(gdx, gdz) || 1;
        o.yaw = Math.atan2(gdx, gdz);
        o.mesh.rotation.y = o.yaw;

        if (gDist > 14) {
          const moved = this._moveOfficerDry(o, gm.pos.x, gm.pos.z, 4.1, dt);
          if (moved) {
            o.stridePhase += dt * 9.0;
            poseHumanStride(o.mesh, o.stridePhase, false);
          } else {
            poseHumanCombat(o.mesh, true);
          }
        } else {
          poseHumanCombat(o.mesh, true);
        }

        const gEye = { x: gm.pos.x, y: (gm.pos.y ?? 0) + 1.3, z: gm.pos.z };
        const hasGangLOS = gDist < 38 && (
          this.collisionWorld ? this.collisionWorld.hasLineOfSight(offEye, gEye, { ignoreTags: ['bus-stop'] }) : true
        );
        if (!hasGangLOS && gDist > 4) {
          const moved = this._moveOfficerDry(o, gm.pos.x, gm.pos.z, 4.1, dt);
          if (moved) {
            o.stridePhase += dt * 9.0;
            poseHumanStride(o.mesh, o.stridePhase, false);
          }
        }
        if (hasGangLOS) {
          o.fireCd -= dt;
          if (o.fireCd <= 0) {
            if (o.clip <= 0) {
              o.reloadTimer = o.reloadDuration;
              continue;
            }
            const orig = o.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
            const tgt = gm.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.22, (Math.random() - 0.5) * 0.8));
            const shotVec = tgt.clone().sub(orig);
            const shotDist = shotVec.length() || 1;
            const shotDir = shotVec.clone().divideScalar(shotDist);
            const envHit = this.collisionWorld ? this.collisionWorld.raycast(orig, shotDir, shotDist, { vehicles }) : null;
            o.clip -= 1;
            o.fireCd = 0.78 + Math.random() * 0.55;
            o.muzzleTimer = 0.08;
            if (o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = true;
            if (audio) audio.playGunshot('pistol');
            this.policeVsGangShots += 1;
            if (envHit && envHit.dist < shotDist - 0.45) {
              const stopPt = new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z);
              if (combatSystem) {
                combatSystem.spawnTracer(orig, stopPt, 0x62b4ff, 0.036, 0.14);
                combatSystem.spawnSparks(stopPt, 4, 0xffd27a);
              }
            } else {
              if (combatSystem) {
                combatSystem.spawnTracer(orig, tgt, 0x62b4ff, 0.036, 0.14);
                combatSystem.spawnSparks(tgt, 5, 0xff8040);
              }
              if (Math.random() < 0.58 && onGangShotByPolice) {
                onGangShotByPolice(gm, 18, shotDir, o);
              }
            }
            if (o.clip <= 0) o.reloadTimer = o.reloadDuration;
          }
        }
        if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
        continue;
      }

      // Standard pursuit of player
      if (state.wantedLevel === 0) {
        poseHumanStride(o.mesh, 0, false);
        continue;
      }

      o.yaw = Math.atan2(dxP, dzP);
      o.mesh.rotation.y = o.yaw;

      // In arrest mode (1★ or non-firing 2★), officers rush right up to arm's reach (~1.75m)!
      const stopDist = arrestAllowed ? 1.75 : 11.5;
      const runSpd = state.wantedLevel === 1 ? 3.55 : 4.25;
      if (!jammed && distP > stopDist && (hasPlayerLOS || distP < 36)) {
        const moved = this._moveOfficerDry(o, playerPos.x, playerPos.z, runSpd, dt);
        if (moved) {
          o.stridePhase += dt * (state.wantedLevel === 1 ? 8.2 : 9.5);
          poseHumanStride(o.mesh, o.stridePhase, false);
        } else {
          poseHumanCombat(o.mesh, true);
        }
      } else if (o.meleeSwingTimer > 0) {
        poseHumanMeleeSwing(o.mesh, 1 - o.meleeSwingTimer / 0.30, true, 0);
      } else {
        poseHumanCombat(o.mesh, true);
      }

      // 1★ non-firing baton melee if player is resisting right next to officer (no gunfire unless shotAtPolice!)
      if (!jammed && hasPlayerLOS && o.weaponId === 'bat' && distP < 2.4 && playerResisting && !state.inVehicle) {
        if (o.meleeCd <= 0) {
          o.meleeCd = 1.05;
          o.meleeSwingTimer = 0.30;
          if (audio) audio.playGunshot('bat');
          if (onPlayerHit) onPlayerHit(7);
        }
      }

      // Firearm attack ONLY when lethal force is authorized (3★+, shotAtPolice, or 2★ resisting)
      if (!jammed && hasPlayerLOS && o.weaponId !== 'bat' && officerLethalToPlayer && distP < 38) {
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
          if (onPoliceGunfireNear) onPoliceGunfireNear(o.pos, o);

          if (envHit && envHit.dist < shotDist - 0.45) {
            o.fireCd = 0.9 + Math.random() * 0.6;
            const stopPt = new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z);
            if (combatSystem) {
              combatSystem.spawnTracer(orig, stopPt, 0x62b4ff, 0.036, 0.14);
              combatSystem.spawnSparks(stopPt, 4, 0xffd27a);
            }
            continue;
          }

          o.clip -= 1;
          o.fireCd = state.wantedLevel >= 4 ? (0.7 + Math.random() * 0.55) : (0.95 + Math.random() * 0.7);
          o.muzzleTimer = 0.08;
          if (o.mesh.userData.muzzleFlash) o.mesh.userData.muzzleFlash.visible = true;
          if (audio) audio.playGunshot(o.weaponId === 'carbine' ? 'carbine' : 'pistol');
          if (combatSystem) combatSystem.spawnTracer(orig, tgt, 0x62b4ff, 0.036, 0.14);
          if (Math.random() < 0.36 && onPlayerHit) onPlayerHit(state.wantedLevel >= 4 ? 9 : 7);
          if (o.clip <= 0) o.reloadTimer = o.reloadDuration;
        }
      }

      if (o.flinchTimer > 0) poseHumanFlinch(o.mesh, o.flinchTimer / 0.25);
    }

    if (!anyActiveGangTarget) this.gangShootoutActive = false;

    state.inSight = Boolean(state.wantedLevel > 0 && anyPoliceLOS && !jammed);
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
        const hideDelay = state.wantedLevel === 1 ? 1.2 : 1.8;
        if (this.hiddenTimer >= hideDelay || jammed) {
          const decayRate = jammed ? 45 : state.wantedLevel === 1 ? 32 : 24;
          state.wantedHeat = Math.max(0, state.wantedHeat - decayRate * dt);
          const nextStars = computeWantedStars(state.wantedHeat);
          if (nextStars !== state.wantedLevel) {
            state.wantedLevel = nextStars;
            state.airUnitDeployed = getPoliceCapsForStar(state.wantedLevel).heli;
          }
          if (state.wantedHeat <= 0) {
            this.clearAll(state);
            state.careerStats.pursuitsEvaded += 1;
          }
        }
      }
    } else {
      state.hiddenFromPolice = false;
      this.hiddenTimer = 0;
    }

    // TRUE GTA-STYLE BUSTED ARREST MECHANIC:
    // - NEVER triggers at 0★
    // - ONLY at 1★ or (2★ && !shotAtPolice)
    // - ONLY when alive on-foot officer < 2.5m with clear LOS AND player is stationary & NOT resisting
    // - IMMEDIATELY resets bustProgress = 0 if player resists (WASD / Shift / fire / melee / accelerate / reverse)!
    const stationaryNotResisting = !playerResisting && (!state.inVehicle ? playerSpeed < 0.5 : playerSpeed < 1.2);
    const canFillBust = state.wantedLevel > 0 && arrestAllowed && !jammed && !state.statusOverlay && !state.swimming &&
      officerWithinArrestReach && stationaryNotResisting;

    if (canFillBust) {
      state.bustProgress = Math.min(2.2, (state.bustProgress ?? 0) + dt);
    } else if (state.wantedLevel === 0 || !arrestAllowed || playerResisting || !stationaryNotResisting) {
      state.bustProgress = 0;
    } else {
      state.bustProgress = Math.max(0, (state.bustProgress ?? 0) - dt * 3.0);
    }

    return {
      active: state.wantedLevel > 0,
      bustedReady: state.wantedLevel > 0 && arrestAllowed && (state.bustProgress ?? 0) >= 2.2,
      hidden: state.hiddenFromPolice,
    };
  }
}
