// Anatomically proportioned realistic 3D human character generator (~1.78m height) with 2-segment limbs, sculpted head/hair/torso, customizable appearance, weapon & fishing rod props.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../core/config.js';
import { getRadialGlowTexture } from './vehicleFactory.js';

export function buildCharacterMesh({
  jacket = 0xe65f3c,
  accent = 0xffe2ad,
  pants = 0x1b2230,
  skin = 0xd9a17a,
  hair = 0x1b1514,
  isFemale = false,
  allyGlow = false,
  outfitStyle = 'bomber',
  hairStyle = null,
  accessory = 'aviators',
  shortSleeves = false,
  shorts = false,
  withWeapon = true,
  role = null,
} = {}) {
  const g = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.52, metalness: 0.12 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.44, metalness: 0.1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.74 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x151922, roughness: 0.48, metalness: 0.15 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xe6ebf2, roughness: 0.75 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.72 });
  const shadesMat = new THREE.MeshStandardMaterial({ color: 0x0c1220, metalness: 0.92, roughness: 0.08 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xd8b86a, metalness: 0.85, roughness: 0.25 });

  const effectiveHairStyle = hairStyle ?? (isFemale ? 'ponytail' : 'swept');

  // Ground contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 18),
    new THREE.MeshBasicMaterial({ color: 0x05070c, transparent: true, opacity: 0.44, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  g.add(shadow);

  // Subtle glowing ally floor ring for crew partner Nadia
  if (allyGlow) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.6, 28),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
  }

  // Upper body root so torso can lean/twist slightly during combat or sprint
  const upperBody = new THREE.Group();
  upperBody.position.y = 0.90;
  g.add(upperBody);

  // 1. Rounded sculpted pelvis / hip base (y = 0.86..0.97)
  const hipScaleX = isFemale ? 1.18 : 1.08;
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.16, 14), pantsMat);
  pelvis.scale.set(hipScaleX, 1, 0.76);
  pelvis.position.y = -0.02;
  pelvis.castShadow = true;
  upperBody.add(pelvis);

  // Belt & metallic buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.045, 14), shoeMat);
  belt.scale.set(hipScaleX * 1.01, 1, 0.78);
  belt.position.y = 0.06;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.042, 0.03), metalMat);
  buckle.position.set(0, 0.06, 0.125);
  upperBody.add(belt, buckle);

  // 2. Anatomically contoured tapered torso (waist -> ribcage -> broad rounded chest)
  const waistR = isFemale ? 0.122 : 0.145;
  const chestR = isFemale ? 0.162 : 0.192;

  const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(chestR * 0.88, waistR, 0.24, 14), jacketMat);
  abdomen.scale.set(1.14, 1, 0.74);
  abdomen.position.y = 0.19;
  abdomen.castShadow = true;
  upperBody.add(abdomen);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(chestR, chestR * 0.88, 0.27, 14), jacketMat);
  chest.scale.set(1.18, 1, 0.76);
  chest.position.y = 0.43;
  chest.castShadow = true;
  upperBody.add(chest);

  // Rounded trapezius / sloped shoulder bridge (eliminates boxy corners completely!)
  const shoulderBridge = new THREE.Mesh(new THREE.SphereGeometry(chestR * 0.94, 14, 10), jacketMat);
  shoulderBridge.scale.set(1.24, 0.42, 0.72);
  shoulderBridge.position.y = 0.555;
  upperBody.add(shoulderBridge);

  // Outfit-specific sculpted details (open jacket inner shirt, collar, lapels, tactical vest)
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.105, 0.08, 12), jacketMat);
  collar.position.set(0, 0.585, -0.01);
  upperBody.add(collar);

  const innerShirt = new THREE.Mesh(
    new THREE.CylinderGeometry(chestR * 0.52, waistR * 0.52, 0.44, 10),
    accentMat
  );
  innerShirt.scale.set(0.95, 1, 0.55);
  innerShirt.position.set(0, 0.34, 0.082);
  upperBody.add(innerShirt);

  if (outfitStyle === 'tactical') {
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x1c232e, roughness: 0.68, metalness: 0.2 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.22), vestMat);
    plate.position.set(0, 0.38, 0.02);
    upperBody.add(plate);
  } else if (outfitStyle === 'blazer') {
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.26, 0.03), jacketMat);
      lapel.position.set(side * 0.072, 0.41, 0.138);
      lapel.rotation.z = side * 0.18;
      upperBody.add(lapel);
    }
  } else if (outfitStyle === 'bomber') {
    // Ribbed bomber hem
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(waistR * 1.04, waistR * 1.02, 0.06, 14), shoeMat);
    hem.scale.set(1.14, 1, 0.76);
    hem.position.y = 0.085;
    upperBody.add(hem);
  }

  // 3. Distinct cylindrical neck + sculpted oval head + tapered jaw + ears + hair + accessories
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.61, 0);
  upperBody.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.066, 0.125, 10), skinMat);
  neck.position.y = 0.04;
  headGroup.add(neck);

  // Cranium oval ellipsoid
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 14), skinMat);
  cranium.scale.set(0.88, 1.02, 0.96);
  cranium.position.set(0, 0.19, 0);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Sculpted lower jaw / tapered chin
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), skinMat);
  jaw.scale.set(0.76, 0.84, 0.88);
  jaw.position.set(0, 0.128, 0.024);
  headGroup.add(jaw);

  // Subtle nose ridge & ears
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 6), skinMat);
  nose.rotation.x = Math.PI * 0.45;
  nose.position.set(0, 0.175, 0.112);
  headGroup.add(nose);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), skinMat);
    ear.scale.set(0.45, 1.15, 0.75);
    ear.position.set(side * 0.102, 0.18, -0.005);
    headGroup.add(ear);
  }

  // Layered sculpted 3D hair (ZERO boxes!)
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.124, 14, 12), hairMat);
  hairCrown.scale.set(0.92, 0.76, 1.0);
  hairCrown.position.set(0, 0.242, -0.015);
  headGroup.add(hairCrown);

  if (effectiveHairStyle === 'swept' || effectiveHairStyle === 'slick') {
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.112, 12, 10), hairMat);
    hairBack.scale.set(0.9, 0.88, 0.72);
    hairBack.position.set(0, 0.195, -0.052);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), hairMat);
    fringe.scale.set(0.96, 0.42, 0.75);
    fringe.position.set(effectiveHairStyle === 'slick' ? 0 : 0.015, 0.275, 0.032);
    fringe.rotation.x = -0.18;
    headGroup.add(hairBack, fringe);
  } else if (effectiveHairStyle === 'ponytail') {
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), hairMat);
    hairBack.scale.set(0.92, 0.92, 0.76);
    hairBack.position.set(0, 0.195, -0.05);
    const ponyTop = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.056, 0.16, 10), hairMat);
    ponyTop.position.set(0, 0.165, -0.145);
    ponyTop.rotation.x = 0.55;
    const ponyTail = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.22, 10), hairMat);
    ponyTail.position.set(0, 0.03, -0.195);
    ponyTail.rotation.x = Math.PI - 0.16;
    headGroup.add(hairBack, ponyTop, ponyTail);
  } else if (effectiveHairStyle === 'fade') {
    const fadeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.104, 0.055, 12), hairMat);
    fadeTop.position.set(0, 0.285, 0.005);
    headGroup.add(fadeTop);
  }

  // Head Accessories: Aviators / Cap / Role Hats
  if (accessory === 'aviators' && role !== 'vendor') {
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), shadesMat);
      lens.scale.set(1.18, 0.85, 0.42);
      lens.position.set(side * 0.043, 0.192, 0.102);
      headGroup.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.036, 6), metalMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.20, 0.112);
    headGroup.add(bridge);
  } else if (accessory === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.65 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.128, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
    dome.position.set(0, 0.22, -0.005);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.014, 12, 1, false, -Math.PI * 0.42, Math.PI * 0.84), capMat);
    visor.position.set(0, 0.23, 0.068);
    visor.rotation.x = 0.14;
    headGroup.add(dome, visor);
  }

  // Archetype NPC accessories (sculpted, non-boxy!)
  if (role === 'tourist') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xe6c88a, roughness: 0.82 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.025, 16), hatMat);
    brim.position.set(0, 0.26, -0.005);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.125, 0.095, 14), hatMat);
    crown.position.set(0, 0.305, -0.005);
    headGroup.add(brim, crown);
  } else if (role === 'officer') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x13264a, roughness: 0.55 });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.115, 0.075, 14), capMat);
    crown.position.set(0, 0.285, -0.005);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.015, 12, 1, false, -Math.PI * 0.4, Math.PI * 0.8), shoeMat);
    visor.position.set(0, 0.25, 0.065);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.01, 8), metalMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.09, 0.44, 0.145);
    headGroup.add(crown, visor);
    upperBody.add(badge);
  } else if (role === 'vendor') {
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(chestR * 0.92, hipScaleX * 0.155, 0.48, 12, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.85, side: THREE.DoubleSide }));
    apron.scale.set(1.16, 1, 0.8);
    apron.position.set(0, 0.14, 0.015);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.018, 8, 16), new THREE.MeshStandardMaterial({ color: 0xff4f4f }));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.245, -0.005);
    upperBody.add(apron);
    headGroup.add(band);
  } else if (role === 'jogger') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.014, 8, 16), new THREE.MeshBasicMaterial({ color: 0x34e0c8 }));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.235, 0);
    headGroup.add(band);
  }

  // 4. Two-Segment Articulated Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Sculpted Hand)
  const shoulderX = (isFemale ? 0.195 : 0.228);
  const buildArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, 0.515, 0);

    const upperMat = shortSleeves ? skinMat : jacketMat;
    const foreMat = shortSleeves ? skinMat : jacketMat;

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), jacketMat);
    deltoid.scale.set(0.95, 1.05, 0.95);
    shoulder.add(deltoid);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.046, 0.28, 10), upperMat);
    upperArm.position.y = -0.145;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.285, 0);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), foreMat);
    const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.26, 10), foreMat);
    lowerArm.position.y = -0.135;
    lowerArm.castShadow = true;

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), skinMat);
    hand.scale.set(0.82, 1.18, 0.62);
    hand.position.set(0, -0.28, 0.012);

    forearm.add(elbow, lowerArm, hand);
    shoulder.add(forearm);
    return { shoulder, forearm };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  upperBody.add(leftArm.shoulder, rightArm.shoulder);

  // 5. Two-Segment Articulated Legs (Hip -> Thigh -> Knee -> Calf -> Contoured Sneaker/Boot)
  const buildLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * (isFemale ? 0.095 : 0.105), 0.88, 0);

    const thighMat = pantsMat;
    const calfMat = shorts ? skinMat : pantsMat;

    const hipCap = new THREE.Mesh(new THREE.SphereGeometry(0.084, 10, 8), thighMat);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.065, 0.41, 10), thighMat);
    thigh.position.y = -0.205;
    thigh.castShadow = true;
    hip.add(hipCap, thigh);

    const calf = new THREE.Group();
    calf.position.set(0, -0.41, 0);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), calfMat);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.043, 0.40, 10), calfMat);
    shin.position.y = -0.20;
    shin.castShadow = true;

    // Contoured sneaker/boot (heel + tapered toe box + sole)
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.425, 0.035);
    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.08, 10), shoeMat);
    heel.position.set(0, 0.02, -0.045);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), shoeMat);
    toe.scale.set(0.95, 0.62, 1.65);
    toe.position.set(0, 0.005, 0.042);
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.058, 0.024, 10), soleMat);
    sole.scale.set(0.95, 1, 2.05);
    sole.position.set(0, -0.028, 0.015);
    shoeGroup.add(heel, toe, sole);

    calf.add(knee, shin, shoeGroup);
    hip.add(calf);
    return { hip, calf };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);
  g.add(leftLeg.hip, rightLeg.hip);

  // 6. Detailed Multi-Part Weapon + Starburst Muzzle Flash (attached cleanly to Right Hand)
  let gunGroup = null;
  let muzzleFlash = null;
  if (withWeapon) {
    gunGroup = new THREE.Group();
    gunGroup.position.set(0, -0.29, 0.045);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x19202b, metalness: 0.85, roughness: 0.22 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x2a3240, roughness: 0.65 });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.42, 0.105), gunMat);
    receiver.position.set(0, -0.14, 0.02);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), gunMat);
    barrel.position.set(0, -0.44, 0.035);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.095, 0.19), gripMat);
    mag.position.set(0, -0.17, -0.085);
    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.08, 0.045), new THREE.MeshBasicMaterial({ color: 0x34e0c8 }));
    optic.position.set(0, -0.08, 0.085);

    muzzleFlash = new THREE.Group();
    muzzleFlash.position.set(0, -0.62, 0.035);
    const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,186,62,0.88)', 'rgba(255,92,24,0)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flashSprite.scale.set(0.96, 0.96, 1);
    const flashCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.56, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    flashCone.rotation.x = Math.PI;
    flashCone.position.y = -0.26;
    const flashLight = new THREE.PointLight(0xffa43b, 10, 7.5, 2.2);
    muzzleFlash.add(flashSprite, flashCone, flashLight);
    muzzleFlash.visible = false;

    gunGroup.add(receiver, barrel, mag, optic, muzzleFlash);
    rightArm.forearm.add(gunGroup);
  }

  // 7. 3D Fishing Rod with Line & Floating Bobber (toggled when fishing!)
  const rodGroup = new THREE.Group();
  rodGroup.position.set(0, -0.28, 0.04);
  const rodShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.022, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x263240, roughness: 0.35, metalness: 0.65 })
  );
  rodShaft.position.set(0, -1.25, 0.08);
  rodShaft.rotation.x = 0.08;
  const reel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10),
    metalMat
  );
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.04, -0.24, 0.02);
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 3.8, 4),
    new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.72 })
  );
  line.position.set(0, -2.55, 1.9);
  line.rotation.x = 1.48;
  const bobber = new THREE.Group();
  bobber.position.set(0, -2.6, 3.8);
  const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b4e }));
  bobTop.position.y = 0.03;
  const bobBot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
  bobBot.position.y = -0.03;
  bobber.add(bobTop, bobBot);
  rodGroup.add(rodShaft, reel, line, bobber);
  rodGroup.visible = false;
  rightArm.forearm.add(rodGroup);

  g.userData.limbs = {
    upperBody,
    headGroup,
    legL: leftLeg.hip,
    legR: rightLeg.hip,
    calfL: leftLeg.calf,
    calfR: rightLeg.calf,
    armL: leftArm.shoulder,
    armR: rightArm.shoulder,
    forearmL: leftArm.forearm,
    forearmR: rightArm.forearm,
  };
  g.userData.muzzleFlash = muzzleFlash;
  g.userData.gunGroup = gunGroup;
  g.userData.rodGroup = rodGroup;
  g.userData.bobber = bobber;
  return g;
}

// Smooth articulated 2-segment human pose & stride helper
export function poseHumanCombat(mesh, active = true) {
  const l = mesh.userData.limbs;
  if (!l) return;
  if (active) {
    l.upperBody.rotation.y = -0.14;
    l.upperBody.rotation.x = 0.05;
    l.armR.rotation.set(-0.94, -0.05, -0.04);
    l.forearmR.rotation.set(-0.60, 0, 0.04);
    l.armL.rotation.set(-0.84, 0.28, 0.14);
    l.forearmL.rotation.set(-0.64, 0.18, -0.10);
    // Athletic combat wide stance with slight knee bend
    l.legL.rotation.set(-0.16, 0.06, -0.07);
    l.calfL.rotation.set(0.22, 0, 0);
    l.legR.rotation.set(0.14, -0.07, 0.07);
    l.calfR.rotation.set(0.18, 0, 0);
  } else {
    l.upperBody.rotation.set(0, 0, 0);
    l.armR.rotation.set(0, 0, -0.06);
    l.forearmR.rotation.set(-0.14, 0, 0);
    l.armL.rotation.set(0, 0, 0.06);
    l.forearmL.rotation.set(-0.14, 0, 0);
    l.legL.rotation.set(0, 0, 0);
    l.calfL.rotation.set(0, 0, 0);
    l.legR.rotation.set(0, 0, 0);
    l.calfR.rotation.set(0, 0, 0);
  }
}

export function poseHumanStride(mesh, t, panicked = false) {
  const l = mesh.userData.limbs;
  if (!l) return;
  l.upperBody.position.y = 0.90;
  if (t === 0 && !panicked) {
    l.upperBody.rotation.set(0, 0, 0);
    l.legL.rotation.set(0, 0, -0.03);
    l.legR.rotation.set(0, 0, 0.03);
    if (l.calfL) l.calfL.rotation.set(0.04, 0, 0);
    if (l.calfR) l.calfR.rotation.set(0.04, 0, 0);
    l.armL.rotation.set(0, 0, 0.06);
    l.armR.rotation.set(0, 0, -0.06);
    if (l.forearmL) l.forearmL.rotation.set(-0.12, 0, 0);
    if (l.forearmR) l.forearmR.rotation.set(-0.12, 0, 0);
    return;
  }
  const swing = Math.sin(t) * (panicked ? 0.68 : 0.42);
  l.upperBody.rotation.x = panicked ? 0.18 : 0.03;
  l.upperBody.rotation.y = Math.sin(t) * (panicked ? 0.11 : 0.06);
  l.legL.rotation.set(swing, 0, 0);
  l.legR.rotation.set(-swing, 0, 0);
  if (l.calfL) l.calfL.rotation.set(Math.max(0.06, -swing * 0.72 + 0.14), 0, 0);
  if (l.calfR) l.calfR.rotation.set(Math.max(0.06, swing * 0.72 + 0.14), 0, 0);
  if (panicked) {
    l.armL.rotation.set(-2.05 + swing * 0.35, 0, 0.24);
    l.armR.rotation.set(-2.05 - swing * 0.35, 0, -0.24);
    if (l.forearmL) l.forearmL.rotation.set(-0.48, 0, 0);
    if (l.forearmR) l.forearmR.rotation.set(-0.48, 0, 0);
  } else {
    l.armL.rotation.set(-swing * 0.62, 0, 0.05);
    l.armR.rotation.set(swing * 0.62, 0, -0.05);
    if (l.forearmL) l.forearmL.rotation.set(-0.18 - Math.max(0, swing * 0.28), 0, 0);
    if (l.forearmR) l.forearmR.rotation.set(-0.18 - Math.max(0, -swing * 0.28), 0, 0);
  }
}

// Distinct athletic SPRINT animation: ~18-degree forward torso lean, wide stride, high knee lift & backward heel kick, fast pumping bent elbows!
export function poseHumanSprint(mesh, t) {
  const l = mesh.userData.limbs;
  if (!l) return;
  const s = Math.sin(t);
  const c = Math.cos(t);
  // 18-degree (~0.31 rad) forward athletic lean + subtle vertical running bounce
  l.upperBody.rotation.set(0.31 + Math.abs(c) * 0.04, s * 0.14, -s * 0.04);
  l.upperBody.position.y = 0.89 + Math.abs(s) * 0.04;

  // Wide athletic leg stride with strong knee drive & heel kick
  const hipL = s * 0.92;
  const hipR = -s * 0.92;
  l.legL.rotation.set(hipL, 0, -0.02);
  l.legR.rotation.set(hipR, 0, 0.02);
  if (l.calfL) l.calfL.rotation.set(Math.max(0.14, (hipL > 0 ? hipL * 0.55 : -hipL * 1.15) + 0.24), 0, 0);
  if (l.calfR) l.calfR.rotation.set(Math.max(0.14, (hipR > 0 ? hipR * 0.55 : -hipR * 1.15) + 0.24), 0, 0);

  // Bent elbows pumping dynamically opposite the legs
  l.armL.rotation.set(-s * 0.95 - 0.15, 0, 0.10);
  l.armR.rotation.set(s * 0.95 - 0.15, 0, -0.10);
  if (l.forearmL) l.forearmL.rotation.set(-1.18 - Math.max(0, -s * 0.25), 0, 0);
  if (l.forearmR) l.forearmR.rotation.set(-1.18 - Math.max(0, s * 0.25), 0, 0);
}

// Exhausted ("ngos-ngosan") pose: hunched torso + heavy-breathing chest bob + sluggish stride
export function poseHumanExhausted(mesh, elapsed, moving, phase) {
  const l = mesh.userData.limbs;
  if (!l) return;
  const breath = Math.sin(elapsed * 7.8);
  if (moving) {
    poseHumanStride(mesh, phase, false);
    l.legL.rotation.x *= 0.65;
    l.legR.rotation.x *= 0.65;
  } else {
    poseHumanStride(mesh, 0, false);
  }
  l.upperBody.rotation.x = 0.23 + breath * 0.055;
  l.upperBody.position.y = 0.885 + breath * 0.024;
  if (!moving) {
    l.armL.rotation.set(-0.22 + breath * 0.06, 0, 0.14);
    l.armR.rotation.set(-0.22 + breath * 0.06, 0, -0.14);
    if (l.forearmL) l.forearmL.rotation.set(-0.42, 0, 0);
    if (l.forearmR) l.forearmR.rotation.set(-0.42, 0, 0);
  }
}

// 3D Weapon Reload arm animation (used by Player, Syndicate Enemies & On-Foot Police!)
// progress: 0..1 across reload duration
export function poseHumanReload(mesh, progress) {
  const l = mesh.userData.limbs;
  if (!l) return;
  const p = Math.max(0, Math.min(1, progress));
  // Tilt weapon sideways in right hand; left hand drops mag (0..0.35), grabs fresh mag (0.35..0.68), inserts & racks (0.68..1.0)
  l.upperBody.rotation.y = -0.10;
  l.upperBody.rotation.x = 0.08;
  l.armR.rotation.set(-0.82, -0.22, -0.34);
  l.forearmR.rotation.set(-0.62, 0.28, 0.22);

  if (p < 0.35) {
    const t = p / 0.35;
    l.armL.rotation.set(-0.84 + t * 0.65, 0.24 - t * 0.18, 0.14);
    l.forearmL.rotation.set(-0.64 + t * 0.35, 0.12, -0.08);
  } else if (p < 0.72) {
    const t = (p - 0.35) / 0.37;
    l.armL.rotation.set(-0.19 - t * 0.68, 0.06 + t * 0.24, 0.14);
    l.forearmL.rotation.set(-0.29 - t * 0.42, 0.16, -0.08);
  } else {
    const t = (p - 0.72) / 0.28;
    const rack = Math.sin(t * Math.PI) * 0.28;
    l.armL.rotation.set(-0.87 - rack, 0.30, 0.16);
    l.forearmL.rotation.set(-0.71 - rack * 0.6, 0.18, -0.1);
  }
}

// Immediate directional body flinch / stagger animation when shot!
export function poseHumanFlinch(mesh, frac) {
  const l = mesh.userData.limbs;
  if (!l || frac <= 0) return;
  const f = Math.min(1, frac);
  l.upperBody.rotation.x -= 0.36 * f;
  l.upperBody.rotation.z += 0.18 * f;
  l.armL.rotation.x -= 0.28 * f;
  l.armR.rotation.x -= 0.24 * f;
}

// Smooth swimming tread animation in deep ocean/bay water
export function poseHumanSwim(mesh, elapsed) {
  const l = mesh.userData.limbs;
  if (!l) return;
  const s = Math.sin(elapsed * 5.2);
  l.upperBody.rotation.set(0.32, s * 0.18, 0);
  l.upperBody.position.y = 0.88;
  l.armL.rotation.set(-1.35 + s * 0.55, 0.35, 0.45);
  l.armR.rotation.set(-1.35 - s * 0.55, -0.35, -0.45);
  if (l.forearmL) l.forearmL.rotation.set(-0.55, 0, 0);
  if (l.forearmR) l.forearmR.rotation.set(-0.55, 0, 0);
  l.legL.rotation.set(s * 0.48, 0, 0);
  l.legR.rotation.set(-s * 0.48, 0, 0);
  if (l.calfL) l.calfL.rotation.set(0.35, 0, 0);
  if (l.calfR) l.calfR.rotation.set(0.35, 0, 0);
}

export class PlayerController {
  constructor(scene, collisionWorld) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;

    // Dante Varo (protagonist)
    this.mesh = buildCharacterMesh({
      jacket: 0xe65f3c, accent: 0xffe2ad, pants: 0x1b2230, skin: 0xd9a17a, hair: 0x1b1514,
      outfitStyle: 'bomber', hairStyle: 'swept', accessory: 'aviators',
    });
    this.scene.add(this.mesh);

    // Crew Partner Nadia Solis (appears during combat/missions with clear teal ally ring)
    this.partnerMesh = buildCharacterMesh({
      jacket: 0x22c4b6, accent: 0x121824, pants: 0x181e2a, skin: 0xdba584, hair: 0x24161a,
      isFemale: true, allyGlow: true, outfitStyle: 'blazer', hairStyle: 'ponytail', accessory: 'aviators',
    });
    this.partnerMesh.visible = false;
    this.scene.add(this.partnerMesh);

    this.pos = new THREE.Vector3(-120, 0, 200);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2;
    this.vy = 0;
    this.grounded = true;
    this.aiming = false;
    this.fishing = false;
    this.muzzleTimer = 0;
    this.stridePhase = 0;
    this.pantCooldown = 0;
    this.flinchTimer = 0;
    this.knockdownTimer = 0;
    this.knockVel = new THREE.Vector3();
  }

  applyAppearance(app) {
    if (!app) return;
    const wasVisible = this.mesh.visible;
    const prevPos = this.mesh.position.clone();
    const prevRotY = this.mesh.rotation.y;
    this.scene.remove(this.mesh);

    const accentHex = app.outfitStyle === 'coastal' ? '#f6efe4' : app.outfitStyle === 'tactical' ? '#252c38' : '#ffe2ad';
    this.mesh = buildCharacterMesh({
      jacket: app.jacketColor ?? '#e65f3c',
      accent: accentHex,
      pants: app.pantsColor ?? '#1b2230',
      skin: app.skinTone ?? '#d9a17a',
      hair: app.hairColor ?? '#1b1514',
      outfitStyle: app.outfitStyle ?? 'bomber',
      hairStyle: app.hairStyle ?? 'swept',
      accessory: app.accessory ?? 'aviators',
      shortSleeves: app.outfitStyle === 'coastal',
    });
    this.mesh.position.copy(prevPos);
    this.mesh.rotation.y = prevRotY;
    this.mesh.visible = wasVisible;
    this.scene.add(this.mesh);
    if (this.aiming) this.setCombatPose(true);
    if (this.fishing) this.setFishingMode(true);
  }

  setVisible(onFoot) {
    this.mesh.visible = onFoot;
  }

  setFishingMode(active) {
    this.fishing = active;
    if (this.mesh.userData.gunGroup) this.mesh.userData.gunGroup.visible = !active;
    if (this.mesh.userData.rodGroup) this.mesh.userData.rodGroup.visible = active;
    const l = this.mesh.userData.limbs;
    if (active && l) {
      poseHumanCombat(this.mesh, false);
      l.armR.rotation.set(-0.75, 0, -0.05);
      l.forearmR.rotation.set(-0.45, 0, 0);
      l.armL.rotation.set(-0.62, 0.25, 0.16);
      l.forearmL.rotation.set(-0.55, 0, 0);
    }
  }

  flashMuzzle(duration = 0.08) {
    this.muzzleTimer = duration;
    if (this.mesh.userData.muzzleFlash) this.mesh.userData.muzzleFlash.visible = true;
  }

  setCombatPose(aiming) {
    this.aiming = aiming;
    if (!this.fishing) {
      poseHumanCombat(this.mesh, aiming);
    }
  }

  getMuzzleWorldPos() {
    this.mesh.updateMatrixWorld(true);
    const mf = this.mesh.userData.muzzleFlash;
    if (mf) {
      const out = new THREE.Vector3();
      mf.getWorldPosition(out);
      return out;
    }
    return this.pos.clone().add(new THREE.Vector3(0, 1.38, 0));
  }

  applyVehicleImpact(dirX, dirZ, speed) {
    const force = Math.min(18, Math.max(5.5, speed * 0.72));
    this.knockVel.set(dirX * force, 0, dirZ * force);
    this.vy = Math.min(7.5, 3.2 + speed * 0.14);
    this.grounded = false;
    this.knockdownTimer = Math.max(this.knockdownTimer, 1.35);
    this.flinchTimer = 0.35;
  }

  applyBulletFlinch() {
    this.flinchTimer = Math.max(this.flinchTimer, 0.24);
  }

  updateOnFoot(input, dt, elapsed, cameraYaw, state, audio) {
    if (this.fishing) {
      const bob = this.mesh.userData.bobber;
      if (bob) bob.position.y = -2.6 + Math.sin(elapsed * 4.5) * 0.07;
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.yaw;
      return;
    }

    if (this.flinchTimer > 0) this.flinchTimer = Math.max(0, this.flinchTimer - dt);

    // Handle car-hit tumble/knockdown & smooth get-up recovery
    if (this.knockdownTimer > 0) {
      this.knockdownTimer = Math.max(0, this.knockdownTimer - dt);
      this.knockVel.multiplyScalar(Math.pow(0.08, dt));
      if (this.collisionWorld) {
        this.collisionWorld.moveAndSlide(this.pos, this.knockVel, 0.62, dt, { bounce: 0.1 });
      } else {
        this.pos.x += this.knockVel.x * dt;
        this.pos.z += this.knockVel.z * dt;
      }
      if (!this.grounded) {
        this.vy -= WORLD.gravity * dt;
        this.pos.y += this.vy * dt;
        if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }
      }
      const getUpFrac = this.knockdownTimer < 0.45 ? this.knockdownTimer / 0.45 : 1.0;
      this.mesh.position.set(this.pos.x, this.pos.y + 0.18 * getUpFrac, this.pos.z);
      this.mesh.rotation.y = this.yaw;
      this.mesh.rotation.x = (-Math.PI * 0.48) * getUpFrac;
      return;
    }
    this.mesh.rotation.x = 0;

    const { forward, right } = input.getMoveAxes();
    const wantsMove = forward !== 0 || right !== 0;
    const wantsSprint = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && wantsMove;

    // Stamina & Exhaustion ("ngos-ngosan") system
    let sprinting = false;
    if (state) {
      if (state.exhausted) {
        state.exhaustTimer = Math.max(0, state.exhaustTimer - dt);
        state.stamina = Math.min(state.maxStamina, state.stamina + dt * 10.5);
        this.pantCooldown -= dt;
        if (this.pantCooldown <= 0) {
          this.pantCooldown = 0.88;
          if (audio) audio.playPantBreath();
        }
        if (state.exhaustTimer <= 0 && state.stamina >= 30) {
          state.exhausted = false;
        }
      } else if (wantsSprint && state.stamina > 0) {
        sprinting = true;
        state.stamina = Math.max(0, state.stamina - dt * 18.0);
        if (state.stamina <= 0) {
          state.exhausted = true;
          state.exhaustTimer = 3.5;
          this.pantCooldown = 0.05;
        }
      } else {
        const recRate = wantsMove ? 11.5 : 19.0;
        state.stamina = Math.min(state.maxStamina, state.stamina + dt * recRate);
      }
    } else {
      sprinting = wantsSprint;
    }

    // Natural physical water boundary (shallow surf slows; deep water smoothly swims & pushes back toward shore)
    const waterDepth = this.collisionWorld ? this.collisionWorld.getWaterDepth(this.pos.x, this.pos.z) : 0;
    const inDeepWater = waterDepth >= 1.05;
    const inShallowWater = waterDepth > 0.05 && !inDeepWater;

    // Realistic human speeds: walk 2.0 m/s, sprint 5.6 m/s, exhausted 1.35 m/s
    let speed = state?.exhausted ? 1.35 : sprinting ? 5.6 : 2.0;
    if (inShallowWater) speed *= 0.56;
    else if (inDeepWater) speed = 1.9;

    const moveYaw = cameraYaw ?? this.yaw;
    let mx = 0;
    let mz = 0;
    if (wantsMove) {
      const fwdX = Math.sin(moveYaw);
      const fwdZ = Math.cos(moveYaw);
      const rtX = -Math.cos(moveYaw);
      const rtZ = Math.sin(moveYaw);
      mx = fwdX * forward + rtX * right;
      mz = fwdZ * forward + rtZ * right;
      const len = Math.hypot(mx, mz) || 1;
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;
      if (!input.rightMouseDown && !input.mouseDown) {
        this.yaw = Math.atan2(mx, mz);
      }
    }

    // Smooth coastal return current if swimming too far out into deep ocean
    if (inDeepWater && this.collisionWorld) {
      const ret = this.collisionWorld.getShoreReturnVector(this.pos.x, this.pos.z);
      const push = Math.min(3.4, (waterDepth - 0.9) * 2.2);
      mx += ret.x * push;
      mz += ret.z * push;
    }

    // Aiming faces camera yaw smoothly
    if (input.mouseDown || input.rightMouseDown || (state?.reloadTimer > 0)) {
      this.yaw = moveYaw;
    }

    this.vel.set(mx, 0, mz);
    if (this.collisionWorld) {
      this.collisionWorld.moveAndSlide(this.pos, this.vel, 0.62, dt, { bounce: 0 });
    } else {
      this.pos.x += mx * dt;
      this.pos.z += mz * dt;
    }

    if (this.grounded && !inDeepWater && input.consumePress('Space')) {
      this.vy = 9.2;
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

    // Sink subtly when wading/swimming in water
    const waterSink = inDeepWater ? -0.68 : inShallowWater ? -waterDepth * 0.35 : 0;
    this.mesh.position.set(this.pos.x, this.pos.y + waterSink, this.pos.z);
    this.mesh.rotation.y = this.yaw;

    const actualSpd = Math.hypot(mx, mz);
    const moving = actualSpd > 0.25;
    if (moving) {
      this.stridePhase += dt * (sprinting ? 13.0 : state?.exhausted ? 4.8 : 6.4);
    }

    // Distinct Pose Priority: Deep Water Swim -> Exhausted -> Sprint -> Walk -> Idle -> Combat/Reload -> Flinch
    if (inDeepWater) {
      poseHumanSwim(this.mesh, elapsed);
    } else if (state?.exhausted) {
      poseHumanExhausted(this.mesh, elapsed, moving, this.stridePhase);
    } else if (sprinting && moving) {
      poseHumanSprint(this.mesh, this.stridePhase);
    } else if (moving) {
      poseHumanStride(this.mesh, this.stridePhase, false);
    } else {
      poseHumanStride(this.mesh, 0, false);
    }

    // Reload 3D arm animation overrides upper-body arms cleanly
    if (state && state.reloadTimer > 0 && state.reloadDuration > 0) {
      const prog = 1 - state.reloadTimer / state.reloadDuration;
      poseHumanReload(this.mesh, prog);
    } else if (!inDeepWater && (input.mouseDown || input.rightMouseDown || this.muzzleTimer > 0)) {
      this.setCombatPose(true);
    } else {
      this.aiming = false;
    }

    if (this.flinchTimer > 0) {
      poseHumanFlinch(this.mesh, this.flinchTimer / 0.24);
    }

    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0 && this.mesh.userData.muzzleFlash) {
        this.mesh.userData.muzzleFlash.visible = false;
      }
    }
  }
}
