// Procedural Web Audio engine: engine RPM hum, tire screech, police sirens, heli rotor, gunshots, explosions, and 4 radio stations.

import { RADIO_STATIONS } from '../core/config.js';

export class SoundAndRadio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioStep = 0;
    this.radioAccum = 0;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.ctx.destination);

      // Continuous subtle engine drone
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 210;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      // Police siren wail
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenOsc.start();

      this.unlocked = true;
    } catch {
      // Headless or blocked audio
    }
  }

  update(dt, elapsed, state, vehicleSpeed, isDrifting) {
    if (!this.unlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    const sfxVol = state.settings.sfxVolume;
    const playing = state.mode === 'playing';

    if (this.engineGain && this.engineOsc) {
      const targetGain = playing && state.inVehicle ? 0.14 * sfxVol : 0;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(52 + vehicleSpeed * 2.6, this.ctx.currentTime, 0.06);
    }

    if (this.sirenGain && this.sirenOsc) {
      const wantSiren = playing && state.wantedLevel > 0;
      this.sirenGain.gain.setTargetAtTime(wantSiren ? 0.065 * sfxVol : 0, this.ctx.currentTime, 0.12);
      if (wantSiren) {
        const wail = 620 + Math.sin(elapsed * 5.2) * 210;
        this.sirenOsc.frequency.setTargetAtTime(wail, this.ctx.currentTime, 0.05);
      }
    }

    // Procedural Radio Station Arpeggiator
    if (playing && !state.radioMuted && state.settings.radioVolume > 0.02) {
      const station = RADIO_STATIONS[state.radioStationIdx];
      const stepDur = 60 / station.bpm / 2;
      this.radioAccum += dt;
      if (this.radioAccum >= stepDur) {
        this.radioAccum -= stepDur;
        this._playRadioNote(station, this.radioStep++, state.settings.radioVolume);
      }
    }
  }

  _playRadioNote(station, step, vol) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const scales = {
      synthwave: [0, 3, 7, 10, 12, 10, 7, 3],
      electro: [0, 0, 7, 12, 5, 7, 10, 12],
      dub: [0, -2, 3, 5, 0, 7, 5, 3],
      scanner: [0, 12, 0, 7],
    };
    const pat = scales[station.mode] ?? scales.synthwave;
    const semi = pat[step % pat.length];
    const freq = station.rootHz * Math.pow(2, semi / 12);

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = station.mode === 'scanner' ? 'sine' : station.mode === 'dub' ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = station.mode === 'electro' ? 950 : 620;

    g.gain.setValueAtTime(0.06 * vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

    osc.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playGunshot(weaponId) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    const startHz = weaponId === 'shotgun' ? 140 : weaponId === 'smg' ? 280 : 210;
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playExplosion() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.55);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playUiBeep(hz = 680) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}
