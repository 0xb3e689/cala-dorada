// Application entrypoint: mounts CalaDoradaEngine and handles deterministic ?shot= capture states.

import { CalaDoradaEngine } from './core/engine.js';
import { applyShotMode } from './shots/shotMode.js';

function boot() {
  const canvas = document.getElementById('game-canvas');
  const engine = new CalaDoradaEngine(canvas);

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    applyShotMode(engine, shot);
  }

  engine.startLoop();
  window.__CALA_DORADA__ = engine;
  window.__SHOT_READY__ = true;
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
