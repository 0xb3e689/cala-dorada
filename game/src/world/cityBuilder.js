// 3D open-world city builder: non-boxy Art-Deco & skyline architecture, lush tropical beaches & coastal props, Puente del Sol, Mercado Nocturno cobblestones & lanterns, and 8 interactive city properties.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PROPERTIES } from '../core/config.js';
import { ROAD_X, ROAD_Z, STUNT_RAMPS, GOLDEN_SHELLS } from './cityPlan.js';
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
  const animated = { ocean: null, palms: [], shells: [], lanterns: [], propertyBeacons: [] };

  // 1. Base City Terrain & Terraced Plaza Slab
  const groundMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.88, metalness: 0.04 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1180, 920), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -90);
  ground.receiveShadow = true;
  root.add(ground);

  // Golden Beach Sand Strip along South Coast (Paseo Dorado + Bahia Esmeralda)
  const sandMat = new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.94, metalness: 0.02 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1260, 62), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.05, 253);
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

  // Rustic Wooden Boardwalk Fence & Rope Posts along Beach Edge (z = 228)
  buildBoardwalkFences(root);

  // 2. Turquoise Ocean with Golden Sunset Specular Shimmer + Shoreline Foam
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.water,
    color: 0x1bb2c7,
    roughness: 0.16,
    metalness: 0.48,
    emissive: 0x0d4254,
    emissiveIntensity: 0.45,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1400), waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, 976);
  root.add(ocean);
  animated.ocean = ocean;

  // Marina Channel (bay water cutting right under Puente del Sol)
  const bayWater = new THREE.Mesh(new THREE.PlaneGeometry(148, 220), waterMat);
  bayWater.rotation.x = -Math.PI / 2;
  bayWater.position.set(110, 0.03, 240);
  root.add(bayWater);

  // Focused Golden Sunset Shimmer Path across the Ocean
  const shimmerMat = new THREE.MeshBasicMaterial({
    map: getRadialGlowTexture('rgba(255,232,162,0.44)', 'rgba(255,146,72,0.16)', 'rgba(255,110,60,0)'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(290, 360), shimmerMat);
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.position.set(155, 0.08, 410);
  root.add(shimmer);

  // Shoreline Foam Ribbon
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xecfdff, transparent: true, opacity: 0.72 });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1260, 5.2), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.07, 279);
  root.add(foam);

  // Marina Wooden Pier & Moored Boats in Bahia Esmeralda + Cove
  buildMarinaBoats(root);

  // 3. Road Grid & Crosswalks
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.68, metalness: 0.1 });
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
  const cwMat = new THREE.MeshStandardMaterial({ map: textures.crosswalk, roughness: 0.7 });
  for (const rx of ROAD_X) {
    for (const rz of ROAD_Z) {
      const box = new THREE.Mesh(new THREE.PlaneGeometry(roadW + 1, roadW + 1), cwMat);
      box.rotation.x = -Math.PI / 2;
      box.position.set(rx, 0.105, rz);
      root.add(box);
    }
  }

  // 4. Iconic Red-and-Gold Cable-Stayed Bridge: PUENTE DEL SOL
  buildPuenteDelSol(root, 110, 200);

  // 5. Detailed Non-Boxy Architectural City Builder
  const trimStoneMat = new THREE.MeshStandardMaterial({ color: 0xf7e3c4, roughness: 0.48, metalness: 0.18 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x263140, roughness: 0.42, metalness: 0.72 });
  const lobbyGlassMat = new THREE.MeshStandardMaterial({ color: 0x1a2e44, emissive: 0x452c16, emissiveIntensity: 0.45, roughness: 0.16, metalness: 0.75 });
  const terraRoofMat = new THREE.MeshStandardMaterial({ color: 0xb84f32, roughness: 0.76, metalness: 0.05 });
  const awningPalette = [0xff5d47, 0x2ec4b6, 0xffbe55, 0xe84393, 0x3b82f6];
  const beaconGlowTex = getRadialGlowTexture('#ffffff', 'rgba(255,60,92,0.88)', 'rgba(0,0,0,0)');

  const addBuilding = (x, z, w, d, h, facadeTex, roofColor, signSpec = null, opts = {}) => {
    const style = opts.style ?? (h >= 54 ? 'tower' : 'deco');
    const spire = Boolean(opts.spire);
    const bGroup = new THREE.Group();
    const matSide = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: style === 'tower' ? 0.34 : 0.56, metalness: style === 'tower' ? 0.38 : 0.14 });
    const matRoof = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.74 });

    // Ground-floor podium / arched colonnade & recessed storefront base
    const baseH = Math.min(5.2, h * 0.28);
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.96, baseH, d * 0.96),
      lobbyGlassMat
    );
    podium.position.set(x, baseH / 2, z);
    bGroup.add(podium);

    // Colonnade pilasters wrapping the ground floor
    const pilCountX = Math.max(3, Math.floor(w / 7));
    for (let i = 0; i < pilCountX; i++) {
      const px = x - w / 2 + 1.1 + (i / (pilCountX - 1)) * (w - 2.2);
      for (const sz of [-d / 2 + 0.4, d / 2 - 0.4]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(1.1, baseH + 0.3, 1.1), trimStoneMat);
        pil.position.set(px, baseH / 2, z + sz);
        bGroup.add(pil);
      }
    }

    // Projecting striped ground-floor storefronts & awnings (on south and north faces)
    if (style !== 'port') {
      const awCol = awningPalette[Math.abs(Math.floor(x + z)) % awningPalette.length];
      const awMat = new THREE.MeshStandardMaterial({ color: awCol, roughness: 0.62 });
      const awStripeMat = new THREE.MeshStandardMaterial({ color: 0xfff5e4, roughness: 0.62 });
      const awningSpan = w * 0.78;
      for (const side of [1, -1]) {
        if (side === -1 && style === 'tower') continue;
        const aw = new THREE.Mesh(new THREE.BoxGeometry(awningSpan, 0.24, 2.3), awMat);
        aw.position.set(x, baseH - 0.5, z + side * (d / 2 + 0.95));
        aw.rotation.x = side * 0.26;
        bGroup.add(aw);
        // Alternating awning ribs
        const ribs = Math.max(3, Math.floor(awningSpan / 4.5));
        for (let r = 0; r < ribs; r++) {
          const rx = x - awningSpan / 2 + 1.2 + (r / Math.max(1, ribs - 1)) * (awningSpan - 2.4);
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 2.34), awStripeMat);
          rib.position.set(rx, baseH - 0.48, z + side * (d / 2 + 0.95));
          rib.rotation.x = side * 0.26;
          bGroup.add(rib);
        }
      }
    }

    // Main sculpted upper shaft (stepped slightly above podium)
    const shaftH = style === 'deco' && h >= 22 ? h * 0.76 - baseH : style === 'tower' ? h * 0.78 - baseH : h - baseH;
    const shaftY = baseH + shaftH / 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, Math.max(4, shaftH), d), [matSide, matSide, matRoof, matRoof, matSide, matSide]);
    body.position.set(x, shaftY, z);
    body.castShadow = true;
    body.receiveShadow = true;
    bGroup.add(body);

    // Belt cornice trim above ground floor
    const belt = new THREE.Mesh(new THREE.BoxGeometry(w + 1.1, 0.7, d + 1.1), trimStoneMat);
    belt.position.set(x, baseH + 0.1, z);
    bGroup.add(belt);

    let topY = baseH + Math.max(4, shaftH);

    // Style-specific architectural silhouette sculpting!
    if (style === 'deco') {
      // Cantilevered Art-Deco balconies with crisp horizontal guardrails + vertical fins!
      const floors = Math.max(2, Math.floor(shaftH / 6.2));
      for (let f = 1; f < floors; f++) {
        const fy = baseH + f * (shaftH / floors);
        const balcW = w * 0.74;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(balcW, 0.34, 1.8), trimStoneMat);
        slab.position.set(x, fy, z + d / 2 + 0.75);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(balcW, 0.14, 0.14), darkMetalMat);
        rail.position.set(x, fy + 0.82, z + d / 2 + 1.52);
        const glassGuard = new THREE.Mesh(
          new THREE.BoxGeometry(balcW - 0.4, 0.65, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45, roughness: 0.15 })
        );
        glassGuard.position.set(x, fy + 0.48, z + d / 2 + 1.52);
        bGroup.add(slab, rail, glassGuard);
      }

      // Vertical Art-Deco corner fins / pilasters
      for (const sx of [-w / 2 + 0.4, w / 2 - 0.4]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, shaftH + 1.8, d + 0.8), trimStoneMat);
        fin.position.set(x + sx, shaftY + 0.6, z);
        bGroup.add(fin);
      }

      // Stepped Art-Deco upper setback penthouse tier!
      if (h >= 22) {
        const setH = h - topY;
        const setback = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.74, setH, d * 0.74),
          [matSide, matSide, matRoof, matRoof, matSide, matSide]
        );
        setback.position.set(x, topY + setH / 2, z);
        setback.castShadow = true;
        bGroup.add(setback);
        const midCornice = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.85, d + 1.2), trimStoneMat);
        midCornice.position.set(x, topY + 0.35, z);
        bGroup.add(midCornice);
        topY += setH;
      }

      // Stepped Art-Deco parapet crown + sunlit rooftop pergola
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78 + 0.8, 1.15, d * 0.78 + 0.8), trimStoneMat);
      crown.position.set(x, topY + 0.5, z);
      bGroup.add(crown);
      topY += 1.05;

      // Rooftop Pergola or HVAC chillers
      if (rand() > 0.35) {
        const pergMat = new THREE.MeshStandardMaterial({ color: 0x8f5b38, roughness: 0.78 });
        for (const px of [-w * 0.22, w * 0.22]) {
          for (const pz of [-d * 0.18, d * 0.18]) {
            const pPost = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.8, 6), pergMat);
            pPost.position.set(x + px, topY + 1.4, z + pz);
            bGroup.add(pPost);
          }
        }
        const pergTop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.22, d * 0.42), pergMat);
        pergTop.position.set(x, topY + 2.8, z);
        bGroup.add(pergTop);
      }
    } else if (style === 'tower') {
      // Faceted glass skyscraper with stepped upper setbacks, illuminated vertical architectural ribs & crown spire!
      const ribCol = spire ? 0x34e0c8 : 0xffbe55;
      const ribMat = new THREE.MeshBasicMaterial({ color: ribCol });
      for (const sx of [-w / 2 - 0.12, w / 2 + 0.12]) {
        for (const sz of [-d / 2 - 0.12, d / 2 + 0.12]) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.36, shaftH + 1.2, 0.36), ribMat);
          rib.position.set(x + sx, shaftY, z + sz);
          bGroup.add(rib);
        }
      }

      // Tier 2 setback (chamfered narrower glass core)
      const tier1H = h * 0.16;
      const tier1 = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.76, tier1H, d * 0.76),
        [matSide, matSide, matRoof, matRoof, matSide, matSide]
      );
      tier1.position.set(x, topY + tier1H / 2, z);
      tier1.castShadow = true;
      bGroup.add(tier1);
      const collar1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.9, d + 0.9), darkMetalMat);
      collar1.position.set(x, topY + 0.3, z);
      bGroup.add(collar1);
      topY += tier1H;

      // Tier 3 crown mechanical lantern with glowing architectural ring
      const tier2H = Math.max(5.5, h * 0.08);
      const tier2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.52, tier2H, d * 0.52), darkMetalMat);
      tier2.position.set(x, topY + tier2H / 2, z);
      const crownGlow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.75, d * 0.56), ribMat);
      crownGlow.position.set(x, topY + tier2H + 0.25, z);
      bGroup.add(tier2, crownGlow);
      topY += tier2H + 0.6;

      if (spire) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.62, 18, 8),
          new THREE.MeshStandardMaterial({ color: 0xdbe4f0, metalness: 0.85, roughness: 0.2 })
        );
        mast.position.set(x, topY + 9, z);
        const sideAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 10, 6), darkMetalMat);
        sideAnt.position.set(x + w * 0.16, topY + 5, z - d * 0.12);
        const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
          map: beaconGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        beacon.scale.set(2.8, 2.8, 1);
        beacon.position.set(x, topY + 18.2, z);
        bGroup.add(mast, sideAnt, beacon);
      }
    } else if (style === 'villa') {
      // Sloped terracotta hip roof with overhanging eaves (Barrio Viejo & Villas del Cabo!)
      const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, 0.65, d + 2.2), trimStoneMat);
      eave.position.set(x, topY + 0.2, z);
      bGroup.add(eave);

      const roofRadius = Math.max(w, d) * 0.76;
      const roofH = Math.min(7.5, Math.max(4.5, Math.min(w, d) * 0.25));
      const hipRoof = new THREE.Mesh(new THREE.ConeGeometry(roofRadius, roofH, 4), terraRoofMat);
      hipRoof.rotation.y = Math.PI / 4;
      hipRoof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
      hipRoof.position.set(x, topY + roofH / 2 + 0.4, z);
      hipRoof.castShadow = true;
      bGroup.add(hipRoof);
      topY += roofH * 0.55;
    } else {
      // Market / Port buildings: stepped parapet + rooftop HVAC chillers + water tower
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 1.1, d + 0.9), trimStoneMat);
      parapet.position.set(x, topY + 0.45, z);
      bGroup.add(parapet);
      topY += 0.95;
    }

    // Procedural Rooftop Details on non-villa buildings (AC chillers, water towers, comm masts)
    if (style !== 'villa' && !signSpec?.rooftop) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2.6), darkMetalMat);
      ac.position.set(x - w * 0.16, topY + 0.9, z - d * 0.12);
      bGroup.add(ac);
      if (h < 50 && rand() > 0.42) {
        // Classic coastal rooftop wooden water tower on stilts
        const wtX = x + w * 0.2;
        const wtZ = z + d * 0.14;
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(1.45, 1.55, 2.8, 10),
          new THREE.MeshStandardMaterial({ color: 0x876246, roughness: 0.85 })
        );
        tank.position.set(wtX, topY + 3.2, wtZ);
        const coneTop = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.15, 10), darkMetalMat);
        coneTop.position.set(wtX, topY + 5.1, wtZ);
        for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 5), darkMetalMat);
          leg.position.set(wtX + lx, topY + 1.0, wtZ + lz);
          bGroup.add(leg);
        }
        bGroup.add(tank, coneTop);
      }
    }

    // Glowing Rooftop or Facade Marquee Sign
    if (signSpec) {
      const sTex = createSignTexture(signSpec.text, signSpec.bg, signSpec.fg, signSpec.accent);
      const sMat = new THREE.MeshBasicMaterial({ map: sTex });
      const signW = Math.min(w * 0.94, signSpec.width ?? 22);
      const signH = signSpec.height ?? 5.4;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.9), sMat);
      const faceZ = signSpec.southFace ? z + d / 2 + 0.85 : z - d / 2 - 0.85;
      const signY = signSpec.rooftop ? topY + signH / 2 + 1.4 : Math.min(topY - 3, signSpec.y ?? 11);
      sign.position.set(x, signY, faceZ);
      bGroup.add(sign);

      if (signSpec.rooftop) {
        for (const sx of [-signW * 0.35, signW * 0.35]) {
          const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 6), darkMetalMat);
          strut.position.set(x + sx, topY + 1.1, faceZ);
          bGroup.add(strut);
        }
      }
    }

    root.add(bGroup);
    colliders.push({ minX: x - w / 2 - 0.6, maxX: x + w / 2 + 0.6, minZ: z - d / 2 - 0.6, maxZ: z + d / 2 + 0.6, height: h });
  };

  // Paseo Dorado Oceanfront Art-Deco Hero Hotels & Solsticio Beach Club (facing south toward beach!)
  addBuilding(-120, 158, 42, 24, 35, textures.facadeArtDecoCoral, 0xd48b66, {
    text: 'HOTEL SOLSTICIO', bg: '#161124', fg: '#ffd46e', accent: '#ff5d47', rooftop: true, southFace: true, width: 32, height: 6.4,
  }, { style: 'deco' });
  addBuilding(-250, 158, 38, 24, 29, textures.facadeArtDecoCream, 0xdba978, {
    text: 'CASA AMBAR', bg: '#1a1220', fg: '#ffba52', accent: '#ff7043', rooftop: true, southFace: true, width: 28, height: 5.8,
  }, { style: 'deco' });
  addBuilding(-54, 158, 32, 24, 26, textures.facadeArtDecoTeal, 0x5ca4a0, {
    text: 'SOLSTICIO CLUB', bg: '#0c1f29', fg: '#5bf5df', accent: '#ffbe55', rooftop: true, southFace: true, width: 26, height: 5.2,
  }, { style: 'deco' });
  addBuilding(-308, 158, 28, 24, 23, textures.facadeArtDecoCoral, 0xc77e5b, null, { style: 'deco' });

  // Distrito Torre Faceted Glass Skyscrapers + Mirador Syndicate Vault
  addBuilding(52, -64, 38, 34, 98, textures.facadeGlassGold, 0x263f59, {
    text: 'MIRADOR PLAZA', bg: '#0e1928', fg: '#ffe082', accent: '#4ba3ff', rooftop: true, southFace: true, width: 32, height: 6.6,
  }, { style: 'tower', spire: true });
  addBuilding(-62, -62, 34, 32, 84, textures.facadeGlassTeal, 0x1e364c, null, { style: 'tower', spire: true });
  addBuilding(116, -62, 32, 32, 78, textures.facadeGlassGold, 0x2a4561, null, { style: 'tower', spire: true });
  addBuilding(-112, -118, 34, 28, 72, textures.facadeGlassTeal, 0x1d3448, null, { style: 'tower' });
  addBuilding(56, -124, 36, 28, 92, textures.facadeGlassGold, 0x223b54, null, { style: 'tower', spire: true });
  addBuilding(-58, 56, 36, 30, 64, textures.facadeGlassTeal, 0x1e354c, null, { style: 'tower' });
  addBuilding(62, 58, 34, 28, 74, textures.facadeGlassGold, 0x28435e, {
    text: 'TORRE DORADA', bg: '#111829', fg: '#ffbe55', accent: '#34e0c8', rooftop: true, southFace: true, width: 28, height: 5.8,
  }, { style: 'tower', spire: true });

  // Barrio Viejo Properties: Dante's Loft (Safehouse) & Rafa's Chop & Spray (Garage)
  addBuilding(92, -264, 30, 24, 18, textures.facadeArtDecoCoral, 0xb8593c, {
    text: "DANTE'S LOFT", bg: '#1b1322', fg: '#ffd46e', accent: '#ff7846', rooftop: true, southFace: true, width: 24, height: 4.8,
  }, { style: 'villa' });
  addBuilding(150, -264, 34, 24, 14, textures.facadeArtDecoCream, 0x8f5b3c, {
    text: "RAFA'S GARAGE", bg: '#1a1414', fg: '#ffbe55', accent: '#ff5252', rooftop: true, southFace: true, width: 26, height: 5.2,
  }, { style: 'market' });
  addBuilding(-244, -142, 28, 22, 16, textures.facadeMarket, 0x5c362e, {
    text: 'EL TALLER', bg: '#1b1116', fg: '#ff8a5b', accent: '#34e0c8', rooftop: true, southFace: true, width: 22, height: 4.8,
  }, { style: 'market' });

  // Puerto Cenit Smuggler Warehouse & Bahia Esmeralda Marina Dock
  addBuilding(268, -86, 40, 30, 20, textures.facadePort, 0x3b4859, {
    text: 'CENIT WAREHOUSE', bg: '#131626', fg: '#d4b8ff', accent: '#a876ff', rooftop: true, southFace: true, width: 32, height: 5.2,
  }, { style: 'port' });
  addBuilding(264, 160, 36, 24, 26, textures.facadeArtDecoTeal, 0x4ca19c, {
    text: 'ESMERALDA DOCK', bg: '#0c202a', fg: '#4ef5db', accent: '#ffbe55', rooftop: true, southFace: true, width: 28, height: 5.2,
  }, { style: 'deco' });
  addBuilding(232, 114, 30, 26, 58, textures.facadeGlassGold, 0x243b54, null, { style: 'tower', spire: true });
  addBuilding(298, 114, 32, 26, 44, textures.facadeArtDecoCoral, 0xc77e5b, {
    text: 'CLUB PALMA', bg: '#191024', fg: '#ffbe55', accent: '#ff4b72', rooftop: true, southFace: true, width: 24, height: 4.8,
  }, { style: 'deco' });
  addBuilding(348, 160, 32, 24, 34, textures.facadeArtDecoCream, 0xdba978, null, { style: 'deco' });

  // Cabo Crest Penthouse (Villas del Cabo luxury estate)
  addBuilding(-110, -268, 36, 28, 18, textures.facadeVilla, 0xb85236, {
    text: 'CABO PENTHOUSE', bg: '#10211c', fg: '#6ff5b0', accent: '#ffbe55', rooftop: true, southFace: true, width: 28, height: 5.0,
  }, { style: 'villa' });

  // Fill remaining city blocks with varied non-boxy architectural silhouettes
  const blockDefs = [
    // Mercado Nocturno perimeter buildings
    { x: -385, z: -90, w: 30, d: 34, h: 20, t: textures.facadeMarket, style: 'market' },
    { x: -385, z: -18, w: 30, d: 32, h: 18, t: textures.facadeMarket, style: 'market' },
    { x: -385, z: 58, w: 30, d: 34, h: 24, t: textures.facadeArtDecoCoral, style: 'deco' },
    { x: -242, z: -60, w: 28, d: 30, h: 22, t: textures.facadeMarket, style: 'market' },
    { x: -242, z: 56, w: 30, d: 32, h: 26, t: textures.facadeArtDecoCream, style: 'deco' },
    // Puerto Cenit warehouses & skyline towers
    { x: 268, z: 54, w: 38, d: 30, h: 42, t: textures.facadeGlassTeal, style: 'tower' },
    { x: 332, z: 54, w: 34, d: 28, h: 56, t: textures.facadeGlassGold, style: 'tower', spire: true },
    { x: 410, z: -80, w: 38, d: 44, h: 22, t: textures.facadePort, style: 'port' },
    { x: 410, z: 45, w: 38, d: 40, h: 24, t: textures.facadePort, style: 'port' },
    // Villas del Cabo terracotta-roof hillside estates
    { x: -265, z: -265, w: 34, d: 28, h: 15, t: textures.facadeVilla, style: 'villa' },
    { x: -265, z: -395, w: 38, d: 28, h: 16, t: textures.facadeVilla, style: 'villa' },
    { x: -95, z: -395, w: 36, d: 28, h: 17, t: textures.facadeVilla, style: 'villa' },
    // Barrio Viejo terracotta & deco plazas
    { x: 255, z: -265, w: 36, d: 28, h: 22, t: textures.facadeArtDecoCoral, style: 'villa' },
    { x: 255, z: -395, w: 34, d: 28, h: 24, t: textures.facadeArtDecoTeal, style: 'deco' },
    { x: 90, z: -395, w: 34, d: 28, h: 26, t: textures.facadeArtDecoCream, style: 'villa' },
    // Extra Downtown Skyline depth (stepped glass towers)
    { x: -115, z: 54, w: 30, d: 28, h: 58, t: textures.facadeGlassGold, style: 'tower', spire: true },
    { x: 120, z: 56, w: 32, d: 28, h: 66, t: textures.facadeGlassTeal, style: 'tower', spire: true },
    { x: 184, z: 56, w: 28, d: 28, h: 52, t: textures.facadeGlassGold, style: 'tower' },
    { x: 118, z: -124, w: 30, d: 28, h: 64, t: textures.facadeGlassTeal, style: 'tower' },
    { x: -110, z: -218, w: 28, d: 22, h: 32, t: textures.facadeArtDecoCoral, style: 'deco' },
  ];
  for (const b of blockDefs) {
    addBuilding(b.x, b.z, b.w, b.d, b.h, b.t, 0x3b4859, null, { style: b.style, spire: b.spire });
  }

  // 6. Mercado Nocturno: Cobblestone Lantern Night Market Alley with Tight Focused Lighting
  buildMercadoNocturno(root, colliders, animated, textures);

  // 7. Lush Coastal Coconut Palm Trees (Boardwalk, Dunes, Beach & Boulevards)
  // Keep Puente del Sol road approach sightline unobstructed while making both beaches lush and tropical!
  const palmPositions = [];
  for (let x = -335; x <= 345; x += 22) {
    if (Math.abs(x - 110) < 62) continue;
    // Boardwalk palm row (skip immediate chase camera blocking zone x in [6..36] at z=217)
    if (!(x >= 4 && x <= 38)) {
      palmPositions.push({ x, z: 217, scale: 0.92 + rand() * 0.25 });
    }
    // North sidewalk palm row
    if ((x < 2 || x > 190) && !(x >= 0 && x <= 46)) {
      palmPositions.push({ x: x + 9, z: 184, scale: 0.88 + rand() * 0.24 });
    }
    // Lush beach-dune palm clusters right on the golden sand (keep chase camera sun sightline x in [16..38] clear of tall trunks!)
    if (x < 14 || x > 184) {
      if (Math.abs(x) % 44 < 24) {
        palmPositions.push({ x: x + (rand() - 0.5) * 8, z: 234 + rand() * 14, scale: 0.82 + rand() * 0.32 });
      }
    }
  }
  // Extra prominent tropical beach palm clusters on right-hand Bahia Esmeralda coast (visible in 1-chase.jpg)
  // and Paseo Dorado sandy beach foreground (visible in 4-title.jpg)
  const heroBeachPalms = [
    { x: 186, z: 233, scale: 1.05 }, { x: 204, z: 240, scale: 0.92 }, { x: 228, z: 235, scale: 1.08 },
    { x: 256, z: 242, scale: 0.96 }, { x: 282, z: 234, scale: 1.02 },
    { x: -128, z: 236, scale: 1.04 }, { x: -102, z: 244, scale: 0.9 }, { x: -64, z: 235, scale: 1.06 },
    { x: -24, z: 241, scale: 0.94 }, { x: -175, z: 240, scale: 1.0 }, { x: -225, z: 236, scale: 0.95 },
  ];
  palmPositions.push(...heroBeachPalms);

  for (let z = -260; z <= 100; z += 44) {
    palmPositions.push({ x: -16, z, scale: 0.95 }, { x: 16, z, scale: 0.95 }, { x: -196, z, scale: 0.95 });
  }
  for (const pp of palmPositions) {
    const palm = createPalmTree(rand, pp.scale ?? 1.0);
    palm.position.set(pp.x, 0, pp.z);
    palm.rotation.y = rand() * Math.PI * 2;
    root.add(palm);
    animated.palms.push(palm);
  }

  // 8. Lush Beach Vegetation Clusters & Coastal Beach Props (Paseo Dorado + Bahia Esmeralda!)
  buildLushBeachEnvironment(root, rand);

  // 9. Streetlamps along Main Avenues (tighter focused warm halos)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x262e3d, metalness: 0.7, roughness: 0.3 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe09e });
  const lampGlowTex = getRadialGlowTexture('rgba(255,240,190,0.78)', 'rgba(255,176,72,0.24)', 'rgba(0,0,0,0)');
  for (let x = -320; x <= 320; x += 48) {
    for (const lz of [186, 214, 14, -14]) {
      if (Math.abs(x - 110) < 58 && lz > 150) continue;
      if (x >= -5 && x <= 48 && lz > 150) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 8.2, 6), lampMat);
      pole.position.set(x, 4.1, lz);
      root.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), bulbMat);
      lamp.position.set(x, 8.3, lz);
      root.add(lamp);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(1.85, 1.85, 1);
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

  // 11. 8 Interactive City Property Entrance Rings, Glowing Beacons & Sidewalk Kiosk Signs
  for (const prop of PROPERTIES) {
    const colHex = Number(prop.color.replace('#', '0x'));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.8, 4.7, 32),
      new THREE.MeshBasicMaterial({ color: colHex, side: THREE.DoubleSide, transparent: true, opacity: 0.82 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(prop.x, 0.16, prop.z);
    root.add(ring);

    const innerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 24),
      new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.position.set(prop.x, 0.15, prop.z);
    root.add(innerDisc);

    // Floating rotating property diamond beacon
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.92, 0),
      new THREE.MeshStandardMaterial({ color: colHex, emissive: colHex, emissiveIntensity: 0.72, roughness: 0.25, metalness: 0.5 })
    );
    beacon.position.set(prop.x, 2.6, prop.z);
    root.add(beacon);
    animated.propertyBeacons.push(beacon);

    // Street-level property entrance plaque post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.6, 6), darkMetalMat);
    post.position.set(prop.x + 4.8, 1.8, prop.z - 2.2);
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 1.85, 0.28),
      new THREE.MeshBasicMaterial({ map: createSignTexture(prop.shortName, '#101624', '#fff2d0', prop.color) })
    );
    plaque.position.set(prop.x + 4.8, 3.8, prop.z - 2.2);
    root.add(post, plaque);
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

function buildBoardwalkFences(root) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7d5839, roughness: 0.88 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xbfa078, roughness: 0.82 });

  const spans = [[-330, 34], [186, 345]];
  for (const [x1, x2] of spans) {
    for (let x = x1; x <= x2; x += 7.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.15, 0.24), postMat);
      post.position.set(x, 0.62, 228.0);
      g.add(post);
    }
    const spanLen = x2 - x1;
    const midX = (x1 + x2) / 2;
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(spanLen, 0.14, 0.14), railMat);
    topRail.position.set(midX, 1.05, 228.0);
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(spanLen, 0.1, 0.1), railMat);
    midRail.position.set(midX, 0.62, 228.0);
    g.add(topRail, midRail);
  }
  root.add(g);
}

function buildLushBeachEnvironment(root, rand) {
  const g = new THREE.Group();
  const umbColors = [0xff6b4a, 0x34e0c8, 0xffbe55, 0xff4b72, 0x4ba3ff];

  // 1. Coastal Sea-Grape Bushes & Tropical Hibiscus/Bougainvillea Shrubs along dunes & boardwalk edge
  const bushCoords = [
    // West Paseo Dorado beach (prominently framed in 4-title.jpg!)
    [-300, 231], [-268, 232], [-235, 233], [-204, 231], [-172, 232], [-145, 231],
    [-116, 232], [-96, 240], [-88, 231], [-62, 242], [-58, 233], [-38, 244], [-32, 231], [-10, 232], [12, 231], [27, 232], [32, 240],
    // East Bahia Esmeralda beach (prominently framed on right of 1-chase.jpg!)
    [188, 231], [202, 232], [218, 231], [238, 233], [260, 231], [286, 232], [312, 231], [338, 232],
  ];
  bushCoords.forEach(([bx, bz], i) => {
    const shrub = i % 2 === 0 ? createHibiscusShrub(rand, i) : createCoastalBush(rand);
    shrub.position.set(bx, 0.05, bz);
    g.add(shrub);
  });

  // 2. Wild Dune Grass Tufts dotted naturally across the sand
  for (let x = -325; x <= 340; x += 14) {
    if (x > 36 && x < 182) continue;
    const tuft = createDuneGrassTuft(rand);
    tuft.position.set(x + (rand() - 0.5) * 6, 0.05, 232 + rand() * 24);
    g.add(tuft);
  }

  // 3. Driftwood Logs & Coastal Rocky Outcrops near shoreline & cove edges
  const rockCoords = [
    [-280, 266], [-155, 268], [-42, 264], [32, 260], [186, 262], [248, 268], [310, 266],
  ];
  for (const [rx, rz] of rockCoords) {
    const rocks = createCoastalRocks(rand);
    rocks.position.set(rx, 0.04, rz);
    g.add(rocks);
  }
  const driftwoodCoords = [
    [-215, 258, 0.3], [-92, 261, -0.45], [16, 256, 0.25], [214, 259, -0.2], [274, 262, 0.4],
  ];
  for (const [dx, dz, rot] of driftwoodCoords) {
    const log = createDriftwoodLog();
    log.position.set(dx, 0.24, dz);
    log.rotation.y = rot;
    g.add(log);
  }

  // 4. Iconic Wooden Lifeguard Towers (one on Paseo Dorado for 4-title, one on Bahia Esmeralda for 1-chase!)
  const lg1 = createLifeguardTower(0x34c8d4, 0xff5a47);
  lg1.position.set(-78, 0.05, 246);
  lg1.rotation.y = -0.18;
  g.add(lg1);

  const lg2 = createLifeguardTower(0xffbe55, 0x2ec4b6);
  lg2.position.set(206, 0.05, 244);
  lg2.rotation.y = -0.35;
  g.add(lg2);

  // 5. Thatched Tiki Shade Huts along both beaches
  const tikiSpots = [
    [-245, 244], [-142, 246], [-18, 246], [244, 245], [305, 246],
  ];
  for (const [tx, tz] of tikiSpots) {
    const hut = createTikiHut();
    hut.position.set(tx, 0.05, tz);
    g.add(hut);
  }

  // 6. Colorful Striped Beach Umbrellas with Twin Lounge Chairs & Beach Towels
  for (let x = -315; x <= 325; x += 22) {
    if (x > 34 && x < 184) continue;
    const col = umbColors[Math.abs(Math.floor(x / 7)) % umbColors.length];
    const set = createBeachUmbrellaSet(col);
    set.position.set(x, 0.05, 247 + (rand() - 0.5) * 14);
    set.rotation.y = (rand() - 0.5) * 0.4;
    g.add(set);
  }

  // 7. Colorful Standing Surfboards stuck in the sand near lifeguard towers & boardwalk
  const surfSpots = [
    [-68, 244], [-134, 243], [21, 244], [198, 241], [238, 242],
  ];
  for (const [sx, sz] of surfSpots) {
    const boards = createSurfboardCluster();
    boards.position.set(sx, 0.05, sz);
    g.add(boards);
  }

  root.add(g);
}

function createCoastalBush(rand) {
  const g = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color: 0x257842, roughness: 0.85 });
  const matB = new THREE.MeshStandardMaterial({ color: 0x32944f, roughness: 0.82 });
  for (let i = 0; i < 4; i++) {
    const r = 0.85 + rand() * 0.6;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), i % 2 === 0 ? matA : matB);
    m.scale.set(1.25, 0.78, 1.15);
    m.position.set((rand() - 0.5) * 1.6, r * 0.55, (rand() - 0.5) * 1.2);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function createHibiscusShrub(rand, idx) {
  const g = createCoastalBush(rand);
  const bloomCols = [0xff4f86, 0xff5a42, 0xffc84d, 0xf255a8];
  const bloomMat = new THREE.MeshBasicMaterial({ color: bloomCols[idx % bloomCols.length] });
  for (let i = 0; i < 6; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bloomMat);
    fl.position.set((rand() - 0.5) * 1.9, 0.65 + rand() * 0.75, (rand() - 0.5) * 1.4);
    g.add(fl);
  }
  return g;
}

function createDuneGrassTuft(rand) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: rand() > 0.4 ? 0x6ea649 : 0x89b856, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + rand() * 0.4;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.35 + rand() * 0.55, 3), mat);
    blade.position.set(Math.cos(ang) * 0.28, 0.58, Math.sin(ang) * 0.28);
    blade.rotation.z = Math.cos(ang) * 0.48;
    blade.rotation.x = Math.sin(ang) * 0.48;
    g.add(blade);
  }
  return g;
}

function createDriftwoodLog() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa68c6e, roughness: 0.92 });
  const main = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.4, 7), mat);
  main.rotation.z = Math.PI / 2;
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.6, 6), mat);
  branch.rotation.set(0.4, 0.5, 1.1);
  branch.position.set(0.9, 0.22, 0.42);
  g.add(main, branch);
  return g;
}

function createCoastalRocks(rand) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5d626b, roughness: 0.92 });
  for (let i = 0; i < 4; i++) {
    const s = 0.75 + rand() * 1.15;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
    rock.scale.set(1.3, 0.65, 1.1);
    rock.position.set((rand() - 0.5) * 3.2, s * 0.35, (rand() - 0.5) * 2.2);
    rock.rotation.set(rand(), rand(), rand());
    g.add(rock);
  }
  return g;
}

function createLifeguardTower(bodyHex, accentHex) {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9c29e, roughness: 0.8 });
  const paintMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c3a54, roughness: 0.15, metalness: 0.7 });

  // 4 tall timber stilts
  for (const [sx, sz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.6, 0.24), woodMat);
    leg.position.set(sx, 1.8, sz);
    leg.castShadow = true;
    g.add(leg);
  }
  // Deck platform + perimeter railing
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.26, 4.4), woodMat);
  deck.position.y = 3.65;
  g.add(deck);
  for (const side of [-2.1, 2.1]) {
    const rX = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.12), woodMat);
    rX.position.set(0, 4.45, side);
    const rZ = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 4.4), woodMat);
    rZ.position.set(side, 4.45, 0);
    g.add(rX, rZ);
  }
  // Painted booth cabin + wide lookout windows + pitched roof
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.3, 2.6), paintMat);
  cabin.position.set(0, 4.9, -0.2);
  cabin.castShadow = true;
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 1.8), glassMat);
  win.position.set(0, 5.25, -0.1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.3, 4), accentMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 6.7, -0.2);
  // Slanted beach stairs + red rescue buoy
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 4.2), woodMat);
  stairs.position.set(0, 1.8, 2.8);
  stairs.rotation.x = 0.72;
  const buoy = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.26), new THREE.MeshBasicMaterial({ color: 0xff3b4e }));
  buoy.position.set(1.55, 4.6, 1.8);
  g.add(cabin, win, roof, stairs, buoy);
  return g;
}

function createTikiHut() {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: 0.88 });
  const thatchMat = new THREE.MeshStandardMaterial({ color: 0xc99c58, roughness: 0.94 });
  for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.2, 6), postMat);
    p.position.set(px, 1.6, pz);
    p.castShadow = true;
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.65, 10), thatchMat);
  roof.position.y = 3.95;
  roof.castShadow = true;
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.9), postMat);
  bench.position.set(0, 0.45, 0);
  g.add(roof, bench);
  return g;
}

function createBeachUmbrellaSet(colorHex) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.1, 6),
    new THREE.MeshStandardMaterial({ color: 0xede6d8 })
  );
  pole.position.y = 1.55;
  g.add(pole);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(2.35, 0.85, 10),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65 })
  );
  canopy.position.y = 3.0;
  canopy.castShadow = true;
  g.add(canopy);

  // Twin wooden sun loungers + colorful beach towel underneath!
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf4eee2, roughness: 0.72 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.78 });
  for (const lx of [-1.05, 1.05]) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.24, 2.2), frameMat);
    bed.position.set(lx, 0.22, 0.2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.9), cushionMat);
    back.position.set(lx, 0.56, -0.78);
    back.rotation.x = 0.52;
    g.add(bed, back);
  }
  return g;
}

function createSurfboardCluster() {
  const g = new THREE.Group();
  const cols = [0xff5d47, 0x34e0c8, 0xffbe55];
  cols.forEach((col, i) => {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 2.55, 0.09),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.15 })
    );
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.45, 0.11),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const wrap = new THREE.Group();
    wrap.add(board, stripe);
    wrap.position.set((i - 1) * 0.72, 1.15, (i % 2) * 0.25);
    wrap.rotation.z = (i - 1) * 0.12;
    wrap.rotation.y = i * 0.25;
    g.add(wrap);
  });
  return g;
}

function buildMarinaBoats(root) {
  const g = new THREE.Group();
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8f6642, roughness: 0.85 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fc, roughness: 0.28, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b6e82, roughness: 0.3 });

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
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x262c38, roughness: 0.68 });
  const lampGlowTex = getRadialGlowTexture('rgba(255,244,205,0.85)', 'rgba(255,176,72,0.28)', 'rgba(0,0,0,0)');
  const redBeaconTex = getRadialGlowTexture('#ffffff', 'rgba(255,48,78,0.86)', 'rgba(0,0,0,0)');

  const deck = new THREE.Mesh(new THREE.BoxGeometry(142, 0.8, 23.5), deckMat);
  deck.position.set(cx, 0.32, cz);
  g.add(deck);

  for (const side of [-11.5, 11.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(142, 1.25, 0.72), redSteel);
    rail.position.set(cx, 1.15, cz + side);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(142, 0.22, 0.85), goldTrim);
    topBar.position.set(cx, 1.85, cz + side);
    g.add(rail, topBar);

    for (let lx = cx - 56; lx <= cx + 56; lx += 28) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.2, 6), redSteel);
      post.position.set(lx, 4.2, cz + side * 0.96);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      orb.scale.set(1.75, 1.75, 1);
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
      beacon.scale.set(2.8, 2.8, 1);
      beacon.position.set(px, 50.8, cz + side);
      g.add(towerLower, towerUpper, cap, beacon);
    }
    for (const cy of [18, 32, 44.5]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 24.4), goldTrim);
      beam.position.set(px, cy, cz);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 24.6), redSteel);
      rib.position.set(px, cy, cz);
      g.add(beam, rib);
    }
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

function buildMercadoNocturno(root, colliders, animated, textures) {
  const g = new THREE.Group();
  const cx = -310;
  const cz = -55;

  // Rich textured cobblestone alley pavement (tighter roughness/metalness -> NO washed-out mirror streaks!)
  const cobbleMat = new THREE.MeshStandardMaterial({
    map: textures.cobble, roughness: 0.76, metalness: 0.08,
  });
  const cobbleRoad = new THREE.Mesh(new THREE.PlaneGeometry(25, 92), cobbleMat);
  cobbleRoad.rotation.x = -Math.PI / 2;
  cobbleRoad.position.set(cx, 0.11, cz - 2);
  cobbleRoad.receiveShadow = true;
  g.add(cobbleRoad);

  // Subtle localized warm puddle/lantern ground pools beneath stalls (focused, crisp!)
  const poolTex = getRadialGlowTexture('rgba(255,190,98,0.22)', 'rgba(255,120,56,0.08)', 'rgba(0,0,0,0)');
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  for (let i = 0; i < 6; i++) {
    const zPos = cz - 30 + i * 12.2;
    for (const side of [-1, 1]) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(cx + side * 9.8, 0.125, zPos);
      g.add(pool);
    }
  }

  // Entrance & Far Neon Archways
  const archMat = new THREE.MeshStandardMaterial({ color: 0x992334, roughness: 0.42, metalness: 0.28 });
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

  // Architectural Side Facade Walls flanking Mercado Nocturno Alley with upper balconies & cornices
  const alleyWallMat = new THREE.MeshStandardMaterial({ color: 0x261a2b, roughness: 0.78 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4b3545, roughness: 0.72 });
  const winGlowMat = new THREE.MeshBasicMaterial({ color: 0xffce73 });
  const neonStripMats = [
    new THREE.MeshBasicMaterial({ color: 0xff4b72 }),
    new THREE.MeshBasicMaterial({ color: 0x34e0c8 }),
  ];
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 17, 86), alleyWallMat);
    wall.position.set(cx + side * 21, 8.5, cz - 2);
    g.add(wall);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.9, 86.6), trimMat);
    cornice.position.set(cx + side * 20.8, 17.2, cz - 2);
    g.add(cornice);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 80), neonStripMats[side > 0 ? 1 : 0]);
    strip.position.set(cx + side * 16.9, 5.2, cz - 2);
    g.add(strip);
    for (let wz = -34; wz <= 30; wz += 10) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.3, 3.2), winGlowMat);
      win.position.set(cx + side * 16.9, 11.2, cz + wz);
      const balc = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 4.2), trimMat);
      balc.position.set(cx + side * 16.4, 9.8, cz + wz);
      g.add(win, balc);
    }
  }

  // Detailed Vendor Stalls with Posts, Striped Awnings, Glowing Counter Interiors & Goods
  const awningColors = [0xff4b5c, 0xffae38, 0x2ec4b6, 0xe84393];
  const stallWood = new THREE.MeshStandardMaterial({ color: 0x6b422a, roughness: 0.8 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2f242c, roughness: 0.65 });
  const goodsColors = [0xffc857, 0xff5e5b, 0x42e38c, 0x5bf5df];
  const stallGlowTex = getRadialGlowTexture('rgba(255,235,175,0.82)', 'rgba(255,148,54,0.28)', 'rgba(0,0,0,0)');

  for (let i = 0; i < 6; i++) {
    const zPos = cz - 30 + i * 12.2;
    for (const side of [-1, 1]) {
      const xPos = cx + side * 13.2;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.35, 6.4), stallWood);
      counter.position.set(xPos, 0.68, zPos);
      g.add(counter);

      const backGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 2.1, 5.6),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffb85c : 0xff7b6b })
      );
      backGlow.position.set(xPos + side * 1.9, 2.3, zPos);
      g.add(backGlow);

      for (const dz of [-2.9, 2.9]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.8, 6), postMat);
        post.position.set(xPos - side * 1.85, 1.9, zPos + dz);
        g.add(post);
      }

      const awCol = awningColors[(i + (side > 0 ? 1 : 0)) % awningColors.length];
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 0.28, 7.2),
        new THREE.MeshStandardMaterial({ color: awCol, emissive: awCol, emissiveIntensity: 0.22, roughness: 0.58 })
      );
      awning.position.set(xPos - side * 0.35, 3.9, zPos);
      awning.rotation.z = side * 0.16;
      g.add(awning);

      for (let k = -1; k <= 1; k++) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.55, 1.3),
          new THREE.MeshStandardMaterial({ color: goodsColors[(i + k + 4) % 4], roughness: 0.68 })
        );
        box.position.set(xPos - side * 0.7, 1.62, zPos + k * 1.8);
        g.add(box);
      }

      // Tight focused stall under-lamp sprite
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: stallGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lamp.scale.set(1.55, 1.55, 1);
      lamp.position.set(xPos - side * 0.8, 3.3, zPos);
      g.add(lamp);
    }
  }

  // Tactical Cover Crates & Barrels
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x99683f, roughness: 0.8 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x264860, roughness: 0.5, metalness: 0.4 });
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

  // Crisscrossing Overhead Glowing Paper Lantern Strings (tighter crisp halos)
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e1824 });
  const capMat = new THREE.MeshBasicMaterial({ color: 0x1a1216 });
  const lanternPalette = [
    { hex: 0xff5a36, glow: 'rgba(255,96,52,0.52)' },
    { hex: 0xffca4a, glow: 'rgba(255,204,72,0.54)' },
    { hex: 0xff3b7c, glow: 'rgba(255,62,132,0.52)' },
    { hex: 0xff9436, glow: 'rgba(255,152,56,0.54)' },
  ];

  for (let row = 0; row < 8; row++) {
    const zRow = cz - 26 + row * 9.5;
    const wireY = 6.9 + (row % 2) * 0.65;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 30, 4), wireMat);
    wire.rotation.z = Math.PI / 2;
    wire.position.set(cx, wireY, zRow);
    g.add(wire);

    for (let j = -4; j <= 4; j++) {
      const lx = cx + j * 3.1;
      const sag = Math.cos((j / 4) * Math.PI * 0.5) * -0.55;
      const pal = lanternPalette[(row + j + 8) % lanternPalette.length];

      const lGroup = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 10),
        new THREE.MeshBasicMaterial({ color: pal.hex })
      );
      body.scale.set(0.9, 1.24, 0.9);
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 8), capMat);
      capTop.position.y = 0.56;
      const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.14, 8), capMat);
      capBot.position.y = -0.56;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getRadialGlowTexture('#fff5d6', pal.glow, 'rgba(0,0,0,0)'),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(1.6, 1.6, 1);

      lGroup.add(body, capTop, capBot, halo);
      lGroup.position.set(lx, wireY - 0.55 + sag, zRow);
      g.add(lGroup);
      animated.lanterns.push(lGroup);
    }
  }

  // Tighter, Localized Warm Market PointLights (focused pools under lanterns & stalls without washing out the alley!)
  const marketLights = [
    [cx, cz - 24, 0xff8c42],
    [cx - 6, cz - 10, 0xffaa4c],
    [cx + 6, cz - 2, 0xff7846],
    [cx - 5, cz + 10, 0xffbe55],
    [cx + 5, cz + 18, 0xff8c42],
  ];
  for (const [lx, lz, col] of marketLights) {
    const pl = new THREE.PointLight(col, 15, 19, 2.0);
    pl.position.set(lx, 5.4, lz);
    g.add(pl);
  }

  root.add(g);
}

// Upgraded Curved Coconut Palm Tree with segmented curving trunk, coconuts & dense arched multi-blade palm fronds!
function createPalmTree(rand, scale = 1.0) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a573a, roughness: 0.9 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x5c3e28, roughness: 0.92 });
  const frondMatA = new THREE.MeshStandardMaterial({ color: 0x268544, roughness: 0.62, side: THREE.DoubleSide });
  const frondMatB = new THREE.MeshStandardMaterial({ color: 0x39a354, roughness: 0.6, side: THREE.DoubleSide });
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.78 });

  const h = (11.2 + rand() * 4.2) * scale;
  const curve = (rand() > 0.5 ? 1 : -1) * (1.5 + rand() * 1.9) * scale;
  const segs = 7;
  let topX = 0;

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const x0 = curve * (t0 * t0);
    const x1 = curve * (t1 * t1);
    const segH = h / segs;
    const rBot = (0.44 - i * 0.042) * scale;
    const rTop = (0.39 - i * 0.042) * scale;

    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH + 0.16, 7), trunkMat);
    seg.position.set((x0 + x1) * 0.5, segH * (i + 0.5), 0);
    seg.rotation.z = -Math.atan2(x1 - x0, segH);
    seg.castShadow = true;
    g.add(seg);

    // Subtle bark collar ring
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 1.08, rTop * 1.08, 0.14, 7), ringMat);
    ring.position.set(x1, segH * (i + 0.96), 0);
    ring.rotation.z = seg.rotation.z;
    g.add(ring);
    topX = x1;
  }

  const crown = new THREE.Group();
  crown.position.set(topX, h, 0);

  // Cluster of hanging coconuts tucked beneath fronds
  for (let c = 0; c < 4; c++) {
    const cAng = (c / 4) * Math.PI * 2 + 0.4;
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 7, 6), coconutMat);
    nut.position.set(Math.cos(cAng) * 0.36 * scale, -0.32 * scale, Math.sin(cAng) * 0.36 * scale);
    crown.add(nut);
  }

  // 11 Dense Arched Multi-Blade Palm Fronds (inner lift + outer graceful droop!)
  const frondCount = 11;
  for (let f = 0; f < frondCount; f++) {
    const ang = (f / frondCount) * Math.PI * 2 + (f % 2) * 0.12;
    const tierLift = f % 2 === 0 ? 0.22 : -0.1;
    const mat = f % 2 === 0 ? frondMatA : frondMatB;

    const fWrap = new THREE.Group();
    fWrap.rotation.y = ang;

    // Inner rising frond arch
    const inner = new THREE.Mesh(new THREE.BoxGeometry(2.9 * scale, 0.08, 0.85 * scale), mat);
    inner.position.set(1.35 * scale, 0.35 * scale + tierLift, 0);
    inner.rotation.z = 0.28 + tierLift * 0.4;

    // Outer drooping tapered palm blade tip
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 3.4 * scale, 4), mat);
    outer.scale.set(1.0, 1.0, 0.24);
    outer.rotation.z = -Math.PI / 2 - 0.56;
    outer.position.set(3.85 * scale, -0.35 * scale + tierLift, 0);

    fWrap.add(inner, outer);
    crown.add(fWrap);
  }

  g.add(crown);
  g.userData.crown = crown;
  return g;
}
