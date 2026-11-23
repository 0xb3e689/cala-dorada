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
    maxSpeed: 71.5, accel: 34, brake: 52, turnRate: 2.38, driftGrip: 0.90,
    maxHp: 150, color: 0xff6138, accent: 0xffc857, length: 4.9, width: 2.25, height: 1.28,
  },
  cabo_gt: {
    id: 'cabo_gt', name: 'Cabo GT Coupe', cls: 'SPORTS',
    maxSpeed: 62.6, accel: 29, brake: 46, turnRate: 2.28, driftGrip: 0.89,
    maxHp: 130, color: 0x2ec4b6, accent: 0xf4f6f9, length: 4.6, width: 2.1, height: 1.35,
  },
  convertible: {
    id: 'convertible', name: 'Solsticio Roadster', cls: 'CABRIO',
    maxSpeed: 59.0, accel: 28, brake: 44, turnRate: 2.34, driftGrip: 0.89,
    maxHp: 120, color: 0xff5e7e, accent: 0xfff0d4, length: 4.55, width: 2.08, height: 1.18, isConvertible: true,
  },
  baja_runner: {
    id: 'baja_runner', name: 'Baja Runner SUV', cls: 'UTILITY',
    maxSpeed: 40.2, accel: 22, brake: 38, turnRate: 1.92, driftGrip: 0.86,
    maxHp: 195, color: 0xd9a05b, accent: 0x222733, length: 5.0, width: 2.35, height: 1.85,
  },
  scooter: {
    id: 'scooter', name: 'Coastal Scooter', cls: 'MOTO',
    maxSpeed: 18.0, accel: 16, brake: 28, turnRate: 2.85, driftGrip: 0.85,
    maxHp: 75, color: 0x39d5ff, accent: 0xffffff, length: 2.2, width: 0.85, height: 1.15,
  },
  cdpd_interceptor: {
    id: 'cdpd_interceptor', name: 'CDPD Interceptor', cls: 'PURSUIT',
    maxSpeed: 53.6, accel: 30, brake: 46, turnRate: 2.30, driftGrip: 0.89,
    maxHp: 140, color: 0x162238, accent: 0xf5f8ff, length: 4.95, width: 2.2, height: 1.48, isPolice: true,
  },
  cdpd_enforcer: {
    id: 'cdpd_enforcer', name: 'CDPD Enforcer SWAT', cls: 'TACTICAL',
    maxSpeed: 36.6, accel: 19, brake: 34, turnRate: 1.65, driftGrip: 0.84,
    maxHp: 260, color: 0x1c2536, accent: 0x3d557d, length: 6.2, width: 2.6, height: 2.55, isPolice: true, isSwat: true,
  },
};

export const WEAPONS = [
  { id: 'fists', slot: 1, name: 'Fists', shortName: 'Fists', damage: 18, fireRate: 0.42, range: 3.2, spread: 0, clip: 0, reserve: 0, reloadTime: 0, melee: true },
  { id: 'bat', slot: 2, name: 'Alloy Bat', shortName: 'Bat', damage: 34, fireRate: 0.55, range: 3.8, spread: 0, clip: 0, reserve: 0, reloadTime: 0, melee: true },
  { id: 'pistol', slot: 3, name: 'Sol 9mm', shortName: '9mm', damage: 24, fireRate: 0.25, range: 58, spread: 0.02, clip: 15, reserve: 120, reloadTime: 1.5 },
  { id: 'smg', slot: 4, name: 'Vector SMG', shortName: 'Vector', damage: 18, fireRate: 0.095, range: 52, spread: 0.045, clip: 32, reserve: 192, reloadTime: 1.68, auto: true },
  { id: 'shotgun', slot: 5, name: 'Breacher 12G', shortName: '12G', damage: 16, pellets: 6, fireRate: 0.72, range: 28, spread: 0.11, clip: 8, reserve: 48, reloadTime: 1.9 },
  { id: 'carbine', slot: 6, name: 'Carbine AR', shortName: 'Carbine', damage: 29, fireRate: 0.13, range: 76, spread: 0.025, clip: 30, reserve: 180, reloadTime: 1.78, auto: true },
];

export const CAR_PAINTS = [
  { id: 'coral', name: 'Solsticio Coral', hex: '#ff6138', price: 800 },
  { id: 'teal', name: 'Esmeralda Teal', hex: '#2ec4b6', price: 800 },
  { id: 'gold', name: 'Cala Gold', hex: '#ffbe55', price: 1000 },
  { id: 'crimson', name: 'Crimson Drift', hex: '#e63946', price: 900 },
  { id: 'cobalt', name: 'Pacific Cobalt', hex: '#3b82f6', price: 900 },
  { id: 'violet', name: 'Neon Violet', hex: '#9b5de5', price: 1100 },
  { id: 'pearl', name: 'Alabaster Pearl', hex: '#edf2f7', price: 900 },
  { id: 'obsidian', name: 'Obsidian Matte', hex: '#1c222d', price: 1200 },
];

export const CAR_SPOILERS = [
  { id: 'stock', name: 'Stock Clean', price: 0 },
  { id: 'ducktail', name: 'Ducktail Lip', price: 1400 },
  { id: 'gt', name: 'Carbon GT Wing', price: 2400 },
];

export const CAR_UNDERGLOWS = [
  { id: 'off', name: 'Off', hex: null, price: 0 },
  { id: 'cyan', name: 'Cyan', hex: '#34e0c8', price: 1200 },
  { id: 'gold', name: 'Gold', hex: '#ffbe55', price: 1200 },
  { id: 'coral', name: 'Coral', hex: '#ff6b4a', price: 1200 },
  { id: 'violet', name: 'Violet', hex: '#a876ff', price: 1200 },
];

export const CAR_RIMS = [
  { id: 'silver', name: 'Alloy Silver', hex: '#e6edf7', price: 0 },
  { id: 'gold', name: 'Forged Gold', hex: '#eab308', price: 900 },
  { id: 'stealth', name: 'Stealth Black', hex: '#232833', price: 900 },
  { id: 'bronze', name: 'Copper Bronze', hex: '#c87d55', price: 950 },
];

export const WARDROBE_OPTIONS = {
  outfits: [
    { id: 'bomber', name: 'Coastal Bomber' },
    { id: 'blazer', name: 'Syndicate Blazer' },
    { id: 'tactical', name: 'Tactical Vest' },
    { id: 'coastal', name: 'Resort Linen' },
  ],
  jacketColors: [
    { name: 'Coral', hex: '#e65f3c' },
    { name: 'Teal', hex: '#22b8a8' },
    { name: 'Obsidian', hex: '#1e2430' },
    { name: 'Cream', hex: '#e8dcc8' },
    { name: 'Crimson', hex: '#c9344c' },
    { name: 'Cobalt', hex: '#2d6cdf' },
  ],
  pantsColors: [
    { name: 'Slate', hex: '#1b2230' },
    { name: 'Charcoal', hex: '#24272e' },
    { name: 'Sand', hex: '#b69f80' },
    { name: 'Indigo', hex: '#25395c' },
    { name: 'Olive', hex: '#384737' },
  ],
  hairStyles: [
    { id: 'swept', name: 'Swept Back' },
    { id: 'fade', name: 'Short Fade' },
    { id: 'ponytail', name: 'Tied Back' },
    { id: 'slick', name: 'Classic Slick' },
  ],
  hairColors: [
    { name: 'Espresso', hex: '#1b1514' },
    { name: 'Chestnut', hex: '#4a2e1f' },
    { name: 'Blonde', hex: '#c7a265' },
    { name: 'Silver', hex: '#a6b0bf' },
    { name: 'Auburn', hex: '#7a2f24' },
  ],
  skinTones: [
    { name: 'Fair', hex: '#ecc0a2' },
    { name: 'Warm Tan', hex: '#d9a17a' },
    { name: 'Olive', hex: '#c48c64' },
    { name: 'Bronze', hex: '#9e6844' },
    { name: 'Deep', hex: '#69422b' },
  ],
  accessories: [
    { id: 'aviators', name: 'Aviators' },
    { id: 'cap', name: 'Baseball Cap' },
    { id: 'none', name: 'None' },
  ],
};

export const FISH_SPECIES = [
  { id: 'snapper', name: 'Golden Snapper', minKg: 1.4, maxKg: 4.2, cash: 450, rp: 45, difficulty: 0.72 },
  { id: 'mahi', name: 'Mahi-Mahi', minKg: 4.5, maxKg: 11.8, cash: 820, rp: 80, difficulty: 0.88 },
  { id: 'barracuda', name: 'Barracuda', minKg: 3.8, maxKg: 9.6, cash: 1150, rp: 110, difficulty: 1.05 },
  { id: 'grouper', name: 'Reef Grouper', minKg: 6.2, maxKg: 16.5, cash: 1450, rp: 145, difficulty: 1.18 },
];

export const GARDEN_CROPS = [
  { id: 'peppers', name: 'Coastal Peppers', seedCost: 90, sellValue: 420, color: '#ff5247', growSec: 18 },
  { id: 'orchids', name: 'Orchids', seedCost: 120, sellValue: 540, color: '#e85aff', growSec: 22 },
  { id: 'hibiscus', name: 'Hibiscus', seedCost: 140, sellValue: 620, color: '#ff6b9d', growSec: 24 },
  { id: 'palms', name: 'Dwarf Palms', seedCost: 220, sellValue: 900, color: '#34d399', growSec: 28 },
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

export const PROPERTIES = [
  {
    id: 'dantes-loft',
    name: "Dante's Loft",
    shortName: "DANTE'S LOFT",
    kind: 'safehouse',
    district: 'barrio-viejo',
    districtLabel: 'Barrio Viejo',
    x: 92,
    z: -242,
    radius: 17,
    price: 0,
    ownedByDefault: true,
    incomePerHr: 0,
    color: '#ffbe55',
    badge: 'SAFEHOUSE',
    perks: 'Save game · Full heal & armor · Advance time of day',
  },
  {
    id: 'rafas-garage',
    name: "Rafa's Chop & Spray",
    shortName: "RAFA'S GARAGE",
    kind: 'garage',
    district: 'barrio-viejo',
    districtLabel: 'Barrio Viejo',
    x: 150,
    z: -242,
    radius: 17,
    price: 0,
    ownedByDefault: true,
    incomePerHr: 1200,
    color: '#34e0c8',
    badge: 'GARAGE',
    perks: 'Repair vehicle · Custom paint · Clear wanted · Nitro/Armor upgrades',
  },
  {
    id: 'el-taller',
    name: 'El Taller Gunsmith',
    shortName: 'EL TALLER',
    kind: 'gunsmith',
    district: 'mercado-nocturno',
    districtLabel: 'Mercado Nocturno',
    x: -244,
    z: -124,
    radius: 17,
    price: 0,
    ownedByDefault: true,
    incomePerHr: 1400,
    color: '#ff6b4a',
    badge: 'GUNSMITH',
    perks: 'Buy weapons · Refill all ammo · Kevlar body armor',
  },
  {
    id: 'solsticio-club',
    name: 'Solsticio Beach Club',
    shortName: 'SOLSTICIO CLUB',
    kind: 'business',
    district: 'paseo-dorado',
    districtLabel: 'Paseo Dorado',
    x: -54,
    z: 174,
    radius: 17,
    price: 25000,
    ownedByDefault: false,
    incomePerHr: 4200,
    color: '#ff8a4c',
    badge: 'BEACH CLUB',
    spawnVehicle: 'apex_gt',
    perks: 'Passive income ($4,200/hr) · Spawns Dorado Apex GT outside',
  },
  {
    id: 'cenit-warehouse',
    name: 'Cenit Smuggler Warehouse',
    shortName: 'CENIT WAREHOUSE',
    kind: 'business',
    district: 'puerto-cenit',
    districtLabel: 'Puerto Cenit',
    x: 268,
    z: -62,
    radius: 18,
    price: 40000,
    ownedByDefault: false,
    incomePerHr: 5600,
    color: '#a876ff',
    badge: 'WAREHOUSE',
    spawnVehicle: 'baja_runner',
    perks: 'Passive income ($5,600/hr) · Armored getaway SUV · +15% mission bonus',
  },
  {
    id: 'esmeralda-dock',
    name: 'Esmeralda Marina Dock',
    shortName: 'ESMERALDA DOCK',
    kind: 'marina',
    district: 'bahia-esmeralda',
    districtLabel: 'Bahia Esmeralda',
    x: 264,
    z: 182,
    radius: 18,
    price: 55000,
    ownedByDefault: false,
    incomePerHr: 6200,
    color: '#34e0c8',
    badge: 'MARINA DOCK',
    perks: 'Passive income ($6,200/hr) · Quick vehicle repair & cool-down hideout',
  },
  {
    id: 'cabo-penthouse',
    name: 'Cabo Crest Penthouse',
    shortName: 'CABO PENTHOUSE',
    kind: 'penthouse',
    district: 'villas-del-cabo',
    districtLabel: 'Villas del Cabo',
    x: -110,
    z: -244,
    radius: 18,
    price: 75000,
    ownedByDefault: false,
    incomePerHr: 7400,
    color: '#42e38c',
    badge: 'PENTHOUSE',
    perks: 'Luxury safehouse · Full ammo & armor stash · $7,400/hr income',
  },
  {
    id: 'mirador-vault',
    name: 'Mirador Syndicate Vault',
    shortName: 'MIRADOR VAULT',
    kind: 'vault',
    district: 'distrito-torre',
    districtLabel: 'Distrito Torre',
    x: 52,
    z: -40,
    radius: 18,
    price: 90000,
    ownedByDefault: false,
    incomePerHr: 9000,
    color: '#ffd24d',
    badge: 'EMPIRE VAULT',
    perks: 'Collect all accumulated empire income at once · $9,000/hr vault yield',
  },
];
