// High-density living city traffic (shootable/destructible, riding elevated bridges cleanly),
// mixed-personality civilians (~70% Timid fleeing vs ~30% Brave melee fighters),
// ambient Street Crime Gangs (Los Caimanes & Viperas del Sur) in distinct city turfs,
// and conditional emergent Gang-vs-Police street shootouts!

import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLES } from '../core/config.js';
import { ROAD_X, ROAD_Z, GANG_TURFS, isWaterAt, getRiverCenterX } from './cityPlan.js';
import { createVehicleMesh } from '../entities/vehicleFactory.js';
import {
  buildCharacterMesh, setCharacterWeaponMesh, poseHumanStride, poseHumanFlinch,
  poseHumanCollapse, poseHumanCombat, poseHumanReload, poseHumanMeleeSwing, poseHumanSwim,
} from '../entities/playerController.js';

export class TrafficAndPeds {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.cars = [];
    this.peds = [];
    this.gangMembers = [];
    this.gangVsPoliceActive = false;
    this.gangVsPoliceShots = 0;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._bloodGeo = new THREE.CircleGeometry(0.56, 16);
    this._bloodMat = new THREE.MeshBasicMaterial({
      color: 0x6b0b16, transparent: true, opacity: 0.74, depthWrite: false,
    });

    this._spawnTraffic();
    this._spawnPedestrians();
    this._spawnStreetGangs();
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

    let civIdx = 0;
    spawnList.forEach((sp, i) => {
      const shirt = brightColors[i % brightColors.length];
      const ped = createPedMesh(shirt, 0x263145, sp.role);
      ped.position.set(sp.x, 0, sp.z);
      if (sp.facing !== undefined) ped.rotation.y = sp.facing;
      else if (sp.stationary) ped.rotation.y = (i % 6) * 1.05;
      this.group.add(ped);
      const maxHp = sp.role === 'officer' ? 90 : (sp.role === 'enforcer' ? 70 : 55);
      // ~30% Brave / Tough civilians vs ~70% Timid fleeing civilians!
      const personality = sp.role === 'vendor'
        ? 'timid'
        : (sp.role === 'enforcer' || (civIdx++ % 10) < 3) ? 'brave' : 'timid';

      this.peds.push({
        mesh: ped,
        pos: ped.position,
        role: sp.role,
        personality,
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
        aggro: false,
        attacking: false,
        label: null,
        meleeCd: 0,
        meleeSwingTimer: 0,
        meleeCombo: 0,
        swimming: false,
      });
    });
  }

  // Spawn ambient 3–4 member Street Crime Gang crews (Los Caimanes & Viperas del Sur) in their city turfs!
  _spawnStreetGangs() {
    const skins = [0xd49a74, 0xc48760, 0xb3744e, 0xdba582];
    let memberIdx = 0;

    for (const turf of GANG_TURFS) {
      const isCaimanes = turf.gangId === 'los-caimanes';
      const jacket = isCaimanes ? 0x6d28d9 : 0xc81e3a; // Purple (Los Caimanes) vs Crimson Red (Viperas del Sur)
      const accent = isCaimanes ? 0xfbbf24 : 0x14b8a6; // Gold accents vs Teal accents
      const pants = isCaimanes ? 0x181626 : 0x151c26;

      for (let i = 0; i < turf.count; i++) {
        const ang = (i / turf.count) * Math.PI * 2 + 0.35;
        const rad = 2.4 + (i % 2) * 0.9;
        const x = turf.center.x + Math.cos(ang) * rad;
        const z = turf.center.z + Math.sin(ang) * rad;
        const weaponId = turf.weapons[i % turf.weapons.length] ?? 'pistol';

        const mesh = buildCharacterMesh({
          jacket,
          accent,
          pants,
          skin: skins[memberIdx % skins.length],
          hair: 0x171414,
          isFemale: !isCaimanes && i === 2,
          outfitStyle: 'bomber',
          hairStyle: isCaimanes ? 'fade' : (i === 2 ? 'ponytail' : 'swept'),
          accessory: i % 2 === 0 ? 'aviators' : 'cap',
          withWeapon: true,
        });
        setCharacterWeaponMesh(mesh, weaponId);
        const y = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(x, z, 0) : 0;
        mesh.position.set(x, y, z);
        // Face inward toward the center of the hangout group
        const homeYaw = Math.atan2(turf.center.x - x, turf.center.z - z);
        mesh.rotation.y = homeYaw;
        poseHumanStride(mesh, 0, false);
        this.group.add(mesh);

        const gm = {
          id: `${turf.crewId}-${i}`,
          crewId: turf.crewId,
          gangId: turf.gangId,
          gangName: turf.gangName,
          district: turf.district,
          isGang: true,
          weaponId,
          mesh,
          pos: mesh.position,
          homePos: new THREE.Vector3(x, y, z),
          homeYaw,
          vel: new THREE.Vector3(),
          yaw: homeYaw,
          hp: 95,
          maxHp: 95,
          dead: false,
          downed: false,
          deathTimer: 0,
          fallSide: memberIdx % 2 === 0 ? 1 : -1,
          bloodMark: null,
          aggro: false,
          attacking: false,
          fightingPolice: false,
          targetOfficer: null,
          label: null,
          recentFireTimer: 0,
          clip: weaponId === 'smg' ? 18 : 10,
          maxClip: weaponId === 'smg' ? 18 : 10,
          reloadTimer: 0,
          reloadDuration: 1.7,
          fireCd: 0.65 + Math.random() * 0.65,
          meleeCd: 0,
          meleeSwingTimer: 0,
          meleeCombo: 0,
          muzzleTimer: 0,
          flinchTimer: 0,
          knockdownTimer: 0,
          knockVel: new THREE.Vector3(),
          stridePhase: memberIdx * 1.3,
          swimming: false,
        };
        if (this.collisionWorld) this.collisionWorld.resolveCircle(gm.pos, null, 0.55);
        gm.homePos.copy(gm.pos);
        this.gangMembers.push(gm);
        memberIdx++;
      }
    }
  }

  // Spawn a pulled-out carjacked driver beside a stolen traffic car (70% timid flee / 30% brave fight back!)
  spawnCarjackedDriver(vehPos, vehYaw, playerPos, forcePersonality = null) {
    const rtX = Math.cos(vehYaw);
    const rtZ = -Math.sin(vehYaw);
    const dx = vehPos.x - rtX * 2.2;
    const dz = vehPos.z - rtZ * 2.2;
    const personality = forcePersonality ?? (Math.random() < 0.30 ? 'brave' : 'timid');
    const pedMesh = createPedMesh(personality === 'brave' ? 0xe85a4f : 0x5c80bc, 0x222938, 'commuter');
    const y = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(dx, dz, vehPos.y ?? 0) : 0;
    pedMesh.position.set(dx, y, dz);
    pedMesh.rotation.y = Math.atan2(playerPos.x - dx, playerPos.z - dz);
    this.group.add(pedMesh);

    const ped = {
      mesh: pedMesh,
      pos: pedMesh.position,
      role: 'commuter',
      personality,
      axis: 'x',
      dir: 1,
      stationary: false,
      min: -340,
      max: 340,
      baseSpeed: 1.85,
      fleeSpeed: 4.1,
      hp: 60,
      maxHp: 60,
      dead: false,
      downed: false,
      deathTimer: 0,
      fallSide: 1,
      bloodMark: null,
      panicTimer: personality === 'timid' ? 7.5 : 0,
      fleeYaw: Math.atan2(dx - playerPos.x, dz - playerPos.z),
      flinchTimer: 0,
      knockdownTimer: 0,
      knockVel: new THREE.Vector3(),
      phase: Math.random() * 6,
      aggro: personality === 'brave',
      attacking: personality === 'brave',
      label: personality === 'brave' ? 'FIGHTER' : null,
      meleeCd: 0.4,
      meleeSwingTimer: 0,
      meleeCombo: 0,
      swimming: false,
    };
    if (this.collisionWorld) this.collisionWorld.resolveCircle(ped.pos, null, 0.5);
    this.peds.push(ped);
    return ped;
  }

  // Calm all civilians & gang crews completely on WASTED / BUSTED & respawn!
  resetAggro() {
    this.gangVsPoliceActive = false;
    for (const p of this.peds) {
      if (p.dead || p.downed) continue;
      p.aggro = false;
      p.attacking = false;
      p.label = null;
      p.panicTimer = 0;
      p.meleeCd = 0;
      p.meleeSwingTimer = 0;
    }
    for (const g of this.gangMembers) {
      if (g.dead || g.downed) continue;
      g.aggro = false;
      g.attacking = false;
      g.fightingPolice = false;
      g.targetOfficer = null;
      g.label = null;
      g.recentFireTimer = 0;
      g.muzzleTimer = 0;
      g.meleeSwingTimer = 0;
      if (g.mesh.userData.muzzleFlash) g.mesh.userData.muzzleFlash.visible = false;
      poseHumanStride(g.mesh, 0, false);
    }
  }

  _killPed(ped) {
    if (ped.dead) return;
    ped.hp = 0;
    ped.dead = true;
    ped.downed = true;
    ped.aggro = false;
    ped.attacking = false;
    ped.label = null;
    ped.deathTimer = 0.001;
    ped.deathBaseY = ped.mesh.position.y ?? 0;
    ped.knockdownTimer = 0;
    if (ped.mesh.userData.muzzleFlash) ped.mesh.userData.muzzleFlash.visible = false;
    if (!ped.bloodMark) {
      const mark = new THREE.Mesh(this._bloodGeo, this._bloodMat);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(ped.mesh.position.x, ped.deathBaseY + 0.04, ped.mesh.position.z);
      this.group.add(mark);
      ped.bloodMark = mark;
    }
    poseHumanCollapse(ped.mesh, 0.12, ped.fallSide, ped.deathBaseY);
  }

  // Rally entire nearby gang crew when any member is provoked!
  provokeGangCrew(sourceMemberOrPos, targetKind = 'player', policeOfficer = null, radius = 26) {
    const isMember = Boolean(sourceMemberOrPos?.isGang);
    const origin = isMember ? sourceMemberOrPos.pos : sourceMemberOrPos;
    const crewId = isMember ? sourceMemberOrPos.crewId : null;
    const gangId = isMember ? sourceMemberOrPos.gangId : null;
    let rallied = 0;

    for (const g of this.gangMembers) {
      if (g.dead || g.downed) continue;
      const d = Math.hypot(g.pos.x - origin.x, g.pos.z - origin.z);
      const sameCrew = crewId && g.crewId === crewId;
      const nearbySameGang = gangId ? (g.gangId === gangId && d <= radius) : (d <= radius);
      if (sameCrew || nearbySameGang) {
        g.aggro = true;
        g.attacking = true;
        g.label = g.gangName.toUpperCase();
        if (targetKind === 'police') {
          g.fightingPolice = true;
          if (policeOfficer) g.targetOfficer = policeOfficer;
          this.gangVsPoliceActive = true;
        }
        rallied++;
      }
    }
    return rallied;
  }

  // Called when police open fire or collide near a gang group -> conditional Gang-vs-Police shootout!
  alertGangsToPoliceNear(pos, officer = null, radius = 18) {
    let alerted = 0;
    for (const g of this.gangMembers) {
      if (g.dead || g.downed) continue;
      if (Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) <= radius) {
        alerted += this.provokeGangCrew(g, 'police', officer, 26);
      }
    }
    return alerted;
  }

  applyGangDamage(g, dmg, dir = null, opts = {}) {
    if (!g || g.dead || g.downed) return { killed: false };
    g.hp = Math.max(0, g.hp - Math.max(1, Math.round(dmg)));
    g.flinchTimer = 0.28;
    if (dir) {
      const kb = opts.source === 'vehicle' ? Math.min(16, (opts.impactSpeed ?? 12) * 0.7) : 0.22;
      if (opts.source === 'vehicle') {
        g.knockVel.set(dir.x * kb, 0, dir.z * kb);
        g.knockdownTimer = Math.max(g.knockdownTimer ?? 0, 1.45);
      } else {
        g.pos.x += dir.x * kb;
        g.pos.z += dir.z * kb;
      }
    }

    // Entire nearby gang crew rallies immediately!
    if (opts.attacker === 'police') {
      this.provokeGangCrew(g, 'police', opts.policeOfficer ?? null, 28);
    } else {
      this.provokeGangCrew(g, 'player', null, 28);
    }

    if (g.hp <= 0) {
      this._killPed(g);
      if (opts.state && opts.attacker !== 'police') {
        opts.state.careerStats.takedowns += 1;
        opts.state.cash += 300;
        opts.state.rp += 40;
      }
      if (opts.combatSystem) {
        const r = Math.random();
        const dropKind = r < 0.42 ? 'cash' : r < 0.70 ? 'ammo' : r < 0.88 ? 'health' : 'armor';
        opts.combatSystem.spawnPickup(g.pos.clone(), dropKind);
      }
      return { killed: true };
    }
    return { killed: false };
  }

  reactToHorn(originPos, radius = 22) {
    let reacted = 0;
    for (const p of this.peds) {
      if (p.role === 'vendor' || p.dead || p.downed || p.aggro) continue;
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

  triggerPanicNear(pos, radius = 48, opts = {}) {
    const heavy = Boolean(opts.heavy);
    for (const p of this.peds) {
      if (p.role === 'vendor' || p.dead || p.downed) continue;
      const dx = p.mesh.position.x - pos.x;
      const dz = p.mesh.position.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        // Unarmed brave fighters can break & flee if heavy gunfire/explosions erupt right next to them!
        if (p.aggro) {
          if (heavy && d2 < 16 * 16) {
            p.aggro = false;
            p.attacking = false;
            p.label = null;
            p.panicTimer = 6.5;
            p.fleeYaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.35;
          }
          continue;
        }
        p.panicTimer = 6.5;
        p.fleeYaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.35;
      }
    }
  }

  applyPedShot(ped, dmg, dir, opts = {}) {
    if (!ped || ped.dead || ped.downed) return { killed: false };
    const isMelee = Boolean(opts.isMelee);
    ped.hp = Math.max(0, ped.hp - Math.max(1, Math.round(dmg)));
    ped.flinchTimer = 0.28;
    if (dir) {
      ped.fleeYaw = Math.atan2(dir.x, dir.z);
      ped.mesh.position.x += dir.x * 0.22;
      ped.mesh.position.z += dir.z * 0.22;
    }
    if (ped.hp <= 0) {
      this._killPed(ped);
      return { killed: true };
    }
    // Mixed civilian personalities: Brave civilians square up & fight back when punched/provoked!
    if (ped.personality === 'brave' && isMelee) {
      ped.aggro = true;
      ped.attacking = true;
      ped.label = 'FIGHTER';
      ped.panicTimer = 0;
    } else {
      ped.aggro = false;
      ped.attacking = false;
      ped.label = null;
      ped.panicTimer = 7.0;
    }
    return { killed: false };
  }

  applyPedVehicleImpact(ped, dirX, dirZ, speed) {
    if (!ped || ped.dead || ped.downed) return { hit: false, killed: false };
    const force = Math.min(18, Math.max(5.5, speed * 0.72));
    ped.knockVel.set(dirX * force, 0, dirZ * force);
    ped.knockdownTimer = 1.65;
    ped.flinchTimer = 0.32;
    ped.fleeYaw = Math.atan2(dirX, dirZ);
    const dmg = Math.round(speed * 3.2);
    ped.hp = Math.max(0, ped.hp - dmg);
    if (ped.hp <= 0) {
      this._killPed(ped);
      return { hit: true, killed: true };
    }
    if (ped.personality === 'brave' && speed < 11) {
      ped.aggro = true;
      ped.attacking = true;
      ped.label = 'FIGHTER';
      ped.panicTimer = 0;
    } else {
      ped.aggro = false;
      ped.attacking = false;
      ped.label = null;
      ped.panicTimer = 7.0;
    }
    return { hit: true, killed: false };
  }

  _isDryPos(x, z, curY = 0) {
    const surfY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(x, z, curY) : 0;
    if (isWaterAt(x, z, surfY)) return false;
    return this.collisionWorld ? this.collisionWorld.getWaterDepth(x, z, surfY) < 0.38 : true;
  }

  _moveHumanDry(ent, tx, tz, spd, dt) {
    const dx = tx - ent.pos.x;
    const dz = tz - ent.pos.z;
    const baseYaw = Math.atan2(dx, dz);
    const stepLen = Math.max(0.55, spd * dt * 2.2);
    const offsets = [0, 0.65, -0.65, 1.25, -1.25];
    let chosen = null;
    for (const ang of offsets) {
      const yw = baseYaw + ang;
      const nx = ent.pos.x + Math.sin(yw) * stepLen;
      const nz = ent.pos.z + Math.cos(yw) * stepLen;
      if (this._isDryPos(nx, nz, ent.pos.y)) {
        chosen = yw;
        break;
      }
    }
    if (chosen === null) return false;
    const prevX = ent.pos.x;
    const prevZ = ent.pos.z;
    const v = new THREE.Vector3(Math.sin(chosen) * spd, 0, Math.cos(chosen) * spd);
    if (this.collisionWorld) {
      this.collisionWorld.moveAndSlide(ent.pos, v, 0.5, dt);
      const surfY = this.collisionWorld.getSurfaceHeight(ent.pos.x, ent.pos.z, ent.pos.y);
      if (isWaterAt(ent.pos.x, ent.pos.z, surfY)) {
        ent.pos.x = prevX;
        ent.pos.z = prevZ;
        return false;
      }
      ent.pos.y = surfY;
    } else {
      ent.pos.x += v.x * dt;
      ent.pos.z += v.z * dt;
    }
    ent.yaw = chosen;
    ent.mesh.rotation.y = chosen;
    return true;
  }

  update(dt, elapsed, playerPos, panicActive, sirenSource = null, extra = {}) {
    const onPlayerHit = extra.onPlayerHit ?? null;
    const combatSystem = extra.combatSystem ?? null;
    const audio = extra.audio ?? null;
    const vehicles = extra.vehicles ?? [];
    const policeUnits = extra.policeUnits ?? [];
    const footOfficers = extra.footOfficers ?? [];
    const onGangFired = extra.onGangFired ?? null;
    const onOfficerHitByGang = extra.onOfficerHitByGang ?? null;
    const statusOverlay = Boolean(extra.statusOverlay);

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

    // Update civilian pedestrians (Timid fleeing + Brave melee fighters + water-safe!)
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
      if (p.meleeCd > 0) p.meleeCd = Math.max(0, p.meleeCd - dt);
      if (p.meleeSwingTimer > 0) p.meleeSwingTimer = Math.max(0, p.meleeSwingTimer - dt);

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

      // Brave civilian actively fighting back against player!
      if (p.aggro && !statusOverlay) {
        const dx = playerPos.x - p.pos.x;
        const dz = playerPos.z - p.pos.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 36) {
          p.aggro = false;
          p.attacking = false;
          p.label = null;
        } else {
          p.attacking = true;
          p.mesh.rotation.y = Math.atan2(dx, dz);
          if (dist > 1.85) {
            const moved = this._moveHumanDry(p, playerPos.x, playerPos.z, 3.7, dt);
            if (moved) {
              p.phase += dt * 9.0;
              poseHumanStride(p.mesh, p.phase, false);
            } else {
              poseHumanStride(p.mesh, 0, false);
            }
          } else {
            if (p.meleeCd <= 0) {
              p.meleeCd = 0.95;
              p.meleeSwingTimer = 0.30;
              p.meleeCombo = (p.meleeCombo + 1) % 2;
              if (audio) audio.playGunshot('fists');
              if (onPlayerHit) onPlayerHit(6);
            }
            if (p.meleeSwingTimer > 0) {
              poseHumanMeleeSwing(p.mesh, 1 - p.meleeSwingTimer / 0.30, false, p.meleeCombo);
            } else {
              poseHumanCombat(p.mesh, true);
            }
          }
          if (p.flinchTimer > 0) poseHumanFlinch(p.mesh, p.flinchTimer / 0.28);
          continue;
        }
      }

      if (panicActive && p.role !== 'vendor' && !p.aggro) {
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
          const prevX = p.mesh.position.x;
          const prevZ = p.mesh.position.z;
          const hit = this.collisionWorld.moveAndSlide(p.mesh.position, tmpVel, 0.5, dt);
          if (hit.hit) p.fleeYaw += 1.2;
          if (this.collisionWorld.getWaterDepth(p.mesh.position.x, p.mesh.position.z, 0) > 0.35) {
            p.mesh.position.x = prevX;
            p.mesh.position.z = prevZ;
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

    // Update Street Gang Members (Los Caimanes & Viperas del Sur + emergent Gang-vs-Police shootouts!)
    let anyGangPoliceFight = false;
    for (let i = this.gangMembers.length - 1; i >= 0; i--) {
      const g = this.gangMembers[i];
      if (g.dead || g.downed) {
        g.deathTimer += dt;
        if (g.deathTimer <= 0.6) {
          poseHumanCollapse(g.mesh, Math.min(1, g.deathTimer / 0.46), g.fallSide, g.deathBaseY ?? 0);
        }
        if (g.deathTimer >= 35) {
          this.group.remove(g.mesh);
          if (g.bloodMark) this.group.remove(g.bloodMark);
          this.gangMembers.splice(i, 1);
        }
        continue;
      }

      if (g.flinchTimer > 0) g.flinchTimer = Math.max(0, g.flinchTimer - dt);
      if (g.meleeCd > 0) g.meleeCd = Math.max(0, g.meleeCd - dt);
      if (g.meleeSwingTimer > 0) g.meleeSwingTimer = Math.max(0, g.meleeSwingTimer - dt);
      if (g.recentFireTimer > 0) g.recentFireTimer = Math.max(0, g.recentFireTimer - dt);
      if (g.muzzleTimer > 0) {
        g.muzzleTimer -= dt;
        if (g.muzzleTimer <= 0 && g.mesh.userData.muzzleFlash) g.mesh.userData.muzzleFlash.visible = false;
      }

      // Check if a speeding police cruiser collides with this gang member -> triggers Gang-vs-Police brawl!
      if (!statusOverlay) {
        for (const pu of policeUnits) {
          if (pu.exploded || pu.playerDriven || (pu.speed ?? 0) < 4.5) continue;
          const d = Math.hypot(pu.pos.x - g.pos.x, pu.pos.z - g.pos.z);
          if (d < 4.5) {
            this.provokeGangCrew(g, 'police', null, 28);
            break;
          }
        }
      }

      if (g.knockdownTimer > 0) {
        g.knockdownTimer = Math.max(0, g.knockdownTimer - dt);
        g.knockVel.multiplyScalar(Math.pow(0.08, dt));
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(g.pos, g.knockVel, 0.55, dt);
        else { g.pos.x += g.knockVel.x * dt; g.pos.z += g.knockVel.z * dt; }
        const baseY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(g.pos.x, g.pos.z, g.pos.y) : 0;
        const f = g.knockdownTimer < 0.45 ? g.knockdownTimer / 0.45 : 1.0;
        g.mesh.position.y = baseY + 0.18 * f;
        g.mesh.rotation.x = -Math.PI * 0.48 * f;
        continue;
      }

      // Prevent gangs from walking on water (swim if knocked into deep water)
      const gDepth = this.collisionWorld ? this.collisionWorld.getWaterDepth(g.pos.x, g.pos.z, g.pos.y) : 0;
      if (gDepth >= 0.72) {
        g.swimming = true;
        const rCx = getRiverCenterX(g.pos.z);
        const dirX = g.pos.x < rCx ? -1 : 1;
        g.pos.x += dirX * 1.65 * dt;
        g.mesh.position.set(g.pos.x, -0.72, g.pos.z);
        g.mesh.rotation.y = Math.atan2(dirX, 0);
        if (g.mesh.userData.gunGroup) g.mesh.userData.gunGroup.visible = false;
        poseHumanSwim(g.mesh, elapsed + g.stridePhase, true, false);
        continue;
      } else if (g.swimming && gDepth < 0.5) {
        g.swimming = false;
        g.mesh.rotation.x = 0;
        if (g.mesh.userData.gunGroup) g.mesh.userData.gunGroup.visible = true;
      }

      g.mesh.rotation.x = 0;
      g.mesh.rotation.z = 0;
      g.pos.y = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(g.pos.x, g.pos.z, g.pos.y) : 0;

      // Peaceful hangout idle in turf when NOT provoked
      if (!g.aggro || statusOverlay) {
        g.attacking = false;
        g.mesh.rotation.y = g.homeYaw;
        poseHumanStride(g.mesh, 0, false);
        const l = g.mesh.userData.limbs;
        if (l) {
          l.armL.rotation.x = Math.sin(elapsed * 1.8 + g.stridePhase) * 0.14;
        }
        continue;
      }

      if (g.reloadTimer > 0) {
        g.reloadTimer = Math.max(0, g.reloadTimer - dt);
        poseHumanReload(g.mesh, 1 - g.reloadTimer / g.reloadDuration);
        if (g.reloadTimer <= 0) g.clip = g.maxClip;
        if (g.flinchTimer > 0) poseHumanFlinch(g.mesh, g.flinchTimer / 0.28);
        continue;
      }

      // Pick active combat target: police officer (if fightingPolice) OR player
      let targetObj = null;
      let targetPos = null;
      let targetIsPolice = false;

      if (g.fightingPolice) {
        let bestOff = null;
        let bestD = 42;
        for (const o of footOfficers) {
          if (o.dead || o.downed || o.swimming) continue;
          const od = Math.hypot(o.pos.x - g.pos.x, o.pos.z - g.pos.z);
          if (od < bestD) {
            bestD = od;
            bestOff = o;
          }
        }
        if (bestOff) {
          g.targetOfficer = bestOff;
          targetObj = bestOff;
          targetPos = bestOff.pos;
          targetIsPolice = true;
          anyGangPoliceFight = true;
        } else {
          g.targetOfficer = null;
          g.fightingPolice = false;
        }
      }

      const distToPlayer = Math.hypot(playerPos.x - g.pos.x, playerPos.z - g.pos.z);
      if (!targetPos) {
        if (distToPlayer <= 58) {
          targetPos = playerPos;
        } else {
          // Player escaped gang turf -> calm down cleanly
          g.aggro = false;
          g.attacking = false;
          g.label = null;
          continue;
        }
      }

      g.attacking = true;
      const dx = targetPos.x - g.pos.x;
      const dz = targetPos.z - g.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      g.yaw = Math.atan2(dx, dz);
      g.mesh.rotation.y = g.yaw;

      if (g.weaponId === 'bat') {
        if (dist > 2.05) {
          const moved = this._moveHumanDry(g, targetPos.x, targetPos.z, 4.1, dt);
          if (moved) {
            g.stridePhase += dt * 9.5;
            poseHumanStride(g.mesh, g.stridePhase, false);
          } else {
            poseHumanCombat(g.mesh, true);
          }
        } else {
          if (g.meleeCd <= 0) {
            g.meleeCd = 0.95;
            g.meleeSwingTimer = 0.30;
            if (audio) audio.playGunshot('bat');
            if (targetIsPolice && onOfficerHitByGang) {
              onOfficerHitByGang(targetObj, 14, { x: dx / dist, z: dz / dist });
            } else if (!targetIsPolice && onPlayerHit) {
              onPlayerHit(11);
            }
          }
          if (g.meleeSwingTimer > 0) poseHumanMeleeSwing(g.mesh, 1 - g.meleeSwingTimer / 0.30, true, 0);
          else poseHumanCombat(g.mesh, true);
        }
      } else {
        // Armed gang member (Pistol / SMG)
        if (dist > 15.5) {
          const moved = this._moveHumanDry(g, targetPos.x, targetPos.z, 3.8, dt);
          if (moved) {
            g.stridePhase += dt * 8.6;
            poseHumanStride(g.mesh, g.stridePhase, false);
          } else {
            poseHumanCombat(g.mesh, true);
          }
        } else {
          poseHumanCombat(g.mesh, true);
        }

        if (dist < 42) {
          g.fireCd -= dt;
          if (g.fireCd <= 0) {
            if (g.clip <= 0) {
              g.reloadTimer = g.reloadDuration;
              continue;
            }
            const orig = g.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
            const tgt = targetPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.3, 1.18, (Math.random() - 0.5) * 1.3));
            const shotVec = tgt.clone().sub(orig);
            const shotDist = shotVec.length() || 1;
            const shotDir = shotVec.clone().divideScalar(shotDist);

            const envHit = this.collisionWorld ? this.collisionWorld.raycast(orig, shotDir, shotDist, { vehicles }) : null;
            g.clip -= 1;
            g.recentFireTimer = 4.5;
            g.fireCd = g.weaponId === 'smg' ? (0.42 + Math.random() * 0.35) : (0.88 + Math.random() * 0.65);
            g.muzzleTimer = 0.08;
            if (g.mesh.userData.muzzleFlash) g.mesh.userData.muzzleFlash.visible = true;
            if (audio) audio.playGunshot(g.weaponId);

            // Notify nearby police within ~32m so Gang-vs-Police shootouts erupt organically!
            if (onGangFired) {
              const alertedPolice = onGangFired(g);
              if (alertedPolice && !g.fightingPolice) {
                this.provokeGangCrew(g, 'police', null, 28);
              }
            }

            if (envHit && envHit.dist < shotDist - 0.45) {
              const stopPt = new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z);
              if (combatSystem) {
                combatSystem.spawnTracer(orig, stopPt, 0xff5a3c, 0.036, 0.14);
                combatSystem.spawnSparks(stopPt, 4, 0xffd27a);
              }
            } else {
              if (combatSystem) combatSystem.spawnTracer(orig, tgt, 0xff5a3c, 0.036, 0.14);
              if (targetIsPolice) {
                this.gangVsPoliceShots += 1;
                if (combatSystem) combatSystem.spawnSparks(tgt, 4, 0xff8040);
                if (Math.random() < 0.52 && onOfficerHitByGang) {
                  onOfficerHitByGang(targetObj, g.weaponId === 'smg' ? 12 : 16, shotDir);
                }
              } else if (Math.random() < 0.34 && onPlayerHit) {
                onPlayerHit(g.weaponId === 'smg' ? 7 : 9);
              }
            }
            if (g.clip <= 0) g.reloadTimer = g.reloadDuration;
          }
        }
      }

      if (g.flinchTimer > 0) poseHumanFlinch(g.mesh, g.flinchTimer / 0.28);
    }

    this.gangVsPoliceActive = anyGangPoliceFight;
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
