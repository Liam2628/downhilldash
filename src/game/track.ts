// Track math: the downhill road is a function of distance s (s = -z).
// The course is endless — gen.ts continuously generates new 100 m chunks
// ahead of the car with a random per-visit seed, so no two runs repeat.
import {
  HALF as GEN_HALF,
  hAtRaw,
  cAtRaw,
  genEnd,
  GANTRIES,
  RAMPS,
  PADS,
  BARRIERS,
  type Loop,
} from "./gen";

export const HALF = GEN_HALF;
export const FINISH = Infinity; // no finish line: the run goes on until you bail

export const LOOP_WIDTH = 9;
export const LOOP_DECK_THICKNESS = 0.18;
export const LOOP_RAIL_RADIUS = 0.25;
export const LOOP_RAIL_HEIGHT = 0.4;
export const BARRIER_DEPTH = 3.6;
export const BARRIER_HEIGHT = 1.2;

export type { Ramp, Loop, Pad, Cone, Barrier, Coin, Mega, Building, Tree, Rock, Gantry, Billboard } from "./gen";
export {
  RAMPS,
  LOOPS,
  PADS,
  CONES,
  BARRIERS,
  COINS,
  MEGAS,
  SCENERY_BUILDINGS,
  SCENERY_TREES,
  SCENERY_ROCKS,
  GANTRIES,
  BILLBOARDS,
  CHUNK,
  AHEAD,
  genEnd,
  ensureTrack,
  useGen,
} from "./gen";

export function loopPoint(lp: Loop, th: number, offset = 0) {
  return { x: cAt(lp.s) - 5 + 10 * th / (Math.PI * 2) + offset,
    y: hAt(lp.s) + lp.R * (1 - Math.cos(th)), z: -lp.s - lp.R * Math.sin(th) };
}
export function loopContact(lp: Loop, x: number, y: number, z: number) {
  const sy = y - hAt(lp.s) - lp.R;
  const sz = -z - lp.s;
  const th = (Math.atan2(sz, -sy) + Math.PI * 2) % (Math.PI * 2);
  const center = loopPoint(lp, th);
  return { th, radial: Math.hypot(sy, sz) - lp.R, offset: x - center.x };
}

/** Sweep the wheel-contact point against both faces of the finite circular deck. */
export function loopSweep(lp: Loop, from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) {
  const cy = hAt(lp.s) + lp.R;
  const y = from.y - cy, z = from.z + lp.s;
  const dy = to.y - from.y, dz = to.z - from.z;
  const a = dy * dy + dz * dz;
  if (a < 1e-12) return null;
  let first: { t: number; th: number; offset: number } | null = null;
  for (const radius of [lp.R, lp.R + LOOP_DECK_THICKNESS]) {
    const b = 2 * (y * dy + z * dz);
    const c = y * y + z * z - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    for (const t of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
      if (t < 0 || t > 1 || (first && t >= first.t)) continue;
      const hit = loopContact(lp, from.x + (to.x - from.x) * t, from.y + dy * t, from.z + dz * t);
      if (Math.abs(hit.offset) <= LOOP_WIDTH / 2) first = { t, th: hit.th, offset: hit.offset };
    }
  }
  return first;
}

/** Name of the generated section at distance s (from the chunk gantry signs). */
export function sectionAt(s: number) {
  let name = "DOWNHILL";
  for (const g of GANTRIES) if (s >= g.s) name = g.name;
  return name;
}

export const hAt = (s: number) => hAtRaw(s);
export const cAt = (s: number) => cAtRaw(s);
export const dcAt = (s: number) => (cAt(s + 1) - cAt(s - 1)) / 2;
/** yaw (radians) of travelling downhill at s; forward = (sin yaw, cos yaw) */
export const roadYaw = (s: number) => Math.atan2(dcAt(s), -1);

export function rampAdd(s: number, dx: number) {
  for (const r of RAMPS) {
    if (s >= r.s && s <= r.s + r.len && Math.abs(dx - r.xo) <= r.w / 2) {
      const t = (s - r.s) / r.len;
      return r.h * t * t;
    }
  }
  return 0;
}

/** Boost pads are raised wedges, with the same deck height used by rendering and driving. */
export function padAdd(s: number, dx: number) {
  for (const p of PADS) {
    if (p.flat) continue;
    const start = p.s - p.len / 2;
    if (s >= start && s <= start + p.len && Math.abs(dx - p.xo) <= p.w / 2) {
      const t = (s - start) / p.len;
      return p.h * t * t;
    }
  }
  return 0;
}

export function barrierAdd(s: number, dx: number) {
  for (const b of BARRIERS) {
    if (Math.abs(dx - b.xo) <= b.w / 2) {
      const d = Math.abs(s - b.s);
      if (d <= BARRIER_DEPTH / 2) return BARRIER_HEIGHT * Math.min(1, (BARRIER_DEPTH / 2 - d) / 1.3);
    }
  }
  return 0;
}

export function surfaceY(s: number, x: number) {
  if (s < 0) return 0;
  const dx = x - cAt(s);
  return hAt(s) + Math.max(rampAdd(s, dx), padAdd(s, dx));
}

export type SolidHit = { y: number; kind: "barrier" | "pillar" | "ramp" | null };
/** Ground plus solid obstacles (barrier tops, loop pillars). */
export function solidY(s: number, x: number): SolidHit {
  const base = surfaceY(s, x);
  if (s < 0) return { y: base, kind: null };
  const dx = x - cAt(s);
  for (const b of BARRIERS) {
    if (Math.abs(s - b.s) < BARRIER_DEPTH / 2 && Math.abs(dx - b.xo) < b.w / 2) return { y: base, kind: "barrier" };
  }
  return { y: base, kind: rampAdd(s, dx) > 0 || padAdd(s, dx) > 0 ? "ramp" : null };
}

export function terrainY(s: number, dx: number) {
  const a = Math.abs(dx);
  const base = hAt(Math.min(Math.max(0, s), Math.max(0, genEnd - 1))) - 0.25;
  if (a < HALF + 1.5) return base;
  // Flat next to the lobby so hills never poke through the plaza or its fence.
  const out = (a - (HALF + 1.5)) * smooth(-10, 140, s);
  const far = Math.max(0, out - 200);
  return base + out * 0.18 + far * 0.25 + Math.sin(s / 23 + dx / 17) * Math.min(1, out / 20) * 3 + Math.sin(s / 90 + dx / 60) * Math.min(1, far / 100) * 40;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Grid shared by the terrain mesh, so props sit on the drawn surface (not the smooth function). */
export const TERRAIN_COLS = [-700, -450, -300, -220, -140, -90, -60, -40, -26, -18, -12, -10.5, -6, 0, 6, 10.5, 12, 18, 26, 40, 60, 90, 140, 220, 300, 450, 700];
export const TERRAIN_DS = 2;
export const TERRAIN_S0 = 0;
/** Height on the exact two triangles drawn in each terrain grid cell. */
export function terrainMeshY(x: number, z: number) {
  const s = Math.max(TERRAIN_S0, -z);
  const i = Math.floor((s - TERRAIN_S0) / TERRAIN_DS);
  const s0 = TERRAIN_S0 + i * TERRAIN_DS, s1 = s0 + TERRAIN_DS;
  const f = (s - s0) / TERRAIN_DS;
  const center = cAt(s0) * (1 - f) + cAt(s1) * f;
  const cols = TERRAIN_COLS;
  const dx = Math.max(cols[0], Math.min(cols[cols.length - 1], x - center));
  let j = 0;
  while (j < cols.length - 2 && cols[j + 1] < dx) j++;
  const g = (dx - cols[j]) / (cols[j + 1] - cols[j]);
  const a = terrainY(s0, cols[j]), b = terrainY(s0, cols[j + 1]);
  const c = terrainY(s1, cols[j]), d = terrainY(s1, cols[j + 1]);
  return (f + g <= 1 ? a + (b - a) * g + (c - a) * f :
    d + (c - d) * (1 - g) + (b - d) * (1 - f)) - 0.05;
}
