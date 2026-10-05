// Track math: the downhill road is a function of distance s (s = -z).
export const FINISH = 1600;
export const L = 1680; // end of road (runout)
export const HALF = 10; // half road width
const N = L + 260;

export type Ramp = { s: number; len: number; h: number; xo: number; w: number };
export type Loop = { s: number; R: number };
export type Pad = { s: number; xo: number; len: number; h: number; w: number };
export type Cone = { s: number; xo: number };
export type Barrier = { s: number; xo: number; w: number };
export type Coin = { x: number; y: number; z: number };

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
  for (const lp of LOOPS) env *= smooth(35, 75, Math.abs(s - lp.s));
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
  { s: 900, len: 28, h: 7.5, xo: 0, w: 19 },
  { s: 1185, len: 12, h: 2.6, xo: 0, w: 16 },
  { s: 1380, len: 14, h: 3.5, xo: -4.5, w: 9 },
  { s: 1420, len: 16, h: 4, xo: 4.5, w: 9 },
  { s: 1490, len: 24, h: 6.5, xo: 0, w: 19 },
];

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
    const start = p.s - p.len / 2;
    if (s >= start && s <= start + p.len && Math.abs(dx - p.xo) <= p.w / 2) {
      const t = (s - start) / p.len;
      return p.h * t * t;
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
    if (Math.abs(s - b.s) < 0.75 && Math.abs(dx - b.xo) < b.w / 2) return { y: hAt(b.s) + 1.2, kind: "barrier" };
  }
  for (const lp of LOOPS) {
    if (Math.abs(s - lp.s) < 0.6 && Math.abs(Math.abs(dx) - 9) < 0.6) return { y: base + 99, kind: "pillar" };
  }
  return { y: base, kind: rampAdd(s, dx) > 0 || padAdd(s, dx) > 0 ? "ramp" : null };
}

export const PADS: Pad[] = [
  { s: 130, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 335, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 580, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 705, xo: -4, len: 7, h: 1.2, w: 5 },
  { s: 868, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 1165, xo: 0, len: 7, h: 1.2, w: 5 },
  { s: 1265, xo: 0, len: 7, h: 1.2, w: 5 },
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

export const BARRIERS: Barrier[] = [];
{
  const r = rng(7);
  const lanes = [-6.5, 0, 6.5];
  for (let s = 1010; s < 1160; s += 20) {
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
  const base = hAt(Math.max(0, s)) - 0.25;
  if (a < HALF + 1.5) return base;
  const out = a - (HALF + 1.5);
  return base + out * 0.18 + Math.sin(s / 23 + dx / 17) * Math.min(1, out / 20) * 3;
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
          y: terrainY(s, side * off),
          w,
          d: 6 + r() * 6,
          h,
          hue: r(),
        });
      }
      if (!downtown) {
        for (let k = 0; k < 2; k++) {
          const off = 16 + r() * 90;
          const dx = side * off;
          SCENERY_TREES.push({ x: cAt(s) + dx, y: terrainY(s, dx), z: -s - r() * 8, s: 0.8 + r() * 1.1 });
        }
      }
    }
  }
}

export const TUNNEL = { s0: 636, s1: 700 };
