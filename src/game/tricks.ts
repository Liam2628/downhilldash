/**
 * Trick recognition. Rotation on each axis is fed in as raw deltas; every net half
 * turn (π) on an axis emits one "unit". Reversing direction subtracts from the
 * pending progress, so wiggling never counts twice. Units are grouped into tricks;
 * a trick interrupted halfway by a different trick still scores as a transition.
 * Add new tricks by extending SINGLE / COMBOS below.
 */
export type Axis = "pitch" | "roll" | "yaw";
export type Unit = { axis: Axis; dir: 1 | -1; t: number };

const HALF = Math.PI;
const SIMUL = 0.35; // seconds: units on two axes this close are a combined trick

/** Name per axis/direction; value is points per full rotation. */
export const SINGLE: Record<string, { name: string; pts: number }> = {
  "pitch+": { name: "FRONTFLIP", pts: 18 },
  "pitch-": { name: "BACKFLIP", pts: 18 },
  "roll+": { name: "RIGHT BARREL ROLL", pts: 14 },
  "roll-": { name: "LEFT BARREL ROLL", pts: 14 },
  "yaw+": { name: "LEFT SPIN", pts: 12 },
  "yaw-": { name: "RIGHT SPIN", pts: 12 },
};

/** Two axes rotating together. Key = sorted axis keys joined by "&". */
export const COMBOS: Record<string, { name: string; pts: number }> = {
  "pitch+&yaw+": { name: "FRONT CORK", pts: 34 },
  "pitch+&yaw-": { name: "FRONT CORK", pts: 34 },
  "pitch-&yaw+": { name: "BACK CORK", pts: 36 },
  "pitch-&yaw-": { name: "BACK CORK", pts: 36 },
  "pitch+&roll+": { name: "FRONT MISTY", pts: 32 },
  "pitch+&roll-": { name: "FRONT MISTY", pts: 32 },
  "pitch-&roll+": { name: "RODEO", pts: 34 },
  "pitch-&roll-": { name: "RODEO", pts: 34 },
  "roll+&yaw+": { name: "TWISTER", pts: 28 },
  "roll+&yaw-": { name: "TWISTER", pts: 28 },
  "roll-&yaw+": { name: "TWISTER", pts: 28 },
  "roll-&yaw-": { name: "TWISTER", pts: 28 },
};
export const TRIPLE = { name: "CHAOS ORBIT", pts: 60 };
const TRANSITION_PTS = 8;

const key = (u: { axis: Axis; dir: number }) => `${u.axis}${u.dir > 0 ? "+" : "-"}`;
const spinDeg = (halves: number) => `${halves * 180}`;

export class TrickTracker {
  acc: Record<Axis, number> = { pitch: 0, roll: 0, yaw: 0 };
  units: Unit[] = [];
  t = 0;

  reset() {
    this.acc = { pitch: 0, roll: 0, yaw: 0 };
    this.units = [];
    this.t = 0;
  }

  feed(axis: Axis, delta: number) {
    let a = this.acc[axis] + delta;
    while (a >= HALF) { this.units.push({ axis, dir: 1, t: this.t }); a -= HALF; }
    while (a <= -HALF) { this.units.push({ axis, dir: -1, t: this.t }); a += HALF; }
    this.acc[axis] = a;
  }

  tick(dt: number) { this.t += dt; }

  /** Collapse units into ordered tricks; returns display names, points and counts. */
  evaluate() {
    type Seg = { keys: string[]; halves: number };
    const segs: Seg[] = [];
    // group: consecutive units of the same key, or overlapping-in-time units of different axes
    for (const u of this.units) {
      const k = key(u);
      const last = segs[segs.length - 1];
      const lastT = (last as Seg & { t?: number })?.t ?? -9;
      if (last && last.keys.includes(k)) { last.halves++; (last as Seg & { t?: number }).t = u.t; continue; }
      if (last && u.t - lastT <= SIMUL && !last.keys.some((x) => x.startsWith(u.axis))) {
        last.keys.push(k); (last as Seg & { t?: number }).t = u.t; continue;
      }
      const s: Seg & { t?: number } = { keys: [k], halves: 1, t: u.t };
      segs.push(s);
    }
    const parts: string[] = [];
    let pts = 0;
    let transitions = 0;
    const counts = { flips: 0, backflips: 0, rolls: 0, spins: 0 };
    segs.forEach((s, i) => {
      const full = Math.floor(s.halves / 2);
      const half = s.halves % 2 === 1;
      const followed = i < segs.length - 1;
      if (full === 0 && !(half && followed)) return; // a lone half turn isn't a trick
      let def: { name: string; pts: number };
      if (s.keys.length >= 3) def = TRIPLE;
      else if (s.keys.length === 2) def = COMBOS[[...s.keys].sort().join("&")] ?? TRIPLE;
      else def = SINGLE[s.keys[0]];
      const isSpin = s.keys.length === 1 && s.keys[0].startsWith("yaw");
      const n = full + (half ? 0.5 : 0);
      let label = isSpin ? `${spinDeg(s.halves)} ${def.name}` : (full > 1 ? `${full}x ` : "") + (full === 0 ? "HALF " : "") + def.name + (half && full > 0 ? " ½" : "");
      if (half && followed) { label += " →"; transitions++; }
      parts.push(label);
      pts += Math.round(def.pts * Math.max(0.5, n));
      for (const k of s.keys) {
        if (k.startsWith("pitch")) { counts.flips += full; if (k === "pitch-") counts.backflips += full; }
        if (k.startsWith("roll")) counts.rolls += full;
        if (k.startsWith("yaw")) counts.spins += full;
      }
    });
    const distinct = new Set(segs.map((s) => s.keys.join("&"))).size;
    if (parts.length >= 3) parts.unshift(`${parts.length}-TRICK CHAIN:`);
    pts += transitions * TRANSITION_PTS;
    const chainMult = 1 + Math.max(0, distinct - 1) * 0.25;
    return { parts, pts: Math.round(pts * chainMult), transitions, counts };
  }
}
