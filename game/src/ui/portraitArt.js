// Stylized SVG character portraits for Dante Varo, Nadia Solis, Toma Reyes, Sora Lin, Dona Marisol, and Vega.

const PORTRAITS = {
  dante: { bg1: '#2b1b26', bg2: '#ff7846', skin: '#dca079', hair: '#1d1616', jacket: '#e65f3c', accent: '#ffd36e', shades: true },
  nadia: { bg1: '#142a33', bg2: '#34e0c8', skin: '#dfa886', hair: '#25151a', jacket: '#22b3a6', accent: '#ff8a5b', shades: false },
  toma:  { bg1: '#1d2230', bg2: '#ffbe55', skin: '#c98e68', hair: '#18181b', jacket: '#3b4f6b', accent: '#34e0c8', shades: false },
  sora:  { bg1: '#1c1533', bg2: '#a876ff', skin: '#ebbea1', hair: '#1d2238', jacket: '#6844b8', accent: '#4ef5db', shades: true },
  marisol: { bg1: '#2b1420', bg2: '#ff5277', skin: '#d69973', hair: '#3b242c', jacket: '#a62c4b', accent: '#ffd36e', shades: false },
  vega:  { bg1: '#18242a', bg2: '#2d7a78', skin: '#c48a66', hair: '#222429', jacket: '#1b3b47', accent: '#ffbe55', shades: true },
};

export function renderPortraitSvg(id = 'dante') {
  const p = PORTRAITS[id] ?? PORTRAITS.dante;
  const gid = `pg-${id}`;
  return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${id}">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg1}"/>
      <stop offset="100%" stop-color="${p.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#${gid})"/>
  <circle cx="52" cy="14" r="14" fill="rgba(255,255,255,0.12)"/>
  <!-- Shoulders & Jacket -->
  <path d="M8 64 C10 47 20 43 32 43 C44 43 54 47 56 64 Z" fill="${p.jacket}"/>
  <path d="M24 44 L32 60 L40 44 Z" fill="${p.accent}"/>
  <!-- Neck & Face -->
  <rect x="27" y="36" width="10" height="10" rx="4" fill="${p.skin}"/>
  <ellipse cx="32" cy="27" rx="12" ry="14" fill="${p.skin}"/>
  <!-- Hair -->
  <path d="M19 25 C19 12 45 12 45 25 C43 18 37 16 32 16 C26 16 21 19 19 25 Z" fill="${p.hair}"/>
  ${p.shades
    ? `<rect x="22" y="23" width="9" height="5" rx="1.5" fill="#101521"/>
       <rect x="33" y="23" width="9" height="5" rx="1.5" fill="#101521"/>
       <line x1="31" y1="25" x2="33" y2="25" stroke="${p.accent}" stroke-width="1.5"/>`
    : `<circle cx="27" cy="26" r="1.8" fill="#141822"/>
       <circle cx="37" cy="26" r="1.8" fill="#141822"/>
       <path d="M24 22.5 L30 23.2 M34 23.2 L40 22.5" stroke="${p.hair}" stroke-width="1.4" stroke-linecap="round"/>`}
  <path d="M28 34 Q32 36.5 36 34" fill="none" stroke="#6b3e2e" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;
}
