// Detailed multi-part 3D vehicles (supercar, coupe, SUV, scooter, CDPD cruisers, SWAT van) and burning wrecks.

import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLES } from '../core/config.js';

const glowTexCache = new Map();

export function getRadialGlowTexture(innerHex, midHex, outerRgba = 'rgba(0,0,0,0)') {
  const key = `${innerHex}|${midHex}|${outerRgba}`;
  if (glowTexCache.has(key)) return glowTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0.0, innerHex);
  grad.addColorStop(0.32, midHex);
  grad.addColorStop(1.0, outerRgba);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTexCache.set(key, tex);
  return tex;
}

function makeFlareSprite(innerHex, midHex, scale, opacity = 0.9) {
  const mat = new THREE.SpriteMaterial({
    map: getRadialGlowTexture(innerHex, midHex),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scale, scale, 1);
  return sp;
}

export function createVehicleMesh(typeKey, overrideColor = null) {
  const spec = VEHICLES[typeKey] ?? VEHICLES.apex_gt;
  const g = new THREE.Group();
  const bodyColor = overrideColor ?? spec.color;

  if (typeKey === 'scooter') {
    return buildScooter(g, bodyColor, spec.accent);
  }

  const paintMat = new THREE.MeshStandardMaterial({
    color: bodyColor, roughness: 0.2, metalness: 0.68,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accent, roughness: 0.25, metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x141922, roughness: 0.58, metalness: 0.42,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe5f2, roughness: 0.18, metalness: 0.9,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x162b42, roughness: 0.08, metalness: 0.92,
  });

  const L = spec.length;
  const W = spec.width;
  const H = spec.height;
  const isSuper = typeKey === 'apex_gt';

  // Soft ground contact shadow under chassis
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x05070c, transparent: true, opacity: 0.42, depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.12, L * 1.08), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.11;
  g.add(shadow);

  // Lower rocker skirt / diffuser base
  const skirtH = 0.22;
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, skirtH, L * 1.02), darkMat);
  skirt.position.y = 0.34;
  g.add(skirt);

  // Main sculpted lower body
  const chassisH = spec.isSwat ? H * 0.52 : isSuper ? H * 0.36 : H * 0.42;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(W, chassisH, L * (isSuper ? 0.92 : 0.98)), paintMat);
  chassis.position.set(0, 0.44 + chassisH / 2, isSuper ? -0.08 : 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  g.add(chassis);

  // Sleek sloped aerodynamic nose wedge for supercar / coupe / interceptor
  if (!spec.isSwat) {
    const noseL = isSuper ? L * 0.34 : L * 0.26;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, chassisH * 0.72, noseL), paintMat);
    nose.position.set(0, 0.46 + chassisH * 0.44, L * 0.34);
    nose.rotation.x = isSuper ? 0.24 : 0.14;
    nose.castShadow = true;
    g.add(nose);

    // Front grille intake & carbon splitter
    const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 0.2, 0.14), darkMat);
    grille.position.set(0, 0.5, L / 2 + 0.04);
    g.add(grille);

    if (isSuper) {
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(W * 1.06, 0.08, 0.45), darkMat);
      splitter.position.set(0, 0.31, L / 2 + 0.08);
      g.add(splitter);

      // Sculpted side fenders & air intakes
      for (const side of [-1, 1]) {
        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.95), darkMat);
        intake.position.set(side * (W / 2 + 0.01), 0.66, -0.25);
        g.add(intake);

        const flareF = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1.05), paintMat);
        flareF.position.set(side * (W / 2 - 0.02), 0.62, L * 0.31);
        const flareR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 1.15), paintMat);
        flareR.position.set(side * (W / 2 - 0.01), 0.66, -L * 0.31);
        g.add(flareF, flareR);
      }
    }
  }

  // Cabin / greenhouse with raked windshield and fastback rear
  const cabW = W * (spec.isSwat ? 0.94 : isSuper ? 0.78 : 0.82);
  const cabH = spec.isSwat ? H * 0.42 : isSuper ? H * 0.36 : H * 0.42;
  const cabL = spec.isSwat ? L * 0.78 : isSuper ? L * 0.38 : L * 0.44;
  const cabZ = spec.isSwat ? -0.15 : isSuper ? -0.22 : -0.24;
  const cabY = 0.44 + chassisH + cabH / 2 - 0.06;

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(cabW, cabH * 0.92, cabL),
    spec.isPolice && !spec.isSwat ? accentMat : isSuper ? paintMat : glassMat
  );
  roof.position.set(0, cabY, cabZ);
  roof.castShadow = true;
  g.add(roof);

  // Side windows wrap
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.04, cabH * 0.68, cabL * 0.92), glassMat);
  sideGlass.position.set(0, cabY - 0.02, cabZ);
  g.add(sideGlass);

  // Sloped front windshield & rear fastback glass
  const windF = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.92, cabH * 1.18, 0.14), glassMat);
  windF.position.set(0, cabY - 0.02, cabZ + cabL / 2 + 0.24);
  windF.rotation.x = isSuper ? -0.82 : spec.isSwat ? -0.22 : -0.58;
  g.add(windF);

  if (!spec.isSwat) {
    const windR = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.88, cabH * 1.25, 0.14), glassMat);
    windR.position.set(0, cabY - 0.03, cabZ - cabL / 2 - 0.26);
    windR.rotation.x = isSuper ? 0.88 : 0.6;
    g.add(windR);
  }

  // Hero Dorado Apex GT bespoke trim: twin racing stripes, GT carbon rear wing, twin exhaust & nitro flames
  let nitroFlames = null;
  if (isSuper) {
    for (const sx of [-0.24, 0.24]) {
      const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, L * 0.34), accentMat);
      stripeHood.position.set(sx, 0.46 + chassisH * 0.82, L * 0.33);
      stripeHood.rotation.x = 0.24;
      const stripeRoof = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, cabL * 0.96), accentMat);
      stripeRoof.position.set(sx, cabY + cabH * 0.47, cabZ);
      g.add(stripeHood, stripeRoof);
    }

    // Carbon GT rear wing + endplates
    const wingY = 0.44 + chassisH + 0.44;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 1.04, 0.09, 0.44), darkMat);
    wing.position.set(0, wingY, -L * 0.46);
    wing.rotation.x = 0.1;
    g.add(wing);
    for (const sx of [-W * 0.52, W * 0.52]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.5), paintMat);
      endplate.position.set(sx, wingY - 0.02, -L * 0.46);
      g.add(endplate);
    }
    for (const sx of [-0.66, 0.66]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.46, 0.22), darkMat);
      strut.position.set(sx, 0.44 + chassisH + 0.2, -L * 0.44);
      g.add(strut);
    }

    // Twin chrome exhaust pipes + glowing nitro flame cones (visible on boost / chase shot)
    nitroFlames = new THREE.Group();
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff8c2b, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0x9ef6ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (const sx of [-0.52, 0.52]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, 0.42, -L / 2 - 0.05);
      g.add(pipe);

      const coneO = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.5, 8), flameOuterMat);
      coneO.rotation.x = -Math.PI / 2;
      coneO.position.set(sx, 0.42, -L / 2 - 0.82);
      const coneC = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.95, 8), flameCoreMat);
      coneC.rotation.x = -Math.PI / 2;
      coneC.position.set(sx, 0.42, -L / 2 - 0.56);
      nitroFlames.add(coneO, coneC);
    }
    nitroFlames.visible = false;
    g.add(nitroFlames);
  }

  // Front & rear bumpers
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.26, 0.26), darkMat);
  bumperF.position.set(0, 0.44, L / 2 + 0.05);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.28, 0.26), darkMat);
  bumperR.position.set(0, 0.44, -L / 2 - 0.05);
  g.add(bumperF, bumperR);

  // Blazing LED Headlights + Additive Flare Sprites & Full-Width Taillight Bar
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff8de });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2442 });
  for (const sx of [-W * 0.35, W * 0.35]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(isSuper ? 0.54 : 0.44, 0.15, 0.12), headMat);
    hl.position.set(sx, isSuper ? 0.64 : 0.72, L / 2 + 0.06);
    const hlFlare = makeFlareSprite('#ffffff', 'rgba(255,226,158,0.85)', isSuper ? 1.85 : 1.35, isSuper ? 0.92 : 0.65);
    hlFlare.position.set(sx, isSuper ? 0.65 : 0.73, L / 2 + 0.24);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.12), tailMat);
    tl.position.set(sx, 0.74, -L / 2 - 0.06);
    g.add(hl, hlFlare, tl);
  }
  if (isSuper) {
    const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, 0.08, 0.1), tailMat);
    tailStrip.position.set(0, 0.74, -L / 2 - 0.07);
    g.add(tailStrip);
  }

  // Soft additive headlight beams on road
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffebba, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const sx of [-W * 0.34, W * 0.34]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.8, 10, 1, true), beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(sx, 0.52, L / 2 + 2.9);
    g.add(beam);
  }

  // Wheels with deep metallic rims & red brake calipers (on supercar)
  const wheels = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x13161d, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xe6edf7, metalness: 0.88, roughness: 0.2 });
  const caliperMat = new THREE.MeshBasicMaterial({ color: 0xff3b4e });
  const wR = spec.isSwat ? 0.52 : isSuper ? 0.42 : 0.4;
  const wZ = L * 0.31;
  for (const [wx, wz] of [[-W / 2 - 0.03, wZ], [W / 2 + 0.03, wZ], [-W / 2 - 0.03, -wZ], [W / 2 + 0.03, -wZ]]) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wR, wR, 0.36, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.62, wR * 0.62, 0.38, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.24, wR * 0.24, 0.4, 8), darkMat);
    hub.rotation.z = Math.PI / 2;
    wg.add(tire, rim, hub);
    if (isSuper) {
      const cal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.22), caliperMat);
      cal.position.set(wx > 0 ? 0.1 : -0.1, 0.05, 0.14);
      wg.add(cal);
    }
    wg.position.set(wx, wR, wz);
    g.add(wg);
    wheels.push(wg);
  }

  // Police Lightbar, Heavy Front Push-Bar & Additive Red/Blue Lens Flares
  let lightbar = null;
  if (spec.isPolice) {
    const barY = cabY + cabH * 0.5 + 0.08;
    const base = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.84, 0.13, 0.42), darkMat);
    base.position.set(0, barY, cabZ + 0.12);
    g.add(base);

    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2288ff });
    const redDom = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.36, 0.2, 0.38), redMat);
    redDom.position.set(-cabW * 0.21, barY + 0.12, cabZ + 0.12);
    const blueDom = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.36, 0.2, 0.38), blueMat);
    blueDom.position.set(cabW * 0.21, barY + 0.12, cabZ + 0.12);

    // Additive lens flare halos so red/blue emergency lights blaze vividly without solid bubble artifacts!
    const redGlow = makeFlareSprite('#fff0f3', 'rgba(255,34,68,0.88)', 3.6, 0.95);
    redGlow.position.copy(redDom.position).add(new THREE.Vector3(0, 0.1, 0));
    const blueGlow = makeFlareSprite('#e8f6ff', 'rgba(42,154,255,0.88)', 3.6, 0.95);
    blueGlow.position.copy(blueDom.position).add(new THREE.Vector3(0, 0.1, 0));

    g.add(redDom, blueDom, redGlow, blueGlow);
    lightbar = { redDom, blueDom, redGlow, blueGlow };

    // Front heavy steel push-bar (bullbar)
    for (const sx of [-0.52, 0.52]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.18), darkMat);
      upright.position.set(sx, 0.66, L / 2 + 0.2);
      g.add(upright);
    }
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.14), darkMat);
    crossBar.position.set(0, 0.82, L / 2 + 0.22);
    g.add(crossBar);

    // Crisp white doors + gold CDPD side stripe
    if (!spec.isSwat) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, chassisH * 0.86, L * 0.38), accentMat);
      door.position.set(0, 0.44 + chassisH / 2, -0.08);
      const badgeStripe = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.07, 0.1, L * 0.86),
        new THREE.MeshBasicMaterial({ color: 0xffc857 })
      );
      badgeStripe.position.set(0, 0.66, -0.05);
      g.add(door, badgeStripe);
    }
  }

  g.userData = { typeKey, spec, wheels, lightbar, paintMat, nitroFlames };
  return g;
}

function buildScooter(g, bodyColor, accentColor) {
  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c222d, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 1.8), paint);
  body.position.set(0, 0.52, 0);
  body.castShadow = true;
  g.add(body);

  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.25), paint);
  shield.position.set(0, 0.92, 0.72);
  shield.rotation.x = -0.18;
  g.add(shield);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.88), dark);
  seat.position.set(0, 0.85, -0.25);
  g.add(seat);

  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c2 }));
  hl.position.set(0, 1.12, 0.84);
  g.add(hl);

  const wheels = [];
  for (const wz of [0.75, -0.72]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.28, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData = { typeKey: 'scooter', spec: VEHICLES.scooter, wheels, lightbar: null, paintMat: paint };
  return g;
}

export function updatePoliceLightbar(vehicleMesh, elapsed, phaseOffset = 0) {
  const lb = vehicleMesh.userData?.lightbar;
  if (!lb) return;
  const pulse = Math.sin(elapsed * 16 + phaseOffset) > 0;
  lb.redGlow.visible = pulse;
  lb.blueGlow.visible = !pulse;
  lb.redDom.material.color.setHex(pulse ? 0xff3355 : 0x55111d);
  lb.blueDom.material.color.setHex(!pulse ? 0x33aaff : 0x112a55);
}

// Cinematic fiery exploding police wreck with blazing incandescent fireball, bloom halo, embers & billowing smoke!
export function createBurningWreck() {
  const g = new THREE.Group();
  const hull = createVehicleMesh('cdpd_interceptor', 0x181a1f);
  hull.rotation.z = 0.28;
  hull.rotation.x = -0.1;
  hull.position.y = 0.22;
  g.add(hull);

  // Additive radial fireball bloom halos so the explosion blazes with true Hollywood intensity!
  const bloomBig = makeFlareSprite('#fffbe0', 'rgba(255,112,24,0.92)', 13.5, 0.96);
  bloomBig.position.set(0.2, 3.0, 0.2);
  const bloomCore = makeFlareSprite('#ffffff', 'rgba(255,226,102,0.95)', 7.6, 1.0);
  bloomCore.position.set(0.0, 2.5, 0.4);
  g.add(bloomBig, bloomCore);

  // Layered flame lobes
  const fireCores = [];
  const fireSpecs = [
    { pos: [0, 2.0, 0.5], r: 2.4, col: 0xff5a14, op: 0.94 },
    { pos: [1.1, 2.8, -0.4], r: 2.1, col: 0xff9b1f, op: 0.92 },
    { pos: [-1.0, 2.4, 0.2], r: 1.85, col: 0xffe46b, op: 0.96 },
    { pos: [0.3, 4.1, -0.1], r: 2.35, col: 0xff6218, op: 0.85 },
    { pos: [-0.5, 3.6, 0.6], r: 1.7, col: 0xffbf38, op: 0.88 },
  ];
  for (const fs of fireSpecs) {
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(fs.r, 1),
      new THREE.MeshBasicMaterial({ color: fs.col, transparent: true, opacity: fs.op })
    );
    m.position.set(...fs.pos);
    g.add(m);
    fireCores.push(m);
  }

  // Flying bright fiery ember sparks bursting outward
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xffe07a });
  const emberGeo = new THREE.BoxGeometry(0.18, 0.18, 0.55);
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2 + 0.3;
    const rad = 2.6 + (i % 4) * 1.4;
    const h = 1.6 + (i % 5) * 1.35;
    const em = new THREE.Mesh(emberGeo, emberMat);
    em.position.set(Math.cos(ang) * rad, h, Math.sin(ang) * rad);
    em.rotation.set(ang, ang * 1.3, 0.5);
    g.add(em);
  }

  // Rising dark charcoal smoke plume (offset cleanly behind/above the bright fireball)
  const smokePuffs = [];
  for (let i = 0; i < 6; i++) {
    const sm = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.65 + i * 0.42, 1),
      new THREE.MeshStandardMaterial({
        color: i < 2 ? 0x3b2620 : 0x1e1d22,
        emissive: i < 2 ? 0x6b2208 : 0x000000,
        emissiveIntensity: i < 2 ? 0.55 : 0,
        roughness: 1,
        transparent: true,
        opacity: 0.72 - i * 0.08,
      })
    );
    sm.position.set(0.6 + i * 0.45 + Math.sin(i * 1.4) * 0.9, 5.6 + i * 2.1, -0.8 + Math.cos(i) * 0.8);
    g.add(sm);
    smokePuffs.push(sm);
  }

  // Intense orange fire illumination on the bridge deck & nearby cars
  const fireLight = new THREE.PointLight(0xff7722, 65, 42, 1.4);
  fireLight.position.set(0, 3.6, 0);
  g.add(fireLight);

  g.userData = { fireCores, smokePuffs, fireLight, bloomBig, bloomCore };
  return g;
}

export function animateBurningWreck(wreck, elapsed) {
  const { fireCores, smokePuffs, fireLight, bloomBig, bloomCore } = wreck.userData;
  if (!fireCores) return;
  fireCores.forEach((f, i) => {
    const sc = 0.9 + Math.sin(elapsed * 11 + i * 2.1) * 0.2;
    f.scale.set(sc, sc * 1.18, sc);
    f.rotation.y = elapsed * (1.8 + i * 0.4);
  });
  if (bloomBig) {
    const bsc = 13.0 + Math.sin(elapsed * 14) * 1.6;
    bloomBig.scale.set(bsc, bsc, 1);
  }
  if (bloomCore) {
    const csc = 7.4 + Math.cos(elapsed * 17) * 0.9;
    bloomCore.scale.set(csc, csc, 1);
  }
  smokePuffs.forEach((s, i) => {
    s.position.y = 5.4 + ((elapsed * 2.4 + i * 2.1) % 12.5);
    s.rotation.y = elapsed * 0.6 + i;
  });
  if (fireLight) fireLight.intensity = 60 + Math.sin(elapsed * 18) * 12;
}
