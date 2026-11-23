// Ultra-smooth continuous 24h Day <-> Dusk <-> Night <-> Dawn sky & lighting system with wispy clouds,
// sun & moon arcs, dynamic night streetlamp PointLights, emissive building windows, and traffic signal cycling.

import * as THREE from '../../vendor/three.module.min.js';
import { getRadialGlowTexture } from '../entities/vehicleFactory.js';

function createWispyCloudTexture(variant = 0) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 192);

  const puffs = variant === 0
    ? [
      [130, 102, 128, 34, 0.42],
      [215, 86, 145, 42, 0.56],
      [305, 92, 138, 38, 0.52],
      [385, 108, 110, 28, 0.36],
      [255, 114, 170, 26, 0.32],
      [175, 76, 86, 26, 0.35],
    ]
    : [
      [110, 96, 108, 22, 0.34],
      [200, 90, 160, 28, 0.48],
      [310, 86, 165, 30, 0.46],
      [405, 98, 102, 22, 0.30],
      [256, 108, 185, 22, 0.28],
    ];

  for (const [cx, cy, rx, ry, alpha] of puffs) {
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / rx);
    const grad = g.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
    grad.addColorStop(0.0, `rgba(255, 250, 242, ${alpha})`);
    grad.addColorStop(0.48, `rgba(255, 232, 206, ${alpha * 0.62})`);
    grad.addColorStop(0.82, `rgba(255, 194, 164, ${alpha * 0.22})`);
    grad.addColorStop(1.0, 'rgba(255, 180, 150, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function lerpColorHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return (r << 16) | (g << 8) | bl;
}

function hexCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Smooth 24-hour atmospheric keyframes (6-stop sky gradient, cosine/smoothstep interpolated — zero abrupt jumps!)
const TIME_KEYFRAMES = [
  {
    h: 0.0,
    sky: [0x050816, 0x0f1432, 0x1e183b, 0x261a42, 0x191630, 0x111022],
    sunColor: 0x88aeff, sunInt: 0.72,
    hemiSky: 0x4b5c96, hemiGround: 0x1c172b, hemiInt: 0.90,
    fogColor: 0x15162a, fogDensity: 0.00145,
    cloudWarm: 0x333c62, cloudCool: 0x2a3354, cloudOp: 0.22,
    sunAlpha: 0.0, moonAlpha: 0.92, nightFactor: 1.0,
  },
  {
    h: 5.0,
    sky: [0x090f28, 0x1b234a, 0x3c2c54, 0x6b3d5c, 0x8a5260, 0x4c2d4a],
    sunColor: 0x9aaeff, sunInt: 0.85,
    hemiSky: 0x5c689e, hemiGround: 0x221d32, hemiInt: 0.94,
    fogColor: 0x2d2442, fogDensity: 0.00135,
    cloudWarm: 0x7a5c78, cloudCool: 0x52577a, cloudOp: 0.42,
    sunAlpha: 0.15, moonAlpha: 0.55, nightFactor: 0.75,
  },
  {
    h: 6.6,
    sky: [0x1c3b7a, 0x4b5c96, 0xb86d7e, 0xf29364, 0xffc682, 0xffe2a8],
    sunColor: 0xffba78, sunInt: 1.95,
    hemiSky: 0xffd2ab, hemiGround: 0x36445c, hemiInt: 1.18,
    fogColor: 0xd99272, fogDensity: 0.00112,
    cloudWarm: 0xffcba0, cloudCool: 0xffe8d2, cloudOp: 0.84,
    sunAlpha: 0.88, moonAlpha: 0.0, nightFactor: 0.18,
  },
  {
    h: 9.5,
    sky: [0x1860c8, 0x408ee0, 0x72b9f0, 0xa8daf8, 0xd8eefc, 0xffeec8],
    sunColor: 0xfff0d4, sunInt: 2.38,
    hemiSky: 0xaad6ff, hemiGround: 0x4b5c6e, hemiInt: 1.20,
    fogColor: 0x9ec8e8, fogDensity: 0.00094,
    cloudWarm: 0xfffdf8, cloudCool: 0xf7fbff, cloudOp: 0.94,
    sunAlpha: 0.95, moonAlpha: 0.0, nightFactor: 0.0,
  },
  {
    h: 15.8,
    sky: [0x1a5cc0, 0x4890dc, 0x82bde8, 0xb6daf2, 0xffe4b5, 0xffd79e],
    sunColor: 0xffe4b8, sunInt: 2.42,
    hemiSky: 0xc2dfff, hemiGround: 0x48566a, hemiInt: 1.22,
    fogColor: 0xb6c8dc, fogDensity: 0.00098,
    cloudWarm: 0xfff4e0, cloudCool: 0xfffaf0, cloudOp: 0.92,
    sunAlpha: 0.96, moonAlpha: 0.0, nightFactor: 0.0,
  },
  {
    h: 18.7, // Signature Cala Dorada Golden Hour Sunset (rich warm coral-amber-gold horizon!)
    sky: [0x162452, 0x48356b, 0xa84f68, 0xf57c4e, 0xffbc68, 0xffe09c],
    sunColor: 0xffb466, sunInt: 2.65,
    hemiSky: 0xffcfa6, hemiGround: 0x2d415c, hemiInt: 1.32,
    fogColor: 0xdf825d, fogDensity: 0.00112,
    cloudWarm: 0xffc494, cloudCool: 0xffe6cc, cloudOp: 1.0,
    sunAlpha: 1.0, moonAlpha: 0.0, nightFactor: 0.25,
  },
  {
    h: 19.9, // Coral-Violet Dusk Twilight
    sky: [0x0c1333, 0x241c4a, 0x5a2d5c, 0x994558, 0xb86258, 0x4a2948],
    sunColor: 0xd97d68, sunInt: 1.25,
    hemiSky: 0x80639c, hemiGround: 0x221d33, hemiInt: 1.02,
    fogColor: 0x492a4a, fogDensity: 0.00132,
    cloudWarm: 0x995d75, cloudCool: 0x5c4c7a, cloudOp: 0.56,
    sunAlpha: 0.30, moonAlpha: 0.45, nightFactor: 0.72,
  },
  {
    h: 21.75, // Signature Cala Dorada Neon Night
    sky: [0x050816, 0x111636, 0x241942, 0x2d1c48, 0x1a1632, 0x121024],
    sunColor: 0x88aeff, sunInt: 0.78,
    hemiSky: 0x4e5e96, hemiGround: 0x1e182e, hemiInt: 0.92,
    fogColor: 0x16162b, fogDensity: 0.00148,
    cloudWarm: 0x323b60, cloudCool: 0x2b3456, cloudOp: 0.24,
    sunAlpha: 0.0, moonAlpha: 0.94, nightFactor: 1.0,
  },
  {
    h: 24.0,
    sky: [0x050816, 0x0f1432, 0x1e183b, 0x261a42, 0x191630, 0x111022],
    sunColor: 0x88aeff, sunInt: 0.72,
    hemiSky: 0x4b5c96, hemiGround: 0x1c172b, hemiInt: 0.90,
    fogColor: 0x15162a, fogDensity: 0.00145,
    cloudWarm: 0x333c62, cloudCool: 0x2a3354, cloudOp: 0.22,
    sunAlpha: 0.0, moonAlpha: 0.92, nightFactor: 1.0,
  },
];

function sampleTimeState(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = TIME_KEYFRAMES[0];
  let b = TIME_KEYFRAMES[TIME_KEYFRAMES.length - 1];
  for (let i = 0; i < TIME_KEYFRAMES.length - 1; i++) {
    if (h >= TIME_KEYFRAMES[i].h && h <= TIME_KEYFRAMES[i + 1].h) {
      a = TIME_KEYFRAMES[i];
      b = TIME_KEYFRAMES[i + 1];
      break;
    }
  }
  const span = Math.max(0.001, b.h - a.h);
  const t = smoothstep01((h - a.h) / span);
  const lerp = (u, v) => u + (v - u) * t;
  return {
    sky: a.sky.map((col, idx) => lerpColorHex(col, b.sky[idx], t)),
    sunColor: lerpColorHex(a.sunColor, b.sunColor, t),
    sunInt: lerp(a.sunInt, b.sunInt),
    hemiSky: lerpColorHex(a.hemiSky, b.hemiSky, t),
    hemiGround: lerpColorHex(a.hemiGround, b.hemiGround, t),
    hemiInt: lerp(a.hemiInt, b.hemiInt),
    fogColor: lerpColorHex(a.fogColor, b.fogColor, t),
    fogDensity: lerp(a.fogDensity, b.fogDensity),
    cloudWarm: lerpColorHex(a.cloudWarm, b.cloudWarm, t),
    cloudCool: lerpColorHex(a.cloudCool, b.cloudCool, t),
    cloudOp: lerp(a.cloudOp, b.cloudOp),
    sunAlpha: lerp(a.sunAlpha, b.sunAlpha),
    moonAlpha: lerp(a.moonAlpha, b.moonAlpha),
    nightFactor: lerp(a.nightFactor, b.nightFactor),
  };
}

export class SkyAndLighting {
  constructor(scene) {
    this.scene = scene;
    this.lastSkyHour = -999;
    this.nightFactor = 0.25;

    // Smooth dynamically blended Sky Dome CanvasTexture
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 8;
    this.skyCanvas.height = 256;
    this.skyCtx = this.skyCanvas.getContext('2d');
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;

    this.skyGeo = new THREE.SphereGeometry(1180, 28, 18);
    this.skyMat = new THREE.MeshBasicMaterial({ map: this.skyTex, side: THREE.BackSide, fog: false });
    this.skyDome = new THREE.Mesh(this.skyGeo, this.skyMat);
    scene.add(this.skyDome);

    // Layered Soft Wispy Sunlit Cloud Banks across Sky Dome
    this.cloudGroup = new THREE.Group();
    this.cloudMats = [];
    const cloudTexA = createWispyCloudTexture(0);
    const cloudTexB = createWispyCloudTexture(1);

    const cloudLayout = [
      { az: -0.58, el: 0.16, dist: 790, w: 340, h: 86,  v: 1, baseOp: 0.72 },
      { az: -0.26, el: 0.21, dist: 810, w: 360, h: 92,  v: 0, baseOp: 0.74 },
      { az: 0.04,  el: 0.22, dist: 820, w: 380, h: 94,  v: 1, baseOp: 0.68 },
      { az: 0.56,  el: 0.18, dist: 780, w: 330, h: 88,  v: 0, baseOp: 0.70 },
      { az: -0.45, el: 0.28, dist: 760, w: 350, h: 112, v: 0, baseOp: 0.74 },
      { az: -0.18, el: 0.34, dist: 810, w: 410, h: 120, v: 1, baseOp: 0.68 },
      { az: 0.14,  el: 0.31, dist: 790, w: 360, h: 112, v: 0, baseOp: 0.70 },
      { az: 0.46,  el: 0.27, dist: 740, w: 340, h: 104, v: 1, baseOp: 0.66 },
      { az: 0.72,  el: 0.33, dist: 820, w: 390, h: 118, v: 0, baseOp: 0.70 },
      { az: -0.68, el: 0.36, dist: 840, w: 370, h: 115, v: 1, baseOp: 0.64 },
      { az: -0.04, el: 0.45, dist: 860, w: 460, h: 128, v: 1, baseOp: 0.58 },
      { az: 0.32,  el: 0.44, dist: 850, w: 420, h: 122, v: 0, baseOp: 0.60 },
      { az: 1.15,  el: 0.29, dist: 780, w: 360, h: 110, v: 0, baseOp: 0.62 },
      { az: 1.55,  el: 0.36, dist: 820, w: 400, h: 116, v: 1, baseOp: 0.58 },
      { az: 2.05,  el: 0.27, dist: 790, w: 350, h: 104, v: 0, baseOp: 0.60 },
      { az: 2.55,  el: 0.34, dist: 830, w: 410, h: 118, v: 1, baseOp: 0.58 },
      { az: 3.05,  el: 0.26, dist: 770, w: 340, h: 102, v: 0, baseOp: 0.62 },
      { az: -2.65, el: 0.35, dist: 820, w: 390, h: 116, v: 1, baseOp: 0.58 },
      { az: -2.1,  el: 0.28, dist: 780, w: 360, h: 108, v: 0, baseOp: 0.60 },
      { az: -1.55, el: 0.33, dist: 810, w: 400, h: 114, v: 1, baseOp: 0.58 },
      { az: -1.1,  el: 0.25, dist: 760, w: 340, h: 104, v: 0, baseOp: 0.64 },
      { az: -0.82, el: 0.44, dist: 870, w: 440, h: 122, v: 1, baseOp: 0.54 },
    ];

    for (const cl of cloudLayout) {
      const mat = new THREE.MeshBasicMaterial({
        map: cl.v === 0 ? cloudTexA : cloudTexB,
        color: 0xffdfc2,
        transparent: true,
        opacity: cl.baseOp,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cl.w, cl.h), mat);
      const horiz = Math.cos(cl.el) * cl.dist;
      const y = Math.sin(cl.el) * cl.dist;
      const x = Math.cos(cl.az) * horiz;
      const z = Math.sin(cl.az) * horiz;
      mesh.position.set(x, y, z);
      mesh.lookAt(0, y * 0.25, 0);
      mesh.renderOrder = 2;
      this.cloudGroup.add(mesh);
      this.cloudMats.push({ mat, baseOp: cl.baseOp, warmTier: cl.el < 0.3 });
    }
    scene.add(this.cloudGroup);

    // Glowing Sun Disk + Focused Radial Corona Halo
    this.sunGroup = new THREE.Group();
    this.sunDiskMat = new THREE.MeshBasicMaterial({ color: 0xfff8dc, transparent: true, opacity: 1, fog: false, depthWrite: false });
    const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(34, 24, 16), this.sunDiskMat);
    this.sunHaloMat = new THREE.SpriteMaterial({
      map: getRadialGlowTexture('rgba(255,244,198,0.88)', 'rgba(255,146,72,0.34)', 'rgba(255,90,60,0)'),
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const sunHalo = new THREE.Sprite(this.sunHaloMat);
    sunHalo.scale.set(225, 225, 1);
    sunHalo.renderOrder = 1;
    this.sunGroup.add(sunDisk, sunHalo);
    scene.add(this.sunGroup);

    // Cool Silvery Moon Disk + Subtle Halo for Night Sky
    this.moonGroup = new THREE.Group();
    this.moonDiskMat = new THREE.MeshBasicMaterial({ color: 0xe6f0ff, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const moonDisk = new THREE.Mesh(new THREE.SphereGeometry(20, 18, 14), this.moonDiskMat);
    this.moonHaloMat = new THREE.SpriteMaterial({
      map: getRadialGlowTexture('rgba(210,232,255,0.65)', 'rgba(130,170,255,0.2)', 'rgba(0,0,0,0)'),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const moonHalo = new THREE.Sprite(this.moonHaloMat);
    moonHalo.scale.set(130, 130, 1);
    this.moonGroup.add(moonDisk, moonHalo);
    scene.add(this.moonGroup);

    // Directional Sun/Moon Light with crisp shadows
    this.sunLight = new THREE.DirectionalLight(0xffb46e, 2.55);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 540;
    const d = 185;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0008;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Hemisphere Fill & Ambient Bounce
    this.hemiLight = new THREE.HemisphereLight(0xffc99e, 0x263850, 1.25);
    scene.add(this.hemiLight);

    this.fog = new THREE.FogExp2(0xdd825e, 0.00118);
    scene.fog = this.fog;

    // Dynamic Pool of 5 Focused Warm Streetlamp PointLights (tracks nearest streetlamps around player/camera at night!)
    this.dynamicStreetLights = [];
    for (let i = 0; i < 5; i++) {
      const pl = new THREE.PointLight(0xffbe6b, 0, 32, 1.75);
      pl.position.set(0, -100, 0);
      scene.add(pl);
      this.dynamicStreetLights.push(pl);
    }

    this.applyTimeOfDay(18.7);
  }

  _updateSkyGradient(skyStops) {
    const g = this.skyCtx;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    const offsets = [0.0, 0.24, 0.42, 0.53, 0.65, 1.0];
    for (let i = 0; i < skyStops.length; i++) {
      grad.addColorStop(offsets[i], hexCss(skyStops[i]));
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
    this.skyTex.needsUpdate = true;
  }

  applyTimeOfDay(hour, focusPos = null, customSunDir = null) {
    const h = ((hour % 24) + 24) % 24;
    const s = sampleTimeState(h);
    this.nightFactor = s.nightFactor;

    if (Math.abs(h - this.lastSkyHour) > 0.015) {
      this.lastSkyHour = h;
      this._updateSkyGradient(s.sky);
    }

    this.sunLight.color.setHex(s.sunColor);
    this.sunLight.intensity = s.sunInt;
    this.hemiLight.color.setHex(s.hemiSky);
    this.hemiLight.groundColor.setHex(s.hemiGround);
    this.hemiLight.intensity = s.hemiInt;
    this.fog.color.setHex(s.fogColor);
    this.fog.density = s.fogDensity;

    for (const c of this.cloudMats) {
      c.mat.color.setHex(c.warmTier ? s.cloudWarm : s.cloudCool);
      c.mat.opacity = c.baseOp * s.cloudOp;
    }

    const fx = focusPos ? focusPos.x : 0;
    const fz = focusPos ? focusPos.z : 0;
    this.skyDome.position.set(fx, 0, fz);
    this.cloudGroup.position.set(fx, 0, fz);

    // Continuous smooth solar arc across 24h (peaks at noon, golden low east/southeast around 18.7)
    let sunDir;
    if (customSunDir) {
      sunDir = customSunDir;
    } else {
      const dayAngle = ((h - 6) / 13.5) * Math.PI; // 0 at 6am, PI/2 at 12:45pm, ~PI at 7:30pm
      const elev = Math.sin(Math.max(0.08, Math.min(Math.PI - 0.08, dayAngle)));
      const sx = Math.cos(dayAngle) * -220 + 180;
      const sy = Math.max(38, elev * 220);
      const sz = 110 + (1 - elev) * 45;
      sunDir = new THREE.Vector3(sx, sy, sz);
    }

    this.sunGroup.visible = s.sunAlpha > 0.02;
    this.sunDiskMat.opacity = s.sunAlpha;
    this.sunHaloMat.opacity = s.sunAlpha;
    this.sunGroup.position.set(fx + sunDir.x * 3.1, sunDir.y * 1.95, fz + sunDir.z * 3.1);
    this.sunGroup.lookAt(fx, 10, fz);

    // Smooth lunar arc opposite the sun
    const moonAngle = ((h + 6) % 24) / 24 * Math.PI * 2;
    const moonDir = new THREE.Vector3(Math.cos(moonAngle) * 190, 145 + Math.sin(moonAngle) * 40, -140);
    this.moonGroup.visible = s.moonAlpha > 0.02;
    this.moonDiskMat.opacity = s.moonAlpha;
    this.moonHaloMat.opacity = s.moonAlpha * 0.85;
    this.moonGroup.position.set(fx + moonDir.x * 3.2, moonDir.y * 2.1, fz + moonDir.z * 3.2);
    this.moonGroup.lookAt(fx, 10, fz);

    // Directional light smoothly tracks sun during day/golden hour and moon at night
    const activeDir = s.nightFactor > 0.78 && !customSunDir ? moonDir : sunDir;
    this.sunLight.position.set(fx + activeDir.x, activeDir.y, fz + activeDir.z);
    this.sunLight.target.position.set(fx, 0, fz);
  }

  updateAmbient(dt, elapsed, worldAnim, focusPos = null) {
    this.cloudGroup.rotation.y = (elapsed * 0.0022) % (Math.PI * 2);

    if (worldAnim.ocean) {
      worldAnim.ocean.material.map.offset.x = (elapsed * 0.018) % 1;
      worldAnim.ocean.material.map.offset.y = Math.sin(elapsed * 0.35) * 0.04;
    }
    for (let i = 0; i < worldAnim.palms.length; i++) {
      const crown = worldAnim.palms[i].userData.crown;
      if (crown) {
        crown.rotation.z = Math.sin(elapsed * 1.4 + i) * 0.048;
      }
    }
    for (let i = 0; i < worldAnim.shells.length; i++) {
      const s = worldAnim.shells[i];
      if (s.visible) {
        s.rotation.y += dt * 1.8;
        s.position.y = 1.45 + Math.sin(elapsed * 2.8 + i) * 0.28;
      }
    }
    for (let i = 0; i < (worldAnim.propertyBeacons?.length ?? 0); i++) {
      const b = worldAnim.propertyBeacons[i];
      b.rotation.y += dt * 1.6;
      b.position.y = 2.6 + Math.sin(elapsed * 2.6 + i) * 0.28;
    }

    // Automatic Night Streetlights, Ground Glow Pools & Lit Building Windows!
    const nf = this.nightFactor;
    if (worldAnim.nightGlowMeshes) {
      for (let i = 0; i < worldAnim.nightGlowMeshes.length; i++) {
        const ng = worldAnim.nightGlowMeshes[i];
        ng.mat.opacity = ng.dayOp + (ng.nightOp - ng.dayOp) * nf;
      }
    }
    if (worldAnim.nightWindowMats) {
      const winInt = 0.06 + nf * 0.58;
      for (let i = 0; i < worldAnim.nightWindowMats.length; i++) {
        worldAnim.nightWindowMats[i].emissiveIntensity = winInt;
      }
    }

    // Position the 5 real Three.js PointLights onto the nearest streetlamps to the player/camera!
    if (focusPos && worldAnim.streetLampPositions?.length) {
      const lamps = worldAnim.streetLampPositions;
      const intensity = nf > 0.08 ? nf * 26 : 0;
      if (intensity <= 0.1) {
        for (const pl of this.dynamicStreetLights) pl.intensity = 0;
      } else {
        // Pick 5 closest streetlamps cleanly
        const best = [];
        for (let i = 0; i < lamps.length; i++) {
          const lp = lamps[i];
          const d2 = (lp.x - focusPos.x) ** 2 + (lp.z - focusPos.z) ** 2;
          if (d2 > 6400) continue; // within 80m
          if (best.length < 5) {
            best.push({ lp, d2 });
            best.sort((a, b) => a.d2 - b.d2);
          } else if (d2 < best[4].d2) {
            best[4] = { lp, d2 };
            best.sort((a, b) => a.d2 - b.d2);
          }
        }
        for (let i = 0; i < this.dynamicStreetLights.length; i++) {
          const pl = this.dynamicStreetLights[i];
          if (i < best.length) {
            pl.position.copy(best[i].lp);
            pl.intensity = intensity;
          } else {
            pl.intensity = 0;
          }
        }
      }
    }

    // Cycle Intersection Traffic Lights smoothly (Red -> Green -> Amber)
    if (worldAnim.trafficSignals) {
      for (let i = 0; i < worldAnim.trafficSignals.length; i++) {
        const sig = worldAnim.trafficSignals[i];
        const cycle = (elapsed + sig.phaseOffset) % 14;
        const isGreen = cycle < 6.5;
        const isAmber = cycle >= 6.5 && cycle < 8.0;
        const isRed = cycle >= 8.0;
        sig.grnMat.color.setHex(isGreen ? 0x34f58c : 0x0b2b1a);
        sig.ambMat.color.setHex(isAmber ? 0xffbe33 : 0x2e2108);
        sig.redMat.color.setHex(isRed ? 0xff2b45 : 0x2e0b10);
      }
    }
  }
}
