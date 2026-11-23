// Articulated 3D Dante Varo player character and crew partner Nadia Solis with smooth locomotion and weapons.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../core/config.js';
import { animatePedLimbs } from '../world/trafficAndPeds.js';

export function buildCharacterMesh({ jacket, accent, pants, skin, hair, isFemale = false }) {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.52, metalness: 0.12 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.72 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.75 });
  const shadesMat = new THREE.MeshStandardMaterial({ color: 0x11151f, metalness: 0.85, roughness: 0.15 });

  const torsoW = isFemale ? 0.5 : 0.6;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.76, 0.34), jacketMat);
  torso.position.y = 1.22;
  torso.castShadow = true;
  g.add(torso);

  // Inner shirt / collar stripe
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.36), accentMat);
  lapel.position.set(0, 1.22, 0.01);
  g.add(lapel);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat);
  head.position.y = 1.79;
  head.castShadow = true;
  g.add(head);

  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, isFemale ? 0.26 : 0.16, 0.4), hairMat);
  hairMesh.position.set(0, isFemale ? 1.94 : 1.97, isFemale ? -0.04 : -0.01);
  g.add(hairMesh);

  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.08), shadesMat);
  shades.position.set(0, 1.81, 0.16);
  g.add(shades);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), pantsMat);
  legL.position.set(-0.15, 0.42, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.82, 0.23), pantsMat);
  legR.position.set(0.15, 0.42, 0);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.18), jacketMat);
  armL.position.set(-torsoW / 2 - 0.1, 1.2, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.18), jacketMat);
  armR.position.set(torsoW / 2 + 0.1, 1.2, 0);

  // Held weapon group attached to right hand (points along local -Y so when armR pitches -1.45, barrel aims straight +Z!)
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0, -0.34, 0.08);
  const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.72, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x1b212d, metalness: 0.82, roughness: 0.24 })
  );
  gunBody.position.set(0, -0.26, 0.02);

  const muzzleFlash = new THREE.Group();
  muzzleFlash.position.set(0, -0.74, 0.02);
  const flashCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff4b8 })
  );
  const flashCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.68, 6),
    new THREE.MeshBasicMaterial({ color: 0xff9f38, transparent: true, opacity: 0.92 })
  );
  flashCone.rotation.x = Math.PI;
  flashCone.position.y = -0.22;
  muzzleFlash.add(flashCore, flashCone);
  muzzleFlash.visible = false;
  gunGroup.add(gunBody, muzzleFlash);
  armR.add(gunGroup);

  g.add(legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.muzzleFlash = muzzleFlash;
  g.userData.gunGroup = gunGroup;
  return g;
}

export class PlayerController {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;

    // Dante Varo (protagonist)
    this.mesh = buildCharacterMesh({
      jacket: 0xe65f3c, accent: 0xffe2ad, pants: 0x1e2533, skin: 0xd9a17a, hair: 0x1b1514,
    });
    this.scene.add(this.mesh);

    // Crew Partner Nadia Solis (appears during combat/missions)
    this.partnerMesh = buildCharacterMesh({
      jacket: 0x25b8ab, accent: 0x141926, pants: 0x1b202b, skin: 0xdba584, hair: 0x24161a, isFemale: true,
    });
    this.partnerMesh.visible = false;
    this.scene.add(this.partnerMesh);

    this.pos = new THREE.Vector3(-120, 0, 200);
    this.yaw = Math.PI / 2;
    this.vy = 0;
    this.grounded = true;
    this.aiming = false;
    this.muzzleTimer = 0;
  }

  setVisible(onFoot) {
    this.mesh.visible = onFoot;
  }

  flashMuzzle(duration = 0.08) {
    this.muzzleTimer = duration;
    this.mesh.userData.muzzleFlash.visible = true;
  }

  setCombatPose(aiming) {
    this.aiming = aiming;
    const { armR, armL } = this.mesh.userData.limbs;
    if (aiming) {
      armR.rotation.x = -1.45;
      armL.rotation.x = -1.25;
      armL.rotation.z = 0.25;
    } else {
      armL.rotation.z = 0;
    }
  }

  updateOnFoot(input, dt, elapsed, cameraYaw) {
    const { forward, right } = input.getMoveAxes();
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? 11.8 : 7.4;

    if (input.lookDeltaX !== 0) {
      this.yaw -= input.lookDeltaX * 0.0032;
    }

    const moveYaw = cameraYaw ?? this.yaw;
    let mx = 0;
    let mz = 0;
    if (forward !== 0 || right !== 0) {
      const fwdX = Math.sin(moveYaw);
      const fwdZ = Math.cos(moveYaw);
      const rtX = -Math.cos(moveYaw);
      const rtZ = Math.sin(moveYaw);
      mx = fwdX * forward + rtX * right;
      mz = fwdZ * forward + rtZ * right;
      const len = Math.hypot(mx, mz) || 1;
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;
      if (!input.rightMouseDown) {
        this.yaw = Math.atan2(mx, mz);
      }
    }

    this.pos.x = Math.max(-440, Math.min(440, this.pos.x + mx * dt));
    this.pos.z = Math.max(-430, Math.min(255, this.pos.z + mz * dt));

    // Building collision
    const r = 0.65;
    for (const c of this.colliders) {
      if (this.pos.x + r > c.minX && this.pos.x - r < c.maxX &&
          this.pos.z + r > c.minZ && this.pos.z - r < c.maxZ) {
        const dxL = Math.abs(this.pos.x + r - c.minX);
        const dxR = Math.abs(c.maxX - (this.pos.x - r));
        const dzT = Math.abs(this.pos.z + r - c.minZ);
        const dzB = Math.abs(c.maxZ - (this.pos.z - r));
        const m = Math.min(dxL, dxR, dzT, dzB);
        if (m === dxL) this.pos.x = c.minX - r;
        else if (m === dxR) this.pos.x = c.maxX + r;
        else if (m === dzT) this.pos.z = c.minZ - r;
        else this.pos.z = c.maxZ + r;
      }
    }

    if (this.grounded && input.consumePress('Space')) {
      this.vy = 10.5;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= WORLD.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;

    const moving = Math.hypot(mx, mz) > 0.4;
    if (moving) {
      animatePedLimbs(this.mesh, elapsed * (sprint ? 12 : 8.5), false);
    } else {
      animatePedLimbs(this.mesh, 0, false);
    }
    this.setCombatPose(input.mouseDown || input.rightMouseDown || this.muzzleTimer > 0);

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) this.mesh.userData.muzzleFlash.visible = false;
    }
  }
}
