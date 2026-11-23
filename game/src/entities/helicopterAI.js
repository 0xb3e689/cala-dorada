// CDPD HALCÓN-1 tactical helicopter with spinning rotors, nav lights, and volumetric sweeping spotlight cone.

import * as THREE from '../../vendor/three.module.min.js';

export class HelicopterAI {
  constructor(scene) {
    this.scene = scene;
    this.mesh = this._buildHeliMesh();
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    this.orbitAngle = 0.6;
  }

  _buildHeliMesh() {
    const g = new THREE.Group();
    const darkNavy = new THREE.MeshStandardMaterial({ color: 0x152033, roughness: 0.35, metalness: 0.55 });
    const whiteTrim = new THREE.MeshStandardMaterial({ color: 0xeff4fc, roughness: 0.35, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x264b6e, roughness: 0.12, metalness: 0.9 });

    // Fuselage pod
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.1, 6.2), darkNavy);
    g.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 2.2), glassMat);
    nose.position.set(0, -0.1, 3.6);
    nose.rotation.x = 0.25;
    g.add(nose);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.36, 5.4), whiteTrim);
    stripe.position.set(0, -0.35, 0.2);
    g.add(stripe);

    // Tail boom & stabilizer
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, 6.8), darkNavy);
    boom.position.set(0, 0.35, -6.1);
    g.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 1.2), whiteTrim);
    fin.position.set(0, 1.0, -9.2);
    g.add(fin);

    // Landing skids
    for (const sx of [-1.25, 1.25]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.6, 6), darkNavy);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.65, 0.4);
      g.add(skid);
    }

    // Main spinning rotor + translucent motion blur disc
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 1.45, 0.2);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c212b });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.08, 0.38), bladeMat);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 12.5), bladeMat);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(6.3, 24),
      new THREE.MeshBasicMaterial({ color: 0x9bb2cc, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    mainRotor.add(b1, b2, disc);
    g.add(mainRotor);

    // Tail rotor
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 0.22), whiteTrim);
    tailRotor.position.set(0.45, 0.9, -9.1);
    g.add(tailRotor);

    // Flashing red/blue strobe & nav lights
    const strobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2b4f })
    );
    strobe.position.set(0, -1.15, -2.0);
    g.add(strobe);

    // Volumetric Sweeping Spotlight Cone!
    const spotOrigin = new THREE.Group();
    spotOrigin.position.set(0, -1.1, 3.3);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff8d6 })
    );
    spotOrigin.add(lamp);

    const coneHeight = 44;
    const coneGeo = new THREE.ConeGeometry(8.8, coneHeight, 22, 1, true);
    coneGeo.translate(0, -coneHeight / 2, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff3c4,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    spotOrigin.add(cone);

    // Ground spotlight disc highlight
    const spotLight = new THREE.SpotLight(0xfff1c4, 90, 95, 0.36, 0.5, 1.2);
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
    this._aimSpotlight(targetPos);
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
    }
  }
}
