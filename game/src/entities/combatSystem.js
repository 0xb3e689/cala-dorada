// 6-weapon combat system: dual-core additive bullet tracers, muzzle flashes, sparks, Los Caimanes enemies, and pickups.

import * as THREE from '../../vendor/three.module.min.js';
import { WEAPONS } from '../core/config.js';
import { buildCharacterMesh } from './playerController.js';
import { getRadialGlowTexture } from './vehicleFactory.js';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.enemies = []; // { mesh, pos, hp, maxHp, yaw, fireCd, downed, alert }
    this.tracers = []; // { mesh, life, maxLife }
    this.sparks = [];  // { mesh, vel, life }
    this.pickups = []; // { mesh, kind, pos }
    this.fireCooldown = 0;
  }

  clearEnemies() {
    for (const e of this.enemies) this.group.remove(e.mesh);
    this.enemies = [];
  }

  spawnEnemy(x, z, yaw = 0, downed = false) {
    const mesh = buildCharacterMesh({
      jacket: 0x1a3f4d, accent: 0xff4b5c, pants: 0x141822, skin: 0xcf9670, hair: 0x171414,
    });
    mesh.position.set(x, downed ? 0.22 : 0, z);
    mesh.rotation.y = yaw;
    if (downed) {
      mesh.rotation.x = -Math.PI / 2;
    } else {
      mesh.userData.limbs.armR.rotation.x = -1.45;
      mesh.userData.limbs.armL.rotation.x = -1.15;
    }
    this.group.add(mesh);
    const enemy = {
      mesh,
      pos: mesh.position,
      hp: downed ? 0 : 75,
      maxHp: 75,
      yaw,
      fireCd: 0.7 + Math.random() * 1.1,
      downed,
      muzzleTimer: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnEncounter(center, count = 5) {
    this.clearEnemies();
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const r = 10 + (i % 3) * 6;
      this.spawnEnemy(center.x + Math.cos(ang) * r, center.z + Math.sin(ang) * r, ang + Math.PI, false);
    }
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
    const sheathGeo = new THREE.CylinderGeometry(radius * 1.9, radius * 0.9, len, 6);
    const sheathMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    grp.add(new THREE.Mesh(coreGeo, coreMat), new THREE.Mesh(sheathGeo, sheathMat));
    grp.position.copy(start).addScaledVector(dir, 0.5);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.group.add(grp);
    this.tracers.push({ mesh: grp, mats: [coreMat, sheathMat], geos: [coreGeo, sheathGeo], life, maxLife: life });
  }

  spawnSparks(pos, count = 7, color = 0xffbd4a) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.34);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
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
    // Impact flash sprite
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,168,54,0.85)', 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.scale.set(1.6, 1.6, 1);
    sp.position.copy(pos);
    this.group.add(sp);
    this.sparks.push({ mesh: sp, vel: new THREE.Vector3(0, 0.4, 0), life: 0.22 });
  }

  spawnPickup(pos, kind = 'health') {
    const col = kind === 'health' ? 0x42e38c : 0x4ba3ff;
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.48, 0),
      new THREE.MeshBasicMaterial({ color: col })
    );
    mesh.position.set(pos.x, 0.9, pos.z);
    this.group.add(mesh);
    this.pickups.push({ mesh, kind, pos: mesh.position });
  }

  tryPlayerFire(state, player, aimDir, audio, onEnemyDown, onCrime) {
    if (this.fireCooldown > 0) return false;
    const weapon = WEAPONS[state.activeWeaponIdx];
    const ammo = state.weaponAmmo[weapon.id];

    if (!weapon.melee) {
      if (ammo.clip <= 0) {
        if (ammo.reserve > 0) {
          const take = Math.min(weapon.clip, ammo.reserve);
          ammo.clip = take;
          ammo.reserve -= take;
        } else {
          return false;
        }
      }
      ammo.clip -= 1;
    }

    this.fireCooldown = weapon.fireRate;
    player.flashMuzzle(0.08);
    if (audio) audio.playGunshot(weapon.id);
    if (onCrime) onCrime();

    const origin = player.pos.clone().add(new THREE.Vector3(0, 1.42, 0));
    const pellets = weapon.pellets ?? 1;

    for (let p = 0; p < pellets; p++) {
      const dir = aimDir.clone();
      dir.x += (Math.random() - 0.5) * weapon.spread;
      dir.y += (Math.random() - 0.5) * weapon.spread * 0.6;
      dir.z += (Math.random() - 0.5) * weapon.spread;
      dir.normalize();

      let hitEnemy = null;
      let bestDist = weapon.range;
      for (const e of this.enemies) {
        if (e.downed) continue;
        const toE = e.pos.clone().add(new THREE.Vector3(0, 1.25, 0)).sub(origin);
        const proj = toE.dot(dir);
        if (proj > 0 && proj < bestDist) {
          const perp = toE.clone().addScaledVector(dir, -proj).length();
          if (perp < 1.15) {
            bestDist = proj;
            hitEnemy = e;
          }
        }
      }

      const endPoint = origin.clone().addScaledVector(dir, bestDist);
      if (!weapon.melee) {
        this.spawnTracer(origin, endPoint, 0xffe47a, 0.04, 0.14);
      }
      if (hitEnemy) {
        hitEnemy.hp -= weapon.damage;
        this.spawnSparks(endPoint, 6, 0xff8040);
        if (hitEnemy.hp <= 0 && !hitEnemy.downed) {
          hitEnemy.downed = true;
          hitEnemy.mesh.rotation.x = -Math.PI / 2;
          hitEnemy.mesh.position.y = 0.22;
          hitEnemy.mesh.userData.muzzleFlash.visible = false;
          state.careerStats.takedowns += 1;
          state.cash += 350;
          state.rp += 45;
          this.spawnPickup(hitEnemy.pos.clone(), Math.random() < 0.5 ? 'health' : 'armor');
          if (onEnemyDown) onEnemyDown();
        }
      }
    }
    return true;
  }

  update(dt, elapsed, state, playerPos, onPlayerHit) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

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
        t.mats[1].opacity = frac * 0.45;
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

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.mesh.rotation.y += dt * 2.8;
      if (p.pos.distanceTo(playerPos) < 2.4) {
        if (p.kind === 'health') state.health = Math.min(state.maxHealth, state.health + 25);
        else state.armor = Math.min(state.maxArmor, state.armor + 25);
        this.group.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }

    // Enemy AI
    let alive = 0;
    for (const e of this.enemies) {
      if (e.downed) continue;
      alive++;
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 48) {
        e.yaw = Math.atan2(dx, dz);
        e.mesh.rotation.y = e.yaw;
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = 1.2 + Math.random() * 1.1;
          e.muzzleTimer = 0.09;
          e.mesh.userData.muzzleFlash.visible = true;
          const orig = e.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
          const tgt = playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.2, (Math.random() - 0.5) * 2.2));
          this.spawnTracer(orig, tgt, 0xff6b4a, 0.038, 0.14);
          if (Math.random() < 0.35 && onPlayerHit) onPlayerHit(7);
        }
      }
      if (e.muzzleTimer > 0) {
        e.muzzleTimer -= dt;
        if (e.muzzleTimer <= 0) e.mesh.userData.muzzleFlash.visible = false;
      }
    }
    state.missionEnemiesRemaining = alive;
  }
}
