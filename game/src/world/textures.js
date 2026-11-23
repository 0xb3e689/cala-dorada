// Procedural canvas textures for roads, Art-Deco facades, custom signage, sand, water, and lanterns.

import * as THREE from '../../vendor/three.module.min.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createTextureLibrary() {
  const lib = {};

  // Asphalt road with double gold center line and dashed lane markings
  {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = '#252a34';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4500; i++) {
      const v = 30 + ((i * 37) % 24);
      g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      g.fillRect((i * 73) % 512, (i * 139) % 512, 2, 2);
    }
    // Outer white shoulder lines
    g.fillStyle = 'rgba(245, 246, 250, 0.78)';
    g.fillRect(24, 0, 8, 512);
    g.fillRect(480, 0, 8, 512);
    // Double amber center line
    g.fillStyle = '#f5b841';
    g.fillRect(247, 0, 6, 512);
    g.fillRect(259, 0, 6, 512);
    // Dashed lane dividers
    g.fillStyle = 'rgba(255,255,255,0.68)';
    for (let y = 16; y < 512; y += 64) {
      g.fillRect(136, y, 6, 32);
      g.fillRect(370, y, 6, 32);
    }
    lib.road = toTexture(c, 1, 1);
  }

  // Crosswalk stripes
  {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#262c36';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(250, 248, 240, 0.85)';
    for (let x = 18; x < 240; x += 32) {
      g.fillRect(x, 22, 18, 212);
    }
    lib.crosswalk = toTexture(c, 1, 1);
  }

  // Sidewalk terracotta tiles
  {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#c9b39b';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(90, 72, 56, 0.28)';
    g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    lib.sidewalk = toTexture(c, 4, 4);
  }

  // Warm golden beach sand
  {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#e5c185';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,244,210,0.22)' : 'rgba(182,135,78,0.18)';
      g.fillRect((i * 53) % 256, (i * 97) % 256, 3, 2);
    }
    lib.sand = toTexture(c, 12, 4);
  }

  // Ocean waves texture
  {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0d5b73');
    grad.addColorStop(0.5, '#137c8c');
    grad.addColorStop(1, '#106278');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255, 224, 168, 0.25)';
    g.lineWidth = 3;
    for (let y = 14; y < 512; y += 28) {
      g.beginPath();
      for (let x = 0; x <= 512; x += 16) {
        const wy = y + Math.sin(x * 0.045 + y * 0.1) * 4;
        if (x === 0) g.moveTo(x, wy); else g.lineTo(x, wy);
      }
      g.stroke();
    }
    lib.water = toTexture(c, 14, 10);
  }

  // Facade generator (Art-Deco coastal, glass skyscraper, market brick)
  const makeFacade = (baseHex, trimHex, litColor, cols, rows, style) => {
    const c = makeCanvas(256, 512);
    const g = c.getContext('2d');
    g.fillStyle = baseHex;
    g.fillRect(0, 0, 256, 512);

    // Horizontal Art-Deco cornices
    g.fillStyle = trimHex;
    for (let r = 0; r < rows; r++) {
      const y = (r / rows) * 512;
      g.fillRect(0, y, 256, style === 'glass' ? 3 : 6);
    }
    // Vertical ribs
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < 256; x += Math.floor(256 / cols)) {
      g.fillRect(x, 0, 4, 512);
    }
    // Windows with warm sunlit/evening interior glow
    const padX = 8;
    const padY = 8;
    const cellW = 256 / cols;
    const cellH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const seed = (r * 19 + col * 31) % 11;
        const lit = seed > 3;
        const wx = col * cellW + padX;
        const wy = r * cellH + padY;
        const ww = cellW - padX * 2;
        const wh = cellH - padY * 1.8;
        if (lit) {
          const wGrad = g.createLinearGradient(wx, wy, wx, wy + wh);
          wGrad.addColorStop(0, litColor);
          wGrad.addColorStop(1, style === 'glass' ? '#70c4e8' : '#e6944c');
          g.fillStyle = wGrad;
        } else {
          g.fillStyle = style === 'glass' ? '#1e354d' : '#263042';
        }
        g.fillRect(wx, wy, ww, wh);
        // Window glint
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(wx + 2, wy + 2, ww * 0.35, 3);
      }
    }
    return toTexture(c, 1, 1);
  };

  lib.facadeArtDecoCoral = makeFacade('#e5a582', '#f7e1c1', '#ffe4a3', 4, 8, 'deco');
  lib.facadeArtDecoCream = makeFacade('#edd9bd', '#ff9d6e', '#ffd984', 4, 7, 'deco');
  lib.facadeArtDecoTeal = makeFacade('#7abfb8', '#f5e2c4', '#ffe9a8', 4, 8, 'deco');
  lib.facadeGlassGold = makeFacade('#22384f', '#5a8ab0', '#ffcf7d', 6, 12, 'glass');
  lib.facadeGlassTeal = makeFacade('#1a2d42', '#34c5b8', '#9cf7ec', 6, 12, 'glass');
  lib.facadeMarket = makeFacade('#5a3934', '#d98348', '#ffbb5c', 4, 6, 'market');
  lib.facadeVilla = makeFacade('#f0dfc8', '#c96f4a', '#ffe3a8', 3, 4, 'deco');
  lib.facadePort = makeFacade('#3d4c5c', '#c97836', '#ffd27a', 5, 5, 'market');

  return lib;
}

export function createSignTexture(text, bgHex = '#121826', fgHex = '#ffbe55', accentHex = '#ff6542') {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bgHex;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = accentHex;
  g.lineWidth = 8;
  g.strokeRect(6, 6, 500, 116);
  g.strokeStyle = fgHex;
  g.lineWidth = 2;
  g.strokeRect(14, 14, 484, 100);

  g.font = '900 44px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = accentHex;
  g.shadowBlur = 18;
  g.fillStyle = fgHex;
  g.fillText(text, 256, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
