// 6-weapon combat system with true 3D raycast occlusion (bullets CANNOT pierce buildings, walls, roofs, bridge decks, or cars),
// shootable/destructible vehicles, killable enemies/police/NPCs with physical collapse death animations & crimson ground marks,
// magazine reload cycles, hit-confirm crosshair & weapon-only damage popups.

import * as THREE from '../../vendor/three.module.min.js';
import { WEAPONS } from '../core/config.js';
import {
  buildCharacterMesh, setCharacterWeaponMesh, poseHumanCombat, poseHumanReload, poseHumanFlinch, poseHumanCollapse,
} from './playerController.js';
import { getRadialGlowTexture } from './vehicleFactory.js';

export class CombatSystem {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.enemies = [];
    this.tracers = [];
    this.sparks = [];
    this.pickups = [];
    this.damagePopups = [];
    this.hitConfirmTimer = 0;
    this.hitConfirmCrit = false;
    this.fireCooldown = 0;

    this._bloodGeo = new THREE.CircleGeometry(0.56, 16);
    this._bloodMat = new THREE.MeshBasicMaterial({
      color: 0x6b0b16, transparent: true, opacity: 0.74, depthWrite: false,
    });
  }

  clearEnemies() {
    for (const e of this.enemies) {
      this.group.remove(e.mesh);
      if (e.bloodMark) this.group.remove(e.bloodMark);
    }
    this.enemies = [];
    this.damagePopups = [];
    this.hitConfirmTimer = 0;
    this.hitConfirmCrit = false;
  }

  spawnEnemy(x, z, yaw = 0, downed = false, maxHp = 100) {
    const mesh = buildCharacterMesh({
      jacket: 0x1a3f4d, accent: 0xff4b5c, pants: 0x141822, skin: 0xcf9670, hair: 0x171414,
      outfitStyle: 'tactical', hairStyle: 'fade', accessory: 'aviators',
    });
    setCharacterWeaponMesh(mesh, 'carbine');
    mesh.position.set(x, downed ? 0.22 : 0, z);
    mesh.rotation.y = yaw;
    if (downed) {
      poseHumanCollapse(mesh, 1, 1);
    } else {
      poseHumanCombat(mesh, true);
    }
    this.group.add(mesh);
    const enemy = {
      mesh,
      pos: mesh.position,
      hp: downed ? 0 : maxHp,
      maxHp,
      yaw,
      fireCd: 0.7 + Math.random() * 1.1,
      clip: 8,
      maxClip: 8,
      reloadTimer: 0,
      reloadDuration: 1.7,
      dead: downed,
      downed,
      deathTimer: downed ? 1.0 : 0,
      fallSide: Math.random() < 0.5 ? 1 : -1,
      bloodMark: null,
      attacking: !downed,
      muzzleTimer: 0,
      lastHitTimer: 0,
      flinchTimer: 0,
      knockdownTimer: 0,
      knockVel: new THREE.Vector3(),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnEncounter(center, count = 5) {
    this.clearEnemies();
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const r = 10 + (i % 3) * 6;
      const e = this.spawnEnemy(center.x + Math.cos(ang) * r, center.z + Math.sin(ang) * r, ang + Math.PI, false);
      if (this.collisionWorld) this.collisionWorld.resolveCircle(e.pos, null, 0.65);
    }
  }

  startPlayerReload(state, audio) {
    const weapon = WEAPONS[state.activeWeaponIdx];
    if (!weapon || weapon.melee) return false;
    if (state.reloadTimer > 0) return false;
    const ammo = state.weaponAmmo[weapon.id];
    if (!ammo || ammo.clip >= weapon.clip || ammo.reserve <= 0) return false;
    state.reloadDuration = weapon.reloadTime ?? 1.6;
    state.reloadTimer = state.reloadDuration;
    state.reloadingWeaponId = weapon.id;
    if (audio) audio.playReload('start');
    return true;
  }

  // Spawn floating damage numbers ONLY for weapons/melee — NEVER for car ramming!
  spawnDamagePopup(worldPos, amount, crit = false, source = 'weapon') {
    if (source === 'vehicle') return;
    if (amount <= 0) return;
    this.damagePopups.push({
      pos: worldPos.clone(),
      amount: Math.round(amount),
      crit: Boolean(crit),
      source,
      life: 0.95,
      maxLife: 0.95,
      driftX: (Math.random() - 0.5) * 0.7,
    });
  }

  applyEnemyDamage(enemy, amount, hitPos, state, opts = {}) {
    if (!enemy || enemy.dead || enemy.downed) return { killed: false };
    const source = opts.source ?? 'weapon';
    const dmg = Math.max(1, Math.round(amount));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.attacking = true;
    enemy.lastHitTimer = 0.28;
    enemy.flinchTimer = 0.28;

    if (opts.dir) {
      const kb = source === 'vehicle' ? Math.min(16, (opts.impactSpeed ?? 12) * 0.7) : 1.8;
      enemy.knockVel.set(opts.dir.x * kb, 0, opts.dir.z * kb);
      if (source === 'vehicle') {
        enemy.knockdownTimer = Math.max(enemy.knockdownTimer ?? 0, 1.45);
      } else {
        enemy.pos.x += opts.dir.x * 0.24;
        enemy.pos.z += opts.dir.z * 0.24;
      }
    }

    if (source !== 'vehicle') {
      const popupPos = (hitPos ? hitPos.clone() : enemy.pos.clone().add(new THREE.Vector3(0, 1.65, 0)));
      this.spawnDamagePopup(popupPos, dmg, Boolean(opts.crit), source);
      this.hitConfirmTimer = 0.24;
      this.hitConfirmCrit = Boolean(opts.crit);
    }

    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      enemy.downed = true;
      enemy.attacking = false;
      enemy.deathTimer = 0.001;
      enemy.deathBaseY = enemy.pos.y ?? 0;
      enemy.knockdownTimer = 0;
      if (enemy.mesh.userData.muzzleFlash) enemy.mesh.userData.muzzleFlash.visible = false;
      if (!enemy.bloodMark) {
        const mark = new THREE.Mesh(this._bloodGeo, this._bloodMat);
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(enemy.pos.x, enemy.deathBaseY + 0.04, enemy.pos.z);
        this.group.add(mark);
        enemy.bloodMark = mark;
      }
      poseHumanCollapse(enemy.mesh, 0.12, enemy.fallSide ?? 1, enemy.deathBaseY);
      if (state) {
        state.careerStats.takedowns += 1;
        state.cash += enemy.isPolice ? 0 : 350;
        state.rp += enemy.isPolice ? 25 : 45;
      }
      const r = Math.random();
      const dropKind = enemy.isPolice ? (r < 0.5 ? 'armor' : 'ammo') : (r < 0.35 ? 'health' : r < 0.65 ? 'cash' : r < 0.85 ? 'ammo' : 'armor');
      this.spawnPickup(enemy.pos.clone(), dropKind);
      if (opts.onEnemyDown) opts.onEnemyDown(enemy);
      return { killed: true };
    }
    return { killed: false };
  }

  spawnTracer(start, end, color = 0xffe073, radius = 0.04, life = 0.16) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.2) return;

    const grp = new THREE.Group();
    const coreGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.25, len, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfff8dc, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sheathGeo = new THREE.CylinderGeometry(radius * 1.8, radius * 0.85, len, 6);
    const sheathMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    grp.add(new THREE.Mesh(coreGeo, coreMat), new THREE.Mesh(sheathGeo, sheathMat));
    grp.position.copy(start).addScaledVector(dir, 0.5);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.group.add(grp);
    this.tracers.push({ mesh: grp, mats: [coreMat, sheathMat], geos: [coreGeo, sheathGeo], life, maxLife: life });
  }

  spawnSparks(pos, count = 7, color = 0xffbd4a) {
    const geo = new THREE.BoxGeometry(0.07, 0.07, 0.3);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      const vx = (Math.random() - 0.5) * 9;
      const vy = 2 + Math.random() * 6;
      const vz = (Math.random() - 0.5) * 9;
      m.lookAt(pos.x + vx, pos.y + vy, pos.z + vz);
      this.group.add(m);
      this.sparks.push({
        mesh: m,
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0.28 + Math.random() * 0.2,
      });
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,168,54,0.8)', 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(1.05, 1.05, 1);
    sp.position.copy(pos);
    this.group.add(sp);
    this.sparks.push({ mesh: sp, vel: new THREE.Vector3(0, 0.4, 0), life: 0.22 });
  }

  spawnPickup(pos, kind = 'health', opts = {}) {
    const g = new THREE.Group();
    const glowCols = {
      health: ['#ffffff', 'rgba(66,227,140,0.75)'],
      armor: ['#ffffff', 'rgba(75,163,255,0.75)'],
      ammo: ['#ffffff', 'rgba(255,190,85,0.75)'],
      cash: ['#ffffff', 'rgba(52,224,132,0.75)'],
    };
    const [gIn, gMid] = glowCols[kind] ?? glowCols.health;

    if (kind === 'health') {
      // Crisp white medkit box with glowing emerald cross
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.48, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xf4f8fc, emissive: 0x164a32, emissiveIntensity: 0.45, roughness: 0.3 })
      );
      const crossMat = new THREE.MeshBasicMaterial({ color: 0x22e584 });
      const cv = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.38), crossMat);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.38), crossMat);
      g.add(box, cv, ch);
    } else if (kind === 'armor') {
      // Glowing blue tactical armor vest / shield icon
      const vest = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.46, 0),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 0.65, metalness: 0.5, roughness: 0.25 })
      );
      vest.scale.set(1.0, 1.25, 0.55);
      g.add(vest);
    } else if (kind === 'ammo') {
      // Golden tactical ammo crate
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.42, 0.44),
        new THREE.MeshStandardMaterial({ color: 0xd99b26, emissive: 0x8a5808, emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.35 })
      );
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.10, 0.46), new THREE.MeshBasicMaterial({ color: 0xffe478 }));
      g.add(crate, stripe);
    } else {
      // Emerald green cash stack
      const stack = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.24, 0.38),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.6, roughness: 0.4 })
      );
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.40), new THREE.MeshBasicMaterial({ color: 0xffd24d }));
      g.add(stack, band);
    }

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture(gIn, gMid, 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.set(1.65, 1.65, 1);
    g.add(halo);

    const baseY = (pos.y ?? 0) + 0.95;
    g.position.set(pos.x, baseY, pos.z);
    this.group.add(g);
    const pk = {
      id: opts.id ?? null,
      mesh: g,
      kind,
      amount: opts.amount ?? null,
      pos: g.position,
      baseY,
      respawnSec: opts.respawnSec ?? 0,
      respawnTimer: 0,
      collected: false,
    };
    this.pickups.push(pk);
    return pk;
  }

  _testExplosiveRay(origin, dir, maxDist, exp) {
    const baseY = exp.pos.y ?? 0;
    const cx = exp.pos.x - origin.x;
    const cz = exp.pos.z - origin.z;
    const horizLenSq = dir.x * dir.x + dir.z * dir.z;
    let t = horizLenSq > 1e-6 ? (cx * dir.x + cz * dir.z) / horizLenSq : (baseY + exp.height * 0.5 - origin.y) / (dir.y || 1);
    if (t <= 0 || t >= maxDist) return null;
    const hx = origin.x + dir.x * t;
    const hy = origin.y + dir.y * t;
    const hz = origin.z + dir.z * t;
    if (hy < baseY - 0.1 || hy > baseY + exp.height + 0.2) return null;
    if (Math.hypot(hx - exp.pos.x, hz - exp.pos.z) > exp.radius + 0.25) return null;
    return { dist: t, point: new THREE.Vector3(hx, hy, hz) };
  }

  // Exact ray vs vertical human capsule (y in [baseY+0.05, baseY+1.88], radius 0.62m)
  _testHumanRay(origin, dir, maxDist, pos) {
    const baseY = pos.y ?? 0;
    const cx = pos.x - origin.x;
    const cz = pos.z - origin.z;
    const horizLenSq = dir.x * dir.x + dir.z * dir.z;
    let t = 0;
    if (horizLenSq > 1e-6) {
      t = (cx * dir.x + cz * dir.z) / horizLenSq;
    } else {
      t = (baseY + 1.1 - origin.y) / (dir.y || 1);
    }
    if (t <= 0 || t >= maxDist) return null;
    const hx = origin.x + dir.x * t;
    const hy = origin.y + dir.y * t;
    const hz = origin.z + dir.z * t;
    if (hy < baseY - 0.1 || hy > baseY + 1.98) return null;
    const perpXZ = Math.hypot(hx - pos.x, hz - pos.z);
    if (perpXZ > 0.65) return null;
    return { dist: t, perp: perpXZ, isHead: hy > baseY + 1.44 };
  }

  tryPlayerFire(state, player, aimDir, audio, onEnemyDown, onCrime, extraTargets = {}) {
    if (this.fireCooldown > 0) return false;
    if (state.reloadTimer > 0) return false;
    if (state.swimming && !extraTargets.fromVehicle) return false;
    const weapon = WEAPONS[state.activeWeaponIdx] ?? WEAPONS[0];
    const ammo = state.weaponAmmo[weapon.id];

    // Drive-by shooting from vehicles only allowed with Pistol or Vector SMG!
    if (extraTargets.fromVehicle && weapon.id !== 'pistol' && weapon.id !== 'smg') {
      return false;
    }

    if (!weapon.melee) {
      if (ammo.clip <= 0) {
        this.startPlayerReload(state, audio);
        return false;
      }
      ammo.clip -= 1;
      if (ammo.clip <= 0 && ammo.reserve > 0) {
        this.startPlayerReload(state, audio);
      }
    }

    this.fireCooldown = weapon.fireRate;
    if (weapon.melee) {
      if (player.triggerMeleeSwing) player.triggerMeleeSwing();
    } else if (!extraTargets.fromVehicle) {
      if (player.setCombatPose) player.setCombatPose(true);
      player.flashMuzzle(0.08);
    }
    if (audio) audio.playGunshot(weapon.id);
    if (extraTargets.onRecoil && !weapon.melee) {
      const kick = weapon.id === 'shotgun' ? 0.055 : weapon.id === 'carbine' ? 0.028 : weapon.id === 'pistol' ? 0.022 : 0.014;
      extraTargets.onRecoil(kick);
    }
    if (onCrime) onCrime(weapon.melee ? 'melee' : 'gunshot');

    const rawOrigin = extraTargets.origin
      ? extraTargets.origin.clone()
      : (player.getMuzzleWorldPos ? player.getMuzzleWorldPos() : player.pos.clone().add(new THREE.Vector3(0, 1.42, 0)));
    const origin = rawOrigin.clone();
    if (!extraTargets.origin) {
      origin.y = Math.max((player.pos?.y ?? 0) + 1.18, origin.y);
    }

    const hitTotals = new Map();
    const vehicleHitTotals = new Map();
    const explosiveHitTotals = new Map();
    const policeOfficers = extraTargets.footOfficers ?? [];
    const peds = extraTargets.peds ?? [];
    const vehicles = extraTargets.vehicles ?? [];
    const explosives = extraTargets.explosives ?? [];
    const ignoreVehicle = extraTargets.ignoreVehicle ?? null;

    // Dedicated generous close-range forward melee arc check (Fists & Alloy Bat)
    if (weapon.melee) {
      const pPos = player.pos;
      const fwd = new THREE.Vector3(aimDir.x, 0, aimDir.z);
      if (fwd.lengthSq() < 1e-4) fwd.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      else fwd.normalize();
      const meleeRange = weapon.range + 0.55;

      const checkMeleeList = (arr, kind) => {
        for (const e of arr) {
          if (e.dead || e.downed) continue;
          const pos = e.pos ?? e.mesh.position;
          const dx = pos.x - pPos.x;
          const dz = pos.z - pPos.z;
          const dy = Math.abs((pos.y ?? 0) - (pPos.y ?? 0));
          const dist = Math.hypot(dx, dz);
          if (dist > meleeRange || dy > 2.2) continue;
          const dirX = dist > 0.01 ? dx / dist : fwd.x;
          const dirZ = dist > 0.01 ? dz / dist : fwd.z;
          const dot = dirX * fwd.x + dirZ * fwd.z;
          if (dist > 1.25 && dot < 0.22) continue;
          const hitPt = new THREE.Vector3(pos.x, (pos.y ?? 0) + 1.35, pos.z);
          hitTotals.set(e, {
            kind,
            dmg: weapon.damage,
            crit: weapon.id === 'bat' && Math.random() < 0.25,
            pos: hitPt,
            dir: new THREE.Vector3(dirX, 0, dirZ),
          });
          this.spawnSparks(hitPt, 5, 0xffc857);
          if (hitTotals.size >= 2) return;
        }
      };
      checkMeleeList(this.enemies, 'enemy');
      if (hitTotals.size < 2) checkMeleeList(policeOfficers, 'police');
      if (hitTotals.size < 2) checkMeleeList(peds, 'ped');
    } else {
      const pellets = weapon.pellets ?? 1;
      for (let p = 0; p < pellets; p++) {
        const dir = aimDir.clone();
        dir.x += (Math.random() - 0.5) * weapon.spread;
        dir.y += (Math.random() - 0.5) * weapon.spread * 0.6;
        dir.z += (Math.random() - 0.5) * weapon.spread;
        dir.normalize();

        // 1. Raycast against solid 3D world (buildings, walls, overhead roofs, bridge decks, piers, AND vehicles!) FIRST!
        const envHit = this.collisionWorld
          ? this.collisionWorld.raycast(origin, dir, weapon.range, { vehicles, ignoreVehicle })
          : null;

        let bestDist = envHit ? envHit.dist : weapon.range;
        let hitTarget = null;
        let hitKind = null;
        let hitHead = false;
        let hitExplosive = null;
        let hitExplosivePt = null;

        // 2. Check explosive gas pumps & red fuel barrels
        for (const exp of explosives) {
          if (exp.exploded) continue;
          const eres = this._testExplosiveRay(origin, dir, bestDist, exp);
          if (eres) {
            bestDist = eres.dist;
            hitExplosive = exp;
            hitExplosivePt = eres.point;
          }
        }

        // 3. Check ALL human pools strictly closer than the solid obstruction!
        const checkList = (arr, kind) => {
          for (const e of arr) {
            if (e.dead || e.downed) continue;
            const pos = e.pos ?? e.mesh.position;
            const res = this._testHumanRay(origin, dir, bestDist, pos);
            if (res) {
              bestDist = res.dist;
              hitTarget = e;
              hitKind = kind;
              hitHead = res.isHead;
              hitExplosive = null;
            }
          }
        };

        checkList(this.enemies, 'enemy');
        checkList(policeOfficers, 'police');
        checkList(peds, 'ped');

        const endPoint = origin.clone().addScaledVector(dir, bestDist);
        this.spawnTracer(origin, endPoint, 0xffe47a, 0.038, 0.14);

        if (hitTarget) {
          const isCrit = hitHead || Math.random() < 0.15;
          const dmg = Math.round(weapon.damage * (isCrit ? 1.5 : 1.0));
          const prev = hitTotals.get(hitTarget) ?? { kind: hitKind, dmg: 0, crit: false, pos: endPoint, dir };
          prev.dmg += dmg;
          prev.crit = prev.crit || isCrit;
          prev.pos = endPoint;
          hitTotals.set(hitTarget, prev);
          this.spawnSparks(endPoint, pellets > 1 ? 3 : 6, 0xff8040);
        } else if (hitExplosive) {
          const prev = explosiveHitTotals.get(hitExplosive) ?? { dmg: 0, point: hitExplosivePt };
          prev.dmg += weapon.damage;
          explosiveHitTotals.set(hitExplosive, prev);
          this.spawnSparks(hitExplosivePt, 8, 0xffa638);
        } else if (envHit) {
          if (envHit.vehicle) {
            const prev = vehicleHitTotals.get(envHit.vehicle) ?? {
              dmg: 0,
              point: new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z),
              normal: envHit.normal,
            };
            prev.dmg += weapon.damage;
            vehicleHitTotals.set(envHit.vehicle, prev);
            this.spawnSparks(new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z), pellets > 1 ? 4 : 8, 0xffe073);
          } else {
            this.spawnSparks(new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z), pellets > 1 ? 2 : 5, 0xffd27a);
          }
        }
      }
    }

    // Apply human hits
    for (const [target, info] of hitTotals.entries()) {
      if (info.kind === 'ped') {
        this.spawnDamagePopup(info.pos, info.dmg, info.crit, weapon.melee ? 'melee' : 'weapon');
        this.hitConfirmTimer = 0.24;
        this.hitConfirmCrit = info.crit;
        if (extraTargets.onPedShot) extraTargets.onPedShot(target, info.dmg, info.dir);
      } else if (info.kind === 'police') {
        const res = this.applyEnemyDamage(target, info.dmg, info.pos, state, {
          source: weapon.melee ? 'melee' : 'weapon',
          crit: info.crit,
          dir: info.dir,
          onEnemyDown: extraTargets.onPoliceKilled,
        });
        if (extraTargets.onPoliceShot) extraTargets.onPoliceShot(target, res.killed);
      } else {
        this.applyEnemyDamage(target, info.dmg, info.pos, state, {
          source: weapon.melee ? 'melee' : 'weapon',
          crit: info.crit,
          dir: info.dir,
          onEnemyDown,
        });
      }
    }

    // Apply explosive hits (gas pumps & red fuel barrels!)
    for (const [exp, info] of explosiveHitTotals.entries()) {
      if (audio) audio.playMetalHit();
      if (extraTargets.onExplosiveShot) extraTargets.onExplosiveShot(exp, info.dmg, info.point);
    }

    // Apply vehicle bullet hits
    for (const [veh, info] of vehicleHitTotals.entries()) {
      if (audio) audio.playMetalHit();
      if (extraTargets.onVehicleShot) {
        extraTargets.onVehicleShot(veh, info.dmg, info.point, info.normal);
      }
    }
    return true;
  }

  update(dt, elapsed, state, playerPos, onPlayerHit, audio, vehicles = []) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.hitConfirmTimer > 0) this.hitConfirmTimer = Math.max(0, this.hitConfirmTimer - dt);

    // Player Reload Timer completion
    if (state.reloadTimer > 0) {
      state.reloadTimer = Math.max(0, state.reloadTimer - dt);
      if (state.reloadTimer <= 0 && state.reloadingWeaponId) {
        const w = WEAPONS.find((x) => x.id === state.reloadingWeaponId);
        const ammo = w ? state.weaponAmmo[w.id] : null;
        if (w && ammo && ammo.reserve > 0) {
          const need = Math.max(0, w.clip - ammo.clip);
          const take = Math.min(need, ammo.reserve);
          ammo.clip += take;
          ammo.reserve -= take;
        }
        state.reloadingWeaponId = null;
        if (audio) audio.playReload('finish');
      }
    }

    // Update floating damage popups
    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      const p = this.damagePopups[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.damagePopups.splice(i, 1);
      } else {
        p.pos.y += dt * 1.45;
        p.pos.x += p.driftX * dt * 0.4;
      }
    }

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.group.remove(t.mesh);
        t.geos.forEach((g) => g.dispose());
        t.mats.forEach((m) => m.dispose());
        this.tracers.splice(i, 1);
      } else {
        const frac = t.life / t.maxLife;
        t.mats[0].opacity = frac * 0.96;
        t.mats[1].opacity = frac * 0.42;
      }
    }

    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.group.remove(s.mesh);
        s.mesh.material.dispose();
        this.sparks.splice(i, 1);
      } else {
        s.vel.y -= 18 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
      }
    }

    // Update spinning floating pickups (world pickups respawn after 45s; dropped pickups clear once collected)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.collected) {
        if (p.respawnSec > 0) {
          p.respawnTimer -= dt;
          if (p.respawnTimer <= 0) {
            p.collected = false;
            p.mesh.visible = true;
          }
        }
        continue;
      }
      p.mesh.rotation.y += dt * 2.6;
      p.mesh.position.y = p.baseY + Math.sin(elapsed * 3.0 + i) * 0.16;
      const distXZ = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
      if (distXZ < 2.6 && Math.abs((p.baseY - 0.95) - (playerPos.y ?? 0)) < 2.5) {
        if (p.kind === 'health') {
          state.health = Math.min(state.maxHealth, state.health + (p.amount ?? 35));
          state.toast = { text: '+MEDKIT RESTORED', timer: 2.0 };
        } else if (p.kind === 'armor') {
          state.armor = Math.min(state.maxArmor, state.armor + (p.amount ?? 35));
          state.toast = { text: '+ARMOR VEST EQUIPPED', timer: 2.0 };
        } else if (p.kind === 'ammo') {
          const mult = p.amount ?? 1;
          for (const w of WEAPONS) {
            if (!w.melee && state.weaponAmmo[w.id]) {
              state.weaponAmmo[w.id].reserve += w.clip * mult;
            }
          }
          state.toast = { text: '+AMMO CRATE COLLECTED', timer: 2.0 };
        } else if (p.kind === 'cash') {
          const amt = p.amount ?? 450;
          state.cash += amt;
          state.careerStats.cashEarned += amt;
          state.toast = { text: `+$${amt.toLocaleString()} CASH`, timer: 2.0 };
        }
        if (audio && audio.playPickupChime) audio.playPickupChime();
        else if (audio) audio.playUiBeep(920);
        if (p.respawnSec > 0) {
          p.collected = true;
          p.respawnTimer = p.respawnSec;
          p.mesh.visible = false;
        } else {
          this.group.remove(p.mesh);
          this.pickups.splice(i, 1);
        }
      }
    }

    // Enemy AI with 3D raycast bullet occlusion, collapse death animation & 25s despawn
    let alive = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead || e.downed) {
        e.deathTimer = (e.deathTimer ?? 0) + dt;
        if (e.deathTimer <= 0.6) {
          poseHumanCollapse(e.mesh, Math.min(1, e.deathTimer / 0.46), e.fallSide ?? 1, e.deathBaseY ?? 0);
        }
        if (e.deathTimer >= 25) {
          this.group.remove(e.mesh);
          if (e.bloodMark) this.group.remove(e.bloodMark);
          this.enemies.splice(i, 1);
        }
        continue;
      }
      alive++;
      if (e.lastHitTimer > 0) e.lastHitTimer = Math.max(0, e.lastHitTimer - dt);
      if (e.flinchTimer > 0) e.flinchTimer = Math.max(0, e.flinchTimer - dt);
      if (e.muzzleTimer > 0) {
        e.muzzleTimer -= dt;
        if (e.muzzleTimer <= 0 && e.mesh.userData.muzzleFlash) e.mesh.userData.muzzleFlash.visible = false;
      }

      if (e.knockdownTimer > 0) {
        e.knockdownTimer = Math.max(0, e.knockdownTimer - dt);
        e.knockVel.multiplyScalar(Math.pow(0.08, dt));
        if (this.collisionWorld) this.collisionWorld.moveAndSlide(e.pos, e.knockVel, 0.55, dt);
        else { e.pos.x += e.knockVel.x * dt; e.pos.z += e.knockVel.z * dt; }
        const baseY = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(e.pos.x, e.pos.z, e.pos.y) : 0;
        const f = e.knockdownTimer < 0.45 ? e.knockdownTimer / 0.45 : 1.0;
        e.mesh.position.y = baseY + 0.18 * f;
        e.mesh.rotation.x = -Math.PI * 0.48 * f;
        continue;
      }
      e.mesh.rotation.x = 0;
      e.mesh.rotation.z = 0;
      e.mesh.position.y = this.collisionWorld ? this.collisionWorld.getSurfaceHeight(e.pos.x, e.pos.z, e.pos.y) : 0;

      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);

      if (e.reloadTimer > 0) {
        e.reloadTimer = Math.max(0, e.reloadTimer - dt);
        poseHumanReload(e.mesh, 1 - e.reloadTimer / e.reloadDuration);
        if (e.reloadTimer <= 0) e.clip = e.maxClip;
        if (e.flinchTimer > 0) poseHumanFlinch(e.mesh, e.flinchTimer / 0.28);
        continue;
      }

      if (dist < 56) {
        e.attacking = true;
        e.yaw = Math.atan2(dx, dz);
        e.mesh.rotation.y = e.yaw;
        poseHumanCombat(e.mesh, true);
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          if (e.clip <= 0) {
            e.reloadTimer = e.reloadDuration;
            continue;
          }
          const orig = e.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
          const tgt = playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.15, (Math.random() - 0.5) * 1.6));
          const shotVec = tgt.clone().sub(orig);
          const shotDist = shotVec.length() || 1;
          const shotDir = shotVec.clone().divideScalar(shotDist);

          // Raycast against buildings, walls, roofs, bridge decks & cars!
          const envHit = this.collisionWorld
            ? this.collisionWorld.raycast(orig, shotDir, shotDist, { vehicles })
            : null;
          if (envHit && envHit.dist < shotDist - 0.45) {
            // Blocked by solid cover! Hold fire or clip tracer cleanly on obstruction
            e.fireCd = 0.9 + Math.random() * 0.8;
            if (Math.random() < 0.35) {
              const stopPt = new THREE.Vector3(envHit.point.x, envHit.point.y, envHit.point.z);
              this.spawnTracer(orig, stopPt, 0xff6b4a, 0.036, 0.14);
              this.spawnSparks(stopPt, 4, 0xffd27a);
            }
            continue;
          }

          e.clip -= 1;
          e.fireCd = 1.15 + Math.random() * 1.0;
          e.muzzleTimer = 0.09;
          if (e.mesh.userData.muzzleFlash) e.mesh.userData.muzzleFlash.visible = true;
          if (audio) audio.playGunshot('pistol');
          this.spawnTracer(orig, tgt, 0xff6b4a, 0.036, 0.14);
          if (Math.random() < 0.36 && onPlayerHit) onPlayerHit(9);
          if (e.clip <= 0) e.reloadTimer = e.reloadDuration;
        }
      }

      if (e.flinchTimer > 0) {
        poseHumanFlinch(e.mesh, e.flinchTimer / 0.28);
      }
    }
    state.missionEnemiesRemaining = alive;
  }
}
