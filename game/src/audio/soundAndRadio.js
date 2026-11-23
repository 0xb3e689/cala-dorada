// Procedural Web Audio engine: engine RPM hum, police sirens, distinct 6-weapon gunshot/melee SFX,
// metallic car-hit ricochets, reload clicks, collision crunches, fire crackle, car-hit thuds,
// vocal-formant "ouch!" / "ugh!" pain exclamation, underwater low-pass muffling, water splash & bubbles,
// WASTED/BUSTED sting, and 4 radio stations.

import { RADIO_STATIONS } from '../core/config.js';

export class SoundAndRadio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.underwaterFilter = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.noiseBuf = null;
    this.radioStep = 0;
    this.radioAccum = 0;
    this.unlocked = false;
    this.lastPainPlayedAt = 0;
    this._painToggle = 0;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.underwaterFilter = this.ctx.createBiquadFilter();
      this.underwaterFilter.type = 'lowpass';
      this.underwaterFilter.frequency.value = 18000;
      this.underwaterFilter.Q.value = 0.7;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.underwaterFilter);
      this.underwaterFilter.connect(this.ctx.destination);

      // Shared white noise buffer for breath, gun cracks, fire crackle, splashes & impacts
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 1.0, sr);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      // Continuous subtle engine drone
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
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

  update(dt, elapsed, state, vehicleSpeed, isDrifting, playerSirenActive = false) {
    if (!this.unlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    const sfxVol = state.settings.sfxVolume;
    const playing = state.mode === 'playing' && !state.statusOverlay;

    // Underwater audio muffling filter
    if (this.underwaterFilter) {
      const targetCutoff = (playing && state.diving) ? 380 : 18000;
      this.underwaterFilter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.1);
    }

    if (this.engineGain && this.engineOsc) {
      const targetGain = playing && state.inVehicle ? 0.14 * sfxVol : 0;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(52 + vehicleSpeed * 2.4, this.ctx.currentTime, 0.06);
    }

    if (this.sirenGain && this.sirenOsc) {
      const wantSiren = playing && (state.wantedLevel > 0 || playerSirenActive);
      this.sirenGain.gain.setTargetAtTime(wantSiren ? 0.07 * sfxVol : 0, this.ctx.currentTime, 0.12);
      if (wantSiren) {
        const wail = 620 + Math.sin(elapsed * (playerSirenActive ? 6.4 : 5.2)) * 210;
        this.sirenOsc.frequency.setTargetAtTime(wail, this.ctx.currentTime, 0.05);
      }
    }

    // Procedural Radio Station Arpeggiator (plays in vehicle)
    if (playing && state.inVehicle && !state.radioMuted && state.settings.radioVolume > 0.02) {
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

    // Melee whoosh / bat crack
    if (weaponId === 'fists' || weaponId === 'bat') {
      if (this.noiseBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(weaponId === 'bat' ? 920 : 520, now);
        filt.frequency.exponentialRampToValueAtTime(220, now + 0.11);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(weaponId === 'bat' ? 0.22 : 0.16, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        src.connect(filt);
        filt.connect(g);
        g.connect(this.masterGain);
        src.start(now);
        src.stop(now + 0.13);
      }
      if (weaponId === 'bat') {
        const ping = this.ctx.createOscillator();
        const pg = this.ctx.createGain();
        ping.type = 'triangle';
        ping.frequency.setValueAtTime(640, now);
        ping.frequency.exponentialRampToValueAtTime(240, now + 0.08);
        pg.gain.setValueAtTime(0.14, now);
        pg.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        ping.connect(pg);
        pg.connect(this.masterGain);
        ping.start(now);
        ping.stop(now + 0.1);
      }
      return;
    }

    // Distinct firearm synthesis per weapon
    const cfg = {
      pistol:  { hz: 240, endHz: 52, dur: 0.11, noiseHz: 1500, vol: 0.26 },
      smg:     { hz: 320, endHz: 75, dur: 0.075, noiseHz: 2100, vol: 0.22 },
      shotgun: { hz: 125, endHz: 26, dur: 0.24, noiseHz: 780,  vol: 0.42 },
      carbine: { hz: 190, endHz: 40, dur: 0.14, noiseHz: 1350, vol: 0.31 },
    }[weaponId] ?? { hz: 220, endHz: 44, dur: 0.12, noiseHz: 1400, vol: 0.26 };

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = weaponId === 'shotgun' ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(cfg.hz, now);
    osc.frequency.exponentialRampToValueAtTime(cfg.endHz, now + cfg.dur);
    g.gain.setValueAtTime(cfg.vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur + 0.02);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + cfg.dur + 0.03);

    if (this.noiseBuf) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const nf = this.ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.setValueAtTime(cfg.noiseHz, now);
      nf.Q.value = weaponId === 'shotgun' ? 0.7 : 1.2;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(cfg.vol * 0.85, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur * 1.15);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(this.masterGain);
      n.start(now);
      n.stop(now + cfg.dur * 1.2 + 0.02);
    }
  }

  playMetalHit() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const base = 1150 + Math.random() * 480;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.45, now + 0.085);
    g.gain.setValueAtTime(0.20, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playReload(stage = 'start') {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const clicks = stage === 'start' ? [520, 380] : [760, 1080];
    clicks.forEach((hz, i) => {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.65, t + 0.05);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  playCrash(speed = 20) {
    if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const intensity = Math.min(1, Math.max(0.2, speed / 45));
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(320 + intensity * 260, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32 * intensity, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.26);
  }

  playCarHitHuman(speed = 15) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    g.gain.setValueAtTime(Math.min(0.36, 0.16 + speed * 0.008), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playWaterSplash(intensity = 0.6) {
    if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(950, now);
    filt.frequency.exponentialRampToValueAtTime(340, now + 0.24);
    filt.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14 * intensity, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.28);
  }

  playUnderwaterBubble() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const startHz = 280 + Math.random() * 160;
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(startHz * 2.1, now + 0.09);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playFireCrackle() {
    if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 1100;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.19);
  }

  playPantBreath() {
    if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(680, now);
    filt.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.30);
  }

  // Procedural vocal-formant "ouch!" / "ugh!" exclamation when player is shot or injured
  playPlayerPain(hitArmor = false) {
    this.lastPainPlayedAt = performance.now();
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const isOuch = (this._painToggle++ % 2 === 0);
    const pitchMul = 0.92 + Math.random() * 0.16;

    // 1. Glottal pulse/sawtooth vocal cord excitation with natural pitch contour
    const glottis = this.ctx.createOscillator();
    glottis.type = 'sawtooth';
    const f0Start = (isOuch ? 168 : 148) * pitchMul;
    const f0Peak = (isOuch ? 186 : 158) * pitchMul;
    const f0End = (isOuch ? 112 : 94) * pitchMul;
    glottis.frequency.setValueAtTime(f0Start, now);
    glottis.frequency.linearRampToValueAtTime(f0Peak, now + 0.032);
    glottis.frequency.exponentialRampToValueAtTime(f0End, now + 0.17);

    // 2. Dual vocal formant bandpass filters (F1 & F2 diphthong sweep: "aa -> oo" for "ouch!", "uh" for "ugh!")
    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 5.2;
    f1.frequency.setValueAtTime(isOuch ? 760 : 610, now);
    f1.frequency.exponentialRampToValueAtTime(isOuch ? 410 : 470, now + 0.13);

    const f2 = this.ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 6.4;
    f2.frequency.setValueAtTime(isOuch ? 1280 : 1140, now);
    f2.frequency.exponentialRampToValueAtTime(isOuch ? 840 : 920, now + 0.13);

    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.001, now);
    voiceGain.gain.linearRampToValueAtTime(0.36, now + 0.018);
    voiceGain.gain.setValueAtTime(0.32, now + 0.085);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    glottis.connect(f1);
    glottis.connect(f2);
    f1.connect(voiceGain);
    f2.connect(voiceGain);
    voiceGain.connect(this.masterGain);
    glottis.start(now);
    glottis.stop(now + 0.20);

    // 3. Brief "-ch" / breathy consonant release burst at end of "ouch!"
    if (this.noiseBuf) {
      const cons = this.ctx.createBufferSource();
      cons.buffer = this.noiseBuf;
      const cf = this.ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.setValueAtTime(isOuch ? 2900 : 1450, now + 0.11);
      cf.Q.value = 2.4;
      const cg = this.ctx.createGain();
      const tCons = now + (isOuch ? 0.115 : 0.09);
      cg.gain.setValueAtTime(0.001, tCons);
      cg.gain.linearRampToValueAtTime(isOuch ? 0.16 : 0.10, tCons + 0.012);
      cg.gain.exponentialRampToValueAtTime(0.001, tCons + 0.065);
      cons.connect(cf);
      cf.connect(cg);
      cg.connect(this.masterGain);
      cons.start(tCons);
      cons.stop(tCons + 0.07);
    }

    // 4. Short bullet impact thud (crisper kevlar thump on armor, deeper body thump on HP)
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = hitArmor ? 'triangle' : 'sine';
    thud.frequency.setValueAtTime(hitArmor ? 240 : 130, now);
    thud.frequency.exponentialRampToValueAtTime(hitArmor ? 85 : 46, now + 0.085);
    tg.gain.setValueAtTime(0.18, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    thud.connect(tg);
    tg.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.10);
  }

  playWastedBusted(type = 'WASTED') {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(type === 'WASTED' ? 88 : 112, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 1.15);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(320, now);
    filt.frequency.exponentialRampToValueAtTime(70, now + 1.15);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  playExplosion() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.55);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playHorn(isBoat = false) {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = isBoat ? [196, 247] : [415, 523];
    const dur = isBoat ? 0.42 : 0.24;
    for (const hz of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz, now);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = isBoat ? 650 : 1400;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.02);
      g.gain.setValueAtTime(0.10, now + dur - 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }
  }

  playPickupChime() {
    if (!this.unlocked || !this.ctx) return;
    const now = this.ctx.currentTime;
    [740, 987, 1318].forEach((hz, i) => {
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, t);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playSprayPaint() {
    if (!this.unlocked || !this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.58);
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
