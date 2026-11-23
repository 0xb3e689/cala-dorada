// 3D open-world city builder: roads, Art-Deco hotels, skyline, Puente del Sol bridge, Mercado Nocturno lanterns, marina, beach & ocean.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD } from '../core/config.js';
import { ROAD_X, ROAD_Z, STUNT_RAMPS, GOLDEN_SHELLS, SHOPS } from './cityPlan.js';
import { createSignTexture } from './textures.js';
import { getRadialGlowTexture } from '../entities/vehicleFactory.js';

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

  // Wooden Boardwalk along Paseo Dorado beachfront (split cleanly around bay channel)
  const boardwalkMat = new THREE.MeshStandardMaterial({ color: 0xa8764c, roughness: 0.82 });
  const bwWest = new THREE.Mesh(new THREE.BoxGeometry(475, 0.28, 7.5), boardwalkMat);
  bwWest.position.set(-200, 0.14, 224);
  bwWest.receiveShadow = true;
  const bwEast = new THREE.Mesh(new THREE.BoxGeometry(280, 0.28, 7.5), boardwalkMat);
  bwEast.position.set(324, 0.14, 224);
  bwEast.receiveShadow = true;
  root.add(bwWest, bwEast);

  // 2. Turquoise Ocean with Golden Sunset Specular Shimmer + Shoreline Foam
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.water,
    color: 0x1bb2c7,
    roughness: 0.14,
    metalness: 0.52,
    emissive: 0x0d4254,
    emissiveIntensity: 0.48,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1400), waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, 972);
  root.add(ocean);
  animated.ocean = ocean;

  // Marina Channel (bay water cutting right under Puente del Sol)
  const bayWater = new THREE.Mesh(new THREE.PlaneGeometry(148, 220), waterMat);
  bayWater.rotation.x = -Math.PI / 2;
  bayWater.position.set(110, 0.03, 240);
  root.add(bayWater);

  // Golden Sunset Shimmer Path across the Ocean
  const shimmerMat = new THREE.MeshBasicMaterial({
    map: getRadialGlowTexture('rgba(255,232,162,0.52)', 'rgba(255,146,72,0.2)', 'rgba(255,110,60,0)'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(360, 420), shimmerMat);
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.position.set(150, 0.08, 410);
  root.add(shimmer);

  // Shoreline Foam Ribbon
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xecfdff, transparent: true, opacity: 0.72 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1260, 5.2), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.07, 276);
  root.add(foam);

  // Marina Wooden Pier & Moored Boats in Bahia Esmeralda + Cove
  buildMarinaBoats(root);

  // 3. Road Grid & Crosswalks
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.6, metalness: 0.14 });
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
  const addBuilding = (x, z, w, d, h, facadeTex, roofColor, signSpec = null, spire = false) => {
    const bGroup = new THREE.Group();
    const matSide = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.52, metalness: 0.18 });
    const matRoof = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.72 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [matSide, matSide, matRoof, matRoof, matSide, matSide]);
    body.position.set(x, h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    bGroup.add(body);

    // Art-Deco crown parapet + stepped tier for tall towers
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1.1, 1.3, d + 1.1),
      new THREE.MeshStandardMaterial({ color: 0xffe4bd, roughness: 0.42, metalness: 0.25 })
    );
    crown.position.set(x, h + 0.55, z);
    bGroup.add(crown);

    if (h >= 54) {
      const tierH = Math.min(14, h * 0.16);
      const tier = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.68, tierH, d * 0.68),
        [matSide, matSide, matRoof, matRoof, matSide, matSide]
      );
      tier.position.set(x, h + tierH / 2 + 1.1, z);
      bGroup.add(tier);

      // Subtle glowing crown neon trim
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, 0.65, d * 0.7),
        new THREE.MeshBasicMaterial({ color: spire ? 0x34e0c8 : 0xffbe55 })
      );
      trim.position.set(x, h + tierH + 1.25, z);
      bGroup.add(trim);

      if (spire) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.55, 16, 6),
          new THREE.MeshStandardMaterial({ color: 0xdbe4f0, metalness: 0.8, roughness: 0.25 })
        );
        mast.position.set(x, h + tierH + 9.2, z);
        const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
          map: getRadialGlowTexture('#ffffff', 'rgba(255,60,92,0.92)'),
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        beacon.scale.set(4.5, 4.5, 1);
        beacon.position.set(x, h + tierH + 17.2, z);
        bGroup.add(mast, beacon);
      }
    }

    if (signSpec) {
      const sTex = createSignTexture(signSpec.text, signSpec.bg, signSpec.fg, signSpec.accent);
      const sMat = new THREE.MeshBasicMaterial({ map: sTex });
      const signW = Math.min(w * 0.94, signSpec.width ?? 22);
      const signH = signSpec.height ?? 5.4;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.9), sMat);
      const faceZ = signSpec.southFace ? z + d / 2 + 0.6 : z - d / 2 - 0.6;
      const signY = signSpec.rooftop ? h + signH / 2 + 1.6 : Math.min(h - 3, signSpec.y ?? 11);
      sign.position.set(x, signY, faceZ);
      bGroup.add(sign);

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
  addBuilding(-54, 158, 32, 24, 26, textures.facadeArtDecoTeal, 0x5ca4a0, {
    text: 'SOLSTICIO LOUNGE', bg: '#0c1f29', fg: '#5bf5df', accent: '#ffbe55', rooftop: false, southFace: true, y: 12, width: 24, height: 4.5,
  });
  addBuilding(-308, 158, 28, 24, 22, textures.facadeArtDecoCoral, 0xc77e5b);

  // Distrito Torre Gleaming Downtown Skyscrapers (dense stepped skyline visible across bridge & vista!)
  addBuilding(52, -64, 38, 34, 98, textures.facadeGlassGold, 0x263f59, {
    text: 'MIRADOR PLAZA', bg: '#0e1928', fg: '#ffe082', accent: '#4ba3ff', rooftop: true, southFace: true, width: 32, height: 6.6,
  }, true);
  addBuilding(-62, -62, 34, 32, 84, textures.facadeGlassTeal, 0x1e364c, null, true);
  addBuilding(116, -62, 32, 32, 78, textures.facadeGlassGold, 0x2a4561, null, true);
  addBuilding(-112, -118, 34, 28, 72, textures.facadeGlassTeal, 0x1d3448);
  addBuilding(56, -124, 36, 28, 92, textures.facadeGlassGold, 0x223b54, null, true);
  addBuilding(-58, 56, 36, 30, 64, textures.facadeGlassTeal, 0x1e354c);
  addBuilding(62, 58, 34, 28, 74, textures.facadeGlassGold, 0x28435e, {
    text: 'TORRE DORADA', bg: '#111829', fg: '#ffbe55', accent: '#34e0c8', rooftop: true, southFace: true, width: 28, height: 5.8,
  }, true);

  // Barrio Viejo Garage & Shops
  addBuilding(140, -258, 34, 24, 14, textures.facadeArtDecoCream, 0x8f5b3c, {
    text: "RAFA'S GARAGE", bg: '#1a1414', fg: '#ffbe55', accent: '#ff5252', rooftop: true, southFace: true, width: 26, height: 5.2,
  });
  addBuilding(-244, -138, 28, 22, 16, textures.facadeMarket, 0x5c362e, {
    text: 'EL TALLER', bg: '#1b1116', fg: '#ff8a5b', accent: '#34e0c8', rooftop: true, southFace: true, width: 22, height: 4.8,
  });

  // Bahia Esmeralda Marina Safehouse & Resort Towers (vivid backdrop behind Puente del Sol!)
  addBuilding(268, 162, 36, 24, 26, textures.facadeArtDecoTeal, 0x4ca19c, {
    text: 'BAHIA MARINA', bg: '#0c202a', fg: '#4ef5db', accent: '#ffbe55', rooftop: true, southFace: true, width: 26, height: 5.2,
  });
  addBuilding(232, 118, 30, 26, 56, textures.facadeGlassGold, 0x243b54, null, true);
  addBuilding(298, 118, 32, 26, 44, textures.facadeArtDecoCoral, 0xc77e5b, {
    text: 'CLUB PALMA', bg: '#191024', fg: '#ffbe55', accent: '#ff4b72', rooftop: true, southFace: true, width: 24, height: 4.8,
  });
  addBuilding(348, 162, 32, 24, 34, textures.facadeArtDecoCream, 0xdba978);

  // Fill remaining city blocks with varied district-themed buildings & skyline depth
  const blockDefs = [
    // Mercado Nocturno perimeter buildings
    { x: -385, z: -90, w: 30, d: 34, h: 20, t: textures.facadeMarket },
    { x: -385, z: -18, w: 30, d: 32, h: 18, t: textures.facadeMarket },
    { x: -385, z: 58, w: 30, d: 34, h: 22, t: textures.facadeArtDecoCoral },
    { x: -242, z: -60, w: 28, d: 30, h: 22, t: textures.facadeMarket },
    { x: -242, z: 56, w: 30, d: 32, h: 24, t: textures.facadeArtDecoCream },
    // Puerto Cenit warehouses & skyline towers
    { x: 268, z: -85, w: 40, d: 32, h: 20, t: textures.facadePort },
    { x: 268, z: 54, w: 38, d: 30, h: 38, t: textures.facadeGlassTeal },
    { x: 332, z: 54, w: 34, d: 28, h: 52, t: textures.facadeGlassGold },
    { x: 410, z: -80, w: 38, d: 44, h: 22, t: textures.facadePort },
    { x: 410, z: 45, w: 38, d: 40, h: 24, t: textures.facadePort },
    // Villas del Cabo hillside estates
    { x: -265, z: -265, w: 34, d: 28, h: 14, t: textures.facadeVilla },
    { x: -110, z: -265, w: 36, d: 28, h: 16, t: textures.facadeVilla },
    { x: -265, z: -395, w: 38, d: 28, h: 15, t: textures.facadeVilla },
    { x: -95, z: -395, w: 36, d: 28, h: 17, t: textures.facadeVilla },
    // Barrio Viejo plazas
    { x: 75, z: -265, w: 32, d: 26, h: 22, t: textures.facadeArtDecoCream },
    { x: 255, z: -265, w: 36, d: 28, h: 24, t: textures.facadeArtDecoCoral },
    { x: 255, z: -395, w: 34, d: 28, h: 26, t: textures.facadeArtDecoTeal },
    { x: 90, z: -395, w: 34, d: 28, h: 28, t: textures.facadeArtDecoCream },
    // Extra Downtown Skyline depth
    { x: -115, z: 54, w: 30, d: 28, h: 56, t: textures.facadeGlassGold, spire: true },
    { x: 120, z: 56, w: 32, d: 28, h: 64, t: textures.facadeGlassTeal, spire: true },
    { x: 184, z: 56, w: 28, d: 28, h: 48, t: textures.facadeGlassGold },
    { x: 118, z: -124, w: 30, d: 28, h: 62, t: textures.facadeGlassTeal },
    { x: -110, z: -218, w: 28, d: 22, h: 34, t: textures.facadeArtDecoCoral },
  ];
  for (const b of blockDefs) {
    addBuilding(b.x, b.z, b.w, b.d, b.h, b.t, 0x3b4859, null, Boolean(b.spire));
  }

  // 6. Mercado Nocturno: Vibrant Lantern Night Market Alley (centered around x = -310, z = -55)
  buildMercadoNocturno(root, colliders, animated);

  // 7. Coastal Palm Trees along Paseo Dorado, Bahia Esmeralda & Boulevards
  // Keep bridge approach sightline (x in [-4..52] on z=217 and [0..46] on z=184) clean for dramatic unobstructed chase framing!
  const palmPositions = [];
  for (let x = -335; x <= 325; x += 26) {
    if (Math.abs(x - 110) < 58) continue;
    if (!(x >= -6 && x <= 52)) {
      palmPositions.push([x, 217]);
    }
    if ((x < 2 || x > 190) && !(x >= 0 && x <= 46)) {
      palmPositions.push([x + 10, 184]);
    }
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
  for (let x = -310; x <= 290; x += 26) {
    if (x > 25 && x < 195) continue;
    const u = createBeachUmbrella(umbColors[Math.abs(Math.floor(x)) % umbColors.length]);
    u.position.set(x, 0.05, 248 + (rand() - 0.5) * 18);
    root.add(u);
  }

  // 9. Streetlamps along Main Avenues (with subtle warm glow sprites)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x262e3d, metalness: 0.7, roughness: 0.3 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe09e });
  const lampGlowTex = getRadialGlowTexture('rgba(255,240,190,0.85)', 'rgba(255,176,72,0.35)', 'rgba(0,0,0,0)');
  for (let x = -320; x <= 320; x += 48) {
    for (const lz of [186, 214, 14, -14]) {
      if (Math.abs(x - 110) < 58 && lz > 150) continue;
      if (x >= -5 && x <= 48 && lz > 150) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 8.2, 6), lampMat);
      pole.position.set(x, 4.1, lz);
      root.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), bulbMat);
      lamp.position.set(x, 8.3, lz);
      root.add(lamp);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(3.2, 3.2, 1);
      halo.position.set(x, 8.3, lz);
      root.add(halo);
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

function buildMarinaBoats(root) {
  const g = new THREE.Group();
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8f6642, roughness: 0.85 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fc, roughness: 0.28, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b6e82, roughness: 0.3 });

  // Pier stretching into Bahia Esmeralda
  const pier = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 52), pierMat);
  pier.position.set(225, 0.5, 298);
  g.add(pier);

  const boatCoords = [
    [155, 295, 0.2], [208, 298, -0.15], [242, 308, 0.3], [92, 310, -0.35], [-60, 318, 0.45],
  ];
  for (const [bx, bz, rot] of boatCoords) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 8.8), hullMat);
    hull.position.y = 0.55;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.6), trimMat);
    cabin.position.set(0, 1.5, -0.8);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6.5, 6), hullMat);
    mast.position.set(0, 4.2, 1.0);
    boat.add(hull, cabin, mast);
    boat.position.set(bx, 0, bz);
    boat.rotation.y = rot;
    g.add(boat);
  }
  root.add(g);
}

function buildPuenteDelSol(root, cx, cz) {
  const g = new THREE.Group();
  const redSteel = new THREE.MeshStandardMaterial({ color: 0xdf3b30, roughness: 0.34, metalness: 0.48 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xffc84d, roughness: 0.28, metalness: 0.72 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x262c38, roughness: 0.65 });
  const lampGlowTex = getRadialGlowTexture('rgba(255,244,205,0.92)', 'rgba(255,176,72,0.4)', 'rgba(0,0,0,0)');
  const redBeaconTex = getRadialGlowTexture('#ffffff', 'rgba(255,48,78,0.9)', 'rgba(0,0,0,0)');

  // Bridge deck & guardrails
  const deck = new THREE.Mesh(new THREE.BoxGeometry(142, 0.8, 23.5), deckMat);
  deck.position.set(cx, 0.32, cz);
  g.add(deck);

  for (const side of [-11.5, 11.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(142, 1.25, 0.72), redSteel);
    rail.position.set(cx, 1.15, cz + side);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(142, 0.22, 0.85), goldTrim);
    topBar.position.set(cx, 1.85, cz + side);
    g.add(rail, topBar);

    // Warm glowing bridge deck streetlamps
    for (let lx = cx - 56; lx <= cx + 56; lx += 28) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.2, 6), redSteel);
      post.position.set(lx, 4.2, cz + side * 0.96);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      orb.scale.set(2.8, 2.8, 1);
      orb.position.set(lx, 7.4, cz + side * 0.92);
      g.add(post, orb);
    }
  }

  // Twin Iconic Red & Gold Suspension Pylons
  for (const px of [cx - 34, cx + 34]) {
    for (const side of [-11.6, 11.6]) {
      const towerLower = new THREE.Mesh(new THREE.BoxGeometry(3.6, 26, 3.6), redSteel);
      towerLower.position.set(px, 13, cz + side);
      towerLower.castShadow = true;
      const towerUpper = new THREE.Mesh(new THREE.BoxGeometry(2.7, 23, 2.7), redSteel);
      towerUpper.position.set(px, 37.5, cz + side);
      towerUpper.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 3.2), goldTrim);
      cap.position.set(px, 49.4, cz + side);
      const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: redBeaconTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      beacon.scale.set(4.0, 4.0, 1);
      beacon.position.set(px, 50.8, cz + side);
      g.add(towerLower, towerUpper, cap, beacon);
    }
    // Golden Art-Deco crossbeams with red accent ribs
    for (const cy of [18, 32, 44.5]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 24.4), goldTrim);
      beam.position.set(px, cy, cz);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 24.6), redSteel);
      rib.position.set(px, cy, cz);
      g.add(beam, rib);
    }
    // Stay cables radiating down to deck
    const cableMat = new THREE.MeshBasicMaterial({ color: 0xffe4a8 });
    for (const side of [-11.3, 11.3]) {
      for (const offset of [-30, -22, -14, -7, 7, 14, 22, 30]) {
        const dx = offset;
        const dy = -42;
        const len = Math.hypot(dx, dy);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 5), cableMat);
        cable.position.set(px + dx * 0.5, 45 + dy * 0.5, cz + side);
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

  // Wet night-market asphalt reflection strip down center of alley
  const wetMat = new THREE.MeshStandardMaterial({
    color: 0x1c1826, roughness: 0.18, metalness: 0.65,
  });
  const wetRoad = new THREE.Mesh(new THREE.PlaneGeometry(24, 90), wetMat);
  wetRoad.rotation.x = -Math.PI / 2;
  wetRoad.position.set(cx, 0.11, cz - 2);
  g.add(wetRoad);

  // Entrance & Far Neon Archways (raised cleanly above lantern strings so MERCADO NOCTURNO is 100% unobstructed!)
  const archMat = new THREE.MeshStandardMaterial({ color: 0x992334, roughness: 0.4, metalness: 0.3 });
  const goldColMat = new THREE.MeshStandardMaterial({ color: 0xffc44d, roughness: 0.3, metalness: 0.7 });
  for (const az of [cz + 42, cz - 34]) {
    for (const sx of [-12.5, 12.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 13.4, 8), archMat);
      col.position.set(cx + sx, 6.7, az);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.6, 8), goldColMat);
      ring.position.set(cx + sx, 11.4, az);
      g.add(col, ring);
    }
    const archSign = new THREE.Mesh(
      new THREE.BoxGeometry(25.5, 4.4, 1.2),
      new THREE.MeshBasicMaterial({ map: createSignTexture('MERCADO NOCTURNO', '#1a0a16', '#ffe078', '#ff3b6b') })
    );
    archSign.position.set(cx, 12.6, az);
    g.add(archSign);
  }

  // Side Neon Storefront & Stall Signs
  const signDefs = [
    { text: 'BAR MARISOL', x: cx - 15.2, z: cz + 4, rotY: Math.PI / 2, fg: '#5bf5df', accent: '#ff5277', w: 11.5, h: 3.1, y: 7.4 },
    { text: 'ELIXIR BAR', x: cx + 15.2, z: cz + 2, rotY: -Math.PI / 2, fg: '#ff96e0', accent: '#34e0c8', w: 11.0, h: 3.0, y: 7.4 },
    { text: 'CAIMAN IMPORT', x: cx + 15.2, z: cz - 14, rotY: -Math.PI / 2, fg: '#ffbe55', accent: '#ff6138', w: 12.0, h: 3.0, y: 7.6 },
    { text: 'MARISCOS SOL', x: cx - 15.2, z: cz - 16, rotY: Math.PI / 2, fg: '#ffe078', accent: '#ff5252', w: 11.5, h: 3.0, y: 7.6 },
  ];
  for (const s of signDefs) {
    const sm = new THREE.Mesh(
      new THREE.BoxGeometry(s.w, s.h, 0.6),
      new THREE.MeshBasicMaterial({ map: createSignTexture(s.text, '#140a18', s.fg, s.accent) })
    );
    sm.position.set(s.x, s.y, s.z);
    sm.rotation.y = s.rotY;
    g.add(sm);
  }

  // Detailed Side Facade Walls flanking Mercado Nocturno Alley with lit windows & neon accent strips
  const alleyWallMat = new THREE.MeshStandardMaterial({ color: 0x261a2b, roughness: 0.72 });
  const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xffce73 });
  const neonStripMats = [
    new THREE.MeshBasicMaterial({ color: 0xff4b72 }),
    new THREE.MeshBasicMaterial({ color: 0x34e0c8 }),
  ];
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 17, 86), alleyWallMat);
    wall.position.set(cx + side * 21, 8.5, cz - 2);
    g.add(wall);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 80), neonStripMats[side > 0 ? 1 : 0]);
    strip.position.set(cx + side * 16.9, 5.2, cz - 2);
    g.add(strip);
    for (let wz = -34; wz <= 30; wz += 10) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.3, 3.2), winGlowMat);
      win.position.set(cx + side * 16.9, 11.2, cz + wz);
      g.add(win);
    }
  }

  // Detailed Vendor Stalls with Posts, Striped Awnings, Glowing Counter Interiors & Goods!
  const awningColors = [0xff4b5c, 0xffae38, 0x2ec4b6, 0xe84393];
  const stallWood = new THREE.MeshStandardMaterial({ color: 0x6b422a, roughness: 0.78 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2f242c, roughness: 0.6 });
  const goodsColors = [0xffc857, 0xff5e5b, 0x42e38c, 0x5bf5df];
  const stallGlowTex = getRadialGlowTexture('rgba(255,235,175,0.9)', 'rgba(255,148,54,0.42)', 'rgba(0,0,0,0)');

  for (let i = 0; i < 6; i++) {
    const zPos = cz - 30 + i * 12.2;
    for (const side of [-1, 1]) {
      const xPos = cx + side * 13.2;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.35, 6.4), stallWood);
      counter.position.set(xPos, 0.68, zPos);
      g.add(counter);

      // Warm illuminated counter backdrop / display shelf
      const backGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 2.1, 5.6),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffb85c : 0xff7b6b })
      );
      backGlow.position.set(xPos + side * 1.9, 2.3, zPos);
      g.add(backGlow);

      // Wooden support posts
      for (const dz of [-2.9, 2.9]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.8, 6), postMat);
        post.position.set(xPos - side * 1.85, 1.9, zPos + dz);
        g.add(post);
      }

      // Colorful awning + front valance stripe
      const awCol = awningColors[(i + (side > 0 ? 1 : 0)) % awningColors.length];
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 0.28, 7.2),
        new THREE.MeshStandardMaterial({ color: awCol, emissive: awCol, emissiveIntensity: 0.28, roughness: 0.55 })
      );
      awning.position.set(xPos - side * 0.35, 3.9, zPos);
      awning.rotation.z = side * 0.16;
      g.add(awning);

      // Stacked market goods / fruit crates on counter
      for (let k = -1; k <= 1; k++) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.55, 1.3),
          new THREE.MeshStandardMaterial({ color: goodsColors[(i + k + 4) % 4], roughness: 0.65 })
        );
        box.position.set(xPos - side * 0.7, 1.62, zPos + k * 1.8);
        g.add(box);
      }

      // Warm glowing stall under-lamp sprite
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: stallGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lamp.scale.set(2.8, 2.8, 1);
      lamp.position.set(xPos - side * 0.8, 3.3, zPos);
      g.add(lamp);
    }
  }

  // Tactical Cover Crates & Barrels with metallic bands
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x99683f, roughness: 0.78 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x264860, roughness: 0.45, metalness: 0.45 });
  const coverSpots = [
    [cx - 4.2, cz - 14], [cx + 4.8, cz - 6], [cx - 5.5, cz + 6], [cx + 4.0, cz + 14.2], [cx - 1.5, cz - 26],
  ];
  for (const [kx, kz] of coverSpots) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.32, 1.65), crateMat);
    crate.position.set(kx, 0.66, kz);
    crate.castShadow = true;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.28, 10), barrelMat);
    barrel.position.set(kx + 1.65, 0.64, kz - 0.15);
    g.add(crate, barrel);
    colliders.push({ minX: kx - 1.4, maxX: kx + 2.1, minZ: kz - 0.9, maxZ: kz + 0.9, height: 1.4 });
  }

  // Crisscrossing Overhead Glowing Paper Lantern Strings (with top/bottom caps & warm additive halos!)
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e1824 });
  const capMat = new THREE.MeshBasicMaterial({ color: 0x1a1216 });
  const lanternPalette = [
    { hex: 0xff5a36, glow: 'rgba(255,96,52,0.72)' },
    { hex: 0xffca4a, glow: 'rgba(255,204,72,0.74)' },
    { hex: 0xff3b7c, glow: 'rgba(255,62,132,0.72)' },
    { hex: 0xff9436, glow: 'rgba(255,152,56,0.74)' },
  ];

  for (let row = 0; row < 8; row++) {
    const zRow = cz - 26 + row * 9.5;
    const wireY = 6.9 + (row % 2) * 0.65;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 30, 4), wireMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(cx, wireY, zRow);
    g.add(wire);

    for (let j = -4; j <= 4; j++) {
      // Keep center sightline slightly arched higher so far MERCADO NOCTURNO archway shines clearly above!
      const lx = cx + j * 3.1;
      const sag = Math.cos((j / 4) * Math.PI * 0.5) * -0.55;
      const pal = lanternPalette[(row + j + 8) % lanternPalette.length];

      const lGroup = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 12, 10),
        new THREE.MeshBasicMaterial({ color: pal.hex })
      );
      body.scale.set(0.9, 1.25, 0.9);
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 8), capMat);
      capTop.position.y = 0.58;
      const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.14, 8), capMat);
      capBot.position.y = -0.58;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getRadialGlowTexture('#fff5d6', pal.glow, 'rgba(0,0,0,0)'),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(3.0, 3.0, 1);

      lGroup.add(body, capTop, capBot, halo);
      lGroup.position.set(lx, wireY - 0.55 + sag, zRow);
      g.add(lGroup);
      animated.lanterns.push(lGroup);
    }
  }

  // Lush Warm Market Glow PointLights (cast rich golden/coral pools across the street & characters!)
  for (const [lz, col] of [[cz - 24, 0xff8c42], [cz - 4, 0xffaa4c], [cz + 14, 0xff7846], [cz + 28, 0xffbe55]]) {
    const pl = new THREE.PointLight(col, 38, 52, 1.45);
    pl.position.set(cx, 6.4, lz);
    g.add(pl);
  }

  root.add(g);
}

function createPalmTree(rand) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x735238, roughness: 0.88 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2b8a4c, roughness: 0.62, side: THREE.DoubleSide });

  const h = 11.5 + rand() * 4.5;
  const lean = (rand() - 0.5) * 1.8;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const segH = h / segs;
    const rBot = 0.42 - i * 0.055;
    const rTop = 0.36 - i * 0.055;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH + 0.16, 7), trunkMat);
    seg.position.set(lean * (i / segs), segH * (i + 0.5), 0);
    seg.rotation.z = -lean * 0.04;
    seg.castShadow = true;
    g.add(seg);
  }

  const crown = new THREE.Group();
  crown.position.set(lean, h, 0);
  for (let f = 0; f < 9; f++) {
    const ang = (f / 9) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.95, 5.8, 4), frondMat);
    frond.scale.set(1.0, 1.0, 0.22);
    frond.position.set(Math.cos(ang) * 2.3, -0.35 + (f % 2) * 0.25, Math.sin(ang) * 2.3);
    frond.rotation.order = 'YXZ';
    frond.rotation.y = -ang + Math.PI / 2;
    frond.rotation.x = 1.2 + (f % 2) * 0.14;
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
