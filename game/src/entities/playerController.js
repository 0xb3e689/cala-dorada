// Articulated 3D Dante Varo player character and crew partner Nadia Solis with sculpted silhouettes, detailed SMG, and muzzle FX.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../core/config.js';
import { animatePedLimbs } from '../world/trafficAndPeds.js';
import { getRadialGlowTexture } from './vehicleFactory.js';

export function buildCharacterMesh({ jacket, accent, pants, skin, hair, isFemale = false, allyGlow = false }) {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.46, metalness: 0.16 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.38 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.72 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.55 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.75 });
  const shadesMat = new THREE.MeshStandardMaterial({ color: 0x0d1320, metalness: 0.9, roughness: 0.1 });

  // Ground contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 16),
    new THREE.MeshBasicMaterial({ color: 0x05070c, transparent: true, opacity: 0.48, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  g.add(shadow);

  // Subtle glowing ally floor ring for crew partner Nadia
  if (allyGlow) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.56, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8, side: THREE.DoubleSide, transparent: true, opacity: 0.82 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    g.add(ring);
  }

  // Sculpted upper torso + tapered jacket + belt
  const torsoW = isFemale ? 0.5 : 0.62;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, 0.74, 0.34), jacketMat);
  torso.position.y = 1.24;
  torso.castShadow = true;
  g.add(torso);

  // Shoulders & collar trim
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.12, 0.16, 0.36), jacketMat);
  shoulders.position.y = 1.54;
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.06), accentMat);
  lapel.position.set(0, 1.24, 0.16);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.98, 0.1, 0.36), bootMat);
  belt.position.y = 0.88;
  g.add(shoulders, lapel, belt);

  // Neck + rounded stylized head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 10), skinMat);
  neck.position.y = 1.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skinMat);
  head.scale.set(0.92, 1.05, 0.96);
  head.position.y = 1.84;
  head.castShadow = true;
  g.add(neck, head);

  // Styled hair (with ponytail for Nadia)
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), hairMat);
  hairTop.scale.set(0.98, 0.75, 1.04);
  hairTop.position.set(0, 1.93, -0.02);
  g.add(hairTop);
  if (isFemale) {
    const pony = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 8), hairMat);
    pony.position.set(0, 1.78, -0.22);
    pony.rotation.x = 0.45;
    g.add(pony);
  }

  // Aviator shades
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.085, 0.08), shadesMat);
  shades.position.set(0, 1.86, 0.17);
  g.add(shades);

  // Tapered legs with distinct boots
  const legL = new THREE.Group();
  legL.position.set(-0.15, 0.84, 0);
  const legLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.72, 10), pantsMat);
  legLMesh.position.y = -0.36;
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.28), bootMat);
  bootL.position.set(0, -0.76, 0.04);
  legL.add(legLMesh, bootL);

  const legR = new THREE.Group();
  legR.position.set(0.15, 0.84, 0);
  const legRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.72, 10), pantsMat);
  legRMesh.position.y = -0.36;
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.28), bootMat);
  bootR.position.set(0, -0.76, 0.04);
  legR.add(legRMesh, bootR);

  // Articulated arms (pivoting cleanly from shoulder!)
  const armL = new THREE.Group();
  armL.position.set(-torsoW / 2 - 0.11, 1.5, 0);
  const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.075, 0.62, 10), jacketMat);
  armLMesh.position.y = -0.3;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skinMat);
  handL.position.y = -0.62;
  armL.add(armLMesh, handL);

  const armR = new THREE.Group();
  armR.position.set(torsoW / 2 + 0.11, 1.5, 0);
  const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.075, 0.62, 10), jacketMat);
  armRMesh.position.y = -0.3;
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skinMat);
  handR.position.y = -0.62;
  armR.add(armRMesh, handR);

  // Detailed multi-part Vector SMG attached to right hand (points along local -Y so pitch -1.45 aims straight +Z!)
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0, -0.62, 0.06);
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x19202b, metalness: 0.85, roughness: 0.22 });
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 0.14), gunMat);
  receiver.position.set(0, -0.18, 0.02);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 8), gunMat);
  barrel.position.set(0, -0.56, 0.04);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.24), gunMat);
  mag.position.set(0, -0.22, -0.1);
  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0x34e0c8 }));
  optic.position.set(0, -0.12, 0.11);

  // Blazing Additive Starburst Muzzle Flash + Dynamic Orange Light!
  const muzzleFlash = new THREE.Group();
  muzzleFlash.position.set(0, -0.78, 0.04);
  const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getRadialGlowTexture('#ffffff', 'rgba(255,186,62,0.92)', 'rgba(255,92,24,0)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flashSprite.scale.set(1.65, 1.65, 1);
  const flashCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.85, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  flashCone.rotation.x = Math.PI;
  flashCone.position.y = -0.35;
  const flashLight = new THREE.PointLight(0xffa43b, 22, 14, 1.8);
  muzzleFlash.add(flashSprite, flashCone, flashLight);
  muzzleFlash.visible = false;

  gunGroup.add(receiver, barrel, mag, optic, muzzleFlash);
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
      jacket: 0xe65f3c, accent: 0xffe2ad, pants: 0x1b2230, skin: 0xd9a17a, hair: 0x1b1514,
    });
    this.scene.add(this.mesh);

    // Crew Partner Nadia Solis (appears during combat/missions with clear teal ally ring)
    this.partnerMesh = buildCharacterMesh({
      jacket: 0x22c4b6, accent: 0x121824, pants: 0x181e2a, skin: 0xdba584, hair: 0x24161a, isFemale: true, allyGlow: true,
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
      armR.rotation.x = -1.48;
      armL.rotation.x = -1.28;
      armL.rotation.z = 0.34;
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
