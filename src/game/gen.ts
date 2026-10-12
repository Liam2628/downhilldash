// Endless track generation. The course is built in 100 m chunks, far enough
// ahead of the car that the player can never reach ungenerated road.
// The seed comes from Math.random() at page load, so every visit is a
// different mountain and runs are not repeatable.
import { create } from "zustand";

export const CHUNK = 100;
export const AHEAD = 700; // meters generated beyond the car
export const HALF = 10;

const seed = (Math.random() * 2 ** 32) >>> 0;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Ramp = { s: number; len: number; h: number; xo: number; w: number };
export type Loop = { s: number; R: number };
export type Pad = { s: number; xo: number; len: number; h: number; w: number; flat?: boolean };
export type Cone = { s: number; xo: number };
export type Barrier = { s: number; xo: number; w: number };
export type Coin = { x: number; y: number; z: number };
export type Mega = { s: number; xo: number };
export type Building = { x: number; z: number; y: number; w: number; d: number; h: number; hue: number };
export type Tree = { x: number; y: number; z: number; s: number };
export type Rock = { x: number; y: number; z: number; sc: number; sy: number; rot: [number, number, number] };
export type Gantry = { s: number; name: string };
export type Billboard = { s: number; side: number; text: string; sub: string };

export const RAMPS: Ramp[] = [];
export const LOOPS: Loop[] = [];
export const PADS: Pad[] = [];
export const CONES: Cone[] = [];
export const BARRIERS: Barrier[] = [];
export const COINS: Coin[] = [];
export const MEGAS: Mega[] = [];
export const SCENERY_BUILDINGS: Building[] = [];
export const SCENERY_TREES: Tree[] = [];
export const SCENERY_ROCKS: Rock[] = [];
export const GANTRIES: Gantry[] = [];
export const BILLBOARDS: Billboard[] = [];

// Height / curve tables, one entry per meter, grown as chunks are generated.
const H: number[] = [0];
const C: number[] = [0];
export let genEnd = 0; // meters generated so far (multiple of CHUNK)

export const CHUNK_NAMES: Record<string, string> = {
  normal: "DOWNHILL",
  steep: "STEEP DROP",
  verySteep: "VERTIGO",
  boost: "BOOST ALLEY",
  curve: "S-CURVES",
  loop: "LOOP DE LOOP",
  obstacles: "BARRIER RUN",
  mega: "MEGA LAUNCH",
};
export const chunkTypes: string[] = [];
export const AREAS: { s: number; type: ChunkType; variation: number; length: number }[] = [];

// Five authored layouts per area; a shuffled bag visits all five before reuse.
export const AREA_VARIATIONS = [
  { grade: 0.92, curve: 0.16, bend: 1, rampAt: 34, rampEvery: 2, loopAt: 48, radius: 10, loopEvery: 2, rows: [30, 68], gapStep: 1, megaAt: 42, boostAt: 28 },
  { grade: 1, curve: 0.23, bend: -1, rampAt: 48, rampEvery: 3, loopAt: 56, radius: 12, loopEvery: 3, rows: [38, 76], gapStep: 2, megaAt: 52, boostAt: 38 },
  { grade: 1.08, curve: 0.28, bend: 0, rampAt: 38, rampEvery: 2, loopAt: 46, radius: 11, loopEvery: 2, rows: [28, 58, 86], gapStep: 0, megaAt: 62, boostAt: 46 },
  { grade: 0.96, curve: 0.2, bend: 2, rampAt: 56, rampEvery: 3, loopAt: 62, radius: 13, loopEvery: 2, rows: [42, 82], gapStep: -1, megaAt: 46, boostAt: 32 },
  { grade: 1.04, curve: 0.25, bend: -2, rampAt: 42, rampEvery: 2, loopAt: 52, radius: 10.5, loopEvery: 3, rows: [26, 64], gapStep: 1, megaAt: 58, boostAt: 42 },
] as const;
const variationBags = new Map<ChunkType, number[]>();
const lastVariations = new Map<ChunkType, number>();
function nextVariation(type: ChunkType, r: () => number) {
  let bag = variationBags.get(type);
  if (!bag?.length) {
    bag = [0, 1, 2, 3, 4];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag[bag.length - 1] === lastVariations.get(type)) [bag[0], bag[4]] = [bag[4], bag[0]];
    variationBags.set(type, bag);
  }
  const variation = bag.pop() ?? 0;
  lastVariations.set(type, variation);
  return variation;
}

let grade = 0.18;
let dc = 0;
let lastMegaChunk = -99;
let lastType = "";
let areaRemaining = 0;
let areaStart = 0;
let areaType: ChunkType = "normal";
let areaDowntown = false;
let areaVariation = 0;
let lastPairChunk = -10;

type ChunkType = "normal" | "steep" | "verySteep" | "boost" | "curve" | "loop" | "obstacles" | "mega";

function pickType(r: () => number, chunkIndex: number): ChunkType {
  if (chunkIndex === 0) return "normal";
  const weights: [ChunkType, number][] = [
    ["steep", 0.17], ["verySteep", 0.12], ["boost", 0.25],
    ["curve", 0.2], ["loop", 0.12], ["obstacles", 0.14],
    ["mega", chunkIndex - lastMegaChunk >= 10 ? 0.06 : 0],
  ];
  const choices = weights.filter(([t, w]) => t !== lastType && w > 0);
  let roll = r() * choices.reduce((sum, [, w]) => sum + w, 0);
  for (const [t, w] of choices) {
    roll -= w;
    if (roll <= 0) {
      if (t === "mega") lastMegaChunk = chunkIndex;
      return t;
    }
  }
  return "boost";
}

const GRADES: Record<ChunkType, [number, number]> = {
  normal: [0.16, 0.24],
  steep: [0.3, 0.38],
  verySteep: [0.45, 0.55],
  boost: [0.18, 0.22],
  curve: [0.18, 0.26],
  loop: [0.02, 0.03],
  obstacles: [0.18, 0.24],
  mega: [0.16, 0.2],
};

const BILLBOARD_COPY: [string, string][] = [
  ["FLIP IT", "Double press W / S in the air"],
  ["ROLL IT", "Double press A / D in the air"],
  ["SEND IT", "Boost pads are one-shot — commit"],
  ["STAY LOW", "Stick the landing for combo wheels"],
  ["LOOP!", "Hold W all the way around"],
  ["DODGE!", "Find the gap in the barriers"],
];

function generateChunk(chunkIndex: number) {
  const s0 = chunkIndex * CHUNK;
  const r = rng((seed ^ Math.imul(chunkIndex + 1, 2654435761)) >>> 0);
  const newArea = areaRemaining === 0;
  if (newArea) {
    areaType = pickType(r, chunkIndex);
    areaStart = chunkIndex;
    // A single 100 m introduction, then 300–600 m playable areas.
    areaRemaining = chunkIndex === 0 ? 1 :
      areaType === "boost" || areaType === "curve" ? 4 + Math.floor(r() * 3) : 3 + Math.floor(r() * 2);
    areaDowntown = chunkIndex > 0 && r() < 0.2;
    areaVariation = nextVariation(areaType, r);
    AREAS.push({ s: s0, type: areaType, variation: areaVariation, length: areaRemaining * CHUNK });
    lastType = areaType;
  }
  const type = areaType;
  const areaOffset = chunkIndex - areaStart;
  const layout = AREA_VARIATIONS[areaVariation];
  areaRemaining--;
  chunkTypes[chunkIndex] = type;

  const [g0, g1] = GRADES[type];
  const gradeTarget = (g0 + r() * (g1 - g0)) * layout.grade;
  const bendSign = layout.bend === 0 ? (areaOffset % 2 ? -1 : 1) :
    Math.sign(layout.bend) * (Math.abs(layout.bend) === 2 && areaOffset % 2 ? -1 : 1);
  const dcTarget = type === "curve" ? bendSign * layout.curve
    : chunkIndex === 0 || type === "loop" || type === "mega" ? 0
    : (r() - 0.5) * 0.1;

  for (let m = 0; m < CHUNK; m++) {
    const t = m / CHUNK;
    const ease = t * t * (3 - 2 * t);
    grade += (gradeTarget - grade) * ease * 0.08;
    dc += (dcTarget - dc) * ease * 0.06;
    if (type === "loop" || type === "mega") dc *= 0.88; // straighten quickly so loops sit on straight road
    dc = Math.max(-0.3, Math.min(0.3, dc));
    H.push(H[H.length - 1] - grade);
    C.push(C[C.length - 1] + dc);
  }
  genEnd = s0 + CHUNK;

  const hAtL = (s: number) => H[Math.max(0, Math.min(H.length - 1, Math.round(s)))];
  const cAtL = (s: number) => C[Math.max(0, Math.min(C.length - 1, Math.round(s)))];

  // --- features per type ---
  const addRamp = (s: number, big = false) => {
    const len = big ? 30 + r() * 14 : 12 + r() * 6;
    const h = big ? 5 + r() * 2 : 2.4 + r() * 2;
    RAMPS.push({ s, len, h, xo: 0, w: HALF * 2 });
    // air-arc coins after the lip
    const v = 36;
    const sEnd = s + len;
    const yEnd = hAtL(sEnd) + h;
    const vy = v * ((2 * h) / len);
    for (let k = 1; k < 12; k++) {
      const ds = k * 4;
      const t2 = ds / v;
      const y = yEnd + vy * t2 - 15 * t2 * t2 + 1.6;
      if (y < hAtL(sEnd + ds) + 2.4) break;
      COINS.push({ x: cAtL(sEnd + ds), y, z: -(sEnd + ds) });
    }
  };
  const addConeRow = (s: number, n: number) => {
    for (let i = 0; i < n; i++) CONES.push({ s: s + i * 6, xo: (i % 2 ? 1 : -1) * (3 + r() * 4) });
  };

  switch (type) {
    case "normal":
      // Clean opening: no ramps, coins, cones, buildings or signs.
      break;
    case "steep":
      if (areaOffset % layout.rampEvery === 1) addRamp(s0 + layout.rampAt);
      break;
    case "verySteep":
      if (areaOffset % layout.rampEvery === 1) addRamp(s0 + layout.rampAt - 4, true);
      break;
    case "boost": {
      // Boosts use the same track-wide spacing policy as every other area.
      break;
    }
    case "curve":
      addConeRow(s0 + 18 + areaVariation * 4, 5 + areaVariation);
      break;
    case "loop": {
      if (areaOffset % layout.loopEvery !== 0) break;
      const lp = { s: s0 + layout.loopAt, R: layout.radius };
      LOOPS.push(lp);
      for (let k = 1; k < 16; k++) {
        const th = (k / 16) * Math.PI * 2;
        const rr = lp.R - 1.4;
        const shift = (th / (Math.PI * 2)) * 10 - 5;
        COINS.push({
          x: cAtL(lp.s) + shift,
          y: hAtL(lp.s) + lp.R - rr * Math.cos(th),
          z: -(lp.s + rr * Math.sin(th)),
        });
      }
      break;
    }
    case "obstacles": {
      const lanes = [-6.5, 0, 6.5];
      for (const [row, offset] of layout.rows.entries()) {
        const bs = s0 + offset;
        const gap = ((areaOffset + row * layout.gapStep + areaVariation) % 3 + 3) % 3;
        lanes.forEach((xo, i) => {
          if (i !== gap) BARRIERS.push({ s: bs, xo, w: 5.6 });
        });
        // coins through the gap
        for (let k = 0; k < 3; k++) COINS.push({ x: cAtL(bs - 6 + k * 6) + lanes[gap], y: hAtL(bs - 6 + k * 6) + 1.3, z: -(bs - 6 + k * 6) });
      }
      break;
    }
    case "mega": {
      if (areaOffset > 0) {
        if (areaOffset === 2) addRamp(s0 + layout.rampAt);
        break;
      }
      const launchS = s0 + layout.megaAt;
      MEGAS.push({ s: launchS, xo: 0 });
      // sky-high coin arc above the launch
      for (let k = 1; k < 10; k++) {
        const ds = k * 5;
        const y = hAtL(launchS) + 4 + k * 4.5 - 0.28 * k * k;
        if (y < hAtL(launchS + ds) + 2) break;
        COINS.push({ x: cAtL(launchS + ds), y, z: -(launchS + ds) });
      }
      break;
    }
  }

  if (chunkIndex > 0) {
    const ramp = RAMPS.find(p => p.s >= s0 && p.s < s0 + CHUNK);
    const loop = LOOPS.find(p => p.s >= s0 && p.s < s0 + CHUNK);
    const mega = MEGAS.find(p => p.s >= s0 && p.s < s0 + CHUNK);
    const boostS = ramp ? ramp.s - 18 : loop ? loop.s - loop.R - 18 : mega ? s0 + 16 : s0 + layout.boostAt;
    const addBoost = (s: number, flat: boolean) => {
      PADS.push(flat ? { s, xo: 0, len: 8, h: 0, w: 6, flat: true } : { s, xo: 0, len: 7, h: 1.2, w: 5 });
    };
    // One boost per 100 m in every playable area, never on an obstacle footprint.
    const barrierNear = BARRIERS.filter(b => b.s >= s0 && b.s < s0 + CHUNK);
    let safeS = boostS;
    if (!ramp && !loop && !mega) {
      for (const b of barrierNear) if (Math.abs(safeS - b.s) < 12) safeS = b.s - 14;
    }
    addBoost(safeS, Boolean(ramp || loop || mega) || (chunkIndex + areaVariation) % 3 === 0);
    // Occasional pairs, with at least four chunks between pairs; no triples.
    if (!ramp && !loop && !mega && !barrierNear.length && chunkIndex - lastPairChunk >= 4 && r() < 0.18) {
      const pairS = safeS + 22;
      if (pairS <= s0 + 68) {
        addBoost(pairS, (chunkIndex + areaVariation) % 2 === 0);
        lastPairChunk = chunkIndex;
      }
    }
    // New chunks are generated far ahead. Resolve approaches across chunk/area
    // boundaries before they become visible, using the unmodified flat version.
    for (const p of PADS) {
      if (p.s < s0 - 80 || p.flat) continue;
      if (RAMPS.some(rp => rp.s > p.s && rp.s - p.s <= 80) || LOOPS.some(lp => lp.s > p.s && lp.s - p.s <= 80)) {
        Object.assign(p, { len: 8, h: 0, w: 6, flat: true });
      }
    }
  }

  // road coin line (skip where features block)
  for (let s = s0 + 6; chunkIndex > 0 && s < s0 + CHUNK - 4; s += 6) {
    const blockedF =
      RAMPS.some((rp) => s > rp.s - 3 && s < rp.s + rp.len + 2) ||
      PADS.some((p) => s > p.s - p.len / 2 - 3 && s < p.s + p.len / 2 + 2) ||
      BARRIERS.some((b) => Math.abs(s - b.s) < 3) ||
      LOOPS.some((l) => Math.abs(s - l.s) < l.R + 6) ||
      MEGAS.some((m) => Math.abs(s - m.s) < 8);
    if (blockedF) continue;
    const xo = type === "curve" ? 0 : 5 * Math.sin(s / 37);
    COINS.push({ x: cAtL(s) + xo, y: hAtL(s) + 1.3, z: -s });
  }

  // section sign at the chunk start
  if (newArea && chunkIndex > 0) GANTRIES.push({ s: s0, name: `${CHUNK_NAMES[type]} · ${s0} M` });

  // billboard occasionally
  if (chunkIndex > 0 && r() < 0.4) {
    const copy = BILLBOARD_COPY[Math.floor(r() * BILLBOARD_COPY.length)];
    BILLBOARDS.push({ s: s0 + 20 + r() * 60, side: r() < 0.5 ? -1 : 1, text: copy[0], sub: copy[1] });
  }

  // --- scenery ---
  const downtown = areaDowntown;
  for (let s = s0 + 4; s < s0 + CHUNK; s += 9) {
    for (const side of [-1, 1]) {
      if (chunkIndex > 0 && (downtown || r() < 0.2)) {
        const off = downtown ? 22 + r() * 10 : 40 + r() * 70;
        const w = 8 + r() * 10;
        const h = downtown ? 20 + r() * 45 : 8 + r() * 22;
        const dx = side * (off + w / 2);
        SCENERY_BUILDINGS.push({ x: cAtL(s) + dx, z: -s, y: 0, w, d: 6 + r() * 6, h, hue: r() });
      }
      if (!downtown) {
        for (let k = 0; k < 4; k++) {
          const off = 16 + r() * 180;
          SCENERY_TREES.push({ x: cAtL(s) + side * off, y: 0, z: -s - r() * 8, s: 0.8 + r() * 1.1 });
        }
      }
      if (r() < 0.5) {
        const off = 14 + r() * 240;
        const sc = 0.6 + r() * r() * 6;
        SCENERY_ROCKS.push({
          x: cAtL(s) + side * off,
          y: 0,
          z: -s - r() * 6,
          sc,
          sy: 0.5 + r() * 0.5,
          rot: [r() * 3, r() * 3, r() * 3],
        });
      }
    }
  }
}

/** Bump when new chunks exist so rendering can pick them up. */
export const useGen = create<{ version: number }>(() => ({ version: 0 }));

/** Generate chunks until s + AHEAD meters of road exist. */
export function ensureTrack(s: number) {
  const target = Math.max(0, s) + AHEAD;
  if (genEnd >= target) return;
  while (genEnd < target) generateChunk(genEnd / CHUNK);
  useGen.setState((st) => ({ version: st.version + 1 }));
}

export function hAtRaw(s: number) {
  if (s <= 0) return H[0];
  if (s >= H.length - 1) return H[H.length - 1];
  const i = Math.floor(s);
  const f = s - i;
  return H[i] * (1 - f) + H[i + 1] * f;
}
export function cAtRaw(s: number) {
  if (s <= 0) return C[0];
  if (s >= C.length - 1) return C[C.length - 1];
  const i = Math.floor(s);
  const f = s - i;
  return C[i] * (1 - f) + C[i + 1] * f;
}
