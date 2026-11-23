// Sun-soaked Golden Hour, Coral Sunset, and Neon Dusk-Night sky dome, sun disk, shadows, and fog.

import * as THREE from '../../vendor/three.module.min.js';

function createSkyTexture(topHex, midHex, horizonHex, bottomHex) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, topHex);
  grad.addColorStop(0.38, midHex);
  grad.addColorStop(0.56, horizonHex);
  grad.addColorStop(0.72, bottomHex);
  grad.addColorStop(1.0, bottomHex);
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
    this.skyGeo = new THREE.SphereGeometry(1100, 24, 16);
    this.skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
    this.skyDome = new THREE.Mesh(this.skyGeo, this.skyMat);
    scene.add(this.skyDome);

    // Glowing Sun Disk + Halo
    this.sunGroup = new THREE.Group();
    const sunDisk = new THREE.Mesh(
      new THREE.CircleGeometry(46, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff0be, fog: false })
    );
    const sunHalo = new THREE.Mesh(
      new THREE.CircleGeometry(105, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.36, fog: false })
    );
    sunHalo.position.z = -1;
    this.sunGroup.add(sunDisk, sunHalo);
    scene.add(this.sunGroup);

    // Directional Sun Light with crisp shadows
    this.sunLight = new THREE.DirectionalLight(0xffb46e, 2.35);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    const d = 175;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0008;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Hemisphere Fill & Ambient Bounce
    this.hemiLight = new THREE.HemisphereLight(0xffc99e, 0x263850, 1.15);
    scene.add(this.hemiLight);

    this.fog = new THREE.FogExp2(0xd98462, 0.00145);
    scene.fog = this.fog;

    this.textures = {
      golden: createSkyTexture('#1e3264', '#874870', '#ff8b54', '#ffcf7d'),
      night: createSkyTexture('#070b1a', '#161b3a', '#35224d', '#1c1830'),
      day: createSkyTexture('#1f6fd4', '#5ba5e8', '#b7dff7', '#ffe8be'),
    };

    this.applyTimeOfDay(18.7);
  }

  applyTimeOfDay(hour, focusPos = null) {
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
      this.sunLight.color.setHex(0xffb063);
      this.sunLight.intensity = 2.55;
      this.hemiLight.color.setHex(0xffcca0);
      this.hemiLight.groundColor.setHex(0x2d3f59);
      this.hemiLight.intensity = 1.25;
      this.fog.color.setHex(0xdf8862);
      this.fog.density = 0.00135;
      this.sunGroup.visible = true;
    } else if (preset === 'night') {
      this.sunLight.color.setHex(0x7ca2ff);
      this.sunLight.intensity = 0.72;
      this.hemiLight.color.setHex(0x4a558c);
      this.hemiLight.groundColor.setHex(0x1f1828);
      this.hemiLight.intensity = 0.85;
      this.fog.color.setHex(0x18172b);
      this.fog.density = 0.0019;
      this.sunGroup.visible = false;
    } else {
      this.sunLight.color.setHex(0xfff1d6);
      this.sunLight.intensity = 2.3;
      this.hemiLight.color.setHex(0xa8d4ff);
      this.hemiLight.groundColor.setHex(0x4b5c6e);
      this.hemiLight.intensity = 1.15;
      this.fog.color.setHex(0x9ec8e8);
      this.fog.density = 0.00105;
      this.sunGroup.visible = true;
    }

    const fx = focusPos ? focusPos.x : 0;
    const fz = focusPos ? focusPos.z : 0;
    this.skyDome.position.set(fx, 0, fz);

    const sunDir = preset === 'day'
      ? new THREE.Vector3(120, 210, 90)
      : new THREE.Vector3(-210, 72, 220);

    this.sunLight.position.set(fx + sunDir.x, sunDir.y, fz + sunDir.z);
    this.sunLight.target.position.set(fx, 0, fz);

    this.sunGroup.position.set(fx + sunDir.x * 3.2, sunDir.y * 2.2, fz + sunDir.z * 3.2);
    this.sunGroup.lookAt(fx, 8, fz);
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
