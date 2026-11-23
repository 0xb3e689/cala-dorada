// 3D open-world city builder: roads, Art-Deco hotels, skyline, Puente del Sol bridge, Mercado Nocturno lanterns, beach & ocean.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../core/config.js';
import { ROAD_X, ROAD_Z, STUNT_RAMPS, GOLDEN_SHELLS, SHOPS } from './cityPlan.js';
import { createSignTexture } from './textures.js';

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildCalaDoradaCity(scene, textures) {
  const rand = seededRand(202607);
  const root = new THREE.Group();
  root.name = 'CalaDoradaWorld';
  const colliders = []; // { minX, maxX, minZ, maxZ, height }
  const animated = { ocean: null, palms: [], shells: [], lanterns: [] };

  // 1. Base City Terrain & Terraced Plaza Slab
  const groundMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.88, metalness: 0.04 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1180, 920), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -90);
  ground.receiveShadow = true;
  root.add(ground);

  // Golden Beach Sand Strip along South Coast (Paseo Dorado + Bahia Esmeralda)
  const sandMat = new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.92, metalness: 0.02 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1260, 56), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.05, 250);
  beach.receiveShadow = true;
  root.add(beach);

  // Wooden Boardwalk along Paseo Dorado beachfront
  const boardwalkMat = new THREE.MeshStandardMaterial({ color: 0xa8764c, roughness: 0.82 });
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(820, 0.28, 7.5), boardwalkMat);
  boardwalk.position.set(-20, 0.14, 224);
  boardwalk.receiveShadow = true;
  root.add(boardwalk);

  // 2. Turquoise Ocean with Golden Specular Shimmer + Shoreline Foam (vividly visible from Paseo Dorado!)
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.water,
    color: 0x1ba8bd,
    roughness: 0.18,
    metalness: 0.42,
    emissive: 0x0b3a4a,
    emissiveIntensity: 0.42,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1200), waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, 872);
  root.add(ocean);
  animated.ocean = ocean;

  // Marina Channel (cutout visual bay water under Puente del Sol)
  const bayWater = new THREE.Mesh(new THREE.PlaneGeometry(148, 220), waterMat);
  bayWater.rotation.x = -Math.PI / 2;
  bayWater.position.set(110, 0.03, 240);
  root.add(bayWater);

  // Shoreline Foam Ribbon
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xecfdff, transparent: true, opacity: 0.72 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1240, 5.5), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.07, 276);
  root.add(foam);

  // 3. Road Grid & Crosswalks
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.62, metalness: 0.12 });
  const roadW = WORLD.roadWidth;

  for (const rx of ROAD_X) {
    const len = 590;
    const mat = roadMat.clone();
    mat.map = textures.road.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(1, len / 26);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(roadW, len), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(rx, 0.08, -70);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  for (const rz of ROAD_Z) {
    const len = 760;
    const mat = roadMat.clone();
    mat.map = textures.road.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(1, len / 26);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(roadW, len), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(10, 0.09, rz);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // Intersection crosswalks
  const cwMat = new THREE.MeshStandardMaterial({ map: textures.crosswalk, roughness: 0.65 });
  for (const rx of ROAD_X) {
    for (const rz of ROAD_Z) {
      const box = new THREE.Mesh(new THREE.PlaneGeometry(roadW + 1, roadW + 1), cwMat);
      box.rotation.x = -Math.PI / 2;
      box.position.set(rx, 0.105, rz);
      root.add(box);
    }
  }

  // 4. Iconic Red-and-Gold Cable-Stayed Bridge: PUENTE DEL SOL (along Paseo Dorado z = 200, x = 40..180)
  buildPuenteDelSol(root, 110, 200);

  // 5. Named Hero Architecture & Custom Signage
  const addBuilding = (x, z, w, d, h, facadeTex, roofColor, signSpec = null) => {
    const bGroup = new THREE.Group();
    const matSide = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.55, metalness: 0.14 });
    const matRoof = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.72 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [matSide, matSide, matRoof, matRoof, matSide, matSide]);
    body.position.set(x, h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    bGroup.add(body);

    // Art-Deco crown parapet
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.1, 1.3, d + 1.1),
      new THREE.MeshStandardMaterial({ color: 0xffe4bd, roughness: 0.45, metalness: 0.2 })
    );
    crown.position.set(x, h + 0.55, z);
    bGroup.add(crown);

    if (signSpec) {
      const sTex = createSignTexture(signSpec.text, signSpec.bg, signSpec.fg, signSpec.accent);
      const sMat = new THREE.MeshBasicMaterial({ map: sTex });
      const signW = Math.min(w * 0.92, signSpec.width ?? 22);
      const signH = signSpec.height ?? 5.4;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.9), sMat);
      const faceZ = signSpec.southFace ? z + d / 2 + 0.6 : z - d / 2 - 0.6;
      const signY = signSpec.rooftop ? h + signH / 2 + 1.6 : Math.min(h - 3, signSpec.y ?? 11);
      sign.position.set(x, signY, faceZ);
      bGroup.add(sign);

      // Rooftop support struts
      if (signSpec.rooftop) {
        const strutMat = new THREE.MeshStandardMaterial({ color: 0x262f3d, metalness: 0.7, roughness: 0.3 });
        for (const sx of [-signW * 0.35, signW * 0.35]) {
          const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 6), strutMat);
          strut.position.set(x + sx, h + 1.2, faceZ);
          bGroup.add(strut);
        }
      }
    }

    root.add(bGroup);
    colliders.push({ minX: x - w / 2 - 0.6, maxX: x + w / 2 + 0.6, minZ: z - d / 2 - 0.6, maxZ: z + d / 2 + 0.6, height: h });
  };

  // Paseo Dorado Oceanfront Art-Deco Hero Hotels (facing south toward beach & chase avenue!)
  addBuilding(-120, 158, 42, 24, 34, textures.facadeArtDecoCoral, 0xd48b66, {
    text: 'HOTEL SOLSTICIO', bg: '#161124', fg: '#ffd46e', accent: '#ff5d47', rooftop: true, southFace: true, width: 32, height: 6.4,
  });
  addBuilding(-250, 158, 38, 24, 28, textures.facadeArtDecoCream, 0xdba978, {
    text: 'CASA AMBAR', bg: '#1a1220', fg: '#ffba52', accent: '#ff7043', rooftop: true, southFace: true, width: 28, height: 5.8,
  });
  addBuilding(-54, 158, 32, 24, 25, textures.facadeArtDecoTeal, 0x5ca4a0, {
    text: 'SOLSTICIO LOUNGE', bg: '#0c1f29', fg: '#5bf5df', accent: '#ffbe55', rooftop: false, southFace: true, y: 12, width: 24, height: 4.5,
  });
  addBuilding(-308, 158, 28, 24, 22, textures.facadeArtDecoCoral, 0xc77e5b);

  // Distrito Torre Gleaming Downtown Skyscrapers
  addBuilding(52, -64, 38, 34, 96, textures.facadeGlassGold, 0x263f59, {
    text: 'MIRADOR PLAZA', bg: '#0e1928', fg: '#ffe082', accent: '#4ba3ff', rooftop: true, southFace: true, width: 32, height: 6.6,
  });
  addBuilding(-62, -62, 34, 32, 82, textures.facadeGlassTeal, 0x1e364c);
  addBuilding(116, -62, 32, 32, 74, textures.facadeGlassGold, 0x2a4561);
  addBuilding(-112, -118, 34, 28, 68, textures.facadeGlassTeal, 0x1d3448);
  addBuilding(56, -124, 36, 28, 88, textures.facadeGlassGold, 0x223b54);
  addBuilding(-58, 56, 36, 30, 62, textures.facadeGlassTeal, 0x1e354c);
  addBuilding(62, 58, 34, 28, 72, textures.facadeGlassGold, 0x28435e, {
    text: 'TORRE DORADA', bg: '#111829', fg: '#ffbe55', accent: '#34e0c8', rooftop: true, southFace: true, width: 28, height: 5.8,
  });

  // Barrio Viejo Garage & Shops
  addBuilding(140, -258, 34, 24, 14, textures.facadeArtDecoCream, 0x8f5b3c, {
    text: "RAFA'S GARAGE", bg: '#1a1414', fg: '#ffbe55', accent: '#ff5252', rooftop: true, southFace: true, width: 26, height: 5.2,
  });
  addBuilding(-244, -138, 28, 22, 16, textures.facadeMarket, 0x5c362e, {
    text: 'EL TALLER', bg: '#1b1116', fg: '#ff8a5b', accent: '#34e0c8', rooftop: true, southFace: true, width: 22, height: 4.8,
  });

  // Bahia Esmeralda Marina Safehouse & Resort
  addBuilding(268, 162, 36, 24, 20, textures.facadeArtDecoTeal, 0x4ca19c, {
    text: 'BAHIA MARINA', bg: '#0c202a', fg: '#4ef5db', accent: '#ffbe55', rooftop: true, southFace: true, width: 26, height: 5.2,
  });

  // Fill remaining city blocks with district-themed buildings
  const blockDefs = [
    // Mercado Nocturno perimeter buildings
    { x: -385, z: -90, w: 30, d: 34, h: 20, t: textures.facadeMarket },
    { x: -385, z: -18, w: 30, d: 32, h: 18, t: textures.facadeMarket },
    { x: -385, z: 58, w: 30, d: 34, h: 22, t: textures.facadeArtDecoCoral },
    { x: -242, z: -60, w: 28, d: 30, h: 22, t: textures.facadeMarket },
    { x: -242, z: 56, w: 30, d: 32, h: 24, t: textures.facadeArtDecoCream },
    // Puerto Cenit warehouses & cranes
    { x: 268, z: -85, w: 40, d: 32, h: 16, t: textures.facadePort },
    { x: 268, z: 54, w: 38, d: 30, h: 18, t: textures.facadePort },
    { x: 410, z: -80, w: 38, d: 44, h: 19, t: textures.facadePort },
    { x: 410, z: 45, w: 38, d: 40, h: 17, t: textures.facadePort },
    // Villas del Cabo hillside estates
    { x: -265, z: -265, w: 34, d: 28, h: 14, t: textures.facadeVilla },
    { x: -110, z: -265, w: 36, d: 28, h: 16, t: textures.facadeVilla },
    { x: -265, z: -395, w: 38, d: 28, h: 15, t: textures.facadeVilla },
    { x: -95, z: -395, w: 36, d: 28, h: 17, t: textures.facadeVilla },
    // Barrio Viejo plazas
    { x: 75, z: -265, w: 32, d: 26, h: 20, t: textures.facadeArtDecoCream },
    { x: 255, z: -265, w: 36, d: 28, h: 22, t: textures.facadeArtDecoCoral },
    { x: 255, z: -395, w: 34, d: 28, h: 24, t: textures.facadeArtDecoTeal },
    { x: 90, z: -395, w: 34, d: 28, h: 26, t: textures.facadeArtDecoCream },
    // Extra Skyline depth
    { x: -115, z: 54, w: 30, d: 28, h: 48, t: textures.facadeGlassGold },
    { x: 120, z: 56, w: 30, d: 28, h: 52, t: textures.facadeGlassTeal },
    { x: 118, z: -124, w: 30, d: 28, h: 58, t: textures.facadeGlassTeal },
    { x: -110, z: -218, w: 28, d: 22, h: 32, t: textures.facadeArtDecoCoral },
  ];
  for (const b of blockDefs) {
    addBuilding(b.x, b.z, b.w, b.d, b.h, b.t, 0x3b4859);
  }

  // 6. Mercado Nocturno: Vibrant Lantern Night Market Alley (centered around x = -310, z = -55)
  buildMercadoNocturno(root, colliders, animated);

  // 7. Coastal Palm Trees along Paseo Dorado, Bahia Esmeralda & Boulevards
  const palmPositions = [];
  for (let x = -335; x <= 325; x += 26) {
    if (Math.abs(x - 110) < 58) continue; // Keep bridge clear
    palmPositions.push([x, 217]);
    if (x < 30 || x > 190) palmPositions.push([x + 10, 184]);
  }
  for (let z = -260; z <= 100; z += 44) {
    palmPositions.push([-16, z], [16, z], [-196, z]);
  }
  for (const [px, pz] of palmPositions) {
    const palm = createPalmTree(rand);
    palm.position.set(px, 0, pz);
    palm.rotation.y = rand() * Math.PI * 2;
    root.add(palm);
    animated.palms.push(palm);
  }

  // 8. Beach Umbrellas & Loungers on Paseo Dorado Sand
  const umbColors = [0xff6b4a, 0x34e0c8, 0xffbe55, 0xff4b72, 0x4ba3ff];
  for (let x = -310; x <= 290; x += 28) {
    if (x > 25 && x < 195) continue;
    const u = createBeachUmbrella(umbColors[Math.abs(Math.floor(x)) % umbColors.length]);
    u.position.set(x, 0.05, 248 + (rand() - 0.5) * 18);
    root.add(u);
  }

  // 9. Streetlamps along Main Avenues
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x262e3d, metalness: 0.7, roughness: 0.3 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd588 });
  for (let x = -320; x <= 320; x += 48) {
    for (const lz of [186, 214, 14, -14]) {
      if (Math.abs(x - 110) < 55 && lz > 150) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 8.2, 6), lampMat);
      pole.position.set(x, 4.1, lz);
      root.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), bulbMat);
      lamp.position.set(x, 8.3, lz);
      root.add(lamp);
    }
  }

  // 10. Stunt Ramps
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xff9f2e, roughness: 0.4, metalness: 0.2 });
  for (const r of STUNT_RAMPS) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 11), rampMat);
    ramp.position.set(r.x, 0.9, r.z);
    ramp.rotation.y = r.yaw;
    ramp.rotation.x = -0.22;
    root.add(ramp);
  }

  // 11. Shop Zone Rings (Garage / Gunsmith / Safehouse)
  for (const sh of SHOPS) {
    const col = sh.kind === 'garage' ? 0x34e0c8 : sh.kind === 'gunsmith' ? 0xff6b4a : 0xffbe55;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 5.1, 32),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sh.x, 0.16, sh.z);
    root.add(ring);
  }

  // 12. Golden Shell Collectibles
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xffd24d, emissive: 0xff8c1a, emissiveIntensity: 0.55, metalness: 0.85, roughness: 0.2,
  });
  for (const sh of GOLDEN_SHELLS) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 1), shellMat);
    mesh.position.set(sh.x, 1.5, sh.z);
    mesh.userData.shellId = sh.id;
    root.add(mesh);
    animated.shells.push(mesh);
  }

  scene.add(root);
  return { root, colliders, animated };
}

function buildPuenteDelSol(root, cx, cz) {
  const g = new THREE.Group();
  const redSteel = new THREE.MeshStandardMaterial({ color: 0xd93b30, roughness: 0.38, metalness: 0.45 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xffc44d, roughness: 0.3, metalness: 0.72 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x2b313d, roughness: 0.7 });

  // Bridge deck guardrails
  const deck = new THREE.Mesh(new THREE.BoxGeometry(132, 0.7, 23), deckMat);
  deck.position.set(cx, 0.32, cz);
  g.add(deck);

  for (const side of [-11.3, 11.3]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(132, 1.2, 0.7), redSteel);
    rail.position.set(cx, 1.15, cz + side);
    g.add(rail);
  }

  // Twin Iconic Red & Gold Suspension Pylons
  for (const px of [cx - 34, cx + 34]) {
    for (const side of [-11.5, 11.5]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 46, 3.2), redSteel);
      tower.position.set(px, 23, cz + side);
      tower.castShadow = true;
      g.add(tower);
    }
    // Golden Art-Deco crossbeams
    for (const cy of [18, 32, 43]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 24.5), goldTrim);
      beam.position.set(px, cy, cz);
      g.add(beam);
    }
    // Stay cables radiating down to deck
    const cableMat = new THREE.MeshBasicMaterial({ color: 0xffe09e });
    for (const side of [-11.2, 11.2]) {
      for (const offset of [-26, -18, -10, 10, 18, 26]) {
        const dx = offset;
        const dy = -38;
        const len = Math.hypot(dx, dy);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 5), cableMat);
        cable.position.set(px + dx * 0.5, 42 + dy * 0.5, cz + side);
        cable.rotation.z = Math.atan2(dx, -dy);
        g.add(cable);
      }
    }
  }
  root.add(g);
}

function buildMercadoNocturno(root, colliders, animated) {
  const g = new THREE.Group();
  const cx = -310;
  const cz = -55;

  // Entrance Neon Archway
  const archMat = new THREE.MeshStandardMaterial({ color: 0x8f2431, roughness: 0.45, metalness: 0.25 });
  for (const sx of [-12.5, 12.5]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 11, 8), archMat);
    col.position.set(cx + sx, 5.5, cz + 42);
    g.add(col);
  }
  const archSign = new THREE.Mesh(
    new THREE.BoxGeometry(26, 4.4, 1.2),
    new THREE.MeshBasicMaterial({ map: createSignTexture('MERCADO NOCTURNO', '#1a0c16', '#ffd26b', '#ff3b6b') })
  );
  archSign.position.set(cx, 11.2, cz + 42);
  g.add(archSign);

  // Side Neon Storefront Signs
  const signDefs = [
    { text: 'BAR MARISOL', x: cx - 15.5, z: cz + 4, rotY: Math.PI / 2, fg: '#5bf5df', accent: '#ff5277' },
    { text: 'CAIMAN IMPORT', x: cx + 15.5, z: cz - 6, rotY: -Math.PI / 2, fg: '#ffbe55', accent: '#ff6138' },
    { text: 'EL TALLER', x: cx - 15.5, z: cz - 20, rotY: Math.PI / 2, fg: '#ff96b5', accent: '#34e0c8' },
    { text: 'MERCADO NOCTURNO', x: cx, z: cz - 34, rotY: 0, fg: '#ffd26b', accent: '#ff3b6b', w: 22, h: 4.2, y: 10.6 },
  ];
  for (const s of signDefs) {
    const sm = new THREE.Mesh(
      new THREE.BoxGeometry(s.w ?? 11, s.h ?? 3.0, 0.6),
      new THREE.MeshBasicMaterial({ map: createSignTexture(s.text, '#140b18', s.fg, s.accent) })
    );
    sm.position.set(s.x, s.y ?? 7.4, s.z);
    sm.rotation.y = s.rotY;
    g.add(sm);
  }

  // Dense Side Facade Walls flanking Mercado Nocturno Alley so the night market feels enclosed & vibrant
  const alleyWallMat = new THREE.MeshStandardMaterial({ color: 0x2a1d2b, roughness: 0.78 });
  const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xffc66d });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 86), alleyWallMat);
    wall.position.set(cx + side * 21, 8, cz - 2);
    g.add(wall);
    for (let wz = -34; wz <= 30; wz += 10) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 3.2), winGlowMat);
      win.position.set(cx + side * 16.9, 10.8, cz + wz);
      g.add(win);
    }
  }

  // Vendor Stalls with Colorful Awnings along both sides of the alley
  const awningColors = [0xff5252, 0xffae38, 0x2ec4b6, 0xe84393];
  const stallWood = new THREE.MeshStandardMaterial({ color: 0x5c3a28, roughness: 0.85 });
  for (let i = 0; i < 6; i++) {
    const zPos = cz - 34 + i * 13.5;
    for (const side of [-1, 1]) {
      const xPos = cx + side * 14.5;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.3, 6.2), stallWood);
      counter.position.set(xPos, 0.65, zPos);
      g.add(counter);

      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.28, 7.2),
        new THREE.MeshStandardMaterial({
          color: awningColors[(i + (side > 0 ? 1 : 0)) % awningColors.length],
          emissive: 0x301008,
          emissiveIntensity: 0.25,
          roughness: 0.6,
        })
      );
      awning.position.set(xPos - side * 0.4, 3.8, zPos);
      awning.rotation.z = side * 0.16;
      g.add(awning);

      // Warm stall under-lamp
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      bulb.position.set(xPos - side * 0.6, 3.35, zPos);
      g.add(bulb);
    }
  }

  // Cover Crates & Barrels in the market center for tactical firefights
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x875c3a, roughness: 0.85 });
  const coverSpots = [
    [cx - 4.2, cz - 14], [cx + 4.8, cz - 6], [cx - 5.5, cz + 6], [cx + 3.8, cz + 15], [cx - 1.5, cz - 26],
  ];
  for (const [kx, kz] of coverSpots) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.35, 1.7), crateMat);
    crate.position.set(kx, 0.68, kz);
    crate.castShadow = true;
    g.add(crate);
    colliders.push({ minX: kx - 1.4, maxX: kx + 1.4, minZ: kz - 0.9, maxZ: kz + 0.9, height: 1.4 });
  }

  // Crisscrossing Overhead Glowing Paper Lantern Strings!
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x241d29 });
  const lanternCols = [0xff5c42, 0xffc145, 0xff3b78, 0xff9138];
  for (let row = 0; row < 8; row++) {
    const zRow = cz - 38 + row * 11;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 32, 4), wireMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(cx, 7.2 + (row % 2) * 0.9, zRow);
    g.add(wire);

    for (let j = -4; j <= 4; j++) {
      const lx = cx + j * 3.2;
      const sag = Math.cos((j / 4) * Math.PI * 0.5) * -0.9;
      const col = lanternCols[(row + j + 8) % lanternCols.length];
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 10, 8),
        new THREE.MeshBasicMaterial({ color: col })
      );
      lantern.scale.set(0.88, 1.25, 0.88);
      lantern.position.set(lx, 6.7 + (row % 2) * 0.9 + sag, zRow);
      g.add(lantern);
      animated.lanterns.push(lantern);
    }
  }

  // Warm overhead Market Glow PointLights (3 well-placed lights for lush night ambiance)
  for (const lz of [cz - 24, cz, cz + 24]) {
    const pl = new THREE.PointLight(0xff9442, 26, 48, 1.5);
    pl.position.set(cx, 7.0, lz);
    g.add(pl);
  }

  root.add(g);
}

function createPalmTree(rand) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a593e, roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8549, roughness: 0.65, side: THREE.DoubleSide });

  const h = 11.5 + rand() * 4.5;
  const lean = (rand() - 0.5) * 1.6;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const segH = h / segs;
    const rBot = 0.42 - i * 0.06;
    const rTop = 0.36 - i * 0.06;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH + 0.15, 7), trunkMat);
    seg.position.set(lean * (i / segs), segH * (i + 0.5), 0);
    seg.rotation.z = -lean * 0.04;
    seg.castShadow = true;
    g.add(seg);
  }

  const crown = new THREE.Group();
  crown.position.set(lean, h, 0);
  for (let f = 0; f < 7; f++) {
    const ang = (f / 7) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.2, 4), frondMat);
    frond.scale.set(1.0, 1.0, 0.25);
    frond.position.set(Math.cos(ang) * 2.1, -0.3, Math.sin(ang) * 2.1);
    frond.rotation.order = 'YXZ';
    frond.rotation.y = -ang + Math.PI / 2;
    frond.rotation.x = 1.18;
    crown.add(frond);
  }
  g.add(crown);
  g.userData.crown = crown;
  return g;
}

function createBeachUmbrella(colorHex) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.0, 6),
    new THREE.MeshStandardMaterial({ color: 0xe6e6e6 })
  );
  pole.position.y = 1.5;
  g.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(2.3, 0.85, 8),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65 })
  );
  canopy.position.y = 2.95;
  g.add(canopy);
  return g;
}
