// CDPD HALCÓN-1 tactical helicopter with sculpted fuselage, spinning rotors, nav lights, and volumetric gradient spotlight.

import * as THREE from '../../vendor/three.module.min.js';
import { getRadialGlowTexture } from './vehicleFactory.js';

function createSpotlightBeamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 252, 232, 0.85)');
  grad.addColorStop(0.18, 'rgba(255, 240, 195, 0.44)');
  grad.addColorStop(0.6, 'rgba(255, 232, 178, 0.16)');
  grad.addColorStop(1.0, 'rgba(255, 224, 165, 0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class HelicopterAI {
  constructor(scene) {
    this.scene = scene;
    this.mesh = this._buildHeliMesh();
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    // Glowing ground spotlight pool ring beneath target
    this.groundPool = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({
        map: getRadialGlowTexture('rgba(255,248,215,0.65)', 'rgba(255,232,165,0.22)', 'rgba(0,0,0,0)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.groundPool.rotation.x = -Math.PI / 2;
    this.groundPool.position.y = 0.14;
    this.groundPool.visible = false;
    this.scene.add(this.groundPool);

    this.orbitAngle = 0.6;
  }

  _buildHeliMesh() {
    const g = new THREE.Group();
    const darkNavy = new THREE.MeshStandardMaterial({ color: 0x162238, roughness: 0.32, metalness: 0.6 });
    const whiteTrim = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.3, metalness: 0.35 });
    const goldAccent = new THREE.MeshStandardMaterial({ color: 0xffc44d, roughness: 0.25, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x2b5d85, roughness: 0.08, metalness: 0.92 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x242c3a, roughness: 0.4, metalness: 0.8 });

    // Sculpted fuselage cabin
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.05, 5.4), darkNavy);
    body.position.set(0, 0.1, 0);
    g.add(body);

    // Tapered upper turbine cowling
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 4.2), darkNavy);
    cowl.position.set(0, 1.38, -0.35);
    g.add(cowl);

    // Angled sleek glass cockpit canopy
    const noseUpper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.35, 2.4), glassMat);
    noseUpper.position.set(0, 0.12, 3.2);
    noseUpper.rotation.x = 0.38;
    const noseChin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.82, 2.2), darkNavy);
    noseChin.position.set(0, -0.62, 3.1);
    noseChin.rotation.x = -0.18;
    g.add(noseUpper, noseChin);

    // Side livery stripes (CDPD white + gold trim)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.38, 4.9), whiteTrim);
    stripe.position.set(0, -0.28, 0.1);
    const goldLine = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.11, 4.8), goldAccent);
    goldLine.position.set(0, -0.02, 0.1);
    g.add(stripe, goldLine);

    // Tapered tail boom & stabilizers
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.62, 7.6, 8), darkNavy);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.45, -6.1);
    g.add(boom);

    const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.85), whiteTrim);
    hStab.position.set(0, 0.48, -7.8);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 1.35), whiteTrim);
    fin.position.set(0, 1.15, -9.6);
    fin.rotation.x = -0.24;
    g.add(hStab, fin);

    // Landing skids + diagonal struts
    for (const sx of [-1.35, 1.35]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 5.8, 8), metalMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.72, 0.5);
      g.add(skid);
      for (const sz of [-1.2, 1.8]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.25, 6), metalMat);
        strut.position.set(sx * 0.84, -1.25, sz);
        strut.rotation.z = sx > 0 ? 0.35 : -0.35;
        g.add(strut);
      }
    }

    // Main rotor mast + 4 spinning blades + soft translucent motion disc
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), metalMat);
    mast.position.set(0, 1.85, 0.15);
    g.add(mast);

    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.15, 0.15);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1a1f28 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.08, 0.34), bladeMat);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 13.6), bladeMat);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(6.8, 28),
      new THREE.MeshBasicMaterial({ color: 0xb7cde6, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    mainRotor.add(b1, b2, disc);
    g.add(mainRotor);

    // Tail rotor
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.22), whiteTrim);
    tailRotor.position.set(0.38, 1.15, -9.6);
    g.add(tailRotor);

    // Belly red/blue flashing strobe + red/green nav lights
    const strobe = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,40,75,0.92)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    strobe.scale.set(2.4, 2.4, 1);
    strobe.position.set(0, -1.18, -1.8);
    g.add(strobe);

    // Volumetric Additive Gradient Spotlight Cone!
    const spotOrigin = new THREE.Group();
    spotOrigin.position.set(0, -1.15, 3.6);

    const lampFlare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getRadialGlowTexture('#ffffff', 'rgba(255,244,196,0.92)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    lampFlare.scale.set(3.4, 3.4, 1);
    spotOrigin.add(lampFlare);

    const coneHeight = 46;
    const coneGeo = new THREE.ConeGeometry(7.2, coneHeight, 24, 1, true);
    coneGeo.translate(0, -coneHeight / 2, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      map: createSpotlightBeamTexture(),
      color: 0xfff3c8,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    spotOrigin.add(cone);

    const spotLight = new THREE.SpotLight(0xfff1c4, 95, 95, 0.34, 0.55, 1.2);
    spotLight.position.set(0, 0, 0);
    spotOrigin.add(spotLight);
    spotOrigin.add(spotLight.target);
    spotLight.target.position.set(0, -30, 0);

    g.add(spotOrigin);

    g.userData = { mainRotor, tailRotor, strobe, spotOrigin, cone };
    return g;
  }

  placeForShot(pos, targetPos) {
    this.mesh.visible = true;
    this.mesh.position.copy(pos);
    this.mesh.lookAt(targetPos.x, pos.y - 3, targetPos.z);
    this.mesh.updateMatrixWorld(true);
    this._aimSpotlight(targetPos);
    this.groundPool.visible = true;
    this.groundPool.position.set(targetPos.x, 0.14, targetPos.z);
  }

  _aimSpotlight(targetPos) {
    const { spotOrigin } = this.mesh.userData;
    const worldOrigin = new THREE.Vector3();
    spotOrigin.getWorldPosition(worldOrigin);
    const dir = new THREE.Vector3().subVectors(targetPos, worldOrigin).normalize();
    const localDir = dir.clone().applyQuaternion(this.mesh.quaternion.clone().invert());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), localDir);
    spotOrigin.quaternion.copy(q);
  }

  update(dt, elapsed, state, targetPos) {
    this.mesh.visible = state.airUnitDeployed;
    this.groundPool.visible = state.airUnitDeployed && state.signalJamTimer <= 0;
    if (!state.airUnitDeployed) return;

    this.orbitAngle += dt * 0.42;
    const radius = 34;
    const desiredX = targetPos.x + Math.cos(this.orbitAngle) * radius;
    const desiredZ = targetPos.z + Math.sin(this.orbitAngle) * radius;
    const desiredY = 26 + Math.sin(elapsed * 1.4) * 2.2;

    this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, desiredX, dt * 1.6);
    this.mesh.position.z = THREE.MathUtils.lerp(this.mesh.position.z, desiredZ, dt * 1.6);
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, desiredY, dt * 2.0);
    this.mesh.lookAt(targetPos.x, this.mesh.position.y - 4, targetPos.z);

    const { mainRotor, tailRotor, strobe, cone } = this.mesh.userData;
    mainRotor.rotation.y += dt * 28;
    tailRotor.rotation.x += dt * 36;
    strobe.visible = Math.sin(elapsed * 14) > 0;

    const jammed = state.signalJamTimer > 0;
    cone.visible = !jammed;
    if (!jammed) {
      this._aimSpotlight(targetPos);
      this.groundPool.position.set(targetPos.x, 0.14, targetPos.z);
    }
  }
}
