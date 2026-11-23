// Deterministic URL shot staging (?shot=chase|combat|career|title) using the live 3D game engine.

import * as THREE from '../../vendor/three.module.min.js';
import { updatePoliceLightbar, animateBurningWreck, createVehicleMesh } from '../entities/vehicleFactory.js';
import { animatePedLimbs } from '../world/trafficAndPeds.js';

export function applyShotMode(engine, shotName) {
  if (!shotName) return false;
  const s = engine.state;
  engine.saveManager.loadSlot(1, s);
  engine.shotFrozen = true;
  engine.elapsed = 12.4;

  if (shotName === 'chase') {
    setupChaseShot(engine);
    return true;
  }
  if (shotName === 'combat') {
    setupCombatShot(engine);
    return true;
  }
  if (shotName === 'career') {
    setupCareerShot(engine);
    return true;
  }
  if (shotName === 'title') {
    setupTitleShot(engine);
    return true;
  }
  return false;
}

// Shot 1 (COVER): High-octane Golden Hour 4-Star pursuit on Paseo Dorado / Puente del Sol!
function setupChaseShot(engine) {
  const s = engine.state;
  s.timeOfDay = 18.7; // Vibrant golden hour sunset
  s.mode = 'playing';
  s.inVehicle = true;
  s.currentDistrictId = 'paseo-dorado';
  s.cash = 142850;
  s.rp = 7650;
  s.health = 92;
  s.armor = 76;
  s.wantedLevel = 4;
  s.wantedHeat = 415;
  s.airUnitDeployed = true;
  s.activeMissionId = 'm5';
  s.missionStageIdx = 2; // Stage 3/4: Break the CDPD cordon across Puente del Sol
  s.missionTimer = 134;
  s.activeWeaponIdx = 3; // Vector SMG
  s.radioStationIdx = 0; // Onda Sol FM 98.4
  s.radioTrackIdx = 0;
  s.crewCooldowns = { nadia: 0, toma: 0, sora: 9 };
  s.dialogue = {
    speaker: 'NADIA SOLIS · WHEELWOMAN',
    portrait: 'nadia',
    text: "Puente del Sol is locked down! Hit [Z] Plate Swap after the bridge — I'll kill their tags!",
    timer: 99,
  };

  // Hero Dorado Apex GT blasting off Puente del Sol in dramatic low-angle front-3/4 power drift!
  const car = engine.playerVehicle;
  car.pos.set(22.5, 0, 203.2);
  car.yaw = -1.16; // Sweeping front-3/4 angle showing sculpted hood, LED headlights, carbon wing & drift stance
  car.speed = 63.8; // ~148 MPH
  car.hp = Math.round(car.maxHp * 0.84);
  car.nitro = 100;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.set(-0.02, car.yaw, 0.068);
  if (car.mesh.userData?.nitroFlames) car.mesh.userData.nitroFlames.visible = true;
  engine.player.setVisible(false);

  // Tire drift smoke & glowing amber nitro sparks trailing the supercar
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(26.2 + i * 2.0, 0.5 + i * 0.12, 201.4 - i * 0.55);
    engine.vehiclePhysics.spawnSmoke(p, i < 3 ? 0xffa64d : 0xe9eef7, 0.75 + i * 0.12, 4.0);
  }

  // Swarm of 5 CDPD Pursuit Units pouring across Puente del Sol with blazing red/blue lightbar flares!
  engine.police.clearAll();
  const u1 = engine.police.spawnUnit('SOL-14', false, 36.5, 195.8, -1.42, 'RAMMING');
  const u2 = engine.police.spawnUnit('SOL-07', false, 34.5, 208.2, -1.52, 'FLANKING');
  const u3 = engine.police.spawnUnit('SWAT-2', true, 66.0, 201.5, -1.55, 'ROADBLOCK');
  const u4 = engine.police.spawnUnit('SOL-22', false, 54.0, 207.4, -1.48, 'CLOSING IN');
  const u5 = engine.police.spawnUnit('SOL-09', false, 80.0, 196.2, -1.56, 'FLANKING');
  [u1, u2, u3, u4, u5].forEach((u, idx) => updatePoliceLightbar(u.mesh, 12.4, idx * 1.4));

  // Blazing exploding police wreck with radiant fireball right on the Puente del Sol deck!
  const wreck = engine.police.spawnBurningWreckAt(49.5, 194.2, -0.78);
  animateBurningWreck(wreck, 12.4);

  // Coastal scooter swerving on right side + scattering pedestrians
  const scooter = createVehicleMesh('scooter', 0x34e0c8);
  scooter.position.set(17.5, 0, 212.0);
  scooter.rotation.set(0, -1.05, -0.22);
  engine.scene.add(scooter);

  engine.traffic.peds.slice(0, 4).forEach((p, idx) => {
    p.mesh.position.set(14 + idx * 9.0, 0, 221 + (idx % 2) * 3.0);
    p.mesh.rotation.y = -0.7 - idx * 0.25;
    animatePedLimbs(p.mesh, 9.2 + idx, true);
  });

  // HALCÓN-1 Helicopter cleanly framed in upper-center golden sky sweeping volumetric spotlight onto the supercar!
  engine.heli.placeForShot(new THREE.Vector3(38, 17.8, 185.5), new THREE.Vector3(22.5, 0.8, 203.2));

  // Dramatic unobstructed front-3/4 action camera: Dorado Apex GT foreground, CDPD swarm + blazing fireball + Puente del Sol + skyline + shimmering ocean!
  engine.cameraOverride = {
    pos: new THREE.Vector3(10.6, 3.85, 211.2),
    lookAt: new THREE.Vector3(47, 7.6, 198.2),
  };

  engine.police.chatterLine = 'HALCÓN-1: Visual locked — Apex GT 148 MPH on Puente del Sol!';
  const dispatch = engine.police.buildDispatchRoster(car.pos, engine.heli, s);
  engine.setMode('playing');
  engine.shotSunDir = new THREE.Vector3(260, 46, 55);
  engine.sky.applyTimeOfDay(s.timeOfDay, car.pos, engine.shotSunDir);
  engine._updateHud(dispatch, true);
  engine.step(0.016, true);
}

// Shot 2: Neon Dusk/Night on-foot shootout in Mercado Nocturno with glowing lanterns & Nadia!
function setupCombatShot(engine) {
  const s = engine.state;
  s.timeOfDay = 21.75; // Neon dusk-night
  s.mode = 'playing';
  s.inVehicle = false;
  s.currentDistrictId = 'mercado-nocturno';
  s.districtStanding['mercado-nocturno'] = 78;
  s.cash = 96400;
  s.rp = 4680;
  s.health = 84;
  s.armor = 62;
  s.wantedLevel = 2;
  s.wantedHeat = 195;
  s.airUnitDeployed = false;
  s.activeMissionId = 'm3';
  s.missionStageIdx = 1; // Stage 2/3: Eliminate Los Caimanes enforcers
  s.missionTimer = 148;
  s.activeWeaponIdx = 3; // Vector SMG
  s.weaponAmmo.smg = { clip: 28, reserve: 180 };
  s.radioStationIdx = 1; // Neon Pulse FM 101.2
  s.crewCooldowns = { nadia: 0, toma: 0, sora: 0 };
  s.dialogue = {
    speaker: 'NADIA SOLIS · WHEELWOMAN',
    portrait: 'nadia',
    text: 'Los Caimanes have the alley boxed! Keep firing under the lanterns — I have their right flank!',
    timer: 99,
  };

  // Position Dante Varo on foot in Mercado Nocturno lantern alley facing north (-Z)
  const cx = -310;
  const cz = -55;
  engine.player.pos.set(cx - 2.0, 0, cz + 14.5);
  engine.player.yaw = Math.PI + 0.08;
  engine.player.mesh.position.copy(engine.player.pos);
  engine.player.mesh.rotation.y = engine.player.yaw;
  engine.player.setVisible(true);
  engine.player.setCombatPose(true);
  engine.player.flashMuzzle(99);

  // Crew partner Nadia Solis flanking right behind a crate, firing!
  const nadia = engine.player.partnerMesh;
  nadia.visible = true;
  nadia.position.set(cx + 3.2, 0, cz + 11.2);
  nadia.rotation.y = Math.PI - 0.16;
  nadia.userData.limbs.armR.rotation.x = -1.46;
  nadia.userData.limbs.armL.rotation.x = -1.2;
  nadia.userData.muzzleFlash.visible = true;

  // Move hero car parked behind cover
  engine.playerVehicle.pos.set(cx + 6.5, 0, cz + 25);
  engine.playerVehicle.yaw = 2.6;
  engine.playerVehicle.mesh.position.copy(engine.playerVehicle.pos);
  engine.playerVehicle.mesh.rotation.y = 2.6;

  // Rival Los Caimanes Syndicate Enforcers + 1 cleanly-posed downed enforcer beside cover!
  engine.combat.clearEnemies();
  const e1 = engine.combat.spawnEnemy(cx - 2.6, cz - 7.5, 0.12, false);
  const e2 = engine.combat.spawnEnemy(cx + 4.2, cz - 11.8, -0.22, false);
  const e3 = engine.combat.spawnEnemy(cx - 6.6, cz - 16.5, 0.28, false);
  const e4 = engine.combat.spawnEnemy(cx + 1.0, cz - 22.0, -0.05, false);
  const downed = engine.combat.spawnEnemy(cx - 4.4, cz + 1.4, 1.35, true);
  downed.mesh.position.y = 0.18;
  e1.mesh.userData.muzzleFlash.visible = true;
  e2.mesh.userData.muzzleFlash.visible = true;
  s.missionEnemiesRemaining = 4;

  // Blazing Additive Golden & Crimson Bullet Tracers + Cover Impact Sparks!
  engine.combat.spawnTracer(
    new THREE.Vector3(cx - 1.5, 1.44, cz + 13.4),
    new THREE.Vector3(cx - 2.4, 1.32, cz - 7.2),
    0xffe67a, 0.048, 9.0
  );
  engine.combat.spawnTracer(
    new THREE.Vector3(cx + 2.85, 1.4, cz + 10.2),
    new THREE.Vector3(cx + 4.0, 1.28, cz - 11.4),
    0x5bf5df, 0.044, 9.0
  );
  engine.combat.spawnTracer(
    new THREE.Vector3(cx - 2.4, 1.44, cz - 6.8),
    new THREE.Vector3(cx + 1.4, 1.85, cz + 11.5),
    0xff5a3c, 0.044, 9.0
  );
  engine.combat.spawnSparks(new THREE.Vector3(cx - 2.5, 1.35, cz - 7.3), 14, 0xffc857);
  engine.combat.spawnSparks(new THREE.Vector3(cx + 4.2, 1.25, cz - 5.6), 10, 0xff7846);

  // Scattering bystanders in market edges
  engine.traffic.peds.slice(14, 19).forEach((p, i) => {
    p.mesh.position.set(cx + (i % 2 === 0 ? -9.5 : 9.8), 0, cz - 4 + i * 5.2);
    p.mesh.rotation.y = i % 2 === 0 ? -1.4 : 1.5;
    animatePedLimbs(p.mesh, 10.5 + i, true);
  });

  // CDPD patrol response pulling up to far end of Mercado Nocturno with blazing lightbars
  engine.police.clearAll();
  const p1 = engine.police.spawnUnit('SOL-11', false, cx - 1.5, cz - 36, 0.15, 'FOOT CHASE');
  const p2 = engine.police.spawnUnit('SOL-04', false, cx + 11, cz - 41, -0.6, 'CLOSING IN');
  updatePoliceLightbar(p1.mesh, 12.4, 0.2);
  updatePoliceLightbar(p2.mesh, 12.4, 2.0);
  engine.police.chatterLine = 'DISPATCH: Shots fired in Mercado Nocturno — units closing!';

  // Parked dark Los Caimanes coupe for mid-alley cover
  const enemyCoupe = createVehicleMesh('cabo_gt', 0x1a2836);
  enemyCoupe.position.set(cx + 5.6, 0, cz - 14.5);
  enemyCoupe.rotation.y = 0.52;
  engine.scene.add(enemyCoupe);

  // Over-the-shoulder action camera framing Dante, Nadia, blazing tracers, glowing lanterns & unobstructed MERCADO NOCTURNO neon archway!
  engine.cameraOverride = {
    pos: new THREE.Vector3(cx - 0.1, 2.35, cz + 19.2),
    lookAt: new THREE.Vector3(cx - 0.3, 2.95, cz - 16.0),
  };

  const dispatch = engine.police.buildDispatchRoster(engine.player.pos, engine.heli, s);
  engine.setMode('playing');
  engine.sky.applyTimeOfDay(s.timeOfDay, engine.player.pos);
  engine._updateHud(dispatch, true);
  engine.step(0.016, true);
}

// Shot 3: Pause / Career / Interactive Map & Save Screen
function setupCareerShot(engine) {
  const s = engine.state;
  s.timeOfDay = 18.7;
  s.cash = 142850;
  s.rp = 7650;
  s.activeMissionId = 'm5';
  s.missionStageIdx = 2;
  s.customWaypoint = { x: 260, z: 215, label: 'Bahia Safehouse' };
  engine.playerVehicle.pos.set(-60, 0, 200);
  engine.playerVehicle.mesh.position.copy(engine.playerVehicle.pos);
  engine.cameraOverride = {
    pos: new THREE.Vector3(-190, 26, 252),
    lookAt: new THREE.Vector3(-10, 16, 120),
  };
  engine.career.activeTab = 'MAP';
  engine.setMode('paused');
  engine.sky.applyTimeOfDay(s.timeOfDay, engine.playerVehicle.pos);
  engine.step(0.016, true);
}

// Shot 4: Start / Title Screen over breathtaking 3D Golden Sunset Panorama of Cala Dorada!
function setupTitleShot(engine) {
  const s = engine.state;
  s.timeOfDay = 18.65;
  engine.police.clearAll();
  engine.combat.clearEnemies();
  engine.heli.mesh.visible = false;

  // Position Dorado Apex GT cruising eastbound along sunlit Paseo Dorado toward Puente del Sol
  engine.playerVehicle.pos.set(-34, 0, 203.5);
  engine.playerVehicle.yaw = Math.PI / 2;
  engine.playerVehicle.mesh.position.copy(engine.playerVehicle.pos);
  engine.playerVehicle.mesh.rotation.y = Math.PI / 2;
  engine.player.setVisible(false);

  // Sweeping elevated coastal sunset vista capturing glowing turquoise-gold ocean, crimson Puente del Sol, skyline towers, Hotel Solsticio & palms!
  engine.cameraOverride = {
    pos: new THREE.Vector3(-135, 34, 305),
    lookAt: new THREE.Vector3(68, 17, 178),
  };
  engine.setMode('title');
  engine.shotSunDir = new THREE.Vector3(240, 44, 20);
  engine.sky.applyTimeOfDay(s.timeOfDay, new THREE.Vector3(20, 0, 200), engine.shotSunDir);
  engine.step(0.016, true);
}
