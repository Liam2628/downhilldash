// Track math: the downhill road is a function of distance s (s = -z).
export const FINISH = 1600;
export const L = 1680; // end of road (runout)
export const HALF = 10; // half road width
const N = L + 260;

export type Ramp = { s: number; len: number; h: number; xo: number; w: number };
export type Loop = { s: number; R: number };
export type Pad = { s: number; xo: number; len: number; h: number; w: number; flat?: boolean };
export type Cone = { s: number; xo: number };
export type Barrier = { s: number; xo: number; w: number };
export type Coin = { x: number; y: number; z: number };
export const LOOP_WIDTH = 9;
export const BARRIER_DEPTH = 3.6;
export const BARRIER_HEIGHT = 1.2;
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

export const LOOPS: Loop[] = [
  { s: 610, R: 11 },
  { s: 1300, R: 12.5 },
];

export const SECTIONS = [
  { s: 0, name: "WARM UP" },
  { s: 150, name: "RAMP ALLEY" },
  { s: 420, name: "CONE ZONE" },
  { s: 560, name: "LOOP DE LOOP" },
  { s: 640, name: "DOWNTOWN" },
  { s: 880, name: "MEGA JUMP" },
  { s: 1000, name: "BARRIER RUN" },
  { s: 1240, name: "THE BIG LOOP" },
  { s: 1360, name: "FINAL SEND" },
  { s: FINISH, name: "FINISH" },
];

export function sectionAt(s: number) {
  let name = SECTIONS[0].name;
  for (const sec of SECTIONS) if (s >= sec.s) name = sec.name;
  return name;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function gradeAt(s: number) {
  let g = 0.2 + 0.07 * Math.sin(s / 110) + 0.03 * Math.sin(s / 37);
  g *= smooth(0, 50, s);
  for (const lp of LOOPS) {
    const d = Math.abs(s - lp.s);
    g = g + (0.02 - g) * (1 - smooth(28, 50, d));
  }
  g *= 1 - smooth(FINISH - 10, FINISH + 40, s);
  return g;
}

function curveRaw(s: number) {
  let env = smooth(30, 100, s);
  // A straight runoff gives drivers time to react after the loop camera blends back.
  for (const lp of LOOPS) env *= smooth(65, 110, Math.abs(s - lp.s));
  env *= 1 - smooth(FINISH - 60, FINISH, s);
  return env * (26 * Math.sin((s - 60) / 150) + 9 * Math.sin((s - 60) / 61));
}

export const Htab = new Float32Array(N);
export const Ctab = new Float32Array(N);
for (let i = 1; i < N; i++) Htab[i] = Htab[i - 1] - gradeAt(i - 0.5);
for (let i = 0; i < N; i++) Ctab[i] = curveRaw(i);

function interp(tab: Float32Array, s: number) {
  if (s <= 0) return tab[0];
  if (s >= N - 1) return tab[N - 1];
  const i = Math.floor(s);
  const f = s - i;
  return tab[i] * (1 - f) + tab[i + 1] * f;
}

export const hAt = (s: number) => interp(Htab, s);
export const cAt = (s: number) => interp(Ctab, s);
export const dcAt = (s: number) => (cAt(s + 1) - cAt(s - 1)) / 2;
/** yaw (radians) of travelling downhill at s; forward = (sin yaw, cos yaw) */
export const roadYaw = (s: number) => Math.atan2(dcAt(s), -1);

export const RAMPS: Ramp[] = [
  { s: 90, len: 10, h: 1.6, xo: 0, w: 14 },
  { s: 190, len: 14, h: 3, xo: 0, w: 19 },
  { s: 262, len: 12, h: 2.6, xo: -5, w: 8 },
  { s: 300, len: 12, h: 2.6, xo: 5, w: 8 },
  { s: 360, len: 16, h: 4, xo: 0, w: 19 },
  { s: 520, len: 12, h: 2.5, xo: 0, w: 12 },
  { s: 722, len: 14, h: 3.2, xo: 4.5, w: 9 },
  { s: 770, len: 14, h: 3.2, xo: -4.5, w: 9 },
  { s: 830, len: 14, h: 3, xo: 0, w: 19 },
  { s: 900, len: 40, h: 6, xo: 0, w: 19 },
  { s: 1185, len: 12, h: 2.6, xo: 0, w: 16 },
  { s: 1380, len: 14, h: 3.5, xo: -4.5, w: 9 },
  { s: 1420, len: 16, h: 4, xo: 4.5, w: 9 },
  { s: 1490, len: 24, h: 6.5, xo: 0, w: 19 },
];
// Launch decks span the driveable road; side-wheel height discontinuities are eliminated.
for (const r of RAMPS) { r.xo = 0; r.w = HALF * 2; }

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
      const edge = smooth(0, 1.5, p.w / 2 - Math.abs(dx - p.xo));
      return p.h * t * t * edge;
    }
  }
  return 0;
}

export function surfaceY(s: number, x: number) {
  if (s < 0) return 0;
  const dx = x - cAt(s);
  return hAt(s) + Math.max(rampAdd(s, dx), padAdd(s, dx), barrierAdd(s, dx));
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

export const PADS: Pad[] = [
  { s: 130, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 335, xo: 0, len: 8, h: 0, w: 6, flat: true },
  { s: 580, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 705, xo: -4, len: 7, h: 1.2, w: 5 },
  { s: 868, xo: 0, len: 8, h: 0, w: 6, flat: true },
  { s: 1165, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 1265, xo: 0, len: 8, h: 0, w: 6, flat: true },
  { s: 1465, xo: 0, len: 7, h: 1.2, w: 5 },
];

// deterministic RNG
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

export const CONES: Cone[] = [];
for (let i = 0; i < 12; i++) CONES.push({ s: 430 + i * 7, xo: (i % 2 ? 1 : -1) * 4.5 });
for (let i = 0; i < 6; i++) {
  CONES.push({ s: 450 + i * 9, xo: -8.5 });
  CONES.push({ s: 450 + i * 9, xo: 8.5 });
}
for (const s of [660, 668, 676]) for (const xo of [-6, 6]) CONES.push({ s, xo });
for (let i = 0; i < 8; i++) CONES.push({ s: 1345 + i * 4, xo: -7 + i * 2 });
// Crash-for-fun cone field right after the finish line
for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++)
  CONES.push({ s: FINISH + 12 + r * 4, xo: -8 + c * 2 + (r % 2 ? 1 : 0) });

export const BARRIERS: Barrier[] = [];
{
  const r = rng(7);
  const lanes = [-6.5, 0, 6.5];
  // A clear landing zone after Mega Jump precedes the slalom.
  for (let s = 1130; s < 1175; s += 20) {
    const gap = Math.floor(r() * 3);
    lanes.forEach((xo, i) => {
      if (i !== gap) BARRIERS.push({ s, xo, w: 5.6 });
    });
  }
  BARRIERS.push({ s: 795, xo: 0, w: 5 });
  BARRIERS.push({ s: 1450, xo: 0, w: 4 });
}

const blocked = (s: number) =>
  LOOPS.some((l) => Math.abs(s - l.s) < 22) ||
  RAMPS.some((r) => s > r.s - 3 && s < r.s + r.len + 2) ||
  PADS.some((p) => s > p.s - p.len / 2 - 3 && s < p.s + p.len / 2 + 2) ||
  BARRIERS.some((b) => Math.abs(s - b.s) < 3);

export const COINS: Coin[] = [];
{
  // road lines
  for (let s = 16; s < FINISH - 5; s += 5) {
    if (blocked(s)) continue;
    let xo = 6 * Math.sin(s / 40);
    if (s > 1000 && s < 1170) {
      // follow the barrier gaps
      const row = BARRIERS.filter((b) => s >= 1000 && Math.abs(b.s - (Math.round((s - 10) / 20) * 20 + 10)) < 1);
      const lanes = [-6.5, 0, 6.5].filter((l) => !row.some((b) => b.xo === l));
      xo = lanes[0] ?? 0;
    }
    if (s > 425 && s < 520) xo = 0;
    const x = cAt(s) + xo;
    COINS.push({ x, y: surfaceY(s, x) + 1.3, z: -s });
  }
  // air arcs after ramps
  for (const r of RAMPS) {
    const v = 36;
    const sEnd = r.s + r.len;
    const yEnd = hAt(sEnd) + r.h;
    const vy = v * ((2 * r.h) / r.len);
    for (let k = 1; k < 14; k++) {
      const ds = k * 4;
      const t = ds / v;
      const y = yEnd + vy * t - 15 * t * t + 1.6;
      const s = sEnd + ds;
      if (y < hAt(s) + 2.4) break;
      if (k % 1 === 0) COINS.push({ x: cAt(s) + r.xo, y, z: -s });
    }
  }
  // loops
  for (const lp of LOOPS) {
    for (let k = 1; k < 16; k++) {
      const th = (k / 16) * Math.PI * 2;
      const rr = lp.R - 1.4;
      const shift = (th / (Math.PI * 2)) * 10 - 5;
      COINS.push({
        x: cAt(lp.s) + shift,
        y: hAt(lp.s) + lp.R - rr * Math.cos(th),
        z: -(lp.s + rr * Math.sin(th)),
      });
    }
  }
}

// Scenery placement (deterministic)
export type Building = { x: number; z: number; y: number; w: number; d: number; h: number; hue: number };
export const SCENERY_BUILDINGS: Building[] = [];
export type Tree = { x: number; y: number; z: number; s: number };
export const SCENERY_TREES: Tree[] = [];

export function terrainY(s: number, dx: number) {
  const a = Math.abs(dx);
  const base = hAt(Math.min(L + 4, Math.max(0, s))) - 0.25;
  if (a < HALF + 1.5) return base;
  // Flat next to the lobby so hills never poke through the plaza or its fence.
  const out = (a - (HALF + 1.5)) * smooth(2, 40, s);
  const far = Math.max(0, out - 200);
  return base + out * 0.18 + far * 0.25 + Math.sin(s / 23 + dx / 17) * Math.min(1, out / 20) * 3 + Math.sin(s / 90 + dx / 60) * Math.min(1, far / 100) * 40;
}

{
  const r = rng(42);
  for (let s = 30; s < L + 120; s += 9) {
    const downtown = s > 640 && s < 880;
    for (const side of [-1, 1]) {
      if (downtown || r() < 0.22) {
        const off = downtown ? 22 + r() * 10 : 40 + r() * 70;
        const w = 8 + r() * 10;
        const h = downtown ? 20 + r() * 45 : 8 + r() * 22;
        const dx = side * (off + w / 2);
        SCENERY_BUILDINGS.push({
          x: cAt(s) + dx,
          z: -s,
          y: 0,
          w,
          d: 6 + r() * 6,
          h,
          hue: r(),
        });
      }
      if (!downtown) {
        for (let k = 0; k < 5; k++) {
          const off = 16 + r() * 180;
          const dx = side * off;
          SCENERY_TREES.push({ x: cAt(s) + dx, y: 0, z: -s - r() * 8, s: 0.8 + r() * 1.1 });
        }
      }
    }
  }
}

export const TUNNEL = { s0: 636, s1: 700 };

/** Grid shared by the terrain mesh, so props sit on the drawn surface (not the smooth function). */
export const TERRAIN_COLS = [-700, -450, -300, -220, -140, -90, -60, -40, -26, -18, -12, -10.5, -6, 0, 6, 10.5, 12, 18, 26, 40, 60, 90, 140, 220, 300, 450, 700];
export const TERRAIN_DS = 2;
export const TERRAIN_S0 = 0;
/** Height of the rendered terrain mesh at world x,z (bilinear on the mesh grid). */
export function terrainMeshY(x: number, z: number) {
  const s = Math.max(TERRAIN_S0, -z);
  const i = Math.floor((s - TERRAIN_S0) / TERRAIN_DS);
  const s0 = TERRAIN_S0 + i * TERRAIN_DS, s1 = s0 + TERRAIN_DS;
  const f = (s - s0) / TERRAIN_DS;
  const rowY = (rs: number) => {
    const dx = x - cAt(rs);
    const C = TERRAIN_COLS;
    if (dx <= C[0]) return terrainY(rs, C[0]);
    if (dx >= C[C.length - 1]) return terrainY(rs, C[C.length - 1]);
    let j = 0;
    while (C[j + 1] < dx) j++;
    const g = (dx - C[j]) / (C[j + 1] - C[j]);
    return terrainY(rs, C[j]) * (1 - g) + terrainY(rs, C[j + 1]) * g;
  };
  return rowY(s0) * (1 - f) + rowY(s1) * f - 0.05;
}

// Resolve prop heights against the drawn terrain (buildings use their lowest corner).
for (const t of SCENERY_TREES) t.y = terrainMeshY(t.x, t.z) - 0.15;
for (const b of SCENERY_BUILDINGS) {
  b.y = Math.min(terrainMeshY(b.x - b.w / 2, b.z - b.d / 2), terrainMeshY(b.x + b.w / 2, b.z - b.d / 2),
    terrainMeshY(b.x - b.w / 2, b.z + b.d / 2), terrainMeshY(b.x + b.w / 2, b.z + b.d / 2), terrainMeshY(b.x, b.z));
}
