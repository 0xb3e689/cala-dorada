// World constants, districts, vehicles, weapons, missions, crew, and radio stations for Cala Dorada.

export const WORLD = {
  size: 1120,
  half: 560,
  roadWidth: 20,
  sidewalkWidth: 5,
  seaLevel: -1.2,
  bridgeY: 11.5,
  gravity: 28,
};

export const DISTRICTS = [
  {
    id: 'paseo-dorado',
    name: 'Paseo Dorado',
    subtitle: 'Sun-Soaked Oceanfront Promenade',
    color: '#ff8a4c',
    bounds: { x1: -440, z1: 110, x2: 140, z2: 330 },
    center: { x: -120, z: 220 },
    standingInit: 82,
  },
  {
    id: 'distrito-torre',
    name: 'Distrito Torre',
    subtitle: 'Financial Skyline & Puente del Sol',
    color: '#4ba3ff',
    bounds: { x1: -200, z1: -240, x2: 240, z2: 110 },
    center: { x: 20, z: -60 },
    standingInit: 64,
  },
  {
    id: 'mercado-nocturno',
    name: 'Mercado Nocturno',
    subtitle: 'Lantern Alleys & Syndicate Bazaars',
    color: '#ff4b72',
    bounds: { x1: -440, z1: -220, x2: -200, z2: 110 },
    center: { x: -320, z: -55 },
    standingInit: 74,
  },
  {
    id: 'puerto-cenit',
    name: 'Puerto Cenit',
    subtitle: 'Container Docks & Smuggler Berths',
    color: '#a876ff',
    bounds: { x1: 240, z1: -220, x2: 470, z2: 120 },
    center: { x: 355, z: -40 },
    standingInit: 58,
  },
  {
    id: 'villas-del-cabo',
    name: 'Villas del Cabo',
    subtitle: 'Terraced Hillside Estates',
    color: '#42e38c',
    bounds: { x1: -440, z1: -440, x2: 60, z2: -220 },
    center: { x: -190, z: -330 },
    standingInit: 51,
  },
  {
    id: 'barrio-viejo',
    name: 'Barrio Viejo',
    subtitle: 'Art-Deco Plazas & Auto Garages',
    color: '#ffbe55',
    bounds: { x1: 60, z1: -440, x2: 380, z2: -220 },
    center: { x: 210, z: -330 },
    standingInit: 79,
  },
  {
    id: 'bahia-esmeralda',
    name: 'Bahia Esmeralda',
    subtitle: 'Turquoise Marina & Safehouse Cove',
    color: '#34e0c8',
    bounds: { x1: 140, z1: 120, x2: 450, z2: 340 },
    center: { x: 280, z: 225 },
    standingInit: 88,
  },
];

export const VEHICLES = {
  apex_gt: {
    id: 'apex_gt', name: 'Dorado Apex GT', cls: 'SUPER',
    maxSpeed: 64, accel: 38, brake: 48, turnRate: 2.35, driftGrip: 0.91,
    maxHp: 140, color: 0xff6138, accent: 0xffc857, length: 4.9, width: 2.25, height: 1.28,
  },
  cabo_gt: {
    id: 'cabo_gt', name: 'Cabo GT Coupe', cls: 'SPORTS',
    maxSpeed: 54, accel: 31, brake: 42, turnRate: 2.25, driftGrip: 0.90,
    maxHp: 120, color: 0x2ec4b6, accent: 0xf4f6f9, length: 4.6, width: 2.1, height: 1.35,
  },
  baja_runner: {
    id: 'baja_runner', name: 'Baja Runner SUV', cls: 'UTILITY',
    maxSpeed: 44, accel: 25, brake: 36, turnRate: 1.95, driftGrip: 0.87,
    maxHp: 185, color: 0xd9a05b, accent: 0x222733, length: 5.0, width: 2.35, height: 1.85,
  },
  scooter: {
    id: 'scooter', name: 'Coastal Scooter', cls: 'MOTO',
    maxSpeed: 38, accel: 28, brake: 38, turnRate: 2.9, driftGrip: 0.86,
    maxHp: 75, color: 0x39d5ff, accent: 0xffffff, length: 2.2, width: 0.85, height: 1.15,
  },
  cdpd_interceptor: {
    id: 'cdpd_interceptor', name: 'CDPD Interceptor', cls: 'PURSUIT',
    maxSpeed: 58, accel: 34, brake: 44, turnRate: 2.3, driftGrip: 0.9,
    maxHp: 135, color: 0x162238, accent: 0xf5f8ff, length: 4.95, width: 2.2, height: 1.48, isPolice: true,
  },
  cdpd_enforcer: {
    id: 'cdpd_enforcer', name: 'CDPD Enforcer SWAT', cls: 'TACTICAL',
    maxSpeed: 42, accel: 22, brake: 34, turnRate: 1.65, driftGrip: 0.85,
    maxHp: 260, color: 0x1c2536, accent: 0x3d557d, length: 6.2, width: 2.6, height: 2.55, isPolice: true, isSwat: true,
  },
};

export const WEAPONS = [
  { id: 'fists', slot: 1, name: 'Fists', icon: '✊', damage: 18, fireRate: 0.42, range: 3.2, spread: 0, clip: 0, reserve: 0, melee: true },
  { id: 'bat', slot: 2, name: 'Alloy Bat', icon: '🏏', damage: 34, fireRate: 0.55, range: 3.8, spread: 0, clip: 0, reserve: 0, melee: true },
  { id: 'pistol', slot: 3, name: 'Sol 9mm', icon: '🔫', damage: 24, fireRate: 0.25, range: 58, spread: 0.02, clip: 15, reserve: 120 },
  { id: 'smg', slot: 4, name: 'Vector SMG', icon: '⚡', damage: 18, fireRate: 0.095, range: 52, spread: 0.045, clip: 32, reserve: 192, auto: true },
  { id: 'shotgun', slot: 5, name: 'Breacher 12G', icon: '💥', damage: 16, pellets: 6, fireRate: 0.72, range: 28, spread: 0.11, clip: 8, reserve: 48 },
  { id: 'carbine', slot: 6, name: 'Carbine AR', icon: '🎯', damage: 29, fireRate: 0.13, range: 76, spread: 0.025, clip: 30, reserve: 180, auto: true },
];

export const CREW = [
  {
    id: 'nadia', key: 'Z', name: 'Nadia Solis', role: 'Wheelwoman',
    ability: 'Plate Swap', cooldown: 32,
    desc: 'Spoofs transponder & drops 2 Wanted Stars immediately.',
    color: '#ff7846',
  },
  {
    id: 'toma', key: 'X', name: 'Toma Reyes', role: 'Master Mechanic',
    ability: 'Field Repair', cooldown: 28,
    desc: 'Restores vehicle hull to 100% and charges full nitro boost.',
    color: '#34e0c8',
  },
  {
    id: 'sora', key: 'C', name: 'Sora Lin', role: 'Signal Ghost',
    ability: 'Signal Jam', cooldown: 35,
    desc: 'Blinds CDPD radar & HALCÓN-1 spotlight for 14 seconds.',
    color: '#a876ff',
  },
];

export const RADIO_STATIONS = [
  {
    id: 'onda-sol', freq: 'FM 98.4', name: 'Onda Sol', genre: 'Sunset Synthwave',
    bpm: 112, rootHz: 110, mode: 'synthwave',
    tracks: ['Sunset Over Esmeralda', 'Palm Boulevard Drift', 'Coral Horizon', 'Golden Hour Syndicate'],
  },
  {
    id: 'neon-pulse', freq: 'FM 101.2', name: 'Neon Pulse', genre: 'Electro Noir',
    bpm: 126, rootHz: 130.8, mode: 'electro',
    tracks: ['Mercado Midnight', 'Chrome Voltage', 'Puente Overdrive', 'Signal Ghost'],
  },
  {
    id: 'bahia-dub', freq: 'FM 94.7', name: 'Bahia Dub', genre: 'Coastal Bass',
    bpm: 96, rootHz: 98, mode: 'dub',
    tracks: ['Tidewater Echo', 'Cabo Breeze', 'Harbor Fog', 'Amber Lantern'],
  },
  {
    id: 'cdpd-scanner', freq: 'CH 16', name: 'CDPD Scanner', genre: 'Tactical Dispatch',
    bpm: 84, rootHz: 164.8, mode: 'scanner',
    tracks: ['District 4 Tactical Feed', 'Air Unit HALCÓN-1 Relay', 'Harbor Patrol Channel'],
  },
];

export const MISSIONS = [
  {
    id: 'm1', number: 1, act: 'Act I', title: 'Gold Coast Welcome', district: 'Paseo Dorado',
    cash: 6500, rp: 350, timeLimit: 180, medalTarget: 95,
    stages: [
      { label: 'Meet Doña Marisol at Hotel Solsticio', target: { x: -160, z: 200 }, type: 'reach' },
      { label: 'Deliver the hot Cabo GT to Rafa\'s Garage', target: { x: 180, z: -280 }, type: 'reach' },
      { label: 'Lose the tail before entering Barrio Viejo', target: { x: 180, z: -280 }, type: 'evade' },
    ],
    dialogue: { speaker: 'DOÑA MARISOL · FIXER', portrait: 'marisol', text: 'Welcome back to Cala Dorada, Dante. Prove you still own these streets.' },
  },
  {
    id: 'm2', number: 2, act: 'Act I', title: 'Harbor Manifest', district: 'Puerto Cenit',
    cash: 9200, rp: 480, timeLimit: 200, medalTarget: 110,
    stages: [
      { label: 'Infiltrate Puerto Cenit Container Pier', target: { x: 340, z: -60 }, type: 'reach' },
      { label: 'Clear Los Caimanes dock guards', target: { x: 340, z: -60 }, type: 'combat', count: 4 },
      { label: 'Extract manifest back to Bahia Esmeralda', target: { x: 260, z: 210 }, type: 'reach' },
    ],
    dialogue: { speaker: 'TOMA REYES · MECHANIC', portrait: 'toma', text: 'Vega\'s crew is offloading customs crates at Pier 3. Keep your ride intact.' },
  },
  {
    id: 'm3', number: 3, act: 'Act I', title: 'Lantern Ledger', district: 'Mercado Nocturno',
    cash: 12400, rp: 620, timeLimit: 210, medalTarget: 120,
    stages: [
      { label: 'Enter Mercado Nocturno with Nadia', target: { x: -310, z: -50 }, type: 'reach' },
      { label: 'Eliminate Los Caimanes enforcers in the market', target: { x: -310, z: -50 }, type: 'combat', count: 6 },
      { label: 'Escape CDPD foot patrol to Safehouse', target: { x: 260, z: 210 }, type: 'evade' },
    ],
    dialogue: { speaker: 'NADIA SOLIS · WHEELWOMAN', portrait: 'nadia', text: 'Lantern alley is crawling with Los Caimanes! Pin them behind the stalls — I have your flank!' },
  },
  {
    id: 'm4', number: 4, act: 'Act II', title: 'Mirador Wiretap', district: 'Distrito Torre',
    cash: 14800, rp: 760, timeLimit: 195, medalTarget: 115,
    stages: [
      { label: 'Drive Sora to Mirador Plaza relay', target: { x: 20, z: -80 }, type: 'reach' },
      { label: 'Hold plaza perimeter while Sora hacks', target: { x: 20, z: -80 }, type: 'combat', count: 5 },
      { label: 'Outrun CDPD interceptors through Downtown', target: { x: -160, z: 200 }, type: 'evade' },
    ],
    dialogue: { speaker: 'SORA LIN · SIGNAL GHOST', portrait: 'sora', text: 'I\'m inside CDPD dispatch telemetry. Keep them off my van for thirty seconds!' },
  },
  {
    id: 'm5', number: 5, act: 'Act II', title: 'Bridge Toll Takedown', district: 'Paseo Dorado',
    cash: 18500, rp: 950, timeLimit: 210, medalTarget: 130,
    stages: [
      { label: 'Intercept syndicate courier on Paseo Dorado', target: { x: -240, z: 200 }, type: 'reach' },
      { label: 'Disable courier escort near Hotel Solsticio', target: { x: -60, z: 200 }, type: 'combat', count: 3 },
      { label: 'Break the CDPD cordon across Puente del Sol', target: { x: 160, z: 120 }, type: 'reach' },
      { label: 'Ditch pursuit at Bahia Esmeralda Marina', target: { x: 270, z: 220 }, type: 'evade' },
    ],
    dialogue: { speaker: 'NADIA SOLIS · WHEELWOMAN', portrait: 'nadia', text: 'Puente del Sol is locked down! Hit [Z] Plate Swap after the bridge — I\'ll kill their tags!' },
  },
  {
    id: 'm6', number: 6, act: 'Act II', title: 'Hillside Vault', district: 'Villas del Cabo',
    cash: 22000, rp: 1100, timeLimit: 230, medalTarget: 140,
    stages: [
      { label: 'Ascend to Vega\'s Villa del Cabo estate', target: { x: -190, z: -330 }, type: 'reach' },
      { label: 'Neutralize courtyard cartel security', target: { x: -190, z: -330 }, type: 'combat', count: 6 },
      { label: 'Speed down to Rafa\'s Garage with the bearer bonds', target: { x: 180, z: -280 }, type: 'reach' },
    ],
    dialogue: { speaker: 'VEGA · LOS CAIMANES', portrait: 'vega', text: 'You think Cala Dorada belongs to ghosts? Every patrol in the hills is paid by me!' },
  },
  {
    id: 'm7', number: 7, act: 'Act III', title: 'Blackout Marina', district: 'Bahia Esmeralda',
    cash: 26500, rp: 1320, timeLimit: 240, medalTarget: 145,
    stages: [
      { label: 'Jam coastal radar towers with Sora', target: { x: 290, z: 210 }, type: 'reach' },
      { label: 'Defend the marina pier from syndicate gunboats', target: { x: 290, z: 210 }, type: 'combat', count: 7 },
      { label: 'Escape HALCÓN-1 air unit lockdown', target: { x: -120, z: 200 }, type: 'evade' },
    ],
    dialogue: { speaker: 'SORA LIN · SIGNAL GHOST', portrait: 'sora', text: 'Trigger [C] Signal Jam whenever HALCÓN-1 locks its spotlight onto you!' },
  },
  {
    id: 'm8', number: 8, act: 'Act III', title: 'Gold Coast Syndicate', district: 'Distrito Torre',
    cash: 45000, rp: 2000, timeLimit: 280, medalTarget: 170,
    stages: [
      { label: 'Storm Casa Ambar penthouse convoy', target: { x: 40, z: 180 }, type: 'reach' },
      { label: 'Defeat Vega and his elite bodyguards', target: { x: 20, z: -40 }, type: 'combat', count: 8 },
      { label: 'Survive 5-Star CDPD citywide lockdown', target: { x: 260, z: 210 }, type: 'evade' },
      { label: 'Claim the Syndicate crown at Bahia Esmeralda', target: { x: 260, z: 210 }, type: 'reach' },
    ],
    dialogue: { speaker: 'DANTE VARO', portrait: 'dante', text: 'Tonight, the Gold Coast remembers who built it. Let\'s finish Vega for good.' },
  },
];

export const RANKS = [
  { rank: 1, rp: 0, title: 'Street Runner' },
  { rank: 4, rp: 1200, title: 'Coastal Wheelman' },
  { rank: 8, rp: 2800, title: 'Harbor Enforcer' },
  { rank: 12, rp: 4900, title: 'District Captain' },
  { rank: 14, rp: 6000, title: 'Gold Coast Fixer' },
  { rank: 18, rp: 8800, title: 'Syndicate Underboss' },
  { rank: 22, rp: 12500, title: 'Cala Dorada Kingpin' },
];
