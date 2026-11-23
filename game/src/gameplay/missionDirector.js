// Multi-stage story mission director with 3D objective beacon, timers, payouts, medals, and dialogue.

import * as THREE from '../../vendor/three.module.min.js';
import { MISSIONS } from '../core/config.js';

export class MissionDirector {
  constructor(scene) {
    this.scene = scene;
    const beaconGeo = new THREE.CylinderGeometry(3.2, 3.2, 38, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffbe55, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.beacon.position.y = 19;
    this.scene.add(this.beacon);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 4.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffbe55, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.2;
    this.scene.add(this.ring);
  }

  getActiveMission(state) {
    return MISSIONS.find((m) => m.id === state.activeMissionId) ?? MISSIONS[0];
  }

  getActiveStage(state) {
    const m = this.getActiveMission(state);
    return m.stages[Math.min(state.missionStageIdx, m.stages.length - 1)];
  }

  getNextStage(state) {
    const m = this.getActiveMission(state);
    return m.stages[state.missionStageIdx + 1] ?? null;
  }

  startMission(state, missionId, combat, police) {
    const m = MISSIONS.find((x) => x.id === missionId) ?? MISSIONS[0];
    state.activeMissionId = m.id;
    state.missionStageIdx = 0;
    state.missionTimer = m.timeLimit;
    state.dialogue = { ...m.dialogue, timer: 8.5 };
    this._syncStage(state, combat, police);
  }

  _syncStage(state, combat, police) {
    const stage = this.getActiveStage(state);
    if (!stage) return;
    if (stage.type === 'combat' && combat) {
      combat.spawnEncounter(stage.target, stage.count ?? 5);
    }
    if (stage.type === 'evade' && police && state.wantedLevel < 2) {
      police.addHeat(state, 200);
    }
  }

  update(dt, elapsed, state, playerPos, combat, police, audio) {
    const m = this.getActiveMission(state);
    const stage = this.getActiveStage(state);
    if (!m || !stage) return;

    this.beacon.position.x = stage.target.x;
    this.beacon.position.z = stage.target.z;
    this.ring.position.x = stage.target.x;
    this.ring.position.z = stage.target.z;
    this.ring.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.1);

    if (state.mode === 'playing') {
      state.missionTimer = Math.max(0, state.missionTimer - dt);
    }

    const dist = Math.hypot(playerPos.x - stage.target.x, playerPos.z - stage.target.z);
    let stageCleared = false;
    if (stage.type === 'reach' && dist < 16) stageCleared = true;
    else if (stage.type === 'combat' && combat && state.missionEnemiesRemaining === 0 && dist < 80) stageCleared = true;
    else if (stage.type === 'evade' && state.wantedLevel === 0) stageCleared = true;

    if (stageCleared) {
      if (state.missionStageIdx + 1 < m.stages.length) {
        state.missionStageIdx += 1;
        state.toast = { text: `STAGE CLEARED — ${this.getActiveStage(state).label}`, timer: 3.4 };
        if (audio) audio.playUiBeep(640);
        this._syncStage(state, combat, police);
      } else {
        this._completeMission(state, m, combat, police, audio);
      }
    }
  }

  _completeMission(state, m, combat, police, audio) {
    const used = m.timeLimit - state.missionTimer;
    const medal = used <= m.medalTarget ? 'GOLD' : used <= m.medalTarget * 1.3 ? 'SILVER' : 'BRONZE';
    const warehouseBonus = state.ownedProperties?.has('cenit-warehouse') ? 1.15 : 1.0;
    const payout = Math.round(m.cash * warehouseBonus);
    state.completedMissions[m.id] = medal;
    state.cash += payout;
    state.careerStats.cashEarned += payout;
    state.rp += m.rp;

    const dKey = Object.keys(state.districtStanding).find((k) => m.district.toLowerCase().includes(k.split('-')[0]));
    if (dKey) state.districtStanding[dKey] = Math.min(100, state.districtStanding[dKey] + 10);

    state.toast = {
      text: `MISSION COMPLETE (${medal}) · +$${payout.toLocaleString()} · +${m.rp} RP`,
      timer: 5.0,
    };
    if (audio) audio.playUiBeep(880);

    const nextIdx = MISSIONS.findIndex((x) => x.id === m.id) + 1;
    if (nextIdx < MISSIONS.length) {
      this.startMission(state, MISSIONS[nextIdx].id, combat, police);
    }
  }
}
