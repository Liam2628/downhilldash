import { carById, type CarStats } from "./data";
import { useGame, useSave } from "./store";
import {
  CONES,
  COINS,
  FINISH,
  HALF,
  L,
  LOOPS,
  PADS,
  padAdd,
  cAt,
  hAt,
  roadYaw,
  sectionAt,
  solidY,
  type Loop,
} from "./track";
import { DAILY_PAD, GATE_HALF, HUB_BOUNDS, HUB_BUILDINGS, HUB_CONES, HUB_SOLIDS, SPAWN } from "./hub";
import { k } from "./input";
import { audio, type CrashKind } from "./audio";

const G = 30;
const TAU = Math.PI * 2;

export const P = {
  x: SPAWN.x,
  y: 0,
  z: SPAWN.z,
  yaw: SPAWN.yaw,
  speed: 0,
  vy: 0,
  grounded: true,
  pitch: 0,
  roll: 0,
  airT: 0,
  tYaw: 0,
  tPitch: 0,
  tRoll: 0,
  takeoffPitch: 0,
  wipe: 0,
  wipeSpin: 0,
  loop: null as null | { lp: Loop; th: number },
  boostT: 0,
  cooldownT: 0,
  cooldownMax: 14,
  boostMax: 2,
  padT: 0,
  combo: 1,
  comboT: 0,
  bestCombo: 1,
  runTime: 0,
  runWheels: 0,
  runTricks: 0,
  lastS: -SPAWN.z,
  boostHeld: false,
  steer: 0,
  wallT: 0,
  hitT: 0,
  topEff: 40,
  boosting: false,
  landFlash: 0,
  snapCam: true,
  shake: 0,
  electric: false,
};

export type ConeState = { x: number; y: number; z: number; vx: number; vz: number; rot: number; tilt: number; home: [number, number] };
function makeCones(): ConeState[] {
  const out: ConeState[] = [];
  for (const cn of CONES) {
    const x = cAt(cn.s) + cn.xo;
    out.push({ x, y: hAt(cn.s), z: -cn.s, vx: 0, vz: 0, rot: 0, tilt: 0, home: [x, -cn.s] });
  }
  for (const [x, z] of HUB_CONES) out.push({ x, y: 0, z, vx: 0, vz: 0, rot: 0, tilt: 0, home: [x, z] });
  return out;
}

export const runState = {
  collected: new Uint8Array(COINS.length),
  usedPads: new Uint8Array(PADS.length),
  cones: makeCones(),
  version: 0,
};

export function resetRun() {
  runState.collected.fill(0);
  runState.usedPads.fill(0);
  // put the track cones back (hub cones stay where you pushed them)
  for (let i = 0; i < CONES.length; i++) {
    const c = runState.cones[i];
    c.x = c.home[0];
    c.z = c.home[1];
    c.vx = c.vz = 0;
    c.tilt = 0;
  }
  runState.version++;
  P.runTime = 0;
  P.runWheels = 0;
  P.runTricks = 0;
  P.combo = 1;
  P.bestCombo = 1;
}

function resetAir() {
  P.tYaw = 0;
  P.tPitch = 0;
  P.tRoll = 0;
  P.airT = 0;
  P.takeoffPitch = 0;
}

export function teleport(x: number, z: number, yaw: number) {
  P.x = x;
  P.z = z;
  P.y = solidY(-z, x).y;
  P.yaw = yaw;
  P.speed = 0;
  P.vy = 0;
  P.grounded = true;
  P.loop = null;
  P.wipe = 0;
  P.wipeSpin = 0;
  P.pitch = 0;
  P.roll = 0;
  P.lastS = -z;
  resetAir();
}

export function returnToLobby() {
  teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
  P.boostT = 0;
  P.cooldownT = 0;
  P.snapCam = true;
  const g = useGame.getState();
  g.setFinish(null);
  g.setMode("hub");
}

export function exitMenu() {
  const g = useGame.getState();
  const b = HUB_BUILDINGS.find((h) => h.id === g.menu);
  g.closeMenu();
  if (b) teleport(b.exit.x, b.exit.z, b.exit.yaw);
  P.snapCam = true;
}

export function currentStats() {
  const s = useSave.getState();
  const def = carById(s.selected);
  const base: CarStats = def.stats;
  const u = s.upgrades;
  const eng = 1 + 0.04 * u.engine;
  return {
    ...base,
    electric: !!def.electric,
    top: base.top * eng,
    accel: base.accel * eng,
    handling: base.handling * (1 + 0.07 * u.grip),
    boostDur: 2 + 0.4 * u.nitro,
    cooldown: Math.max(5, 14 - 0.8 * u.cooler),
    magnet: 2.6 + 0.9 * u.magnet,
  };
}

const wrap = (a: number) => (((a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
const lerpAngle = (a: number, b: number, t: number) => a + wrap(b - a) * t;

export function groundAt(x: number, z: number) {
  return solidY(-z, x).y;
}

function award(n: number) {
  useSave.getState().addWheels(n);
  P.runWheels += n;
}

function wipeout(reason: string, kind: CrashKind, intensity: number) {
  P.wipe = 1.4;
  P.combo = 1;
  P.comboT = 0;
  P.shake = Math.min(1, 0.4 + intensity);
  resetAir();
  audio.crash(kind, intensity);
  useGame.getState().popup("CRASHED!", "bad", reason);
}

/** Impact handler: big hits crash you, small ones bump. */
function impact(kind: CrashKind, impactSpeed: number, reason: string) {
  if (P.hitT > 0) return;
  P.hitT = 0.35;
  const intensity = Math.min(1, impactSpeed / 45);
  if (impactSpeed > 17 && P.wipe <= 0) {
    wipeout(reason, kind, intensity);
    P.speed = -Math.min(6, impactSpeed * 0.15);
  } else {
    audio.crash(kind, intensity * 0.5);
    P.shake = Math.max(P.shake, intensity * 0.4);
    P.speed = -P.speed * 0.25;
  }
}

function land(gy: number, stats: ReturnType<typeof currentStats>) {
  const air = P.airT;
  const impactV = -P.vy;
  P.y = gy;
  P.grounded = true;
  P.vy = 0;
  const tol = 0.8 * stats.landing;
  const yawErr = Math.abs(wrap(P.tYaw));
  const pErr = Math.abs(wrap(P.tPitch));
  const rErr = Math.abs(wrap(P.tRoll));
  const clean = yawErr < tol * 1.15 && pErr < tol && rErr < tol;
  const spins = Math.floor((Math.abs(P.tYaw) + 0.9) / TAU);
  const flips = Math.floor((Math.abs(P.tPitch) + 0.9) / TAU);
  const rolls = Math.floor((Math.abs(P.tRoll) + 0.9) / TAU);
  P.landFlash = Math.min(1, air);

  if (!clean && air > 0.3) {
    // how badly did we land? roof / side / nose
    const kind: CrashKind = pErr > 2.2 || rErr > 2.2 ? "roof" : "landing";
    wipeout(kind === "roof" ? "Landed on the roof!" : "Stick the landing next time", kind, Math.min(1, 0.4 + impactV / 30));
    P.speed *= 0.3;
    return;
  }
  if (air > 0.25) audio.land(Math.min(1, impactV / 25));
  const parts: string[] = [];
  let base = 0;
  if (flips) {
    parts.push((flips > 1 ? `${flips}x ` : "") + (P.tPitch < 0 ? "BACKFLIP" : "FRONTFLIP"));
    base += flips * 18;
  }
  if (spins) {
    parts.push(`${spins * 360}`);
    base += spins * 12;
  }
  if (rolls) {
    parts.push((rolls > 1 ? `${rolls}x ` : "") + "BARREL ROLL");
    base += rolls * 14;
  }
  if (air > 1.1) {
    parts.push(air > 2 ? "HUGE AIR" : "BIG AIR");
    base += Math.floor(air * 4);
  }
  if (base > 0) {
    const reward = Math.round(base * P.combo);
    award(reward);
    P.runTricks += 1;
    const comboTxt = P.combo > 1 ? ` x${P.combo.toFixed(1)}` : "";
    useGame.getState().popup(parts.join(" + "), "hot", `+${reward} wheels${comboTxt}`);
    P.combo = Math.min(5, P.combo + 0.5);
    P.bestCombo = Math.max(P.bestCombo, P.combo);
    P.comboT = 5;
    P.cooldownT = Math.max(0, P.cooldownT - 1.5);
    P.speed += 4;
    audio.play("trick");
  }
  resetAir();
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let hudAcc = 0;
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;
let dailyArmed = true;

/** car footprint sample points (relative to center): front corners, front, rear corners */
const FOOT: [number, number][] = [
  [2.0, 0],
  [1.9, 0.85],
  [1.9, -0.85],
  [-1.9, 0.85],
  [-1.9, -0.85],
];

function footprintBlocked(x: number, z: number, yaw: number, y: number) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (const [f, r] of FOOT) {
    const px = x + fx * f + fz * r;
    const pz = z + fz * f - fx * r;
    const h = solidY(-pz, px);
    // A wheelbase spans the slope ahead of the car. Its raised deck is not a wall.
    // Only a genuinely high side face stops the vehicle.
    if (h.y > y + (h.kind === "ramp" ? 3 : 0.7)) return h.kind ?? "concrete";
  }
  return null;
}

export function step(rawDt: number) {
  const dt = Math.min(rawDt, 0.05);
  const game = useGame.getState();
  const mode = game.mode;

  fpsAcc += rawDt;
  fpsFrames++;
  if (fpsAcc > 0.5) {
    fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
  }

  // paused
  if (game.settingsOpen || game.chestOpen) {
    audio.engine(0, false, false, P.electric);
    return;
  }

  if (mode === "title" || mode === "menu") {
    P.speed = 0;
    audio.engine(0, false, false, P.electric);
    publish(dt, mode);
    return;
  }

  const stats = currentStats();
  P.electric = stats.electric;
  const controls = (mode === "hub" || mode === "run") && P.wipe <= 0;
  P.cooldownMax = stats.cooldown;
  P.boostMax = stats.boostDur;
  P.landFlash = Math.max(0, P.landFlash - dt * 2);
  P.shake = Math.max(0, P.shake - dt * 2);
  P.hitT -= dt;

  // ---------- boost ----------
  const boostKey = controls && k.boost();
  if (boostKey && !P.boostHeld && P.cooldownT <= 0 && P.boostT <= 0) {
    P.boostT = stats.boostDur;
    audio.play("boost");
  }
  P.boostHeld = boostKey;
  if (P.boostT > 0) {
    P.boostT -= dt;
    if (P.boostT <= 0) P.cooldownT = stats.cooldown;
  } else if (P.cooldownT > 0) P.cooldownT -= dt;
  P.padT -= dt;
  P.boosting = P.boostT > 0 || P.padT > 0;
  const topEff = stats.top * (P.boosting ? stats.boost : 1);
  P.topEff = topEff;

  if (P.comboT > 0) {
    P.comboT -= dt;
    if (P.comboT <= 0) P.combo = 1;
  }
  if (mode === "run") P.runTime += dt;

  if (P.loop) {
    stepLoop(dt);
    stepCones(dt);
    publish(dt, mode);
    return;
  }

  if (P.wipe > 0) {
    P.wipe -= dt;
    P.wipeSpin += dt * 9 * Math.max(0.2, P.wipe);
    P.speed *= Math.exp(-2.5 * dt);
    if (P.wipe <= 0) P.wipeSpin = 0;
  }

  const up = controls && k.up();
  const down = controls && k.down();
  const st = controls ? (k.left() ? 1 : 0) - (k.right() ? 1 : 0) : 0;
  P.steer += (st - P.steer) * (1 - Math.exp(-10 * dt));

  if (P.grounded) {
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const gA = groundAt(P.x + fx * 1.5, P.z + fz * 1.5);
    const gB = groundAt(P.x - fx * 1.5, P.z - fz * 1.5);
    const slopeDown = Math.max(-0.6, Math.min(0.6, (gB - gA) / 3));
    let a = G * 0.5 * slopeDown;
    if (up) a += stats.accel * Math.max(0, 1 - P.speed / topEff) * (P.speed < 0 ? 2 : 1);
    if (down) a -= P.speed > 0.5 ? 30 : 9;
    if (P.boosting) a += 26;
    a -= P.speed * 0.05;
    if (!up && !P.boosting) a -= Math.sign(P.speed) * 1.2;
    P.speed += a * dt;
    if (!up && !down && Math.abs(P.speed) < 0.4 && Math.abs(slopeDown) < 0.02) P.speed = 0;
    if (P.speed < -10) P.speed = -10;
    const maxV = topEff * 1.3;
    if (P.speed > maxV) P.speed -= (P.speed - maxV) * 2 * dt;
    if (mode === "finished") P.speed *= Math.exp(-1.4 * dt);

    const sf = Math.min(1, Math.abs(P.speed) / 6) * (1 - 0.35 * Math.min(1, P.speed / 60)) * Math.sign(P.speed || 1);
    P.yaw += P.steer * stats.handling * sf * dt;
  } else {
    P.vy -= G * dt;
    P.speed *= Math.exp(-0.05 * dt);
    if (P.boosting) P.speed += 10 * dt;
    if (controls) {
      P.tYaw += st * stats.air * dt;
      // a little air steering so you can line up landings
      P.yaw += st * stats.handling * 0.35 * dt;
      if (up) P.tPitch += stats.air * 0.85 * dt;
      if (down) P.tPitch -= stats.air * 0.85 * dt;
       if (k.rollL()) P.tRoll -= stats.air * 1.5 * dt;
       if (k.rollR()) P.tRoll += stats.air * 1.5 * dt;
    }
    P.takeoffPitch *= Math.exp(-2.5 * dt);
    P.airT += dt;
  }

  // ---------- integrate ----------
  let nx = P.x + Math.sin(P.yaw) * P.speed * dt;
  let nz = P.z + Math.cos(P.yaw) * P.speed * dt;
  P.wallT -= dt;

  if (nz > 0) {
    // ---- HUB ----
    if (nx < HUB_BOUNDS.minX || nx > HUB_BOUNDS.maxX || nz > HUB_BOUNDS.maxZ) {
      if (Math.abs(P.speed) > 12) impact("wood", Math.abs(P.speed), "Smashed the fence");
      nx = Math.max(HUB_BOUNDS.minX, Math.min(HUB_BOUNDS.maxX, nx));
      nz = Math.min(HUB_BOUNDS.maxZ, nz);
    }
    if (nz < 0.8 && Math.abs(nx) > GATE_HALF - 1.2 && P.z >= 0.8) {
      if (Math.abs(P.speed) > 12) impact("wood", Math.abs(P.speed), "Smashed the fence");
      nz = 0.8;
    }
    for (const b of HUB_BUILDINGS) {
      const r = 1.9;
      const minX = b.center[0] - b.size[0] / 2 - r;
      const maxX = b.center[0] + b.size[0] / 2 + r;
      const minZ = b.center[1] - b.size[2] / 2 - r;
      const maxZ = b.center[1] + b.size[2] / 2 + r;
      if (nx > minX && nx < maxX && nz > minZ && nz < maxZ) {
        const pens = [nx - minX, maxX - nx, nz - minZ, maxZ - nz];
        const m = Math.min(...pens);
        if (m === pens[0]) nx = minX;
        else if (m === pens[1]) nx = maxX;
        else if (m === pens[2]) nz = minZ;
        else nz = maxZ;
        impact(b.id === "dealer" ? "glass" : "concrete", Math.abs(P.speed), "Drove into a building");
      }
    }
    for (const o of HUB_SOLIDS) {
      const dx = nx - o.x;
      const dz = nz - o.z;
      const rr = o.r + 1.7;
      const d = Math.hypot(dx, dz);
      if (d < rr) {
        nx = o.x + (dx / (d || 1)) * rr;
        nz = o.z + (dz / (d || 1)) * rr;
        const kind: CrashKind = o.kind === "tree" ? "wood" : o.kind === "wood" ? "wood" : o.kind === "metal" ? "metal" : "concrete";
        impact(kind, Math.abs(P.speed), o.kind === "tree" ? "Hugged a tree" : o.kind === "metal" ? "T-boned a parked car" : "Ouch!");
      }
    }
  } else {
    // ---- ROAD ----
    const ns = -nz;
    const c = cAt(ns);
    const dx = nx - c;
    const lim = HALF - 1.3;
    if (Math.abs(dx) > lim) {
      nx = c + Math.sign(dx) * lim;
      const ang = Math.abs(wrap(P.yaw - roadYaw(ns)));
      const into = Math.abs(P.speed) * Math.sin(Math.min(ang, Math.PI / 2));
      if (into > 16 && P.grounded) {
        impact("wall", into * 1.3, "Slammed the wall");
      } else {
        if (P.grounded && P.speed > 0) P.yaw = lerpAngle(P.yaw, roadYaw(ns), 0.35);
        P.speed *= 0.985;
        if (P.wallT <= 0 && P.speed > 8) {
          audio.crash("scrape", Math.min(1, into / 16));
          P.wallT = 0.35;
        }
      }
    }
    if (ns > L - 4) {
      nz = -(L - 4);
      P.speed = 0;
    }
  }

  // ---------- solid obstacles: nothing passes through ----------
  const blockedBy = footprintBlocked(nx, nz, P.yaw, P.y);
  if (blockedBy) {
    // If we're already overlapping something (e.g. wedged between ramps), let the car move out.
    const alreadyStuck = footprintBlocked(P.x, P.z, P.yaw, P.y) !== null;
    if (!alreadyStuck) {
      // Try sliding along one axis before stopping dead.
      const slideZ = !footprintBlocked(P.x, nz, P.yaw, P.y);
      const slideX = !footprintBlocked(nx, P.z, P.yaw, P.y);
      const head = Math.abs(P.speed) > 17;
      if (!head && (slideZ || slideX)) {
        if (slideZ) nx = P.x;
        else nz = P.z;
        P.speed *= 0.97;
        if (P.wallT <= 0 && Math.abs(P.speed) > 6) {
          audio.crash("scrape", 0.5);
          P.wallT = 0.35;
        }
      } else {
         const kind: CrashKind = blockedBy === "barrier" ? "barrier" : blockedBy === "pillar" ? "metal" : "concrete";
         impact(kind, Math.abs(P.speed), blockedBy === "barrier" ? "Hit a barrier" : blockedBy === "pillar" ? "Hit the loop pillar" : blockedBy === "ramp" ? "Hit the side of a ramp" : "Hit the road");
        nx = P.x;
        nz = P.z;
      }
    } else if (blockedBy !== "pillar") {
      // Unstick: lift onto whatever we're overlapping so the car isn't wedged.
      const top = Math.max(groundAt(P.x, P.z), P.y);
      P.y = Math.min(top + 0.4, P.y + 6 * dt);
    }
  }

  const gNew = groundAt(nx, nz);
  if (P.grounded) {
    const predicted = P.y + P.vy * dt;
    if (gNew < predicted - 0.3) {
      P.grounded = false;
      P.takeoffPitch = P.pitch;
      P.airT = 0;
      P.tYaw = P.tPitch = P.tRoll = 0;
    } else {
      P.vy = Math.max(-40, Math.min(40, (gNew - P.y) / dt));
      P.y = gNew;
    }
  }
  if (!P.grounded) {
    P.y += P.vy * dt;
    if (P.y <= gNew) land(gNew, stats);
  }
  if (P.y < gNew - 3) {
    P.y = gNew;
    P.grounded = true;
    P.vy = 0;
  }
  P.x = nx;
  P.z = nz;

  if (P.grounded) {
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const gf = groundAt(P.x + fx * 1.6, P.z + fz * 1.6);
    const gb = groundAt(P.x - fx * 1.6, P.z - fz * 1.6);
    const gl = groundAt(P.x + fz * 1, P.z - fx * 1);
    const gr = groundAt(P.x - fz * 1, P.z + fx * 1);
    const clampD = (v: number) => Math.max(-1.2, Math.min(1.2, v));
    const tp = -Math.atan2(clampD(gf - gb), 3.2);
    const tr = Math.atan2(clampD(gl - gr), 2) * 0.5 + P.steer * Math.min(1, P.speed / 40) * 0.05;
    P.pitch += (tp - P.pitch) * (1 - Math.exp(-14 * dt));
    P.roll += (tr - P.roll) * (1 - Math.exp(-10 * dt));
  }

  stepCones(dt);
  const ns = -P.z;
  events(ns, mode, stats, game);
  P.lastS = ns;
  publish(dt, mode);
}

function stepCones(dt: number) {
  const cones = runState.cones;
  const vx = Math.sin(P.yaw) * P.speed;
  const vz = Math.cos(P.yaw) * P.speed;
  for (let i = 0; i < cones.length; i++) {
    const c = cones[i];
    const dz = c.z - P.z;
    if (dz < 25 && dz > -25) {
      const dx = c.x - P.x;
      const d = Math.hypot(dx, dz);
      if (d < 1.9 && c.y < P.y + 1.4 && c.y > P.y - 1.6) {
        const nxv = dx / (d || 1);
        const nzv = dz / (d || 1);
        // push out
        c.x = P.x + nxv * 1.9;
        c.z = P.z + nzv * 1.9;
        const vn = vx * nxv + vz * nzv;
        if (vn > 0) {
          c.vx += nxv * vn * 1.2 + vx * 0.25;
          c.vz += nzv * vn * 1.2 + vz * 0.25;
          if (vn > 4 && c.tilt < 0.1) {
            audio.play("cone");
            P.speed *= 0.97;
          }
        }
      }
    }
    const sp = Math.abs(c.vx) + Math.abs(c.vz);
    if (sp > 0.01) {
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      const fr = Math.exp(-2.2 * dt);
      c.vx *= fr;
      c.vz *= fr;
      c.rot += sp * dt * 0.6;
      c.tilt = Math.min(Math.PI / 2, c.tilt + sp * dt * 0.5);
      // keep in bounds
      if (c.z < 0) {
        const s = -c.z;
        const cc = cAt(s);
        const lim = HALF - 0.6;
        if (Math.abs(c.x - cc) > lim) {
          c.x = cc + Math.sign(c.x - cc) * lim;
          c.vx *= -0.4;
        }
      } else {
        c.x = Math.max(HUB_BOUNDS.minX, Math.min(HUB_BOUNDS.maxX, c.x));
        c.z = Math.min(HUB_BOUNDS.maxZ, c.z);
      }
    } else if (c.tilt > 0 && c.tilt < Math.PI / 2) {
      c.tilt = Math.max(0, c.tilt - dt * 2);
    }
    c.y = solidY(-c.z, c.x).y;
  }
}

function stepLoop(dt: number) {
  const L0 = P.loop!;
  const { lp } = L0;
  P.speed = Math.max(24, P.speed - 14 * Math.sin(L0.th) * dt + (P.boosting ? 20 * dt : 0));
  L0.th += (P.speed / lp.R) * dt;
  const th = Math.min(L0.th, TAU);
  const c = cAt(lp.s);
  P.x = c - 5 + (10 * th) / TAU;
  P.y = hAt(lp.s) + lp.R - lp.R * Math.cos(th);
  P.z = -(lp.s + lp.R * Math.sin(th));
  P.yaw = Math.PI;
  P.pitch = -th;
  P.roll = 0;
  collectCoins(currentStats().magnet);
  if (L0.th >= TAU) {
    P.loop = null;
    P.pitch = 0;
    P.x = c + 5;
    P.z = -(lp.s + 0.6);
    P.y = hAt(lp.s + 0.6);
    P.yaw = roadYaw(lp.s);
    P.grounded = true;
    P.vy = 0;
    P.lastS = lp.s + 0.6;
    const reward = Math.round(25 * P.combo);
    award(reward);
    P.runTricks += 1;
    P.combo = Math.min(5, P.combo + 0.5);
    P.bestCombo = Math.max(P.bestCombo, P.combo);
    P.comboT = 5;
    audio.play("loop");
    useGame.getState().popup("LOOP DE LOOP!", "cool", `+${reward} wheels`);
  }
}

function collectCoins(radius: number) {
  const col = runState.collected;
  for (let i = 0; i < COINS.length; i++) {
    if (col[i]) continue;
    const c = COINS[i];
    const dz = c.z - P.z;
    if (dz > radius + 1 || dz < -radius - 1) continue;
    const dx = c.x - P.x;
    const dy = c.y - (P.y + 0.9);
    if (dx * dx + dy * dy + dz * dz < radius * radius) {
      col[i] = 1;
      award(1);
      audio.play("coin");
    }
  }
}

function events(ns: number, mode: string, stats: ReturnType<typeof currentStats>, game: ReturnType<typeof useGame.getState>) {
  if (mode === "hub") {
    let hint: string | null = null;
    for (const b of HUB_BUILDINGS) {
      const t = b.trigger;
      const dx = Math.abs(P.x - t.x);
      const dz = Math.abs(P.z - t.z);
      if (dx < t.hx && dz < t.hz) {
        audio.play("ui");
        P.speed = 0;
        P.x = t.x;
        P.z = t.z;
        P.yaw = b.exit.yaw + Math.PI;
        P.snapCam = false;
        game.openMenu(b.id);
        return;
      }
      if (dx < t.hx + 12 && dz < t.hz + 12) hint = `Drive in to enter the ${b.label}`;
    }
    const dp = Math.hypot(P.x - DAILY_PAD.x, P.z - DAILY_PAD.z);
    const claimed = useSave.getState().lastDaily === todayKey();
    if (dp < DAILY_PAD.r) {
      if (!claimed && dailyArmed) {
        dailyArmed = false;
        P.speed = 0;
        audio.play("ui");
        game.setChestOpen(true);
      } else if (claimed) hint = "Daily reward claimed — come back tomorrow";
    } else {
      dailyArmed = true;
      if (dp < DAILY_PAD.r + 8 && !claimed) hint = "Daily reward ready! Drive onto the pad";
    }
    if (!hint && P.z < 14) hint = "Drive through the gate to start the run";
    game.setHint(hint);

    if (P.lastS < 2 && ns >= 2) {
      resetRun();
      game.setMode("run");
      game.setHint(null);
      game.popup("GO GO GO!", "hot", "Collect wheels · Hit ramps · Do tricks");
    }
    return;
  }

  if (mode === "run") {
    if (ns < 0) {
      game.setMode("hub");
      game.popup("RUN CANCELLED", "bad");
      return;
    }
    collectCoins(stats.magnet);
    const dxc = P.x - cAt(ns);

    for (let i = 0; i < PADS.length; i++) {
      const p = PADS[i];
      if (runState.usedPads[i]) continue;
      const start = p.s - p.len / 2;
      if (ns >= start && ns <= start + p.len && Math.abs(dxc - p.xo) < p.w / 2 &&
          (P.grounded || Math.abs(P.y - (hAt(ns) + padAdd(ns, dxc))) < 1.6)) {
        runState.usedPads[i] = 1;
        audio.play("pad");
        game.popup("BOOST RAMP", "cool");
        P.padT = 1.5;
        P.speed = Math.max(P.speed, P.topEff * 1.05);
      }
    }
    if (P.grounded) {
      for (const lp of LOOPS) {
        if (P.lastS < lp.s && ns >= lp.s) {
          P.loop = { lp, th: 0 };
          P.speed = Math.max(P.speed, 26);
        }
      }
    }

    if (ns >= FINISH) {
      const time = P.runTime;
      const bonus = 50 + Math.max(0, Math.round((90 - time) * 3));
      award(bonus);
      const isBest = useSave.getState().recordRun(time, P.runTricks);
      audio.play("finish");
      game.setMode("finished");
      game.setFinish({ time, wheels: P.runWheels, tricks: P.runTricks, bestCombo: P.bestCombo, isBest, bonus });
    }
  }
}

function publish(dt: number, mode: string) {
  const speed01 = Math.min(1, Math.abs(P.speed) / 60);
  if (mode !== "title" && mode !== "menu") audio.engine(speed01, P.boosting, true, P.electric);
  hudAcc += dt;
  if (hudAcc < 0.08) return;
  hudAcc = 0;
  const s = -P.z;
  let boostState: "ready" | "active" | "cooldown" = "ready";
  let boostFrac = 1;
  if (P.boostT > 0) {
    boostState = "active";
    boostFrac = P.boostT / P.boostMax;
  } else if (P.cooldownT > 0) {
    boostState = "cooldown";
    boostFrac = 1 - P.cooldownT / P.cooldownMax;
  }
  useGame.getState().setHud({
    speed: Math.abs(P.speed),
    boostState,
    boostFrac,
    progress: Math.max(0, Math.min(1, s / FINISH)),
    time: P.runTime,
    combo: P.combo,
    section: s > 0 ? sectionAt(s) : "LOBBY",
    runWheels: P.runWheels,
    fps,
  });
}
