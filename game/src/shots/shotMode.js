// Deterministic URL shot staging (?shot=chase|combat|career|title) using the live 3D game engine.

import * as THREE from '../../vendor/three.module.min.js';
import { updatePoliceLightbar, animateBurningWreck, createVehicleMesh, applyVehicleMods } from '../entities/vehicleFactory.js';
import { animatePedLimbs } from '../world/trafficAndPeds.js';
import { poseHumanCombat } from '../entities/playerController.js';

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

// Shot 1 (COVER): High-octane Golden Hour 4-Star pursuit on Paseo Dorado / Puente del Sol with Pure GTA HUD!
function setupChaseShot(engine) {
  const s = engine.state;
  s.timeOfDay = 18.7;
  s.mode = 'playing';
  s.inVehicle = true;
  s.currentDistrictId = 'paseo-dorado';
  s.cash = 142850;
  s.health = 92;
  s.armor = 76;
  s.stamina = 100;
  s.exhausted = false;
  s.wantedLevel = 4;
  s.wantedHeat = 415;
  s.airUnitDeployed = true;
  s.activeMissionId = 'm5';
  s.missionStageIdx = 2;
  s.missionTimer = 134;
  s.activeWeaponIdx = 3; // Vector SMG
  s.radioStationIdx = 0; // Onda Sol
  s.weaponWheelOpen = false;
  s.crewActive = true;
  engine.wheelShotRight = false;
  s.crewHealth = { nadia: 92, toma: 100, sora: 86 };
  applyVehicleMods(engine.playerVehicle, s.carMods);
  s.dialogue = {
    speaker: 'NADIA SOLIS',
    portrait: 'nadia',
    text: "Puente del Sol is locked down! Hit [Z] Plate Swap after the bridge — I'll kill their tags!",
    timer: 99,
  };

  // Hero Dorado Apex GT blasting off Puente del Sol at ~152 MPH
  const car = engine.playerVehicle;
  car.pos.set(22.5, 0, 203.2);
  car.yaw = -1.16;
  car.speed = 68.0; // ~152 MPH
  car.hp = Math.round(car.maxHp * 0.84);
  car.nitro = 100;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.set(-0.02, car.yaw, 0.068);
  if (car.mesh.userData?.nitroFlames) car.mesh.userData.nitroFlames.visible = true;
  engine.player.setVisible(false);

  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(26.2 + i * 2.0, 0.5 + i * 0.12, 201.4 - i * 0.55);
    engine.vehiclePhysics.spawnSmoke(p, i < 3 ? 0xffa64d : 0xe9eef7, 0.72 + i * 0.1, 4.0);
  }

  engine.police.clearAll();
  const u1 = engine.police.spawnUnit('SOL-14', false, 36.5, 195.8, -1.42, 'RAMMING');
  const u2 = engine.police.spawnUnit('SOL-07', false, 34.5, 208.2, -1.52, 'FLANKING');
  const u3 = engine.police.spawnUnit('SWAT-2', true, 66.0, 201.5, -1.55, 'ROADBLOCK');
  const u4 = engine.police.spawnUnit('SOL-22', false, 54.0, 207.4, -1.48, 'CLOSING IN');
  const u5 = engine.police.spawnUnit('SOL-09', false, 80.0, 196.2, -1.56, 'FLANKING');
  [u1, u2, u3, u4, u5].forEach((u, idx) => updatePoliceLightbar(u.mesh, 12.4, idx * 1.4));

  // Blazing exploding police wreck right on the Puente del Sol deck
  const wreck = engine.police.spawnBurningWreckAt(49.5, 194.2, -0.78);
  animateBurningWreck(wreck, 12.4);

  const scooter = createVehicleMesh('scooter', 0x34e0c8);
  scooter.position.set(17.5, 0, 212.0);
  scooter.rotation.set(0, -1.05, -0.22);
  engine.scene.add(scooter);

  const civRoadster = createVehicleMesh('convertible', 0xff5e7e);
  civRoadster.position.set(112, 0, 206.8);
  civRoadster.rotation.y = Math.PI / 2;
  const civSuv = createVehicleMesh('baja_runner', 0xf2b138);
  civSuv.position.set(134, 0, 194.5);
  civSuv.rotation.y = -Math.PI / 2;
  const civCoupe = createVehicleMesh('cabo_gt', 0x39c2b8);
  civCoupe.position.set(158, 0, 205.5);
  civCoupe.rotation.y = Math.PI / 2;
  engine.scene.add(civRoadster, civSuv, civCoupe);

  const chasePedSpots = [
    [16, 220.5, -0.8, true], [22, 223.2, -1.2, true], [28, 221.0, -0.6, true],
    [34, 224.0, -1.0, true], [20, 232.0, 0.4, false], [29, 236.5, -0.3, false],
    [35, 241.0, 0.9, false], [188, 223.0, -0.5, false], [198, 234.0, 0.3, false],
    [212, 240.0, -0.7, false], [224, 236.0, 0.5, false], [238, 244.0, -0.2, false],
  ];
  chasePedSpots.forEach(([px, pz, rot, panic], idx) => {
    const p = engine.traffic.peds[idx];
    if (!p) return;
    p.mesh.position.set(px, 0, pz);
    p.mesh.rotation.y = rot;
    animatePedLimbs(p.mesh, 9.2 + idx * 1.1, panic);
  });

  // Prominent HALCÓN-1 Helicopter in clear open sky + focused spotlight beam onto hero car
  engine.heli.placeForShot(new THREE.Vector3(47.5, 20.4, 190.2), new THREE.Vector3(22.5, 0.8, 203.2), 0.16);

  engine.cameraOverride = {
    pos: new THREE.Vector3(10.6, 3.85, 211.2),
    lookAt: new THREE.Vector3(47, 7.6, 198.2),
  };

  engine.setMode('playing');
  engine.shotSunDir = new THREE.Vector3(260, 46, 55);
  engine.sky.applyTimeOfDay(s.timeOfDay, car.pos, engine.shotSunDir);
  engine._updateHud(true);
  engine.step(0.016, true);
}

// Shot 2: Nighttime Mercado Nocturno shootout with working focused night lighting, crosshair dead-center ON target enemy & CS:GO radial Weapon Wheel!
function setupCombatShot(engine) {
  const s = engine.state;
  s.timeOfDay = 21.75;
  s.mode = 'playing';
  s.inVehicle = false;
  s.currentDistrictId = 'mercado-nocturno';
  s.cash = 96400;
  s.health = 84;
  s.armor = 62;
  s.stamina = 78;
  s.exhausted = false;
  s.wantedLevel = 2;
  s.wantedHeat = 195;
  s.airUnitDeployed = false;
  s.activeMissionId = 'm3';
  s.missionStageIdx = 1;
  s.missionTimer = 148;
  s.activeWeaponIdx = 3; // Vector SMG
  s.weaponWheelOpen = true;
  s.weaponWheelHoverIdx = 3;
  s.crewActive = true;
  engine.wheelShotRight = true;
  s.weaponAmmo.smg = { clip: 28, reserve: 180 };
  s.crewHealth = { nadia: 88, toma: 100, sora: 94 };
  engine.player.applyAppearance(s.playerAppearance);
  s.dialogue = {
    speaker: 'NADIA SOLIS',
    portrait: 'nadia',
    text: 'Los Caimanes have the alley boxed! Keep firing under the lanterns — I have their right flank!',
    timer: 99,
  };

  const cx = -310;
  const cz = -55;
  engine.player.pos.set(cx - 2.1, 0, cz + 14.5);
  engine.player.yaw = Math.PI + 0.04;
  engine.player.mesh.position.copy(engine.player.pos);
  engine.player.mesh.rotation.y = engine.player.yaw;
  engine.player.setVisible(true);
  engine.player.setCombatPose(true);
  engine.player.flashMuzzle(99);

  const nadia = engine.player.partnerMesh;
  nadia.visible = true;
  nadia.position.set(cx + 2.8, 0, cz + 11.4);
  nadia.rotation.y = Math.PI - 0.14;
  poseHumanCombat(nadia, true);
  if (nadia.userData.muzzleFlash) nadia.userData.muzzleFlash.visible = true;

  engine.playerVehicle.pos.set(cx + 6.5, 0, cz + 25);
  engine.playerVehicle.yaw = 2.6;
  engine.playerVehicle.mesh.position.copy(engine.playerVehicle.pos);
  engine.playerVehicle.mesh.rotation.y = 2.6;

  engine.combat.clearEnemies();
  const e1 = engine.combat.spawnEnemy(cx - 0.4, cz - 4.2, 0.06, false, 100);
  const e2 = engine.combat.spawnEnemy(cx + 4.4, cz - 7.8, -0.24, false, 100);
  const e3 = engine.combat.spawnEnemy(cx - 4.8, cz - 7.6, 0.28, false, 100);
  const e4 = engine.combat.spawnEnemy(cx - 8.6, cz - 3.6, 0.42, false, 100);
  const downed = engine.combat.spawnEnemy(cx - 4.2, cz + 1.8, 1.35, true, 100);
  downed.mesh.position.y = 0.16;

  e1.hp = 54; e1.attacking = true; e1.mesh.userData.muzzleFlash.visible = true;
  e2.hp = 42; e2.attacking = true; e2.mesh.userData.muzzleFlash.visible = true;
  e3.hp = 86; e3.attacking = true;
  e4.hp = 72; e4.attacking = true;
  s.missionEnemiesRemaining = 4;

  const aimPoint = new THREE.Vector3(e1.pos.x, 1.44, e1.pos.z);
  const danteMuzzle = engine.player.getMuzzleWorldPos();
  nadia.updateMatrixWorld(true);
  const nadiaMuzzle = new THREE.Vector3();
  if (nadia.userData.muzzleFlash) nadia.userData.muzzleFlash.getWorldPosition(nadiaMuzzle);
  else nadiaMuzzle.set(cx + 2.5, 1.38, cz + 10.6);

  engine.combat.hitConfirmTimer = 0.24;
  engine.combat.hitConfirmCrit = true;
  engine.combat.spawnDamagePopup(new THREE.Vector3(e1.pos.x + 1.65, 2.04, e1.pos.z), 46, true, 'weapon');
  engine.combat.spawnDamagePopup(new THREE.Vector3(e2.pos.x + 1.05, 1.92, e2.pos.z), 34, false, 'weapon');

  engine.combat.spawnTracer(danteMuzzle, aimPoint, 0xffe67a, 0.044, 9.0);
  engine.combat.spawnTracer(nadiaMuzzle, new THREE.Vector3(e2.pos.x, 1.36, e2.pos.z), 0x5bf5df, 0.042, 9.0);
  engine.combat.spawnTracer(
    new THREE.Vector3(e2.pos.x - 0.2, 1.38, e2.pos.z + 0.4),
    new THREE.Vector3(cx + 1.2, 1.72, cz + 11.4),
    0xff5a3c, 0.038, 9.0
  );
  engine.combat.spawnSparks(aimPoint, 14, 0xffc857);
  engine.combat.spawnSparks(new THREE.Vector3(e2.pos.x, 1.36, e2.pos.z), 10, 0xff7846);

  const alleyBystanders = [
    [cx - 9.4, cz - 2.0, -1.4, true], [cx + 9.6, cz - 3.5, 1.5, true],
    [cx - 9.2, cz + 4.8, -1.2, true], [cx + 9.4, cz + 6.5, 1.4, true],
    [cx - 8.8, cz - 12.0, -1.6, true], [cx + 9.1, cz - 15.5, 1.6, true],
  ];
  alleyBystanders.forEach(([bx, bz, rot, panic], i) => {
    const p = engine.traffic.peds[40 + i];
    if (!p) return;
    p.mesh.position.set(bx, 0, bz);
    p.mesh.rotation.y = rot;
    animatePedLimbs(p.mesh, 10.5 + i, panic);
  });

  engine.police.clearAll();
  const p1 = engine.police.spawnUnit('SOL-11', false, cx - 1.5, cz - 35, 0.15, 'FOOT CHASE');
  const p2 = engine.police.spawnUnit('SOL-04', false, cx + 10.5, cz - 40, -0.6, 'CLOSING IN');
  updatePoliceLightbar(p1.mesh, 12.4, 0.2);
  updatePoliceLightbar(p2.mesh, 12.4, 2.0);

  const enemyCoupe = createVehicleMesh('cabo_gt', 0x1a2836);
  enemyCoupe.position.set(cx + 5.8, 0, cz - 16.5);
  enemyCoupe.rotation.y = 0.52;
  engine.scene.add(enemyCoupe);

  engine.cameraOverride = {
    pos: new THREE.Vector3(cx - 0.15, 2.05, cz + 18.6),
    lookAt: aimPoint.clone(),
  };

  engine.setMode('playing');
  engine.sky.applyTimeOfDay(s.timeOfDay, engine.player.pos);
  engine._updateHud(true);
  engine.step(0.016, true);
}

// Shot 3: Simplified 4-Tab GTA Pause Menu (MAP | STATS | SAVE | SETTINGS) with 100%-Synced City Map & Legend!
function setupCareerShot(engine) {
  const s = engine.state;
  s.timeOfDay = 18.7;
  s.weaponWheelOpen = false;
  engine.wheelShotRight = false;
  s.cash = 142850;
  s.activeMissionId = 'm5';
  s.missionStageIdx = 2;
  s.customWaypoint = null;
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

// Shot 4: Ultra-Clean GTA Title Screen over Sunset Cala Dorada Panorama!
function setupTitleShot(engine) {
  const s = engine.state;
  s.timeOfDay = 18.65;
  s.weaponWheelOpen = false;
  engine.wheelShotRight = false;
  engine.police.clearAll();
  engine.combat.clearEnemies();
  engine.heli.mesh.visible = false;

  engine.playerVehicle.pos.set(-34, 0, 204.2);
  engine.playerVehicle.yaw = Math.PI / 2;
  engine.playerVehicle.mesh.position.copy(engine.playerVehicle.pos);
  engine.playerVehicle.mesh.rotation.y = Math.PI / 2;
  engine.player.setVisible(false);

  const titleTraffic = [
    ['convertible', 0xff5e7e, -112, 204.2, Math.PI / 2],
    ['cabo_gt', 0x34e0c8, -76, 195.2, -Math.PI / 2],
    ['baja_runner', 0xf2b138, 12, 195.2, -Math.PI / 2],
    ['scooter', 0x39d5ff, -52, 206.0, Math.PI / 2],
    ['convertible', 0xffbe55, 76, 204.2, Math.PI / 2],
    ['cabo_gt', 0xe85a4f, 126, 195.2, -Math.PI / 2],
    ['baja_runner', 0xf4f4f6, -155, 195.2, -Math.PI / 2],
  ];
  for (const [type, col, x, z, yaw] of titleTraffic) {
    const m = createVehicleMesh(type, col);
    m.position.set(x, 0, z);
    m.rotation.y = yaw;
    engine.scene.add(m);
  }

  const titleBeachPeds = [
    [-112, 238, 0.4], [-96, 248, -0.5], [-84, 236, 0.9], [-68, 250, -0.3],
    [-54, 239, 0.6], [-42, 246, -0.8], [-28, 235, 0.2], [-14, 248, -0.4],
  ];
  titleBeachPeds.forEach(([px, pz, rot], i) => {
    const p = engine.traffic.peds[i];
    if (!p) return;
    p.mesh.position.set(px, 0, pz);
    p.mesh.rotation.y = rot;
  });

  engine.cameraOverride = {
    pos: new THREE.Vector3(-135, 34, 305),
    lookAt: new THREE.Vector3(68, 17, 178),
  };
  engine.title.showLoadDrawer = false;
  engine.setMode('title');
  engine.shotSunDir = new THREE.Vector3(240, 44, 20);
  engine.sky.applyTimeOfDay(s.timeOfDay, new THREE.Vector3(20, 0, 200), engine.shotSunDir);
  engine.step(0.016, true);
}
