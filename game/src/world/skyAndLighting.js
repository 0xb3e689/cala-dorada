// Sun-soaked Golden Hour, Coral Sunset, and Neon Dusk-Night sky dome, wispy procedural clouds, sun corona, shadows, and fog.

import * as THREE from '../../vendor/three.module.min.js';
import { getRadialGlowTexture } from '../entities/vehicleFactory.js';

function createSkyTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  for (const [offset, hex] of stops) grad.addColorStop(offset, hex);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Painterly soft wispy cloud streak texture (stretched cirrus + warm sunlit cumulus wisps)
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

export class SkyAndLighting {
  constructor(scene) {
    this.scene = scene;
    this.lastPreset = '';

    // Procedural Sky Dome
    this.skyGeo = new THREE.SphereGeometry(1180, 28, 18);
    this.skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
    this.skyDome = new THREE.Mesh(this.skyGeo, this.skyMat);
    scene.add(this.skyDome);

    // Layered Soft Wispy Sunlit Cloud Banks across Sky Dome
    this.cloudGroup = new THREE.Group();
    this.cloudMats = [];
    const cloudTexA = createWispyCloudTexture(0);
    const cloudTexB = createWispyCloudTexture(1);

    // Carefully positioned wispy cloud bands framing east/northeast/southeast/west vistas without blocking sun or HALCÓN-1
    const cloudLayout = [
      // Mid-low golden-hour cirrus streaks clearly visible in BOTH 1-chase.jpg & 4-title.jpg (kept clear of sun disk & HALCÓN-1!)
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
      // Surrounding 360-degree high-altitude cirrus streaks for full open-world driving
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
      // az = 0 points along +X (east, toward Puente del Sol & sunset vista)
      const x = Math.cos(cl.az) * horiz;
      const z = Math.sin(cl.az) * horiz;
      mesh.position.set(x, y, z);
      mesh.lookAt(0, y * 0.25, 0);
      mesh.renderOrder = 2;
      this.cloudGroup.add(mesh);
      this.cloudMats.push({ mat, baseOp: cl.baseOp, warmTier: cl.el < 0.3 });
    }
    scene.add(this.cloudGroup);

    // Glowing Sunset Sun Disk + Focused Radial Corona Halo (tighter spread so sky stays vivid)
    this.sunGroup = new THREE.Group();
    const sunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(34, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff8dc, fog: false, depthWrite: false })
    );
    const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('rgba(255,244,198,0.88)', 'rgba(255,146,72,0.34)', 'rgba(255,90,60,0)'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    sunHalo.scale.set(225, 225, 1);
    sunHalo.position.set(0, 0, 0);
    sunHalo.renderOrder = 1;
    this.sunGroup.add(sunDisk, sunHalo);
    scene.add(this.sunGroup);

    // Directional Sun Light with crisp shadows
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

    this.textures = {
      golden: createSkyTexture([
        [0.0, '#162452'],
        [0.24, '#4e356d'],
        [0.42, '#b04e6f'],
        [0.54, '#ff7d52'],
        [0.64, '#ffbc6b'],
        [0.76, '#ffe09c'],
        [1.0, '#ffcf86'],
      ]),
      night: createSkyTexture([
        [0.0, '#050816'],
        [0.32, '#111636'],
        [0.52, '#2d1c48'],
        [0.68, '#1a1632'],
        [1.0, '#121024'],
      ]),
      day: createSkyTexture([
        [0.0, '#1964cc'],
        [0.38, '#53a2ea'],
        [0.58, '#b4def7'],
        [0.75, '#ffebbf'],
        [1.0, '#ffe8be'],
      ]),
    };

    this.applyTimeOfDay(18.7);
  }

  applyTimeOfDay(hour, focusPos = null, customSunDir = null) {
    const h = ((hour % 24) + 24) % 24;
    let preset = 'golden';
    if (h >= 20.2 || h < 5.2) preset = 'night';
    else if (h >= 8.5 && h < 16.5) preset = 'day';

    if (preset !== this.lastPreset) {
      this.lastPreset = preset;
      this.skyMat.map = this.textures[preset];
      this.skyMat.needsUpdate = true;
    }

    if (preset === 'golden') {
      this.sunLight.color.setHex(0xffb466);
      this.sunLight.intensity = 2.65;
      this.hemiLight.color.setHex(0xffcfa6);
      this.hemiLight.groundColor.setHex(0x2d415c);
      this.hemiLight.intensity = 1.32;
      this.fog.color.setHex(0xdf825d);
      this.fog.density = 0.00112;
      this.sunGroup.visible = true;
      for (const c of this.cloudMats) {
        c.mat.color.setHex(c.warmTier ? 0xffc494 : 0xffe6cc);
        c.mat.opacity = c.baseOp * 1.0;
      }
    } else if (preset === 'night') {
      this.sunLight.color.setHex(0x88aeff);
      this.sunLight.intensity = 0.78;
      this.hemiLight.color.setHex(0x4b588f);
      this.hemiLight.groundColor.setHex(0x1c1528);
      this.hemiLight.intensity = 0.88;
      this.fog.color.setHex(0x16162b);
      this.fog.density = 0.00155;
      this.sunGroup.visible = false;
      for (const c of this.cloudMats) {
        c.mat.color.setHex(0x30395e);
        c.mat.opacity = c.baseOp * 0.24;
      }
    } else {
      this.sunLight.color.setHex(0xfff1d6);
      this.sunLight.intensity = 2.35;
      this.hemiLight.color.setHex(0xa8d4ff);
      this.hemiLight.groundColor.setHex(0x4b5c6e);
      this.hemiLight.intensity = 1.18;
      this.fog.color.setHex(0x9ec8e8);
      this.fog.density = 0.00095;
      this.sunGroup.visible = true;
      for (const c of this.cloudMats) {
        c.mat.color.setHex(0xfffdf7);
        c.mat.opacity = c.baseOp * 0.94;
      }
    }

    const fx = focusPos ? focusPos.x : 0;
    const fz = focusPos ? focusPos.z : 0;
    this.skyDome.position.set(fx, 0, fz);
    this.cloudGroup.position.set(fx, 0, fz);

    const sunDir = customSunDir ?? (
      preset === 'day'
        ? new THREE.Vector3(120, 210, 90)
        : new THREE.Vector3(240, 56, 150)
    );

    this.sunLight.position.set(fx + sunDir.x, sunDir.y, fz + sunDir.z);
    this.sunLight.target.position.set(fx, 0, fz);

    this.sunGroup.position.set(fx + sunDir.x * 3.1, sunDir.y * 1.95, fz + sunDir.z * 3.1);
    this.sunGroup.lookAt(fx, 10, fz);
  }

  updateAmbient(dt, elapsed, worldAnim) {
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
  }
}
