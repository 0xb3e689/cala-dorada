// CDPD HALCÓN-1 tactical helicopter with detailed white/navy/coral CDPD fuselage, glowing cockpit, twin skids, 4-blade rotor, strobes & focused volumetric searchlight.

import * as THREE from '../../vendor/three.module.min.js';
import { getRadialGlowTexture } from './vehicleFactory.js';

function createSpotlightBeamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 252, 232, 0.82)');
  grad.addColorStop(0.16, 'rgba(255, 240, 198, 0.38)');
  grad.addColorStop(0.58, 'rgba(255, 232, 180, 0.12)');
  grad.addColorStop(1.0, 'rgba(255, 224, 165, 0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHeliSideLiveryTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  // Crisp glossy white upper body + deep-navy CDPD lower hull
  g.fillStyle = '#f2f6ff';
  g.fillRect(0, 0, 512, 92);
  g.fillStyle = '#152746';
  g.fillRect(0, 92, 512, 68);
  // Coral-red & gold accent stripes
  g.fillStyle = '#ff4757';
  g.fillRect(0, 82, 512, 13);
  g.fillStyle = '#ffc84d';
  g.fillRect(0, 95, 512, 8);
  // Side cabin windows
  g.fillStyle = '#244b70';
  g.fillRect(62, 22, 96, 46);
  g.fillRect(174, 22, 96, 46);
  g.strokeStyle = '#d4e2f5';
  g.lineWidth = 3;
  g.strokeRect(62, 22, 96, 46);
  g.strokeRect(174, 22, 96, 46);
  // Crisp CDPD HALCÓN-1 stencil
  g.font = '900 32px "Avenir Next", system-ui, sans-serif';
  g.fillStyle = '#152746';
  g.fillText('CDPD', 298, 56);
  g.font = '900 22px "Avenir Next", system-ui, sans-serif';
  g.fillStyle = '#ffc84d';
  g.fillText('HALCÓN-1 · AIR UNIT', 200, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class HelicopterAI {
  constructor(scene, collisionWorld = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.mesh = this._buildHeliMesh();
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    // Focused ground spotlight pool ring beneath target (stops on roof/bridge deck when player hides underneath!)
    this.groundPool = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 10.5),
      new THREE.MeshBasicMaterial({
        map: getRadialGlowTexture('rgba(255,248,215,0.62)', 'rgba(255,232,165,0.18)', 'rgba(0,0,0,0)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.groundPool.rotation.x = -Math.PI / 2;
    this.groundPool.position.y = 0.14;
    this.groundPool.visible = false;
    this.scene.add(this.groundPool);

    this.orbitAngle = 0.6;
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.bankRoll = 0;
    this.spotTargetPos = new THREE.Vector3();
    this.lastSeenPos = new THREE.Vector3();
    this.spotInitialized = false;
    this.hasVisualLock = false;
    this.fireCd = 2.5;
  }

  _buildHeliMesh() {
    const g = new THREE.Group();
    const darkNavy = new THREE.MeshStandardMaterial({ color: 0x15284a, roughness: 0.3, metalness: 0.55 });
    const whiteBody = new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.26, metalness: 0.32 });
    const coralAccent = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.28, metalness: 0.35 });
    const goldAccent = new THREE.MeshStandardMaterial({ color: 0xffc84d, roughness: 0.22, metalness: 0.72 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x3b96c8, emissive: 0x144566, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.88,
    });
    const cockpitGlowMat = new THREE.MeshBasicMaterial({ color: 0x7ef2ff });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x384354, roughness: 0.35, metalness: 0.82 });
    const liveryTex = createHeliSideLiveryTexture();
    const liveryMat = new THREE.MeshStandardMaterial({ map: liveryTex, roughness: 0.28, metalness: 0.3 });

    // Main sculpted two-tone white/navy fuselage cabin with side livery panels
    const bodyUpper = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 1.35, 5.5),
      [liveryMat, liveryMat, whiteBody, darkNavy, whiteBody, whiteBody]
    );
    bodyUpper.position.set(0, 0.38, 0);
    bodyUpper.castShadow = true;
    g.add(bodyUpper);

    const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.88, 5.3), darkNavy);
    bodyLower.position.set(0, -0.68, 0.05);
    g.add(bodyLower);

    // Bold coral-red & gold fuselage accent stripes wrapping fuselage
    const coralBand = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.22, 5.56), coralAccent);
    coralBand.position.set(0, -0.18, 0.02);
    const goldBand = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.12, 5.56), goldAccent);
    goldBand.position.set(0, -0.35, 0.02);
    g.add(coralBand, goldBand);

    // Sculpted upper twin-turbine cowling & exhaust ducts
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.78, 4.1), whiteBody);
    cowl.position.set(0, 1.38, -0.35);
    const cowlStripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 4.14), darkNavy);
    cowlStripe.position.set(0, 1.15, -0.35);
    g.add(cowl, cowlStripe);

    for (const ex of [-0.58, 0.58]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.0, 8), metalMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(ex, 1.48, -2.35);
      g.add(exhaust);
    }

    // Sleek angled tinted glass cockpit canopy with subtle interior console glow & struts
    const noseUpper = new THREE.Mesh(new THREE.BoxGeometry(2.26, 1.38, 2.5), glassMat);
    noseUpper.position.set(0, 0.24, 3.35);
    noseUpper.rotation.x = 0.44;
    const canopyCenterRib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 2.54), whiteBody);
    canopyCenterRib.position.copy(noseUpper.position);
    canopyCenterRib.rotation.copy(noseUpper.rotation);
    const cockpitDash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.9), cockpitGlowMat);
    cockpitDash.position.set(0, -0.02, 3.05);
    const noseChin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 2.4), whiteBody);
    noseChin.position.set(0, -0.62, 3.25);
    noseChin.rotation.x = -0.16;
    const noseTip = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 0.9), darkNavy);
    noseTip.position.set(0, -0.52, 4.35);
    g.add(noseUpper, canopyCenterRib, cockpitDash, noseChin, noseTip);

    // Tapered white & navy tail boom with coral/gold tail bands & stabilizers
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.68, 7.8, 10), whiteBody);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.42, -6.3);
    const boomBandR = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.72, 10), coralAccent);
    boomBandR.rotation.x = Math.PI / 2;
    boomBandR.position.set(0, 0.42, -7.2);
    const boomBandG = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.34, 10), goldAccent);
    boomBandG.rotation.x = Math.PI / 2;
    boomBandG.position.set(0, 0.42, -6.72);
    g.add(boom, boomBandR, boomBandG);

    const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 0.92), whiteBody);
    hStab.position.set(0, 0.48, -7.9);
    for (const sx of [-1.75, 1.75]) {
      const endPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.96), coralAccent);
      endPlate.position.set(sx, 0.56, -7.9);
      g.add(endPlate);
    }
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.75, 1.48), darkNavy);
    fin.position.set(0, 1.28, -9.8);
    fin.rotation.x = -0.26;
    const finTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 1.42), goldAccent);
    finTrim.position.set(0, 2.2, -10.05);
    finTrim.rotation.x = -0.26;
    g.add(hStab, fin, finTrim);

    // Twin tubular metal landing skids with curved front tips & crossbars
    for (const sx of [-1.45, 1.45]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 6.4, 8), metalMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.82, 0.55);
      const skidTip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.85, 8), metalMat);
      skidTip.rotation.x = Math.PI / 2 - 0.58;
      skidTip.position.set(sx, -1.62, 3.95);
      g.add(skid, skidTip);
      for (const sz of [-1.35, 1.95]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.38, 6), metalMat);
        strut.position.set(sx * 0.84, -1.32, sz);
        strut.rotation.z = sx > 0 ? 0.32 : -0.32;
        g.add(strut);
      }
    }
    for (const sz of [-1.35, 1.95]) {
      const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.8, 6), metalMat);
      cross.rotation.z = Math.PI / 2;
      cross.position.set(0, -1.38, sz);
      g.add(cross);
    }

    // Raised rotor mast + hub + 4 detailed main rotor blades with safety tips + translucent blur disc
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.92, 10), metalMat);
    mast.position.set(0, 2.02, 0.15);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.26, 12), goldAccent);
    hub.position.set(0, 2.48, 0.15);
    g.add(mast, hub);

    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.52, 0.15);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.4, metalness: 0.6 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xffc84d });
    for (let i = 0; i < 4; i++) {
      const bWrap = new THREE.Group();
      bWrap.rotation.y = (i / 4) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.07, 0.34), bladeMat);
      blade.position.x = 3.6;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.075, 0.35), tipMat);
      tip.position.x = 7.0;
      bWrap.add(blade, tip);
      mainRotor.add(bWrap);
    }
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 7.25, 36),
      new THREE.MeshBasicMaterial({ color: 0xd8e8fa, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    mainRotor.add(disc);
    g.add(mainRotor);

    // 4-blade spinning tail rotor with coral tips
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.4, 1.35, -9.85);
    const tr1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 0.22), whiteBody);
    const tr2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 2.5), coralAccent);
    tailRotor.add(tr1, tr2);
    g.add(tailRotor);

    // Flashing Red & Blue Fuselage Strobes (crisp focused glows)
    const strobeRed = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,44,78,0.9)', 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    strobeRed.scale.set(2.1, 2.1, 1);
    strobeRed.position.set(-1.35, -0.82, 0.4);

    const strobeBlue = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(54,162,255,0.9)', 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    strobeBlue.scale.set(2.1, 2.1, 1);
    strobeBlue.position.set(1.35, -0.82, 0.4);

    const tailBeacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,54,78,0.88)', 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    tailBeacon.scale.set(1.75, 1.75, 1);
    tailBeacon.position.set(0, 2.68, -10.15);
    g.add(strobeRed, strobeBlue, tailBeacon);

    // Under-nose Searchlight & FLIR Gimbal Turret casting focused volumetric spotlight cone
    const gimbalHousing = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), metalMat);
    gimbalHousing.position.set(0, -1.22, 3.65);
    g.add(gimbalHousing);

    const spotOrigin = new THREE.Group();
    spotOrigin.position.set(0, -1.28, 3.72);

    const lampFlare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,244,196,0.9)', 'rgba(0,0,0,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    lampFlare.scale.set(2.4, 2.4, 1);
    spotOrigin.add(lampFlare);

    const coneHeight = 46;
    const coneGeo = new THREE.ConeGeometry(4.4, coneHeight, 24, 1, true);
    coneGeo.translate(0, -coneHeight / 2, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      map: createSpotlightBeamTexture(),
      color: 0xfff3c8,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    spotOrigin.add(cone);

    const spotLight = new THREE.SpotLight(0xfff1c4, 65, 68, 0.24, 0.42, 1.8);
    spotLight.position.set(0, 0, 0);
    spotOrigin.add(spotLight);
    spotOrigin.add(spotLight.target);
    spotLight.target.position.set(0, -30, 0);

    g.add(spotOrigin);
    g.scale.setScalar(1.16);

    g.userData = { mainRotor, tailRotor, strobeRed, strobeBlue, tailBeacon, spotOrigin, cone };
    return g;
  }

  placeForShot(pos, targetPos, bankAngle = 0.14) {
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this.mesh.lookAt(targetPos.x, pos.y - 4.2, targetPos.z);
    this.mesh.rotateZ(bankAngle);
    this.mesh.userData.mainRotor.rotation.y = 0.42;
    this.mesh.userData.strobeRed.visible = true;
    this.mesh.userData.strobeBlue.visible = true;
    this.mesh.updateMatrixWorld(true);
    this.spotTargetPos.copy(targetPos);
    this.spotInitialized = true;
    this._aimSpotlightInstant(targetPos);
    this.groundPool.visible = true;
    this.groundPool.position.set(targetPos.x, 0.14, targetPos.z);
  }

  _aimSpotlightInstant(targetPos) {
    const { spotOrigin } = this.mesh.userData;
    const worldOrigin = new THREE.Vector3();
    spotOrigin.getWorldPosition(worldOrigin);
    const dir = new THREE.Vector3().subVectors(targetPos, worldOrigin).normalize();
    const localDir = dir.clone().applyQuaternion(this.mesh.quaternion.clone().invert());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), localDir);
    spotOrigin.quaternion.copy(q);
  }

  // Smooth angular-velocity-damped searchlight gimbal with 3D raycast ceiling/roof/bridge occlusion!
  _aimSpotlightSmooth(targetPos, dt, state) {
    if (!this.spotInitialized) {
      this.spotTargetPos.copy(targetPos);
      this.lastSeenPos.copy(targetPos);
      this.spotInitialized = true;
    }

    const { spotOrigin, cone } = this.mesh.userData;
    const worldOrigin = new THREE.Vector3();
    spotOrigin.getWorldPosition(worldOrigin);

    const playerPt = new THREE.Vector3(targetPos.x, (targetPos.y ?? 0) + 1.15, targetPos.z);
    const toPlayer = new THREE.Vector3().subVectors(playerPt, worldOrigin);
    const distToPlayer = toPlayer.length() || 1;
    const dirToPlayer = toPlayer.clone().divideScalar(distToPlayer);

    // 3D Line-of-Sight raycast from HALCÓN-1 nose to player (blocked by overhead bridge decks, cover building roofs & towers!)
    const losHit = (this.collisionWorld && !state?.diving)
      ? this.collisionWorld.raycast(worldOrigin, dirToPlayer, Math.max(0.5, distToPlayer - 0.3), { ignoreTags: ['bus-stop'] })
      : null;

    if (state?.diving || losHit) {
      // Player is hidden underwater, under a bridge underpass, or inside an enterable roofed cover building!
      this.hasVisualLock = false;
    } else {
      this.hasVisualLock = true;
      this.lastSeenPos.copy(playerPt);
    }

    // Track player when locked; search around last seen roof/area when hidden!
    const aimDesired = this.hasVisualLock ? playerPt : this.lastSeenPos;
    const trackRate = this.hasVisualLock ? 1.9 : 0.75;
    const lagAlpha = 1 - Math.exp(-trackRate * dt);
    this.spotTargetPos.lerp(aimDesired, lagAlpha);

    const beamVec = new THREE.Vector3().subVectors(this.spotTargetPos, worldOrigin);
    const beamDist = beamVec.length() || 1;
    const beamDir = beamVec.clone().divideScalar(beamDist);

    // Raycast the ACTUAL searchlight beam so the volumetric cone & pool stop cleanly on any roof/bridge deck above!
    const beamHit = this.collisionWorld
      ? this.collisionWorld.raycast(worldOrigin, beamDir, beamDist + 2.0, { ignoreTags: ['bus-stop'] })
      : null;

    const hitDist = beamHit ? beamHit.dist : beamDist;
    const poolX = beamHit ? beamHit.point.x : this.spotTargetPos.x;
    const poolY = beamHit ? beamHit.point.y + 0.16 : Math.max(0.14, (targetPos.y ?? 0) + 0.14);
    const poolZ = beamHit ? beamHit.point.z : this.spotTargetPos.z;

    // Scale spotlight cone height dynamically so it NEVER pierces through a roof or bridge deck!
    if (cone) {
      const coneScaleY = Math.max(0.12, Math.min(1.2, hitDist / 46));
      cone.scale.set(1, coneScaleY, 1);
    }

    const localDir = beamDir.clone().applyQuaternion(this.mesh.quaternion.clone().invert());
    const desiredQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), localDir);
    const maxStepRad = 1.25 * dt;
    spotOrigin.quaternion.rotateTowards(desiredQ, maxStepRad);
    this.groundPool.position.set(poolX, poolY, poolZ);
  }

  update(dt, elapsed, state, targetPos, combatSystem = null, onPlayerHit = null, audio = null) {
    const wasVis = this.mesh.visible;
    this.mesh.visible = state.airUnitDeployed;
    this.groundPool.visible = state.airUnitDeployed && state.signalJamTimer <= 0;
    if (!state.airUnitDeployed) {
      this.spotInitialized = false;
      this.hasVisualLock = false;
      return;
    }

    if (!wasVis) {
      this.mesh.position.set(targetPos.x + 28, 34, targetPos.z + 32);
      this.vel.set(0, 0, 0);
      this.spotTargetPos.copy(targetPos);
      this.lastSeenPos.copy(targetPos);
      this.spotInitialized = true;
    }

    // Orbit around player when visually locked, or around lastSeenPos when player hides under cover!
    const orbitFocus = this.hasVisualLock ? targetPos : this.lastSeenPos;
    this.orbitAngle += dt * 0.44;
    const radius = 44;
    const desiredX = orbitFocus.x + Math.cos(this.orbitAngle) * radius;
    const desiredZ = orbitFocus.z + Math.sin(this.orbitAngle) * radius;
    const desiredY = 27 + Math.sin(elapsed * 1.1) * 1.8;

    const toDesX = desiredX - this.mesh.position.x;
    const toDesZ = desiredZ - this.mesh.position.z;
    const toDesY = desiredY - this.mesh.position.y;
    const dist = Math.hypot(toDesX, toDesZ) || 1;
    const cruiseSpeed = Math.min(25.5, Math.max(12, dist * 0.72));
    const desVx = (toDesX / dist) * cruiseSpeed;
    const desVz = (toDesZ / dist) * cruiseSpeed;
    const desVy = Math.max(-5, Math.min(5, toDesY * 1.2));

    const accel = 1 - Math.exp(-1.8 * dt);
    const prevVx = this.vel.x;
    const prevVz = this.vel.z;
    this.vel.x = THREE.MathUtils.lerp(this.vel.x, desVx, accel);
    this.vel.z = THREE.MathUtils.lerp(this.vel.z, desVz, accel);
    this.vel.y = THREE.MathUtils.lerp(this.vel.y, desVy, accel);

    const hSpd = Math.hypot(this.vel.x, this.vel.z);
    if (hSpd > 26.0) {
      const s = 26.0 / hSpd;
      this.vel.x *= s;
      this.vel.z *= s;
    }

    this.mesh.position.addScaledVector(this.vel, dt);

    const lookDx = orbitFocus.x - this.mesh.position.x;
    const lookDz = orbitFocus.z - this.mesh.position.z;
    const desiredYaw = Math.atan2(lookDx, lookDz);
    let yawDiff = desiredYaw - this.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, yawDiff * 2.2 * dt));

    const latAcc = ((this.vel.x - prevVx) * Math.cos(this.yaw) - (this.vel.z - prevVz) * Math.sin(this.yaw)) / Math.max(0.005, dt);
    const desiredBank = Math.max(-0.28, Math.min(0.28, -latAcc * 0.028));
    this.bankRoll = THREE.MathUtils.lerp(this.bankRoll, desiredBank, Math.min(1, dt * 3.5));

    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.y = this.yaw;
    this.mesh.rotation.x = Math.min(0.18, hSpd * 0.006);
    this.mesh.rotation.z = this.bankRoll;
    this.mesh.updateMatrixWorld(true);

    const { mainRotor, tailRotor, strobeRed, strobeBlue, tailBeacon, cone, spotOrigin } = this.mesh.userData;
    mainRotor.rotation.y += dt * 28;
    tailRotor.rotation.x += dt * 36;
    const pulse = Math.sin(elapsed * 14) > 0;
    strobeRed.visible = pulse;
    strobeBlue.visible = !pulse;
    tailBeacon.visible = Math.sin(elapsed * 8) > -0.2;

    const jammed = state.signalJamTimer > 0;
    cone.visible = !jammed;
    if (!jammed) {
      this._aimSpotlightSmooth(targetPos, dt, state);
      // Aerial sniper fire ONLY when visually locked (NEVER shoots through bridge decks or cover roofs!)
      if (this.hasVisualLock && !state.statusOverlay && state.wantedLevel >= 4) {
        this.fireCd -= dt;
        if (this.fireCd <= 0) {
          this.fireCd = state.wantedLevel >= 5 ? 1.8 : 2.6;
          const orig = new THREE.Vector3();
          spotOrigin.getWorldPosition(orig);
          const tgt = new THREE.Vector3(targetPos.x + (Math.random() - 0.5) * 2.2, (targetPos.y ?? 0) + 1.1, targetPos.z + (Math.random() - 0.5) * 2.2);
          const dir = tgt.clone().sub(orig);
          const d = dir.length() || 1;
          const hit = this.collisionWorld ? this.collisionWorld.raycast(orig, dir.clone().divideScalar(d), d - 0.3) : null;
          if (!hit) {
            if (combatSystem) combatSystem.spawnTracer(orig, tgt, 0x70c8ff, 0.042, 0.16);
            if (audio) audio.playGunshot('carbine');
            if (Math.random() < 0.28 && onPlayerHit) onPlayerHit(10);
          }
        }
      }
    } else {
      this.hasVisualLock = false;
    }
  }
}
