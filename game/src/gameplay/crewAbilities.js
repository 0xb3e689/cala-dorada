// Crew active tactical abilities: [Z] Nadia Plate Swap, [X] Toma Field Repair, [C] Sora Signal Jam.

import { CREW } from '../core/config.js';

export class CrewAbilities {
  update(dt, state) {
    for (const c of CREW) {
      if (state.crewCooldowns[c.id] > 0) {
        state.crewCooldowns[c.id] = Math.max(0, state.crewCooldowns[c.id] - dt);
      }
    }
    if (state.signalJamTimer > 0) {
      state.signalJamTimer = Math.max(0, state.signalJamTimer - dt);
    }
  }

  trigger(id, state, playerVehicle, police, audio) {
    const spec = CREW.find((c) => c.id === id);
    if (!spec) return false;
    if (state.crewCooldowns[id] > 0) {
      state.toast = { text: `${spec.ability} recharging (${Math.ceil(state.crewCooldowns[id])}s)`, timer: 2.0 };
      return false;
    }

    state.crewCooldowns[id] = spec.cooldown;
    if (audio) audio.playUiBeep(760);

    if (id === 'nadia') {
      police.dropStars(state, 2);
      state.dialogue = {
        speaker: 'NADIA SOLIS · WHEELWOMAN',
        portrait: 'nadia',
        text: 'Fresh coastal plates pushed to DMV. Two stars wiped clean — keep moving!',
        timer: 5.5,
      };
      state.toast = { text: 'PLATE SWAP ACTIVE — -2 WANTED STARS', timer: 3.0 };
    } else if (id === 'toma') {
      if (playerVehicle) {
        playerVehicle.hp = playerVehicle.maxHp;
        playerVehicle.nitro = 100;
      }
      state.armor = Math.min(state.maxArmor, state.armor + 35);
      state.dialogue = {
        speaker: 'TOMA REYES · MECHANIC',
        portrait: 'toma',
        text: 'Remote ECU purge complete. Chassis sealed and nitro pressure maxed out!',
        timer: 5.5,
      };
      state.toast = { text: 'FIELD REPAIR — HULL 100% & FULL NITRO', timer: 3.0 };
    } else if (id === 'sora') {
      state.signalJamTimer = 14;
      state.dialogue = {
        speaker: 'SORA LIN · SIGNAL GHOST',
        portrait: 'sora',
        text: 'CDPD telemetry flooded. Radar & HALCÓN-1 spotlight blinded for 14 seconds!',
        timer: 5.5,
      };
      state.toast = { text: 'SIGNAL JAM — RADAR & AIR SPOTLIGHT BLINDED', timer: 3.2 };
    }
    return true;
  }
}
