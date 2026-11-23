// 5-star CDPD police dispatch AI with tactical roles (RAMMING, FLANKING, ROADBLOCK, CLOSING IN, FOOT CHASE, SPOTLIGHT).

import * as THREE from '../../vendor/three.module.min.js';
import { createVehicleMesh, updatePoliceLightbar, createBurningWreck, animateBurningWreck } from './vehicleFactory.js';

const CALLSIGNS = ['SOL-14', 'SOL-07', 'SWAT-2', 'SOL-22', 'SOL-09', 'SOL-31'];
const CHATTER = [
  'SOL-14: Suspect apex coupe pushing 140+ eastbound on Paseo Dorado!',
  'DISPATCH: Authorize PIT maneuver and Puente del Sol bridge cordon.',
  'HALCÓN-1: Visual locked — illuminating coral supercar from 180 feet.',
  'SWAT-2: Enforcer barricade established at eastbound span!',
  'SOL-07: Flanking south lane, moving to box suspect against boardwalk.',
  'DISPATCH: All units, suspect armed in Mercado Nocturno — foot chase active!',
];

export class PoliceDispatch {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.units = []; // { id, callsign, mesh, isSwat, pos, yaw, speed, tactic, hp, phase }
    this.wrecks = [];
    this.chatterLine = CHATTER[0];
    this.chatterTimer = 0;
  }

  clearAll() {
    for (const u of this.units) this.group.remove(u.mesh);
    for (const w of this.wrecks) this.group.remove(w);
    this.units = [];
    this.wrecks = [];
  }

  addHeat(state, amount) {
    state.wantedHeat = Math.min(500, state.wantedHeat + amount);
    const stars = Math.min(5, Math.ceil(state.wantedHeat / 95));
    state.wantedLevel = Math.max(state.wantedLevel, stars);
    state.airUnitDeployed = state.wantedLevel >= 4;
    state.evadeTimer = 18;
  }

  dropStars(state, drop = 2) {
    state.wantedLevel = Math.max(0, state.wantedLevel - drop);
    state.wantedHeat = state.wantedLevel * 85;
    state.airUnitDeployed = state.wantedLevel >= 4;
    if (state.wantedLevel === 0) {
      this.clearAll();
      state.careerStats.pursuitsEvaded += 1;
    }
  }

  spawnUnit(callsign, isSwat, x, z, yaw, tactic) {
    const mesh = createVehicleMesh(isSwat ? 'cdpd_enforcer' : 'cdpd_interceptor');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    this.group.add(mesh);
    const u = {
      callsign,
      mesh,
      isSwat,
      pos: mesh.position,
      yaw,
      speed: isSwat ? 24 : 38,
      tactic,
      hp: isSwat ? 220 : 120,
      phase: Math.random() * 6.28,
    };
    this.units.push(u);
    return u;
  }

  spawnBurningWreckAt(x, z, yaw = 0.6) {
    const w = createBurningWreck();
    w.position.set(x, 0, z);
    w.rotation.y = yaw;
    this.group.add(w);
    this.wrecks.push(w);
    return w;
  }

  update(dt, elapsed, state, playerPos, playerYaw, heliUnit) {
    for (const w of this.wrecks) animateBurningWreck(w, elapsed);

    const desiredCount = state.wantedLevel === 0 ? 0 : Math.min(5, state.wantedLevel + 1);
    while (this.units.length < desiredCount) {
      const idx = this.units.length;
      const isSwat = state.wantedLevel >= 4 && idx === 2;
      const angle = playerYaw + Math.PI + (idx - 1.5) * 0.65;
      const dist = 48 + idx * 14;
      const sx = Math.max(-420, Math.min(420, playerPos.x + Math.sin(angle) * dist));
      const sz = Math.max(-410, Math.min(235, playerPos.z + Math.cos(angle) * dist));
      const tactic = isSwat ? 'ROADBLOCK' : idx === 0 ? 'RAMMING' : idx % 2 === 1 ? 'FLANKING' : 'CLOSING IN';
      this.spawnUnit(CALLSIGNS[idx % CALLSIGNS.length], isSwat, sx, sz, playerYaw, tactic);
    }
    while (this.units.length > desiredCount) {
      const popped = this.units.pop();
      this.group.remove(popped.mesh);
    }

    const jammed = state.signalJamTimer > 0;
    const fwdX = Math.sin(playerYaw);
    const fwdZ = Math.cos(playerYaw);
    const rtX = Math.cos(playerYaw);
    const rtZ = -Math.sin(playerYaw);

    this.units.forEach((u, idx) => {
      updatePoliceLightbar(u.mesh, elapsed, u.phase);

      let tx = playerPos.x;
      let tz = playerPos.z;
      if (jammed) {
        tx = u.pos.x + Math.sin(u.yaw + 0.4) * 20;
        tz = u.pos.z + Math.cos(u.yaw + 0.4) * 20;
      } else if (!state.inVehicle) {
        u.tactic = idx === 0 ? 'FOOT CHASE' : 'CLOSING IN';
        tx = playerPos.x - fwdX * (18 + idx * 8);
        tz = playerPos.z - fwdZ * (18 + idx * 8);
      } else if (u.isSwat) {
        u.tactic = 'ROADBLOCK';
        tx = playerPos.x + fwdX * 42;
        tz = playerPos.z + fwdZ * 42;
      } else if (idx === 0) {
        u.tactic = 'RAMMING';
        tx = playerPos.x + fwdX * 6;
        tz = playerPos.z + fwdZ * 6;
      } else if (idx === 1 || idx === 4) {
        u.tactic = 'FLANKING';
        const side = idx === 1 ? 1 : -1;
        tx = playerPos.x + rtX * side * 9 + fwdX * 4;
        tz = playerPos.z + rtZ * side * 9 + fwdZ * 4;
      } else {
        u.tactic = 'CLOSING IN';
        tx = playerPos.x - fwdX * 14;
        tz = playerPos.z - fwdZ * 14;
      }

      const dx = tx - u.pos.x;
      const dz = tz - u.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const desiredYaw = Math.atan2(dx, dz);
      let diff = desiredYaw - u.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff * 3.5 * dt));

      const targetSpd = jammed ? 14 : dist > 10 ? (u.isSwat ? 28 : 44) : 12;
      u.speed = THREE.MathUtils.lerp(u.speed, targetSpd, dt * 3);
      u.pos.x += Math.sin(u.yaw) * u.speed * dt;
      u.pos.z += Math.cos(u.yaw) * u.speed * dt;
      u.mesh.rotation.y = u.yaw;

      for (const w of u.mesh.userData.wheels ?? []) w.rotation.x += u.speed * dt * 1.8;
    });

    // Update chatter ticker
    this.chatterTimer += dt;
    if (this.chatterTimer > 5.5) {
      this.chatterTimer = 0;
      const idx = Math.floor(elapsed) % CHATTER.length;
      this.chatterLine = CHATTER[idx];
    }

    // Cooldown wanted evasion if player escapes far enough
    if (state.wantedLevel > 0) {
      const closest = this.units.reduce((min, u) => Math.min(min, u.pos.distanceTo(playerPos)), 999);
      if (closest > 110 || jammed) {
        state.evadeTimer -= dt;
        if (state.evadeTimer <= 0) {
          this.dropStars(state, 5);
        }
      } else {
        state.evadeTimer = Math.min(18, state.evadeTimer + dt * 2);
      }
    }

    return this.buildDispatchRoster(playerPos, heliUnit, state);
  }

  buildDispatchRoster(playerPos, heliUnit, state) {
    const rows = this.units.map((u) => ({
      callsign: u.callsign,
      distance: Math.round(u.pos.distanceTo(playerPos)),
      tactic: u.tactic,
    }));
    if (state.airUnitDeployed && heliUnit) {
      rows.push({
        callsign: 'HALCÓN-1',
        distance: Math.round(heliUnit.mesh.position.distanceTo(playerPos)),
        tactic: 'SPOTLIGHT',
      });
    }
    rows.sort((a, b) => a.distance - b.distance);
    return {
      active: state.wantedLevel > 0,
      units: rows.slice(0, 6),
      chatter: this.chatterLine,
    };
  }
}
