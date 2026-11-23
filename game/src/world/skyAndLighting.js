// Sun-soaked Golden Hour, Coral Sunset, and Neon Dusk-Night sky dome, glowing sun corona, shadows, and fog.

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

export class SkyAndLighting {
  constructor(scene) {
    this.scene = scene;
    this.lastPreset = '';

    // Procedural Sky Dome
    this.skyGeo = new THREE.SphereGeometry(1180, 28, 18);
    this.skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
    this.skyDome = new THREE.Mesh(this.skyGeo, this.skyMat);
    scene.add(this.skyDome);

    // Glowing Blazing Sunset Sun Disk + Soft Radial Corona Halo
    this.sunGroup = new THREE.Group();
    const sunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(40, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff8dc, fog: false, depthWrite: false })
    );
    const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('rgba(255,244,194,0.92)', 'rgba(255,142,68,0.48)', 'rgba(255,90,60,0)'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }));
    sunHalo.scale.set(340, 340, 1);
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

    this.fog = new THREE.FogExp2(0xdd825e, 0.00125);
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
      this.fog.density = 0.00118;
      this.sunGroup.visible = true;
    } else if (preset === 'night') {
      this.sunLight.color.setHex(0x88aeff);
      this.sunLight.intensity = 0.82;
      this.hemiLight.color.setHex(0x526099);
      this.hemiLight.groundColor.setHex(0x21192d);
      this.hemiLight.intensity = 0.95;
      this.fog.color.setHex(0x16162b);
      this.fog.density = 0.00165;
      this.sunGroup.visible = false;
    } else {
      this.sunLight.color.setHex(0xfff1d6);
      this.sunLight.intensity = 2.35;
      this.hemiLight.color.setHex(0xa8d4ff);
      this.hemiLight.groundColor.setHex(0x4b5c6e);
      this.hemiLight.intensity = 1.18;
      this.fog.color.setHex(0x9ec8e8);
      this.fog.density = 0.001;
      this.sunGroup.visible = true;
    }

    const fx = focusPos ? focusPos.x : 0;
    const fz = focusPos ? focusPos.z : 0;
    this.skyDome.position.set(fx, 0, fz);

    // Position golden sunset sun over the coastal horizon southeast/east-south so it gleams over the ocean & Puente del Sol!
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
    if (worldAnim.ocean) {
      worldAnim.ocean.material.map.offset.x = (elapsed * 0.018) % 1;
      worldAnim.ocean.material.map.offset.y = Math.sin(elapsed * 0.35) * 0.04;
    }
    for (let i = 0; i < worldAnim.palms.length; i++) {
      const crown = worldAnim.palms[i].userData.crown;
      if (crown) {
        crown.rotation.z = Math.sin(elapsed * 1.4 + i) * 0.055;
      }
    }
    for (let i = 0; i < worldAnim.shells.length; i++) {
      const s = worldAnim.shells[i];
      if (s.visible) {
        s.rotation.y += dt * 1.8;
        s.position.y = 1.45 + Math.sin(elapsed * 2.8 + i) * 0.28;
      }
    }
  }
}
