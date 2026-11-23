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
  if (typeKey === 'speedboat' || spec.isBoat) {
    return buildSpeedboat(g, bodyColor, spec.accent);
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
  let noseMesh = null;
  if (!spec.isSwat) {
    const noseL = isSuper ? L * 0.34 : L * 0.26;
    noseMesh = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, chassisH * 0.72, noseL), paintMat);
    noseMesh.position.set(0, 0.46 + chassisH * 0.44, L * 0.34);
    noseMesh.rotation.x = isSuper ? 0.24 : 0.14;
    noseMesh.castShadow = true;
    g.add(noseMesh);

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

  // Cabin / greenhouse with raked windshield and fastback rear (or open-top roadster for convertibles)
  const cabW = W * (spec.isSwat ? 0.94 : isSuper ? 0.78 : 0.82);
  const cabH = spec.isSwat ? H * 0.42 : isSuper ? H * 0.36 : H * 0.42;
  const cabL = spec.isSwat ? L * 0.78 : isSuper ? L * 0.38 : L * 0.44;
  const cabZ = spec.isSwat ? -0.15 : isSuper ? -0.22 : -0.24;
  const cabY = 0.44 + chassisH + cabH / 2 - 0.06;

  if (spec.isConvertible) {
    // Open-top roadster interior tub, twin bucket seats & raked windshield
    const tub = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.96, 0.22, cabL * 1.15), darkMat);
    tub.position.set(0, 0.44 + chassisH + 0.02, cabZ);
    g.add(tub);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xf4e3c8, roughness: 0.72 });
    for (const sx of [-0.4, 0.4]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.42), seatMat);
      seat.position.set(sx, 0.44 + chassisH + 0.24, cabZ - 0.18);
      g.add(seat);
    }
    const windF = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.94, cabH * 1.05, 0.12), glassMat);
    windF.position.set(0, cabY - 0.04, cabZ + cabL / 2 + 0.22);
    windF.rotation.x = -0.68;
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.96, 0.07, 0.14), chromeMat);
    frameTop.position.set(0, cabY + cabH * 0.32, cabZ + cabL / 2 + 0.02);
    g.add(windF, frameTop);
  } else {
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
  }

  // Hero Dorado Apex GT bespoke trim: twin racing stripes, switchable spoilers (Stock / Ducktail / GT Wing), neon underglow & nitro flames
  let nitroFlames = null;
  let spoilerGt = null;
  let spoilerDucktail = null;
  let underglowGroup = null;
  let underglowMat = null;
  if (isSuper) {
    for (const sx of [-0.24, 0.24]) {
      const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, L * 0.34), accentMat);
      stripeHood.position.set(sx, 0.46 + chassisH * 0.82, L * 0.33);
      stripeHood.rotation.x = 0.24;
      const stripeRoof = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, cabL * 0.96), accentMat);
      stripeRoof.position.set(sx, cabY + cabH * 0.47, cabZ);
      g.add(stripeHood, stripeRoof);
    }

    // Option A: Carbon GT rear wing + endplates
    spoilerGt = new THREE.Group();
    const wingY = 0.44 + chassisH + 0.44;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 1.04, 0.09, 0.44), darkMat);
    wing.position.set(0, wingY, -L * 0.46);
    wing.rotation.x = 0.1;
    spoilerGt.add(wing);
    for (const sx of [-W * 0.52, W * 0.52]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.5), paintMat);
      endplate.position.set(sx, wingY - 0.02, -L * 0.46);
      spoilerGt.add(endplate);
    }
    for (const sx of [-0.66, 0.66]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.46, 0.22), darkMat);
      strut.position.set(sx, 0.44 + chassisH + 0.2, -L * 0.44);
      spoilerGt.add(strut);
    }
    g.add(spoilerGt);

    // Option B: Sculpted Ducktail Lip Spoiler
    spoilerDucktail = new THREE.Group();
    const duck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.16, 0.34), paintMat);
    duck.position.set(0, 0.44 + chassisH + 0.09, -L * 0.46);
    duck.rotation.x = 0.36;
    spoilerDucktail.add(duck);
    spoilerDucktail.visible = false;
    g.add(spoilerDucktail);

    // Neon Underglow Kit (chassis light tubes + additive road glow halo)
    underglowGroup = new THREE.Group();
    underglowMat = new THREE.MeshBasicMaterial({
      color: 0x34e0c8, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.48, L * 1.24), underglowMat);
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.y = 0.13;
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x34e0c8 });
    for (const sx of [-W * 0.48, W * 0.48]) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, L * 0.78), stripMat);
      tube.position.set(sx, 0.24, 0);
      underglowGroup.add(tube);
    }
    underglowGroup.add(glowPlane);
    underglowGroup.userData.stripMat = stripMat;
    underglowGroup.visible = false;
    g.add(underglowGroup);

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

  // Crisp focused LED Headlights + Tight Additive Flare Sprites & Full-Width Taillight Bar
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff8de });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2442 });
  const headlightParts = [];
  for (const sx of [-W * 0.35, W * 0.35]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(isSuper ? 0.54 : 0.44, 0.15, 0.12), headMat);
    hl.position.set(sx, isSuper ? 0.64 : 0.72, L / 2 + 0.06);
    const hlFlare = makeFlareSprite('#ffffff', 'rgba(255,226,158,0.72)', isSuper ? 1.15 : 0.82, isSuper ? 0.78 : 0.52);
    hlFlare.position.set(sx, isSuper ? 0.65 : 0.73, L / 2 + 0.2);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.12), tailMat);
    tl.position.set(sx, 0.74, -L / 2 - 0.06);
    g.add(hl, hlFlare, tl);
    headlightParts.push(hlFlare);
  }
  if (isSuper) {
    const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, 0.08, 0.1), tailMat);
    tailStrip.position.set(0, 0.74, -L / 2 - 0.07);
    g.add(tailStrip);
  }

  // Tight focused additive headlight beams (sharp pools without flooding the entire lane)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffebba, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const sx of [-W * 0.34, W * 0.34]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.52, 3.6, 10, 1, true), beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(sx, 0.48, L / 2 + 1.85);
    g.add(beam);
    headlightParts.push(beam);
  }

  // Taxi Roof Beacon & Checkered Side Accent for Cala Cab
  if (spec.isTaxi) {
    const barY = cabY + cabH * 0.5 + 0.12;
    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.28, 0.36),
      new THREE.MeshBasicMaterial({ color: 0xffe46b })
    );
    taxiSign.position.set(0, barY, cabZ + 0.05);
    const taxiCap = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.38), darkMat);
    taxiCap.position.set(0, barY - 0.14, cabZ + 0.05);
    g.add(taxiSign, taxiCap);
    // Iconic black/white checkered side stripes
    for (let k = -4; k <= 4; k++) {
      const sq = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.05, 0.12, 0.24),
        k % 2 === 0 ? darkMat : chromeMat
      );
      sq.position.set(0, 0.68, k * 0.32);
      g.add(sq);
    }
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

    // Tight crisp additive lens flare halos for police lightbars (sharp without flooding adjacent lanes)
    const redGlow = makeFlareSprite('#fff0f3', 'rgba(255,34,68,0.84)', 2.05, 0.84);
    redGlow.position.copy(redDom.position).add(new THREE.Vector3(0, 0.08, 0));
    const blueGlow = makeFlareSprite('#e8f6ff', 'rgba(42,154,255,0.84)', 2.05, 0.84);
    blueGlow.position.copy(blueDom.position).add(new THREE.Vector3(0, 0.08, 0));

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

  // Hood engine fire group (erupts when condition reaches 0% during 5-second humane bail-out countdown!)
  const hoodFireGroup = new THREE.Group();
  hoodFireGroup.position.set(0, 0.95, L * 0.33);
  const f1 = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.68, 1),
    new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.92 })
  );
  const f2 = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.48, 1),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 })
  );
  f2.position.set(0.18, 0.45, -0.1);
  const f3 = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.55, 1),
    new THREE.MeshBasicMaterial({ color: 0xff8c1a, transparent: true, opacity: 0.88 })
  );
  f3.position.set(-0.22, 0.65, 0.12);
  const fireGlow = makeFlareSprite('#fffbe0', 'rgba(255,112,24,0.88)', 4.2, 0.9);
  fireGlow.position.set(0, 0.55, 0);
  const hoodFireLight = new THREE.PointLight(0xff7420, 22, 16, 2.0);
  hoodFireLight.position.set(0, 1.1, 0);
  hoodFireGroup.add(f1, f2, f3, fireGlow, hoodFireLight);
  hoodFireGroup.visible = false;
  g.add(hoodFireGroup);

  g.userData = {
    typeKey, spec, wheels, lightbar, paintMat, rimMat, nitroFlames,
    headMat, headlightParts,
    spoilerGt, spoilerDucktail, underglowGroup, underglowMat,
    chassis, noseMesh, bumperF, bumperR,
    baseNoseRotX: noseMesh ? noseMesh.rotation.x : 0,
    baseNoseY: noseMesh ? noseMesh.position.y : 0,
    baseColorHex: bodyColor,
    hoodFireGroup, hoodFireParts: [f1, f2, f3], hoodFireLight,
  };
  return g;
}

export function setVehicleHeadlights(vehicle, on) {
  const ud = vehicle?.mesh?.userData;
  if (!ud) return;
  if (ud.headlightParts) {
    for (const part of ud.headlightParts) part.visible = Boolean(on);
  }
  if (ud.headMat) {
    ud.headMat.color.setHex(on ? 0xfff8de : 0x3b4252);
  }
}

export function updateVehicleDamageVisuals(v, elapsed) {
  const ud = v?.mesh?.userData;
  if (!ud) return;
  const cond = Math.max(0, Math.min(1, v.hp / Math.max(1, v.maxHp)));
  const dmg = 1 - cond;

  // Gradual visible hood & bumper deformation as damage increases
  if (ud.noseMesh) {
    if (dmg > 0.25) {
      const dent = (dmg - 0.25) / 0.75;
      ud.noseMesh.rotation.x = ud.baseNoseRotX - dent * 0.22;
      ud.noseMesh.position.y = ud.baseNoseY + dent * 0.12;
      ud.noseMesh.rotation.z = dent * 0.06;
    } else {
      ud.noseMesh.rotation.x = ud.baseNoseRotX;
      ud.noseMesh.position.y = ud.baseNoseY;
      ud.noseMesh.rotation.z = 0;
    }
  }
  if (ud.bumperF) {
    ud.bumperF.rotation.z = dmg > 0.35 ? (dmg - 0.35) * 0.16 : 0;
  }
  if (ud.bumperR) {
    ud.bumperR.rotation.z = dmg > 0.5 ? -(dmg - 0.5) * 0.14 : 0;
  }

  // Flickering hood flames during burning countdown
  if (ud.hoodFireGroup) {
    const showFire = Boolean(v.burning && !v.exploded);
    ud.hoodFireGroup.visible = showFire;
    if (showFire) {
      ud.hoodFireParts.forEach((p, idx) => {
        const sc = 0.85 + Math.sin(elapsed * 16 + idx * 2.1) * 0.24;
        p.scale.set(sc, sc * 1.28, sc);
        p.rotation.y = elapsed * (2.5 + idx);
      });
      if (ud.hoodFireLight) ud.hoodFireLight.intensity = 20 + Math.sin(elapsed * 22) * 6;
    }
  }

  // Blackened scorched hull after detonation
  if (v.exploded && ud.paintMat) {
    ud.paintMat.color.setHex(0x1b1c20);
    ud.paintMat.roughness = 0.92;
    ud.paintMat.metalness = 0.12;
  }
}

// Live 3D vehicle customization updater (paint, metallic/matte finish, spoiler, neon underglow, rims, armor)
export function applyVehicleMods(vehicle, mods) {
  if (!vehicle?.mesh?.userData || !mods) return;
  const ud = vehicle.mesh.userData;
  if (ud.paintMat && mods.paint) {
    ud.paintMat.color.set(mods.paint);
    if (mods.finish === 'matte') {
      ud.paintMat.roughness = 0.72;
      ud.paintMat.metalness = 0.14;
    } else {
      ud.paintMat.roughness = 0.18;
      ud.paintMat.metalness = 0.72;
    }
  }
  if (ud.rimMat && mods.rims) {
    ud.rimMat.color.set(mods.rims);
  }
  if (ud.spoilerGt) ud.spoilerGt.visible = mods.spoiler === 'gt';
  if (ud.spoilerDucktail) ud.spoilerDucktail.visible = mods.spoiler === 'ducktail';
  if (ud.underglowGroup) {
    const active = Boolean(mods.underglow && mods.underglow !== 'off');
    ud.underglowGroup.visible = active;
    if (active) {
      ud.underglowMat.color.set(mods.underglow);
      ud.underglowGroup.userData.stripMat.color.set(mods.underglow);
    }
  }
  const armorLvl = mods.armorLevel ?? 1;
  const newMaxHp = Math.round(vehicle.spec.maxHp * (1 + (armorLvl - 1) * 0.25));
  if (vehicle.maxHp !== newMaxHp) {
    vehicle.maxHp = newMaxHp;
    vehicle.hp = Math.min(vehicle.maxHp, Math.max(vehicle.hp, newMaxHp));
  }
  vehicle.turboLevel = mods.turboLevel ?? 1;
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
  g.userData = { typeKey: 'scooter', spec: VEHICLES.scooter, wheels, lightbar: null, paintMat: paint, headlightParts: [] };
  return g;
}

function buildSpeedboat(g, bodyColor, accentColor) {
  const hullMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.22, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor ?? 0x1ec8b8, roughness: 0.28, metalness: 0.45 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xc2935e, roughness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x171d28, roughness: 0.55, metalness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a4864, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.85 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe6eef8, roughness: 0.16, metalness: 0.92 });

  // Main sleek V-hull & tapered pointed bow
  const hullMain = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.82, 4.4), hullMat);
  hullMain.position.set(0, 0.38, -0.5);
  hullMain.castShadow = true;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.5, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1.04, 1.0, 0.38);
  bow.position.set(0, 0.42, 2.85);
  bow.castShadow = true;
  // Teal racing side stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.18, 4.35), accentMat);
  stripe.position.set(0, 0.56, -0.45);
  // Marine teak foredeck & cockpit floor
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 3.9), deckMat);
  deck.position.set(0, 0.78, -0.4);
  // Wraparound tinted sport windshield
  const windF = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.52, 0.1), glassMat);
  windF.position.set(0, 1.05, 0.82);
  windF.rotation.x = -0.52;
  for (const sx of [-0.94, 0.94]) {
    const windS = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.95), glassMat);
    windS.position.set(sx, 1.0, 0.36);
    g.add(windS);
  }
  // Twin leather marine bucket seats + steering console
  const seatMat = new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.65 });
  for (const sx of [-0.46, 0.46]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.52, 0.52), seatMat);
    seat.position.set(sx, 0.98, -0.45);
    g.add(seat);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.46, 0.62), seatMat);
  bench.position.set(0, 0.96, -1.65);
  const consoleM = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.36, 0.52), darkMat);
  consoleM.position.set(0, 0.96, 0.45);
  // Twin outboard engine cowling at stern
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.88, 0.72), darkMat);
  motor.position.set(0, 0.68, -2.95);
  const motorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.65), accentMat);
  motorTrim.position.set(0, 0.98, -2.95);
  // Bow headlight & red/green port-starboard nav lights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff8de });
  const bowLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), headMat);
  bowLight.position.set(0, 0.82, 2.25);
  const bowFlare = makeFlareSprite('#ffffff', 'rgba(255,235,175,0.75)', 1.2, 0.8);
  bowFlare.position.set(0, 0.85, 2.45);
  const portL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3b5c }));
  portL.position.set(-1.12, 0.82, 0.85);
  const stbdL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0x42e38c }));
  stbdL.position.set(1.12, 0.82, 0.85);
  // Chrome bow rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), chromeMat);
  rail.position.set(0, 1.0, 1.85);

  g.add(hullMain, bow, stripe, deck, windF, bench, consoleM, motor, motorTrim, bowLight, bowFlare, portL, stbdL, rail);
  g.userData = {
    typeKey: 'speedboat',
    spec: VEHICLES.speedboat,
    wheels: [],
    lightbar: null,
    paintMat: hullMat,
    headMat,
    headlightParts: [bowFlare],
    baseColorHex: bodyColor,
  };
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

  // Focused additive fireball bloom halos (dramatic yet contained to wreck zone)
  const bloomBig = makeFlareSprite('#fffbe0', 'rgba(255,112,24,0.86)', 9.6, 0.88);
  bloomBig.position.set(0.2, 2.8, 0.2);
  const bloomCore = makeFlareSprite('#ffffff', 'rgba(255,226,102,0.92)', 5.6, 0.95);
  bloomCore.position.set(0.0, 2.4, 0.4);
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

  // Localized orange fire illumination on the bridge deck & nearby cars
  const fireLight = new THREE.PointLight(0xff7722, 34, 22, 2.0);
  fireLight.position.set(0, 3.4, 0);
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
    const bsc = 9.4 + Math.sin(elapsed * 14) * 1.1;
    bloomBig.scale.set(bsc, bsc, 1);
  }
  if (bloomCore) {
    const csc = 5.4 + Math.cos(elapsed * 17) * 0.7;
    bloomCore.scale.set(csc, csc, 1);
  }
  smokePuffs.forEach((s, i) => {
    s.position.y = 5.4 + ((elapsed * 2.4 + i * 2.1) % 12.5);
    s.rotation.y = elapsed * 0.6 + i;
  });
  if (fireLight) fireLight.intensity = 32 + Math.sin(elapsed * 18) * 7;
}
