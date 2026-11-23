// Detailed multi-part 3D vehicles (supercar, coupe, SUV, scooter, CDPD cruisers, SWAT van) and burning wrecks.

import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLES } from '../core/config.js';

export function createVehicleMesh(typeKey, overrideColor = null) {
  const spec = VEHICLES[typeKey] ?? VEHICLES.apex_gt;
  const g = new THREE.Group();
  const bodyColor = overrideColor ?? spec.color;

  if (typeKey === 'scooter') {
    return buildScooter(g, bodyColor, spec.accent);
  }

  const paintMat = new THREE.MeshStandardMaterial({
    color: bodyColor, roughness: 0.24, metalness: 0.62,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accent, roughness: 0.28, metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x161b24, roughness: 0.65, metalness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1b2f45, roughness: 0.12, metalness: 0.85,
  });

  const L = spec.length;
  const W = spec.width;
  const H = spec.height;

  // Lower chassis body
  const chassisH = spec.isSwat ? H * 0.55 : H * 0.45;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(W, chassisH, L), paintMat);
  chassis.position.y = 0.42 + chassisH / 2;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  g.add(chassis);

  // Sporty sloped nose hood for supercar/coupe/interceptor
  if (!spec.isSwat) {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.24, L * 0.34), paintMat);
    hood.position.set(0, 0.42 + chassisH + 0.04, L * 0.28);
    hood.rotation.x = 0.14;
    g.add(hood);
  }

  // Cabin / greenhouse
  const cabW = W * (spec.isSwat ? 0.94 : 0.82);
  const cabH = spec.isSwat ? H * 0.42 : H * 0.44;
  const cabL = spec.isSwat ? L * 0.78 : L * 0.46;
  const cabZ = spec.isSwat ? -0.15 : -0.25;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabL), spec.isPolice ? accentMat : glassMat);
  cabin.position.set(0, 0.42 + chassisH + cabH / 2 - 0.05, cabZ);
  cabin.castShadow = true;
  g.add(cabin);

  // Windshield & rear glass panels
  const wind = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.92, cabH * 0.78, cabL + 0.08), glassMat);
  wind.position.set(0, 0.42 + chassisH + cabH / 2 - 0.04, cabZ);
  g.add(wind);

  // Racing stripes & spoiler on Dorado Apex GT
  if (typeKey === 'apex_gt') {
    for (const sx of [-0.26, 0.26]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, L * 0.92), accentMat);
      stripe.position.set(sx, 0.42 + chassisH + 0.12, 0.05);
      g.add(stripe);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.1, 0.46), darkMat);
    wing.position.set(0, 0.42 + chassisH + 0.48, -L * 0.44);
    g.add(wing);
    for (const sx of [-0.72, 0.72]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.24), darkMat);
      strut.position.set(sx, 0.42 + chassisH + 0.22, -L * 0.42);
      g.add(strut);
    }
  }

  // Front & rear bumpers
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.28, 0.28), darkMat);
  bumperF.position.set(0, 0.48, L / 2 + 0.05);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.3, 0.26), darkMat);
  bumperR.position.set(0, 0.48, -L / 2 - 0.05);
  g.add(bumperF, bumperR);

  // Glowing Headlights & Taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4cf });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2b3d });
  for (const sx of [-W * 0.34, W * 0.34]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.12), headMat);
    hl.position.set(sx, 0.72, L / 2 + 0.06);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.12), tailMat);
    tl.position.set(sx, 0.76, -L / 2 - 0.06);
    g.add(hl, tl);
  }

  // Soft headlight beam cones on ground for dramatic sunset/night visibility
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9b3, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide,
  });
  for (const sx of [-W * 0.34, W * 0.34]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.2, 10, 1, true), beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(sx, 0.56, L / 2 + 2.6);
    g.add(beam);
  }

  // Wheels with rims
  const wheels = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd9e1ec, metalness: 0.8, roughness: 0.25 });
  const wR = spec.isSwat ? 0.52 : 0.4;
  const wZ = L * 0.31;
  for (const [wx, wz] of [[-W / 2 - 0.04, wZ], [W / 2 + 0.04, wZ], [-W / 2 - 0.04, -wZ], [W / 2 + 0.04, -wZ]]) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wR, wR, 0.32, 14), tireMat);
    tire.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wR * 0.58, wR * 0.58, 0.35, 10), rimMat);
    rim.rotation.z = Math.PI / 2;
    wg.add(tire, rim);
    wg.position.set(wx, wR, wz);
    g.add(wg);
    wheels.push(wg);
  }

  // Police Lightbar, Push Bar & Flashing Halos
  let lightbar = null;
  if (spec.isPolice) {
    const barY = 0.42 + chassisH + cabH + 0.08;
    const base = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.78, 0.14, 0.42), darkMat);
    base.position.set(0, barY, cabZ + 0.15);
    g.add(base);

    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2288ff });
    const redDom = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.32, 0.2, 0.38), redMat);
    redDom.position.set(-cabW * 0.2, barY + 0.12, cabZ + 0.15);
    const blueDom = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.32, 0.2, 0.38), blueMat);
    blueDom.position.set(cabW * 0.2, barY + 0.12, cabZ + 0.15);

    const redGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2b4f, transparent: true, opacity: 0.48, depthWrite: false })
    );
    redGlow.position.copy(redDom.position);
    const blueGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.48, depthWrite: false })
    );
    blueGlow.position.copy(blueDom.position);

    g.add(redDom, blueDom, redGlow, blueGlow);
    lightbar = { redDom, blueDom, redGlow, blueGlow };

    // White side door stripe for CDPD Interceptor
    if (!spec.isSwat) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, chassisH * 0.8, L * 0.38), accentMat);
      door.position.set(0, 0.42 + chassisH / 2, -0.1);
      g.add(door);
    }
  }

  g.userData = { typeKey, spec, wheels, lightbar, paintMat };
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

// Fiery burning & exploding police wreck diorama piece (also triggered when vehicles explode in gameplay)
export function createBurningWreck() {
  const g = new THREE.Group();
  const hull = createVehicleMesh('cdpd_interceptor', 0x1b1d22);
  hull.rotation.z = 0.22;
  hull.rotation.x = -0.08;
  hull.position.y = 0.15;
  g.add(hull);

  const fireCores = [];
  const fireSpecs = [
    { pos: [0, 1.8, 0.6], r: 2.3, col: 0xff5a1f, op: 0.92 },
    { pos: [0.9, 2.5, -0.4], r: 1.9, col: 0xffa629, op: 0.88 },
    { pos: [-0.8, 2.2, 0.2], r: 1.65, col: 0xffe066, op: 0.95 },
    { pos: [0.2, 3.6, 0.0], r: 2.1, col: 0xff6e24, op: 0.72 },
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

  // Rising dark smoke column
  const smokePuffs = [];
  for (let i = 0; i < 6; i++) {
    const sm = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.7 + i * 0.45, 1),
      new THREE.MeshStandardMaterial({ color: 0x222024, roughness: 1, transparent: true, opacity: 0.78 - i * 0.09 })
    );
    sm.position.set(Math.sin(i * 1.4) * 1.1, 4.4 + i * 2.1, Math.cos(i) * 0.9);
    g.add(sm);
    smokePuffs.push(sm);
  }

  // Fiery orange glow light on road
  const fireLight = new THREE.PointLight(0xff7722, 42, 34, 1.5);
  fireLight.position.set(0, 3.2, 0);
  g.add(fireLight);

  g.userData = { fireCores, smokePuffs, fireLight };
  return g;
}

export function animateBurningWreck(wreck, elapsed) {
  const { fireCores, smokePuffs, fireLight } = wreck.userData;
  if (!fireCores) return;
  fireCores.forEach((f, i) => {
    const sc = 0.88 + Math.sin(elapsed * 11 + i * 2.1) * 0.22;
    f.scale.set(sc, sc * 1.15, sc);
    f.rotation.y = elapsed * (1.8 + i * 0.4);
  });
  smokePuffs.forEach((s, i) => {
    s.position.y = 4.2 + ((elapsed * 2.4 + i * 2.1) % 12.5);
    s.rotation.y = elapsed * 0.6 + i;
  });
  if (fireLight) fireLight.intensity = 38 + Math.sin(elapsed * 18) * 9;
}
