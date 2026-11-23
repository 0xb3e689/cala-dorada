// 3D open-world city builder: non-boxy Art-Deco & skyline architecture, lush tropical beaches & coastal props, Puente del Sol, Mercado Nocturno cobblestones & lanterns, and 8 interactive city properties.

import * as THREE from '../../vendor/three.module.min.js';
import { WORLD, PROPERTIES, VEHICLES } from '../core/config.js';
import {
  ROAD_X, ROAD_Z, PUBLIC_FACILITIES, GOLDEN_SHELLS, FISHING_SPOTS, GARDEN_SITES, ROOF_REPAIR_SITES,
  getRiverCenterX, getRiverHalfWidth, RIVER_BRIDGES, COVER_BUILDINGS,
  GAS_STATION, FUEL_BARREL_SPOTS, BOAT_DOCK_SPOTS,
} from './cityPlan.js';
import { CollisionWorld } from './collisionWorld.js';
import { createSignTexture } from './textures.js';
import { getRadialGlowTexture, createVehicleMesh } from '../entities/vehicleFactory.js';

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
  const collisionWorld = new CollisionWorld(48);
  const colliders = collisionWorld.colliders;
  const parkedVehicles = [];
  const animated = {
    ocean: null,
    palms: [],
    shells: [],
    lanterns: [],
    propertyBeacons: [],
    gardenBeds: {},
    roofSites: {},
    streetLampPositions: [],
    nightGlowMeshes: [],
    nightWindowMats: [],
    trafficSignals: [],
    explosives: [],
  };

  // 1. Base City Terrain & Terraced Plaza Slab (ends cleanly at beach z=230 so it NEVER overlaps ocean!)
  const groundMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.88, metalness: 0.04 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1180, 700), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -120);
  ground.receiveShadow = true;
  root.add(ground);

  // Golden Beach Sand Strip along South Coast (Paseo Dorado + Bahia Esmeralda, z=224..280)
  const sandMat = new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.94, metalness: 0.02 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1260, 56), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.05, 252);
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

  // Marina Channel (bay water cutting right under Puente del Sol, leaving dry underpass embankments on [56..66] & [154..164])
  const bayWater = new THREE.Mesh(new THREE.PlaneGeometry(92, 220), waterMat);
  bayWater.rotation.x = -Math.PI / 2;
  bayWater.position.set(110, 0.03, 240);
  root.add(bayWater);

  // Scenic Navigable River: RÍO DORADO winding from northern hills (z=-438) down into Marina Bay!
  buildRioDorado(root, waterMat, sandMat);

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
    // Split horizontal avenues cleanly around elevated bridge spans so the river & hollow underpasses show cleanly underneath!
    const bridge = RIVER_BRIDGES.find((b) => Math.abs(b.z - rz) < 2);
    const segments = bridge
      ? [[-370, bridge.x1 + 1], [bridge.x2 - 1, 390]]
      : [[-370, 390]];
    for (const [xStart, xEnd] of segments) {
      const len = xEnd - xStart;
      if (len <= 2) continue;
      const mat = roadMat.clone();
      mat.map = textures.road.clone();
      mat.map.needsUpdate = true;
      mat.map.repeat.set(1, len / 26);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(roadW, len), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set((xStart + xEnd) * 0.5, 0.09, rz);
      mesh.receiveShadow = true;
      root.add(mesh);
    }
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

  // 4. Elevated Bridges with Hollow Passable Underpasses (Puente del Sol + Río Dorado River Bridges!)
  buildPuenteDelSol(root, 110, 200, collisionWorld, animated, textures);
  buildRiverBridges(root, collisionWorld, animated, textures);

  // 5. Detailed Non-Boxy Architectural City Builder
  const trimStoneMat = new THREE.MeshStandardMaterial({ color: 0xf7e3c4, roughness: 0.48, metalness: 0.18 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x263140, roughness: 0.42, metalness: 0.72 });
  const lobbyGlassMat = new THREE.MeshStandardMaterial({ color: 0x1a2e44, emissive: 0x6b451f, emissiveIntensity: 0.55, roughness: 0.16, metalness: 0.75 });
  animated.nightWindowMats.push(lobbyGlassMat);
  const terraRoofMat = new THREE.MeshStandardMaterial({ color: 0xb84f32, roughness: 0.76, metalness: 0.05 });
  const awningPalette = [0xff5d47, 0x2ec4b6, 0xffbe55, 0xe84393, 0x3b82f6];
  const beaconGlowTex = getRadialGlowTexture('#ffffff', 'rgba(255,60,92,0.88)', 'rgba(0,0,0,0)');

  const addBuilding = (x, z, w, d, h, facadeTex, roofColor, signSpec = null, opts = {}) => {
    const style = opts.style ?? (h >= 54 ? 'tower' : 'deco');
    const spire = Boolean(opts.spire);
    const bGroup = new THREE.Group();
    const matSide = new THREE.MeshStandardMaterial({
      map: facadeTex,
      emissiveMap: facadeTex,
      emissive: new THREE.Color(0xffd699),
      emissiveIntensity: 0.12,
      roughness: style === 'tower' ? 0.34 : 0.56,
      metalness: style === 'tower' ? 0.38 : 0.14,
    });
    animated.nightWindowMats.push(matSide);
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
    collisionWorld.addBox(x - w / 2 - 0.5, x + w / 2 + 0.5, z - d / 2 - 0.5, z + d / 2 + 0.5, h, 'building');
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
  addBuilding(56, -124, 36, 28, 92, textures.facadeGlassGold, 0x223b54, null, { style: 'tower', spire: true });
  addBuilding(62, 58, 34, 28, 74, textures.facadeGlassGold, 0x28435e, {
    text: 'TORRE DORADA', bg: '#111829', fg: '#ffbe55', accent: '#34e0c8', rooftop: true, southFace: true, width: 28, height: 5.8,
  }, { style: 'tower', spire: true });
  // Note: (-102,-124) hosts Cala Dorada General Hospital, (118,-124) hosts CDPD Precinct HQ, and (-90,60) hosts Central Parque Dorado!

  // Barrio Viejo Properties: Dante's Loft (Safehouse) & Rafa's Chop & Spray (Garage — framing Río Dorado gorge!)
  addBuilding(86, -264, 30, 24, 18, textures.facadeArtDecoCoral, 0xb8593c, {
    text: "DANTE'S LOFT", bg: '#1b1322', fg: '#ffd46e', accent: '#ff7846', rooftop: true, southFace: true, width: 24, height: 4.8,
  }, { style: 'villa' });
  addBuilding(156, -264, 30, 24, 14, textures.facadeArtDecoCream, 0x8f5b3c, {
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
    // Extra Downtown Skyline depth (stepped glass towers — shifted clear of Parque Dorado, Precinct HQ & Río Dorado)
    { x: -124, z: -60, w: 30, d: 28, h: 62, t: textures.facadeGlassGold, style: 'tower', spire: true },
    { x: 108, z: 56, w: 30, d: 28, h: 66, t: textures.facadeGlassTeal, style: 'tower', spire: true },
    { x: 214, z: 56, w: 28, d: 28, h: 52, t: textures.facadeGlassGold, style: 'tower' },
    { x: -110, z: -218, w: 28, d: 22, h: 32, t: textures.facadeArtDecoCoral, style: 'deco' },
  ];
  for (const b of blockDefs) {
    addBuilding(b.x, b.z, b.w, b.d, b.h, b.t, 0x3b4859, null, { style: b.style, spire: b.spire });
  }

  // 5b. Real Public Urban Facilities (General Hospital, CDPD Precinct HQ, Central Parque Dorado, Bus Stops, Traffic Lights, Hydrants, Curbs, Parking Lots & Coastal Perimeter)
  buildPublicFacilities(root, collisionWorld, animated, textures, rand, parkedVehicles);

  // 5c. 3 Enterable Roofed Cover Buildings (Torre Parking Deck, Puerto Cenit Open Warehouse, Barrio Viejo Arcade)
  buildCoverBuildings(root, collisionWorld, animated, textures);

  // 6. Mercado Nocturno: Cobblestone Lantern Night Market Alley with Tight Focused Lighting
  buildMercadoNocturno(root, collisionWorld, animated, textures);

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
  buildLushBeachEnvironment(root, rand, collisionWorld);

  // 9. Streetlamps along Main Avenues with Working Night Ground Glow Pools
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x262e3d, metalness: 0.7, roughness: 0.3 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe4a8 });
  const lampGlowTex = getRadialGlowTexture('rgba(255,240,190,0.82)', 'rgba(255,176,72,0.28)', 'rgba(0,0,0,0)');
  const streetPoolTex = getRadialGlowTexture('rgba(255,214,132,0.44)', 'rgba(255,164,68,0.16)', 'rgba(0,0,0,0)');
  const addStreetLamp = (lx, lz) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 8.2, 6), lampMat);
    pole.position.set(lx, 4.1, lz);
    root.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.14), lampMat);
    arm.position.set(lx, 8.15, lz);
    root.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), bulbMat);
    lamp.position.set(lx, 8.25, lz);
    root.add(lamp);
    const haloMat = new THREE.SpriteMaterial({
      map: lampGlowTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(2.1, 2.1, 1);
    halo.position.set(lx, 8.25, lz);
    root.add(halo);
    // Warm localized road/sidewalk illumination pool directly underneath each lamp
    const poolMat = new THREE.MeshBasicMaterial({
      map: streetPoolTex, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 16.5), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(lx, 0.13, lz);
    root.add(pool);
    animated.streetLampPositions.push(new THREE.Vector3(lx, 7.6, lz));
    animated.nightGlowMeshes.push({ mat: haloMat, dayOp: 0.18, nightOp: 0.92 });
    animated.nightGlowMeshes.push({ mat: poolMat, dayOp: 0.0, nightOp: 0.76 });
  };

  for (let x = -320; x <= 320; x += 48) {
    for (const lz of [186, 214, 134, 106, 14, -14, -166, -194]) {
      if (Math.abs(x - 110) < 58 && lz > 150) continue;
      if (x >= -5 && x <= 48 && lz > 150) continue;
      if (lz < 150 && (Math.abs(x % 180) < 18)) continue;
      addStreetLamp(x, lz);
    }
  }
  for (let z = -310; z <= 160; z += 54) {
    for (const lx of [-194, -166, -14, 14, 166, 194]) {
      if (Math.abs(z - 200) < 20 || Math.abs(z - 120) < 20 || Math.abs(z) < 20 || Math.abs(z + 180) < 20) continue;
      addStreetLamp(lx, z);
    }
  }

  // (All out-of-nowhere mid-street stunt ramps removed for realistic drivable roads!)

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

  // 13. Interactive World Activity Sites (Fishing Piers, Raised Garden Beds & Barrio Viejo Terracotta Roof Repair)
  buildActivityWorldSites(root, animated, collisionWorld);

  // 14. Roadside Estación Sol Explosive Gas Station + Red Fuel Barrels + Drivable Docked Speedboats + Parked Cala Cab
  buildGasStationAndExplosives(root, animated, collisionWorld);
  buildDockedSpeedboatsAndTaxi(root, parkedVehicles);

  scene.add(root);
  return { root, colliders, collisionWorld, animated, parkedVehicles };
}

function buildActivityWorldSites(root, animated, collisionWorld) {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5e3b, roughness: 0.86 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b281c, roughness: 0.95 });
  const terraMat = new THREE.MeshStandardMaterial({ color: 0xc25434, roughness: 0.72 });
  const damagedMat = new THREE.MeshStandardMaterial({
    color: 0xffb347, emissive: 0xff8c1a, emissiveIntensity: 0.65, transparent: true, opacity: 0.78, roughness: 0.45,
  });

  // A. Fishing Pier Props & Paseo Dorado Wooden Fishing Pier
  for (const spot of FISHING_SPOTS) {
    if (spot.id === 'fish-paseo') {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 42), woodMat);
      pier.position.set(spot.x, 0.48, spot.z + 4);
      root.add(pier);
      for (let pz = spot.z - 14; pz <= spot.z + 22; pz += 9) {
        for (const px of [-2.2, 2.2]) {
          const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8), woodMat);
          piling.position.set(spot.x + px, -0.3, pz);
          root.add(piling);
        }
      }
    }
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.8), woodMat);
    crate.position.set(spot.x + 1.8, 0.95, spot.z - 1.2);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x34e0c8, roughness: 0.4 }));
    bucket.position.set(spot.x - 1.6, 0.82, spot.z - 0.8);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.75, 28),
      new THREE.MeshBasicMaterial({ color: 0x34e0c8, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(spot.x, 0.82, spot.z);
    root.add(crate, bucket, ring);
  }

  // B. 3D Raised Garden Beds with Dynamic Growth Stage Meshes (4 plots per site)
  for (const site of GARDEN_SITES) {
    const sitePlots = [];
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = site.x - 2.6 + col * 5.2;
      const bz = site.z - 2.0 + row * 4.0;
      const bedGroup = new THREE.Group();
      bedGroup.position.set(bx, 0, bz);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.65, 2.8), woodMat);
      frame.position.y = 0.325;
      frame.castShadow = true;
      const soil = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.14, 2.45), soilMat);
      soil.position.y = 0.63;
      bedGroup.add(frame, soil);

      const plantRoot = new THREE.Group();
      plantRoot.position.y = 0.7;
      bedGroup.add(plantRoot);
      root.add(bedGroup);
      sitePlots.push(plantRoot);
    }
    const gRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.2, 28),
      new THREE.MeshBasicMaterial({ color: 0x42e38c, side: THREE.DoubleSide, transparent: true, opacity: 0.76 })
    );
    gRing.rotation.x = -Math.PI / 2;
    gRing.position.set(site.x, 0.15, site.z + 4.4);
    root.add(gRing);
    animated.gardenBeds[site.id] = sitePlots;
  }

  // C. Barrio Viejo Interactive Terracotta Roof Repair Sites (low veranda roof + ladder + 6 swappable tiles!)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6cdb2, roughness: 0.78 });
  for (const site of ROOF_REPAIR_SITES) {
    const rg = new THREE.Group();
    rg.position.set(site.x, 0, site.z);

    // Low terracotta veranda structure with slanted tiled roof
    const shed = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.4, 5.6), wallMat);
    shed.position.set(0, 1.7, -3.5);
    shed.castShadow = true;
    const roofBase = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.28, 6.4), terraMat);
    roofBase.position.set(0, 3.65, -3.5);
    roofBase.rotation.x = 0.24;
    rg.add(shed, roofBase);

    // Wooden access ladder leaning against roof eaves
    for (const lx of [-0.45, 0.45]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.8, 6), woodMat);
      rail.position.set(lx, 1.75, -0.35);
      rail.rotation.x = -0.26;
      rg.add(rail);
    }
    for (let r = 0; r < 6; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), woodMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.45 + r * 0.52, -0.05 - r * 0.13);
      rg.add(rung);
    }

    // 6 Individual Terracotta Tile Slots (damaged = glowing amber gap, repaired = solid terracotta tile!)
    const tileSlots = [];
    for (let t = 0; t < site.totalTiles; t++) {
      const tx = -3.1 + (t % 3) * 3.1;
      const tz = -4.6 + Math.floor(t / 3) * 2.1;
      const ty = 3.92 - Math.floor(t / 3) * 0.5;
      const tileMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.24, 1.65), damagedMat.clone());
      tileMesh.position.set(tx, ty, tz);
      tileMesh.rotation.x = 0.24;
      rg.add(tileMesh);
      tileSlots.push({ mesh: tileMesh, repairedMat: terraMat, damagedMat: tileMesh.material });
    }

    const rRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.0, 28),
      new THREE.MeshBasicMaterial({ color: 0xffbe55, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    rRing.rotation.x = -Math.PI / 2;
    rRing.position.set(0, 0.15, 1.2);
    rg.add(rRing);

    root.add(rg);
    animated.roofSites[site.id] = tileSlots;
    collisionWorld.addRect(site.x, site.z - 3.5, 8.4, 5.8, 4.0, 'prop');
  }
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

function buildLushBeachEnvironment(root, rand, collisionWorld) {
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
  if (collisionWorld) collisionWorld.addRect(-78, 246, 4.4, 4.4, 7.0, 'prop');

  const lg2 = createLifeguardTower(0xffbe55, 0x2ec4b6);
  lg2.position.set(206, 0.05, 244);
  lg2.rotation.y = -0.35;
  g.add(lg2);
  if (collisionWorld) collisionWorld.addRect(206, 244, 4.4, 4.4, 7.0, 'prop');

  // 5. Thatched Tiki Shade Huts along both beaches
  const tikiSpots = [
    [-245, 244], [-142, 246], [-18, 246], [244, 245], [305, 246],
  ];
  for (const [tx, tz] of tikiSpots) {
    const hut = createTikiHut();
    hut.position.set(tx, 0.05, tz);
    g.add(hut);
    if (collisionWorld) collisionWorld.addRect(tx, tz, 3.6, 3.6, 4.5, 'prop');
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

function buildRioDorado(root, waterMat, sandMat) {
  const g = new THREE.Group();
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x9aa490, roughness: 0.9 });
  const concMat = new THREE.MeshStandardMaterial({ color: 0x8b939e, roughness: 0.85 });

  // Segmented meandering turquoise river channel + gentle sloped sandy riverbanks from z = -438 to z = 166
  const stepZ = 14;
  for (let z = -438; z < 164; z += stepZ) {
    const zMid = z + stepZ * 0.5;
    const cx0 = getRiverCenterX(z);
    const cx1 = getRiverCenterX(z + stepZ);
    const cx = (cx0 + cx1) * 0.5;
    const hw = getRiverHalfWidth(zMid);
    const dx = cx1 - cx0;
    const segLen = Math.hypot(dx, stepZ) + 2.4;
    const ang = Math.atan2(dx, stepZ);

    const waterSeg = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2.04, segLen), waterMat);
    waterSeg.rotation.x = -Math.PI / 2;
    waterSeg.rotation.z = -ang;
    waterSeg.position.set(cx, 0.04, zMid);
    g.add(waterSeg);

    // Gentle sloped sandy/grassy riverbanks on both sides so Dante can swim ashore anywhere
    for (const side of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(5.5, segLen), zMid > 60 ? sandMat : bankMat);
      bank.rotation.x = -Math.PI / 2;
      bank.rotation.z = -ang;
      bank.position.set(cx + side * (hw + 2.1), 0.055, zMid);
      g.add(bank);
    }
  }

  // Dry concrete underpass riverside walkways underneath Puente del Sol (x=56..66 and x=154..164, full 5.8m clearance!)
  for (const ex of [61, 159]) {
    const prom = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.24, 82), concMat);
    prom.position.set(ex, 0.12, 197);
    prom.receiveShadow = true;
    g.add(prom);
  }

  root.add(g);
}

// Helper to construct a smooth arched elevated bridge deck (Hermite ramp up -> flat elevated span -> ramp down)
// leaving a genuine hollow passable underpass underneath with overhead ceiling AABB (minY > 4.5m) + separate pier AABBs!
function addElevatedBridgeDeck(g, bridge, roadTex, steelMat, goldMat, collisionWorld) {
  const { x1, x2, z, halfZ, deckY, rampLen } = bridge;
  const widthZ = halfZ * 2;
  const underMat = new THREE.MeshStandardMaterial({ color: 0x626c7a, roughness: 0.78 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x7b8491, roughness: 0.82 });

  const sampleY = (x) => {
    const minEdge = Math.min(x - x1, x2 - x);
    if (minEdge >= rampLen) return deckY;
    const t = Math.max(0, Math.min(1, minEdge / rampLen));
    return deckY * (t * t * (3 - 2 * t));
  };

  // Build smooth segmented bridge girder + properly oriented asphalt road surface with crisp lane markings!
  const segs = bridge.isMain ? 24 : 14;
  const stepX = (x2 - x1) / segs;
  const roadTopMat = new THREE.MeshStandardMaterial({
    map: roadTex ? roadTex.clone() : null,
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.1,
  });
  if (roadTopMat.map) {
    roadTopMat.map.needsUpdate = true;
    roadTopMat.map.repeat.set(1, stepX / 24);
  }
  const sidewalkTrimMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.8 });

  for (let i = 0; i < segs; i++) {
    const ax = x1 + i * stepX;
    const bx = ax + stepX;
    const ay = sampleY(ax);
    const by = sampleY(bx);
    const midX = (ax + bx) * 0.5;
    const midY = (ay + by) * 0.5;
    const segLen = Math.hypot(stepX, by - ay) + 0.14;
    const slope = Math.atan2(by - ay, stepX);

    // Structural concrete girder beneath roadway
    const slab = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.72, widthZ), underMat);
    slab.position.set(midX, midY - 0.38, z);
    slab.rotation.z = slope;
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);

    // Crisp matching street asphalt plane on top with lane markings running cleanly along X!
    const roadRibbon = new THREE.Mesh(new THREE.PlaneGeometry(widthZ - 2.4, segLen), roadTopMat);
    roadRibbon.rotation.x = -Math.PI / 2;
    roadRibbon.rotation.z = Math.PI / 2;
    const roadWrap = new THREE.Group();
    roadWrap.position.set(midX, midY + 0.04, z);
    roadWrap.rotation.z = slope;
    roadWrap.add(roadRibbon);
    g.add(roadWrap);

    for (const side of [-halfZ + 0.45, halfZ - 0.45]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.24, 1.3), sidewalkTrimMat);
      curb.position.set(midX, midY + 0.12, z + side * 0.94);
      curb.rotation.z = slope;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 1.15, 0.65), steelMat);
      rail.position.set(midX, midY + 0.65, z + side);
      rail.rotation.z = slope;
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.2, 0.78), goldMat);
      topBar.position.set(midX, midY + 1.32, z + side);
      topBar.rotation.z = slope;
      g.add(curb, rail, topBar);
    }
  }

  // Register SOLID overhead ceiling AABB (strictly beneath deck surface: deckY-1.15 .. deckY-0.30) across the elevated span!
  // Blocks HALCÓN-1 helicopter LOS & gunfire from above while NEVER obstructing vehicles on the ramp or deck OR walkers underneath!
  const flatX1 = x1 + rampLen;
  const flatX2 = x2 - rampLen;
  if (collisionWorld && flatX2 > flatX1) {
    collisionWorld.addBox3D(flatX1, flatX2, deckY - 1.15, deckY - 0.30, z - halfZ, z + halfZ, 'bridge-deck');
    // Guardrails sit STRICTLY along the outer left & right Z edges, NEVER across road entrances/exits!
    for (const side of [-halfZ - 0.25, halfZ + 0.25]) {
      collisionWorld.addBox3D(x1 + 2, x2 - 2, deckY - 0.15, deckY + 2.6, z + side - 0.55, z + side + 0.55, 'bridge-rail');
    }
  }

  // Support Pier Columns positioned cleanly along outer bridge edges & capped strictly below road deck so cars never snag on them!
  const pierXs = bridge.isMain
    ? [x1 + rampLen + 4, x1 + rampLen + 26, x2 - rampLen - 26, x2 - rampLen - 4]
    : [x1 + rampLen + 2, x2 - rampLen - 2];
  for (const px of pierXs) {
    const py = sampleY(px);
    const pierH = Math.max(2.4, py - 1.05);
    for (const pzOff of [-halfZ + 0.7, halfZ - 0.7]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.9, pierH, 1.9), pierMat);
      pier.position.set(px, pierH * 0.5, z + pzOff);
      pier.castShadow = true;
      pier.receiveShadow = true;
      g.add(pier);
      if (collisionWorld) {
        collisionWorld.addRect(px, z + pzOff, 2.0, 2.0, pierH - 0.1, 'bridge-pier', 0);
      }
    }
  }
}

function buildRiverBridges(root, collisionWorld, animated, textures) {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x3c4d63, roughness: 0.42, metalness: 0.55 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xffc84d, roughness: 0.3, metalness: 0.72 });
  const lampGlowTex = getRadialGlowTexture('rgba(255,244,205,0.85)', 'rgba(255,176,72,0.28)', 'rgba(0,0,0,0)');

  for (const bridge of RIVER_BRIDGES) {
    if (bridge.isMain) continue;
    addElevatedBridgeDeck(g, bridge, textures?.road, steelMat, goldTrim, collisionWorld);

    // Decorative arched steel truss ribs & bridge lamps on Midtown/Central/North bridges
    const midX = (bridge.x1 + bridge.x2) * 0.5;
    for (const side of [-bridge.halfZ + 0.5, bridge.halfZ - 0.5]) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry((bridge.x2 - bridge.x1) * 0.28, 0.35, 8, 20, Math.PI),
        steelMat
      );
      arch.position.set(midX, bridge.deckY + 0.4, bridge.z + side);
      g.add(arch);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.6, 6), steelMat);
      post.position.set(midX, bridge.deckY + 2.5, bridge.z + side);
      const orb = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      orb.scale.set(1.7, 1.7, 1);
      orb.position.set(midX, bridge.deckY + 4.9, bridge.z + side);
      g.add(post, orb);
    }
  }
  root.add(g);
}

function buildPuenteDelSol(root, cx, cz, collisionWorld, animated, textures) {
  const g = new THREE.Group();
  const redSteel = new THREE.MeshStandardMaterial({ color: 0xdf3b30, roughness: 0.34, metalness: 0.48 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xffc84d, roughness: 0.28, metalness: 0.72 });
  const lampGlowTex = getRadialGlowTexture('rgba(255,244,205,0.85)', 'rgba(255,176,72,0.28)', 'rgba(0,0,0,0)');
  const bridgePoolTex = getRadialGlowTexture('rgba(255,214,132,0.38)', 'rgba(255,164,68,0.12)', 'rgba(0,0,0,0)');
  const redBeaconTex = getRadialGlowTexture('#ffffff', 'rgba(255,48,78,0.86)', 'rgba(0,0,0,0)');

  const mainBridge = RIVER_BRIDGES[0];
  addElevatedBridgeDeck(g, mainBridge, textures?.road, redSteel, goldTrim, collisionWorld);

  const deckY = mainBridge.deckY;
  for (const side of [-11.5, 11.5]) {
    for (let lx = cx - 48; lx <= cx + 48; lx += 24) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.2, 6), redSteel);
      post.position.set(lx, deckY + 3.4, cz + side * 0.96);
      const orbMat = new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const orb = new THREE.Sprite(orbMat);
      orb.scale.set(1.9, 1.9, 1);
      orb.position.set(lx, deckY + 6.6, cz + side * 0.92);
      g.add(post, orb);
      if (animated) {
        const poolMat = new THREE.MeshBasicMaterial({
          map: bridgePoolTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(lx, deckY + 0.15, cz + side * 0.6);
        g.add(pool);
        animated.streetLampPositions.push(new THREE.Vector3(lx, deckY + 6.5, cz + side * 0.8));
        animated.nightGlowMeshes.push({ mat: poolMat, dayOp: 0.0, nightOp: 0.72 });
      }
    }
  }

  // Twin Iconic Red & Gold Suspension Pylons (set cleanly outside the roadway guardrails so lanes are 100% clear!)
  for (const px of [cx - 34, cx + 34]) {
    for (const side of [-12.6, 12.6]) {
      const towerLower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 30, 3.4), redSteel);
      towerLower.position.set(px, 15, cz + side);
      towerLower.castShadow = true;
      const towerUpper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 23, 2.6), redSteel);
      towerUpper.position.set(px, 41.5, cz + side);
      towerUpper.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.2, 3.1), goldTrim);
      cap.position.set(px, 53.4, cz + side);
      const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: redBeaconTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      beacon.scale.set(2.8, 2.8, 1);
      beacon.position.set(px, 54.8, cz + side);
      g.add(towerLower, towerUpper, cap, beacon);
      if (collisionWorld) {
        collisionWorld.addRect(px, cz + side, 3.4, 3.4, 54, 'bridge-tower', 0);
      }
    }
    for (const cy of [22, 36, 48.5]) {
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
        const dy = -(49 - deckY);
        const len = Math.hypot(dx, dy);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 5), cableMat);
        cable.position.set(px + dx * 0.5, 49 + dy * 0.5, cz + side);
        cable.rotation.z = Math.atan2(dx, -dy);
        g.add(cable);
      }
    }
  }
  root.add(g);
}

function buildMercadoNocturno(root, collisionWorld, animated, textures) {
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
    collisionWorld.addRect(cx + side * 21, cz - 2, 8.4, 86.4, 17, 'building');
    collisionWorld.addRect(cx + side * 13.6, cz - 2, 4.6, 76, 4.2, 'stall');
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
    collisionWorld.addBox(kx - 1.4, kx + 2.1, kz - 0.9, kz + 0.9, 1.4, 'prop');
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

// Real Public Urban Facilities: Cala Dorada General Hospital, CDPD Precinct HQ, Central Parque Dorado,
// Covered Bus Stops, Intersection Traffic Lights, Fire Hydrants, Public Parking Lots, Curbs & Natural Coastal Perimeter.
function buildPublicFacilities(root, collisionWorld, animated, textures, rand, parkedVehicles = []) {
  const registerParked = (mesh, typeKey) => {
    const spec = VEHICLES[typeKey] ?? VEHICLES.cabo_gt;
    parkedVehicles.push({
      mesh,
      typeKey,
      spec,
      pos: mesh.position,
      yaw: mesh.rotation.y,
      vel: new THREE.Vector3(),
      speed: 0,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      condition: 100,
      burning: false,
      fireCountdown: 0,
      exploded: false,
      smokeTimer: 0,
      crackleTimer: 0,
      isParked: true,
    });
  };
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xeae4d8, roughness: 0.56 });
  const hospitalWhite = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.42, metalness: 0.1 });
  const hospitalTeal = new THREE.MeshStandardMaterial({ color: 0x249ea0, roughness: 0.36, metalness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a56, emissive: 0x3b6a88, emissiveIntensity: 0.35, roughness: 0.14, metalness: 0.72,
  });
  animated.nightWindowMats.push(glassMat);
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x242c38, roughness: 0.42, metalness: 0.75 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8d95a0, roughness: 0.85 });
  const asphaltLotMat = new THREE.MeshStandardMaterial({ color: 0x262c36, roughness: 0.78 });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xdfe6f0 });
  const poolTex = getRadialGlowTexture('rgba(255,218,142,0.42)', 'rgba(255,168,72,0.14)', 'rgba(0,0,0,0)');

  // 1. CALA DORADA GENERAL HOSPITAL (-102, -124) — WASTED Respawn Facility
  {
    const h = PUBLIC_FACILITIES.hospital;
    const hg = new THREE.Group();
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(42, 24, 28), hospitalWhite);
    mainBody.position.set(h.x, 12, h.z);
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    const wingUpper = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 20), hospitalWhite);
    wingUpper.position.set(h.x, 30, h.z - 2);
    wingUpper.castShadow = true;
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(42.6, 2.2, 28.6), hospitalTeal);
    band1.position.set(h.x, 6.2, h.z);
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(42.6, 1.4, 28.6), hospitalTeal);
    band2.position.set(h.x, 23.8, h.z);
    const winRibbon = new THREE.Mesh(new THREE.BoxGeometry(38, 11, 28.4), glassMat);
    winRibbon.position.set(h.x, 15, h.z);
    // Emergency ambulance portico canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 9.5), hospitalTeal);
    canopy.position.set(h.x, 4.8, h.z + 18.2);
    for (const px of [-7.2, 7.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.8, 8), hospitalWhite);
      col.position.set(h.x + px, 2.4, h.z + 22.2);
      hg.add(col);
    }
    // Glowing Red Cross emblem on facade & rooftop marquee sign
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xff2e44 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.2, 0.4), crossMat);
    crossV.position.set(h.x, 30, h.z + 8.3);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 0.4), crossMat);
    crossH.position.set(h.x, 30, h.z + 8.3);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 4.4, 0.8),
      new THREE.MeshBasicMaterial({ map: createSignTexture('GENERAL HOSPITAL', '#0f202c', '#ffffff', '#ff3b5c') })
    );
    sign.position.set(h.x, 38.2, h.z + 7.5);
    // Emergency bay warm-teal ground glow
    const bayPoolMat = new THREE.MeshBasicMaterial({
      map: getRadialGlowTexture('rgba(160,245,255,0.42)', 'rgba(255,80,100,0.14)', 'rgba(0,0,0,0)'),
      transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const bayPool = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), bayPoolMat);
    bayPool.rotation.x = -Math.PI / 2;
    bayPool.position.set(h.x, 0.14, h.z + 19.5);
    animated.nightGlowMeshes.push({ mat: bayPoolMat, dayOp: 0.08, nightOp: 0.78 });
    animated.streetLampPositions.push(new THREE.Vector3(h.x, 6.0, h.z + 20));
    // Parked Ambulance in emergency bay
    const amb = createVehicleMesh('cdpd_enforcer', 0xf6f8fc);
    amb.position.set(h.x - 12, 0, h.z + 21);
    amb.rotation.y = Math.PI / 2;
    registerParked(amb, 'cdpd_enforcer');
    hg.add(mainBody, wingUpper, band1, band2, winRibbon, canopy, crossV, crossH, sign, bayPool, amb);
    g.add(hg);
    collisionWorld.addRect(h.x, h.z, 43, 29, 36, 'hospital');
  }

  // 2. CDPD POLICE PRECINCT HQ (118, -124) — BUSTED Respawn Facility + Cruiser Lot
  {
    const p = PUBLIC_FACILITIES.police;
    const pg = new THREE.Group();
    const navyMat = new THREE.MeshStandardMaterial({ color: 0x1d3254, roughness: 0.46, metalness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(40, 22, 28), stoneMat);
    body.position.set(p.x, 11, p.z);
    body.castShadow = true;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 22), navyMat);
    upper.position.set(p.x, 27, p.z);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(40.8, 2.0, 28.8), navyMat);
    trim.position.set(p.x, 21.5, p.z);
    const win = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 28.4), glassMat);
    win.position.set(p.x, 13, p.z);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(26, 4.4, 0.8),
      new THREE.MeshBasicMaterial({ map: createSignTexture('CDPD PRECINCT HQ', '#0d1a33', '#ffffff', '#4ba3ff') })
    );
    sign.position.set(p.x, 34.4, p.z + 10.6);
    // Blue police entrance lamps + ground glow
    const blueLampMat = new THREE.MeshBasicMaterial({ color: 0x4ba3ff });
    for (const sx of [-5.5, 5.5]) {
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), blueLampMat);
      globe.position.set(p.x + sx, 4.2, p.z + 14.8);
      pg.add(globe);
    }
    const pdPoolMat = new THREE.MeshBasicMaterial({
      map: getRadialGlowTexture('rgba(80,175,255,0.45)', 'rgba(40,110,255,0.14)', 'rgba(0,0,0,0)'),
      transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pdPool = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), pdPoolMat);
    pdPool.rotation.x = -Math.PI / 2;
    pdPool.position.set(p.x, 0.14, p.z + 19);
    animated.nightGlowMeshes.push({ mat: pdPoolMat, dayOp: 0.08, nightOp: 0.82 });
    animated.streetLampPositions.push(new THREE.Vector3(p.x, 6.0, p.z + 19));
    // Precinct Cruiser Parking Lot beside HQ
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), asphaltLotMat);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(p.x, 0.11, p.z + 23);
    for (let s = -12; s <= 12; s += 6) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 7.5), stripeMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(p.x + s, 0.12, p.z + 23);
      pg.add(line);
    }
    const cr1 = createVehicleMesh('cdpd_interceptor');
    cr1.position.set(p.x - 9, 0, p.z + 22.5);
    cr1.rotation.y = 0;
    registerParked(cr1, 'cdpd_interceptor');
    const cr2 = createVehicleMesh('cdpd_interceptor');
    cr2.position.set(p.x - 3, 0, p.z + 22.5);
    cr2.rotation.y = 0;
    registerParked(cr2, 'cdpd_interceptor');
    pg.add(body, upper, trim, win, sign, pdPool, lot, cr1, cr2);
    g.add(pg);
    collisionWorld.addRect(p.x, p.z, 41, 29, 32, 'police-hq');
  }

  // 3. CENTRAL PARQUE DORADO (-90, 60): Green Lawns, Walkways, Central Fountain, Benches, Shade Trees & Park Lamps
  {
    const pk = PUBLIC_FACILITIES.park;
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x2f8548, roughness: 0.92 });
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xd2c2a8, roughness: 0.85 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2ec4d6, emissive: 0x104c5c, emissiveIntensity: 0.35, roughness: 0.14, metalness: 0.45 });
    const benchWood = new THREE.MeshStandardMaterial({ color: 0x7c5032, roughness: 0.82 });

    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(pk.w, pk.d), lawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(pk.x, 0.08, pk.z);
    lawn.receiveShadow = true;
    g.add(lawn);

    // Cross-shaped stone walkways + central plaza circle
    const walkX = new THREE.Mesh(new THREE.PlaneGeometry(pk.w, 8.5), pathMat);
    walkX.rotation.x = -Math.PI / 2;
    walkX.position.set(pk.x, 0.10, pk.z);
    const walkZ = new THREE.Mesh(new THREE.PlaneGeometry(8.5, pk.d), pathMat);
    walkZ.rotation.x = -Math.PI / 2;
    walkZ.position.set(pk.x, 0.10, pk.z);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(14, 28), pathMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(pk.x, 0.11, pk.z);
    g.add(walkX, walkZ, plaza);

    // Central Sculpted Stone Fountain
    const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.0, 1.15, 24), stoneMat);
    basinOuter.position.set(pk.x, 0.58, pk.z);
    const basinWater = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.95, 24), waterMat);
    basinWater.position.set(pk.x, 0.62, pk.z);
    const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 3.2, 12), stoneMat);
    spireBase.position.set(pk.x, 1.8, pk.z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 0.9, 0.7, 16), stoneMat);
    bowl.position.set(pk.x, 3.3, pk.z);
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.2, 10),
      new THREE.MeshBasicMaterial({ color: 0xbff7ff, transparent: true, opacity: 0.65 })
    );
    jet.position.set(pk.x, 4.7, pk.z);
    g.add(basinOuter, basinWater, spireBase, bowl, jet);
    collisionWorld.addRect(pk.x, pk.z, 11.4, 11.4, 3.5, 'park-fountain');

    // Low perimeter park stone walls with wide open walkway entrances on all 4 sides
    const wallH = 1.15;
    const halfW = pk.w / 2;
    const halfD = pk.d / 2;
    const segW = (pk.w - 16) / 2;
    const segD = (pk.d - 16) / 2;
    for (const sz of [-halfD, halfD]) {
      for (const sx of [-halfW + segW / 2, halfW - segW / 2]) {
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, 1.1), stoneMat);
        wMesh.position.set(pk.x + sx, wallH / 2, pk.z + sz);
        g.add(wMesh);
        collisionWorld.addRect(pk.x + sx, pk.z + sz, segW, 1.3, wallH + 0.5, 'park-wall');
      }
    }
    for (const sx of [-halfW, halfW]) {
      for (const sz of [-halfD + segD / 2, halfD - segD / 2]) {
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, wallH, segD), stoneMat);
        wMesh.position.set(pk.x + sx, wallH / 2, pk.z + sz);
        g.add(wMesh);
        collisionWorld.addRect(pk.x + sx, pk.z + sz, 1.3, segD, wallH + 0.5, 'park-wall');
      }
    }

    // Park benches & lush shade trees + warm night park lamps
    const treeOffsets = [
      [-36, -22], [-18, -24], [22, -22], [38, -20],
      [-38, 20], [-20, 24], [20, 22], [38, 22],
      [-34, -4], [34, 4],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b472c, roughness: 0.9 });
    const leafMatA = new THREE.MeshStandardMaterial({ color: 0x267a42, roughness: 0.78 });
    const leafMatB = new THREE.MeshStandardMaterial({ color: 0x369650, roughness: 0.76 });
    for (const [ox, oz] of treeOffsets) {
      const tx = pk.x + ox;
      const tz = pk.z + oz;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 4.6, 8), trunkMat);
      trunk.position.set(tx, 2.3, tz);
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 1), (ox + oz) % 2 === 0 ? leafMatA : leafMatB);
      crown.position.set(tx, 5.8, tz);
      crown.scale.set(1.15, 0.85, 1.15);
      crown.castShadow = true;
      g.add(trunk, crown);
    }

    const benchCoords = [[-13, -7], [13, -7], [-13, 7], [13, 7], [-28, -5.5], [28, 5.5]];
    for (const [bx, bz] of benchCoords) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.72), benchWood);
      seat.position.set(pk.x + bx, 0.55, pk.z + bz);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.14), benchWood);
      back.position.set(pk.x + bx, 0.9, pk.z + bz - 0.32);
      g.add(seat, back);
    }

    const parkLampCoords = [[-16, -16], [16, -16], [-16, 16], [16, 16], [-42, 0], [42, 0]];
    const warmBulb = new THREE.MeshBasicMaterial({ color: 0xffe4a8 });
    for (const [lx, lz] of parkLampCoords) {
      const px = pk.x + lx;
      const pz = pk.z + lz;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.6, 6), darkMetal);
      pole.position.set(px, 2.3, pz);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), warmBulb);
      bulb.position.set(px, 4.75, pz);
      const pPoolMat = new THREE.MeshBasicMaterial({
        map: poolTex, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const pPool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), pPoolMat);
      pPool.rotation.x = -Math.PI / 2;
      pPool.position.set(px, 0.14, pz);
      g.add(pole, bulb, pPool);
      animated.streetLampPositions.push(new THREE.Vector3(px, 4.6, pz));
      animated.nightGlowMeshes.push({ mat: pPoolMat, dayOp: 0.0, nightOp: 0.78 });
    }
  }

  // 4. PUBLIC PARKING LOT (Paseo Plaza — note (18,58) is now the Enterable Torre Covered Parking Deck!)
  const parkingLots = [
    { x: -158, z: 158, w: 30, d: 22 },
  ];
  for (const pl of parkingLots) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(pl.w, pl.d), asphaltLotMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(pl.x, 0.11, pl.z);
    g.add(pad);
    for (let sx = -pl.w / 2 + 4; sx <= pl.w / 2 - 4; sx += 5.5) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 6.5), stripeMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(pl.x + sx, 0.12, pl.z);
      g.add(l);
    }
    const parked = createVehicleMesh('convertible', 0xffbe55);
    parked.position.set(pl.x - 3, 0, pl.z);
    g.add(parked);
    registerParked(parked, 'convertible');
  }

  // 5. COVERED BUS STOPS along Major Boulevards
  const busStops = [
    { x: -145, z: 186.5, rot: 0 },
    { x: -32, z: 186.5, rot: 0 },
    { x: 245, z: 186.5, rot: 0 },
    { x: -85, z: 14.5, rot: 0 },
    { x: 88, z: -14.5, rot: Math.PI },
    { x: 132, z: -194.5, rot: Math.PI },
  ];
  const shelterGlass = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.36, roughness: 0.15, metalness: 0.5 });
  const busAdMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  for (const bs of busStops) {
    const bg = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.22, 2.4), darkMetal);
    roof.position.set(0, 2.85, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.5, 0.12), shelterGlass);
    back.position.set(0, 1.4, -1.05);
    const adBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.9, 1.4), busAdMat);
    adBox.position.set(-2.95, 1.45, 0);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.14, 0.55), stoneMat);
    bench.position.set(0.3, 0.55, -0.55);
    for (const px of [-2.9, 2.9]) {
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.85, 6), darkMetal);
      p1.position.set(px, 1.42, -1.05);
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.85, 6), darkMetal);
      p2.position.set(px, 1.42, 0.95);
      bg.add(p1, p2);
    }
    bg.add(roof, back, adBox, bench);
    bg.position.set(bs.x, 0, bs.z);
    bg.rotation.y = bs.rot;
    g.add(bg);
    collisionWorld.addRect(bs.x, bs.z, 6.2, 2.4, 3.0, 'bus-stop');
  }

  // 6. INTERSECTION TRAFFIC LIGHTS (Glowing Red / Amber / Green Signals that Cycle Smoothly!)
  const majorIntersections = [
    [-180, 200], [0, 200], [180, 200],
    [-180, 120], [0, 120], [180, 120],
    [-180, 0], [0, 0], [180, 0],
    [-180, -180], [0, -180], [180, -180],
  ];
  for (let i = 0; i < majorIntersections.length; i++) {
    const [ix, iz] = majorIntersections[i];
    const poleX = ix + 12.2;
    const poleZ = iz + 12.2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.6, 6), darkMetal);
    pole.position.set(poleX, 3.3, poleZ);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 0.16), darkMetal);
    arm.position.set(poleX - 3.2, 6.4, poleZ);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.85, 0.55), darkMetal);
    housing.position.set(poleX - 5.4, 5.75, poleZ);

    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2b45 });
    const ambMat = new THREE.MeshBasicMaterial({ color: 0x3a2a0a });
    const grnMat = new THREE.MeshBasicMaterial({ color: 0x0b3a22 });
    const redL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), redMat);
    redL.position.set(poleX - 5.4, 6.28, poleZ + 0.25);
    const ambL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), ambMat);
    ambL.position.set(poleX - 5.4, 5.75, poleZ + 0.25);
    const grnL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), grnMat);
    grnL.position.set(poleX - 5.4, 5.22, poleZ + 0.25);
    g.add(pole, arm, housing, redL, ambL, grnL);
    animated.trafficSignals.push({ redMat, ambMat, grnMat, phaseOffset: i * 1.9 });
  }

  // 7. FIRE HYDRANTS & CLEAN SIDEWALK CURBS
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xd93232, roughness: 0.42, metalness: 0.35 });
  for (const [ix, iz] of majorIntersections) {
    const hx = ix - 12.8;
    const hz = iz + 12.8;
    const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.92, 8), hydrantMat);
    hyd.position.set(hx, 0.46, hz);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6), hydrantMat);
    cap.position.set(hx, 0.92, hz);
    g.add(hyd, cap);
  }
  // Crisp raised concrete curbs along Paseo Dorado & Central Avenue
  for (const cz of [189.4, 210.6]) {
    for (const [x1, x2] of [[-350, 38], [182, 355]]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, 0.22, 0.5), concreteMat);
      curb.position.set((x1 + x2) / 2, 0.11, cz);
      g.add(curb);
    }
  }

  // 8. NATURAL PHYSICAL COASTAL PERIMETER (Harbor Seawalls, Coastal Cliffs & Highway Railings — ZERO Invisible Walls!)
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x6f675d, roughness: 0.92 });
  const seawallMat = new THREE.MeshStandardMaterial({ color: 0x7a828c, roughness: 0.8 });
  // North coastal cliffs & scenic highway parapet wall (z = -448)
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(930, 3.2, 4.5), seawallMat);
  northWall.position.set(0, 1.6, -448);
  g.add(northWall);
  for (let cx = -440; cx <= 440; cx += 55) {
    const cliff = new THREE.Mesh(new THREE.DodecahedronGeometry(16 + (Math.abs(cx) % 10), 1), cliffMat);
    cliff.scale.set(2.2, 1.15, 0.95);
    cliff.position.set(cx, 6.5, -464);
    g.add(cliff);
  }
  collisionWorld.addRect(0, -448, 936, 6.0, 20, 'perimeter-wall');

  // West coastal seawall & rocky headland (x = -462)
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.8, 725), seawallMat);
  westWall.position.set(-462, 1.4, -88);
  g.add(westWall);
  collisionWorld.addRect(-462, -88, 6.0, 730, 16, 'seawall');

  // East harbor concrete seawall (x = 468)
  const eastWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.8, 725), seawallMat);
  eastWall.position.set(468, 1.4, -88);
  g.add(eastWall);
  collisionWorld.addRect(468, -88, 6.0, 730, 16, 'seawall');

  // Marina Bay Channel Stone Seawall Embankment (leaves wide navigable mouth at x=126..170 for Río Dorado!)
  const bayNorthWall = new THREE.Mesh(new THREE.BoxGeometry(84, 1.4, 2.2), seawallMat);
  bayNorthWall.position.set(82, 0.7, 155);
  g.add(bayNorthWall);
  collisionWorld.addRect(82, 155, 84, 2.6, 2.5, 'seawall');

  root.add(g);
}

// 3 Enterable Roofed Cover Buildings with wide open entrances, separate perimeter walls, interior cover & solid overhead roof slabs!
function buildCoverBuildings(root, collisionWorld, animated, textures) {
  const g = new THREE.Group();
  const concMat = new THREE.MeshStandardMaterial({ color: 0x828c99, roughness: 0.84 });
  const darkAsphalt = new THREE.MeshStandardMaterial({ color: 0x242a34, roughness: 0.78 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x455468, roughness: 0.52, metalness: 0.55 });
  const stuccoMat = new THREE.MeshStandardMaterial({ color: 0xe5ceb0, roughness: 0.78 });
  const terraMat = new THREE.MeshStandardMaterial({ color: 0xb85032, roughness: 0.72 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x996a40, roughness: 0.82 });
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });

  // 1. TORRE COVERED PARKING DECK (Distrito Torre: x=18, z=58, w=26, d=30, roofY=5.4) — drive or run right inside!
  {
    const b = COVER_BUILDINGS[0];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), darkAsphalt);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(b.x, 0.12, b.z);
    g.add(floor);

    // Solid East & West perimeter walls + flanking North/South facade walls leaving a wide 12m drive-through opening!
    for (const sx of [-b.w / 2 + 0.6, b.w / 2 - 0.6]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, b.roofY, b.d), concMat);
      wall.position.set(b.x + sx, b.roofY / 2, b.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      g.add(wall);
      collisionWorld.addRect(b.x + sx, b.z, 1.4, b.d, b.roofY + 0.5, 'cover-wall', 0);
    }
    for (const sz of [-b.d / 2 + 0.6, b.d / 2 - 0.6]) {
      for (const sx of [-b.w / 2 + 3.5, b.w / 2 - 3.5]) {
        const flank = new THREE.Mesh(new THREE.BoxGeometry(7.0, b.roofY, 1.2), concMat);
        flank.position.set(b.x + sx, b.roofY / 2, b.z + sz);
        flank.castShadow = true;
        g.add(flank);
        collisionWorld.addRect(b.x + sx, b.z + sz, 7.2, 1.4, b.roofY + 0.5, 'cover-wall', 0);
      }
    }

    // 4 Interior Concrete Columns (drive cleanly down the central 11m lane or hide behind pillars!)
    for (const px of [-6.2, 6.2]) {
      for (const pz of [-8.0, 8.0]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.1, b.roofY, 1.1), concMat);
        col.position.set(b.x + px, b.roofY / 2, b.z + pz);
        g.add(col);
        collisionWorld.addRect(b.x + px, b.z + pz, 1.2, 1.2, b.roofY, 'pillar', 0);
      }
    }

    // Solid Overhead Roof Slab (minY=5.0, maxY=6.4 — blocks HALCÓN-1 helicopter LOS & spotlight!)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.8, 1.1, b.d + 0.8), concMat);
    roof.position.set(b.x, b.roofY + 0.45, b.z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);
    collisionWorld.addBox3D(b.x - b.w / 2 - 0.5, b.x + b.w / 2 + 0.5, b.roofY - 0.4, b.roofY + 1.2, b.z - b.d / 2 - 0.5, b.z + b.d / 2 + 0.5, 'roof');

    // Interior ceiling fluorescent strips & exterior marquee sign
    for (const lz of [-8, 0, 8]) {
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(10, 0.14, 0.36), stripMat);
      lightBar.position.set(b.x, b.roofY - 0.12, b.z + lz);
      g.add(lightBar);
    }
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(14, 2.2, 0.5),
      new THREE.MeshBasicMaterial({ map: createSignTexture('TORRE PARKING', '#101828', '#ffbe55', '#34e0c8') })
    );
    sign.position.set(b.x, b.roofY + 1.4, b.z + b.d / 2 + 0.3);
    g.add(sign);
  }

  // 2. PUERTO CENIT OPEN WAREHOUSE (Puerto Cenit: x=308, z=-112, w=30, d=24, roofY=6.0)
  {
    const b = COVER_BUILDINGS[1];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), darkAsphalt);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(b.x, 0.12, b.z);
    g.add(floor);

    // Solid North wall & Solid East wall
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.roofY, 1.2), steelMat);
    nWall.position.set(b.x, b.roofY / 2, b.z - b.d / 2 + 0.6);
    const eWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, b.roofY, b.d), steelMat);
    eWall.position.set(b.x + b.w / 2 - 0.6, b.roofY / 2, b.z);
    g.add(nWall, eWall);
    collisionWorld.addRect(b.x, b.z - b.d / 2 + 0.6, b.w, 1.4, b.roofY + 0.5, 'cover-wall', 0);
    collisionWorld.addRect(b.x + b.w / 2 - 0.6, b.z, 1.4, b.d, b.roofY + 0.5, 'cover-wall', 0);

    // Partial South & West flanking walls leaving 14m wide open cargo bay doorways
    const sFlank = new THREE.Mesh(new THREE.BoxGeometry(10, b.roofY, 1.2), steelMat);
    sFlank.position.set(b.x + 10, b.roofY / 2, b.z + b.d / 2 - 0.6);
    const wFlank = new THREE.Mesh(new THREE.BoxGeometry(1.2, b.roofY, 8), steelMat);
    wFlank.position.set(b.x - b.w / 2 + 0.6, b.roofY / 2, b.z - 8);
    g.add(sFlank, wFlank);
    collisionWorld.addRect(b.x + 10, b.z + b.d / 2 - 0.6, 10, 1.4, b.roofY + 0.5, 'cover-wall', 0);
    collisionWorld.addRect(b.x - b.w / 2 + 0.6, b.z - 8, 1.4, 8, b.roofY + 0.5, 'cover-wall', 0);

    // Interior cargo crates for tactical bullet cover
    for (const [cx, cz] of [[5, -3], [6, 3], [-4, -5]]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 2.2), crateMat);
      crate.position.set(b.x + cx, 0.9, b.z + cz);
      crate.castShadow = true;
      g.add(crate);
      collisionWorld.addRect(b.x + cx, b.z + cz, 3.3, 2.3, 1.85, 'prop', 0);
    }

    // Solid Overhead Corrugated Roof Slab
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.0, 1.1, b.d + 1.0), steelMat);
    roof.position.set(b.x, b.roofY + 0.5, b.z);
    roof.castShadow = true;
    g.add(roof);
    collisionWorld.addBox3D(b.x - b.w / 2 - 0.5, b.x + b.w / 2 + 0.5, b.roofY - 0.4, b.roofY + 1.2, b.z - b.d / 2 - 0.5, b.z + b.d / 2 + 0.5, 'roof');

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(15, 2.4, 0.5),
      new THREE.MeshBasicMaterial({ map: createSignTexture('CENIT CARGO BAY', '#141224', '#d4b8ff', '#a876ff') })
    );
    sign.position.set(b.x - 4, b.roofY + 1.6, b.z + b.d / 2 + 0.35);
    g.add(sign);
  }

  // 3. BARRIO VIEJO COURTYARD ARCADE / COVERED SHELTER (x=204, z=-212, w=22, d=18, roofY=5.2)
  {
    const b = COVER_BUILDINGS[2];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), stuccoMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(b.x, 0.12, b.z);
    g.add(floor);

    // Solid North & East stucco walls; wide open arched colonnade on South & West!
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.roofY, 1.1), stuccoMat);
    nWall.position.set(b.x, b.roofY / 2, b.z - b.d / 2 + 0.55);
    const eWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, b.roofY, b.d), stuccoMat);
    eWall.position.set(b.x + b.w / 2 - 0.55, b.roofY / 2, b.z);
    g.add(nWall, eWall);
    collisionWorld.addRect(b.x, b.z - b.d / 2 + 0.55, b.w, 1.3, b.roofY + 0.5, 'cover-wall', 0);
    collisionWorld.addRect(b.x + b.w / 2 - 0.55, b.z, 1.3, b.d, b.roofY + 0.5, 'cover-wall', 0);

    // Colonnade corner & front stone arches
    for (const [px, pz] of [[-b.w / 2 + 0.7, b.d / 2 - 0.7], [0, b.d / 2 - 0.7], [b.w / 2 - 0.7, b.d / 2 - 0.7], [-b.w / 2 + 0.7, 0]]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, b.roofY, 10), stuccoMat);
      col.position.set(b.x + px, b.roofY / 2, b.z + pz);
      g.add(col);
      collisionWorld.addRect(b.x + px, b.z + pz, 1.0, 1.0, b.roofY, 'pillar', 0);
    }

    // Solid Terracotta Overhead Roof Slab
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.4, 1.1, b.d + 1.4), terraMat);
    roof.position.set(b.x, b.roofY + 0.5, b.z);
    roof.castShadow = true;
    g.add(roof);
    collisionWorld.addBox3D(b.x - b.w / 2 - 0.7, b.x + b.w / 2 + 0.7, b.roofY - 0.4, b.roofY + 1.3, b.z - b.d / 2 - 0.7, b.z + b.d / 2 + 0.7, 'roof');

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.0, 0.45),
      new THREE.MeshBasicMaterial({ map: createSignTexture('PLAZA ARCADE', '#201412', '#ffd46e', '#ff7846') })
    );
    sign.position.set(b.x, b.roofY + 1.45, b.z + b.d / 2 + 0.4);
    g.add(sign);
  }

  root.add(g);
}

// Roadside Estación Sol Fuel Station (canopy, convenience kiosk, 4 explosive gas pumps) + Red Explosive Fuel Barrels!
function buildGasStationAndExplosives(root, animated, collisionWorld) {
  const g = new THREE.Group();
  const gs = GAS_STATION;
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x262c36, roughness: 0.78 });
  const canopyRed = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.36, metalness: 0.25 });
  const canopyWhite = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.45 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd8dee8, roughness: 0.4, metalness: 0.3 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.5, metalness: 0.65 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x224c68, emissive: 0x5c3e18, emissiveIntensity: 0.5, roughness: 0.16, metalness: 0.75 });
  const pumpBodyMat = new THREE.MeshStandardMaterial({ color: 0xf24141, roughness: 0.35, metalness: 0.25 });
  const barrelRedMat = new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.42, metalness: 0.35 });
  const hazardYellowMat = new THREE.MeshBasicMaterial({ color: 0xffd24d });
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xfff4d2 });

  // Forecourt concrete pad
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(gs.w + 4, gs.d + 6), asphaltMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(gs.x, 0.11, gs.z + 1);
  g.add(pad);

  // Overhead Canopy Roof (solid 3D roof slab at y = 5.2..6.2 — drivable underneath!)
  const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(gs.w, 0.9, 10.5), canopyWhite);
  canopyTop.position.set(gs.x, 5.5, gs.z + 2.5);
  canopyTop.castShadow = true;
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(gs.w + 0.3, 0.55, 10.8), canopyRed);
  fascia.position.set(gs.x, 5.75, gs.z + 2.5);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 2.2, 0.4),
    new THREE.MeshBasicMaterial({ map: createSignTexture('ESTACIÓN SOL', '#1c0c12', '#ffe078', '#ff3b4e') })
  );
  sign.position.set(gs.x, 6.25, gs.z + 7.9);
  g.add(canopyTop, fascia, sign);
  collisionWorld.addBox3D(gs.x - gs.w / 2, gs.x + gs.w / 2, 5.0, 6.3, gs.z - 2.8, gs.z + 7.8, 'roof');

  // 4 Canopy Support Pillars
  for (const px of [-gs.w / 2 + 1.6, gs.w / 2 - 1.6]) {
    for (const pz of [-2.2, 6.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.2, 8), pillarMat);
      col.position.set(gs.x + px, 2.6, gs.z + pz);
      g.add(col);
      collisionWorld.addRect(gs.x + px, gs.z + pz, 0.8, 0.8, 5.2, 'pillar', 0);
    }
  }
  // Under-canopy fluorescent strips
  for (const lx of [-6, 0, 6]) {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.5), stripMat);
    fl.position.set(gs.x + lx, 5.02, gs.z + 2.5);
    g.add(fl);
  }
  animated.streetLampPositions.push(new THREE.Vector3(gs.x, 5.0, gs.z + 2.5));

  // Small convenience kiosk behind pumps (z = gs.z - 6.5)
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(13, 4.0, 5.5), canopyWhite);
  kiosk.position.set(gs.x, 2.0, gs.z - 6.2);
  kiosk.castShadow = true;
  const kGlass = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.1, 0.2), glassMat);
  kGlass.position.set(gs.x, 1.8, gs.z - 3.4);
  const kTrim = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.45, 5.8), canopyRed);
  kTrim.position.set(gs.x, 4.1, gs.z - 6.2);
  g.add(kiosk, kGlass, kTrim);
  collisionWorld.addRect(gs.x, gs.z - 6.2, 13.4, 5.8, 4.4, 'building', 0);

  // 4 Explosive Gas Pumps!
  for (const p of gs.pumps) {
    const pg = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 0.9), darkMetal);
    base.position.y = 0.12;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.85, 0.65), pumpBodyMat.clone());
    body.position.y = 1.15;
    body.castShadow = true;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.68), hazardYellowMat);
    screen.position.y = 1.52;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.18, 0.74), canopyWhite);
    cap.position.y = 2.12;
    pg.add(base, body, screen, cap);
    pg.position.set(p.x, 0, p.z);
    g.add(pg);
    animated.explosives.push({
      id: p.id,
      kind: 'gas-pump',
      mesh: pg,
      bodyMat: body.material,
      pos: pg.position,
      radius: 0.95,
      height: 2.2,
      hp: 35,
      maxHp: 35,
      exploded: false,
      chainTimer: 0,
    });
  }

  // Explosive Red Fuel Barrels around Estación Sol, Puerto Cenit & Mercado Nocturno
  for (const br of FUEL_BARREL_SPOTS) {
    const bg = new THREE.Group();
    const mat = barrelRedMat.clone();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.24, 12), mat);
    drum.position.y = 0.62;
    drum.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.16, 12), hazardYellowMat);
    band.position.y = 0.68;
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 12), darkMetal);
    rimT.rotation.x = Math.PI / 2;
    rimT.position.y = 1.22;
    bg.add(drum, band, rimT);
    bg.position.set(br.x, 0, br.z);
    g.add(bg);
    animated.explosives.push({
      id: br.id,
      kind: 'fuel-barrel',
      mesh: bg,
      bodyMat: mat,
      pos: bg.position,
      radius: 0.62,
      height: 1.3,
      hp: 20,
      maxHp: 20,
      exploded: false,
      chainTimer: 0,
    });
  }

  root.add(g);
}

// Dock 3 Sleek Drivable Speedboats (Bahia Esmeralda Marina, Paseo Pier, Río Dorado) + Parked Yellow Cala Cab on Paseo Dorado
function buildDockedSpeedboatsAndTaxi(root, parkedVehicles) {
  const registerVeh = (mesh, typeKey) => {
    const spec = VEHICLES[typeKey] ?? VEHICLES.cabo_gt;
    parkedVehicles.push({
      mesh,
      typeKey,
      spec,
      pos: mesh.position,
      vel: new THREE.Vector3(),
      yaw: mesh.rotation.y,
      speed: 0,
      vFwd: 0,
      vy: 0,
      grounded: true,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      condition: 100,
      nitro: 100,
      boosting: false,
      drifting: false,
      inWater: Boolean(spec.isBoat),
      engineStalled: false,
      headlightsOn: true,
      sirenActive: false,
      burning: false,
      fireCountdown: 0,
      exploded: false,
      smokeTimer: 0,
      crackleTimer: 0,
      coughTimer: 0,
      turboLevel: 1,
      isParked: true,
    });
  };

  for (const spot of BOAT_DOCK_SPOTS) {
    const boat = createVehicleMesh('speedboat');
    boat.position.set(spot.x, 0.08, spot.z);
    boat.rotation.y = spot.yaw;
    root.add(boat);
    registerVeh(boat, 'speedboat');
  }

  // Parked Yellow Cala Cab right outside Hotel Solsticio on Paseo Dorado for instant Taxi Fare side-jobs!
  const cab = createVehicleMesh('cala_cab');
  cab.position.set(-116, 0, 186);
  cab.rotation.y = Math.PI / 2;
  root.add(cab);
  registerVeh(cab, 'cala_cab');
}
