// Endless track generation. The course is built in 100 m chunks, far enough
// ahead of the car that the player can never reach ungenerated road.
// The seed comes from Math.random() at page load, so every visit is a
// different mountain and runs are not repeatable.
import { create } from "zustand";

export const CHUNK = 100;
export const AHEAD = 700; // meters generated beyond the car
export const HALF = 10;

let seed = (Math.random() * 2 ** 32) >>> 0;

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

let grade = 0.18;
let dc = 0;
let lastMegaChunk = -99;
let lastType = "";

type ChunkType = "normal" | "steep" | "verySteep" | "boost" | "curve" | "loop" | "obstacles" | "mega";

function pickType(r: () => number, chunkIndex: number): ChunkType {
  if (chunkIndex < 2) return "normal";
  const weights: [ChunkType, number][] = [
    ["normal", 0.26],
    ["steep", 0.14],
    ["verySteep", 0.08],
    ["boost", 0.11],
    ["curve", 0.14],
    ["loop", 0.08],
    ["obstacles", 0.13],
    ["mega", chunkIndex - lastMegaChunk >= 6 ? 0.06 : 0],
  ];
  for (let attempt = 0; attempt < 8; attempt++) {
    let roll = r();
    let picked: ChunkType = "normal";
    for (const [t, w] of weights) {
      roll -= w;
      if (roll <= 0) { picked = t; break; }
    }
    if (picked === lastType && picked !== "normal") continue; // variety: no back-to-back specials
    if (picked === "mega") lastMegaChunk = chunkIndex;
    return picked;
  }
  return "normal";
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
  const type = pickType(r, chunkIndex);
  chunkTypes[chunkIndex] = type;
  lastType = type;

  const [g0, g1] = GRADES[type];
  const gradeTarget = g0 + r() * (g1 - g0);
  const dcTarget = type === "curve" ? (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.15)
    : type === "loop" || type === "mega" ? 0
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
      if (r() < 0.5) addRamp(s0 + 25 + r() * 40);
      if (r() < 0.35) addConeRow(s0 + 30 + r() * 30, 3 + Math.floor(r() * 3));
      break;
    case "steep":
      if (r() < 0.4) addRamp(s0 + 40 + r() * 30);
      break;
    case "verySteep":
      if (r() < 0.5) addRamp(s0 + 30 + r() * 20, true);
      break;
    case "boost": {
      // always one flat strip plus one or two wedge ramps
      PADS.push({ s: s0 + 25 + r() * 10, xo: 0, len: 8, h: 0, w: 6, flat: true });
      PADS.push({ s: s0 + 55 + r() * 10, xo: 0, len: 7, h: 1.2, w: 5 });
      if (r() < 0.5) PADS.push({ s: s0 + 80 + r() * 8, xo: 0, len: 7, h: 1.2, w: 5 });
      break;
    }
    case "curve":
      addConeRow(s0 + 20 + r() * 20, 5 + Math.floor(r() * 4));
      break;
    case "loop": {
      const lp = { s: s0 + 50, R: 10 + r() * 3 };
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
      for (const bs of [s0 + 30, s0 + 65]) {
        const gap = Math.floor(r() * 3);
        lanes.forEach((xo, i) => {
          if (i !== gap) BARRIERS.push({ s: bs, xo, w: 5.6 });
        });
        // coins through the gap
        for (let k = 0; k < 3; k++) COINS.push({ x: cAtL(bs - 6 + k * 6) + lanes[gap], y: hAtL(bs - 6 + k * 6) + 1.3, z: -(bs - 6 + k * 6) });
      }
      break;
    }
    case "mega": {
      MEGAS.push({ s: s0 + 45, xo: 0 });
      // sky-high coin arc above the launch
      for (let k = 1; k < 10; k++) {
        const ds = k * 5;
        const y = hAtL(s0 + 45) + 4 + k * 4.5 - 0.28 * k * k;
        if (y < hAtL(s0 + 45 + ds) + 2) break;
        COINS.push({ x: cAtL(s0 + 45 + ds), y, z: -(s0 + 45 + ds) });
      }
      break;
    }
  }

  // road coin line (skip where features block)
  for (let s = s0 + 6; s < s0 + CHUNK - 4; s += 6) {
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
  GANTRIES.push({ s: s0, name: `${CHUNK_NAMES[type]} · ${s0} M` });

  // billboard occasionally
  if (chunkIndex > 0 && r() < 0.4) {
    const copy = BILLBOARD_COPY[Math.floor(r() * BILLBOARD_COPY.length)];
    BILLBOARDS.push({ s: s0 + 20 + r() * 60, side: r() < 0.5 ? -1 : 1, text: copy[0], sub: copy[1] });
  }

  // --- scenery ---
  const downtown = r() < 0.1;
  for (let s = s0 + 4; s < s0 + CHUNK; s += 9) {
    for (const side of [-1, 1]) {
      if (downtown || r() < 0.2) {
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
