import { carById, type CarStats } from "./data";
import { useGame, useSave } from "./store";
import {
  BARRIERS,
  BARRIER_DEPTH,
  BARRIER_HEIGHT,
  LOOP_WIDTH,
  LOOP_RAIL_RADIUS,
  LOOP_RAIL_HEIGHT,
  loopPoint,
  loopContact,
  loopSweep,
  surfaceY,
  CONES,
  COINS,
  FINISH,
  HALF,
  ensureTrack,
  LOOPS,
  PADS,
  MEGAS,
  padAdd,
  cAt,
  hAt,
  roadYaw,
  sectionAt,
  solidY,
  type Loop,
} from "./track";
import { DAILY_PAD, GATE_HALF, HUB_BOUNDS, TEST_BOUNDS, TEST_TRACK, HUB_BUILDINGS, HUB_CONES, HUB_SOLIDS, SPAWN } from "./hub";
import { k, doubleTap, keys } from "./input";
import { TrickTracker } from "./tricks";
import { QUESTS, SPLITS, loadSplitPB, questProgress, questsNewRun, saveSplitPB } from "./quests";
import { audio, type CrashKind } from "./audio";

const G = 30;
const TAU = Math.PI * 2;
const BRAKE = 38;
const REVERSE_ACCEL = 12;
const REVERSE_TOP = 10;
const ROAD_GRIP = 11;
const DRIFT_GRIP = 2.8;
const AIR_LEVEL_RATE = 7;
const BARRIER_OVER_SPEED = 28;
const MAX_LAUNCH_VY = 16;

export const P = {
  x: SPAWN.x,
  y: 0,
  z: SPAWN.z,
  yaw: SPAWN.yaw,
  speed: 0,
  lateral: 0,
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
  loop: null as null | { lp: Loop; th: number; offset: number; heading: number },
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
  loopCamera: 0,
  loopFallT: 0,
  snapCam: true,
  shake: 0,
  electric: false,
};

export type ConeState = { x: number; y: number; z: number; vx: number; vz: number; rot: number; tilt: number; home: [number, number]; away?: number };
function makeCones(): ConeState[] {
  // Hub cones first; generated track cones are appended as chunks appear.
  const out: ConeState[] = [];
  for (const [x, z] of HUB_CONES) out.push({ x, y: 0, z, vx: 0, vz: 0, rot: 0, tilt: 0, home: [x, z] });
  return out;
}
const TRACK_CONE0 = HUB_CONES.length;

/** Keep per-run state arrays in step with the endlessly generated track. */
export function syncGenerated() {
  while (runState.collected.length < COINS.length) runState.collected.push(0);
  while (runState.usedPads.length < PADS.length) runState.usedPads.push(0);
  while (runState.usedMegas.length < MEGAS.length) { runState.usedMegas.push(0); runState.megaHitAt.push(0); }
  while (runState.cones.length - TRACK_CONE0 < CONES.length) {
    const cn = CONES[runState.cones.length - TRACK_CONE0];
    const x = cAt(cn.s) + cn.xo;
    runState.cones.push({ x, y: hAt(cn.s), z: -cn.s, vx: 0, vz: 0, rot: 0, tilt: 0, home: [x, -cn.s] });
  }
}

export const MEGA_RADIUS = 2.8;
export const MEGA_LAUNCH_VY = 30;

export const runState = {
  collected: [] as number[],
  usedPads: [] as number[],
  usedMegas: [] as number[],
  megaHitAt: [] as number[],
  cones: makeCones(),
  version: 0,
};

export function resetRun() {
  runState.collected.fill(0);
  runState.usedPads.fill(0);
  runState.usedMegas.fill(0);
  // put the track cones back (hub cones stay where you pushed them)
  for (let i = TRACK_CONE0; i < runState.cones.length; i++) {
    const c = runState.cones[i];
    c.x = c.home[0];
    c.z = c.home[1];
    c.vx = c.vz = 0;
    c.tilt = 0;
  }
  runState.version++;
  runBackflips = 0;
  questsNewRun();
  splitPB = loadSplitPB();
  splitNow = [];
  P.runTime = 0;
  finishMilestonePassed = false;
  P.runWheels = 0;
  P.runTricks = 0;
  P.combo = 1;
  P.bestCombo = 1;
}

const tricks = new TrickTracker();
function resetAir() {
  tricks.reset();
  P.tYaw = 0;
  P.tPitch = 0;
  P.tRoll = 0;
  P.airT = 0;
  P.takeoffPitch = 0;
  autoFlip = 0; autoRoll = 0;
}
let autoRoll = 0;
let autoFlip = 0; // radians of automatic flip left (sign = direction)
let runBackflips = 0;
let splitPB: number[] = [];
let splitNow: number[] = [];

export function teleport(x: number, z: number, yaw: number) {
  P.x = x;
  P.z = z;
  P.y = solidY(-z, x).y;
  P.yaw = yaw;
  P.speed = 0;
  P.lateral = 0;
  P.steer = 0;
  P.hitT = 0;
  P.padT = 0;
  P.vy = 0;
  P.grounded = true;
  P.loop = null;
  P.loopCamera = 0;
  P.loopFallT = 0;
  P.wipe = 0;
  P.wipeSpin = 0;
  P.pitch = 0;
  P.roll = 0;
  P.lastS = -z;
  resetAir();
}

export const MILESTONE_S = 1000;
let finishMilestonePassed = false;

export function returnToLobby() {
  useGame.getState().setMilestone(null);
  useGame.getState().setTestCar(null);
  teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
  P.boostT = 0;
  P.cooldownT = 0;
  P.snapCam = true;
  const g = useGame.getState();
  g.setFinish(null);
  g.setMode("hub");
}

export function startTestDrive(id: string) {
  const g = useGame.getState();
  g.closeMenu();
  g.setTestCar(id);
  teleport(TEST_TRACK.x, TEST_TRACK.z - TEST_TRACK.rz, Math.PI / 2);
  P.speed = 0;
  P.boostT = 0;
  P.cooldownT = 0;
  P.snapCam = true;
  g.popup("TEST DRIVE", "cool", "Practice track · Esc to finish");
}

export function endTestDrive() {
  const g = useGame.getState();
  const id = g.testCar;
  if (!id) return;
  g.setTestCar(null);
  const b = HUB_BUILDINGS.find((h) => h.id === "dealer")!;
  P.speed = 0;
  teleport(b.trigger.x, b.trigger.z, b.exit.yaw + Math.PI);
  P.snapCam = true;
  g.openMenu("dealer");
  g.setPreview(id);
}

export function exitMenu() {
  const g = useGame.getState();
  const b = HUB_BUILDINGS.find((h) => h.id === g.menu);
  g.closeMenu();
  if (b) teleport(b.exit.x, b.exit.z, b.exit.yaw);
  P.snapCam = true;
}

function gravityScale() {
  const s = useSave.getState();
  return s.cheatsUnlocked && s.cheats.moonGravity ? 0.4 : 1;
}

export function currentStats() {
  const s = useSave.getState();
  const def = carById(useGame.getState().testCar ?? s.selected);
  const base: CarStats = def.stats;
  const u = def.elite ? { engine: 5, nitro: 5, cooler: 5, grip: 5, magnet: 5, suspension: 5, aero: 5 } : s.upgrades;
  const special = def.special;
  const eng = 1 + 0.04 * u.engine;
  const ch = s.cheatsUnlocked ? s.cheats : null;
  const spd = ch?.superSpeed ? 2 : 1;
  return {
    ...base,
    electric: !!def.electric,
    top: base.top * eng * (1 + 0.02 * u.aero) * (ch?.superSpeed ? 1.5 : 1),
    accel: base.accel * eng * spd,
    handling: base.handling * (1 + 0.07 * u.grip),
    landing: base.landing * (1 + 0.08 * u.suspension),
    boostDur: 2 + 0.4 * u.nitro + (special?.boostSeconds ?? 0),
    cooldown: ch?.unlimitedBoost ? 0 : Math.max(5, 14 - 0.8 * u.cooler) * (special?.recharge ?? 1),
    magnet: 2.6 + 0.9 * u.magnet + (special?.magnet ?? 0),
    airLevel: (1 + 0.12 * u.aero) * (special?.airAssist ?? 1),
    traction: (1 + 0.07 * u.grip) * (special?.traction ?? 1),
    trickReward: special?.reward ?? 1,
  };
}

const wrap = (a: number) => (((a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
const lerpAngle = (a: number, b: number, t: number) => a + wrap(b - a) * t;

export function groundAt(x: number, z: number) {
  return surfaceY(-z, x);
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

function questDone(q: (typeof QUESTS)[number] | null) {
  if (!q) return;
  award(q.reward);
  useGame.getState().popup("QUEST COMPLETE!", "cool", `${q.label} · +${q.reward} wheels`);
}

function land(gy: number, stats: ReturnType<typeof currentStats>) {
  const air = P.airT;
  const impactV = -P.vy;
  P.y = gy;
  P.grounded = true;
  P.vy = 0;
  const tol = 0.8 * stats.landing;
  const yawErr = Math.abs(wrap(P.tYaw));
  const pErr = Math.abs(wrap(P.takeoffPitch + P.tPitch));
  const rErr = Math.abs(wrap(P.roll + P.tRoll));
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
  void spins; void flips; void rolls;
  const ev = tricks.evaluate();
  const parts: string[] = [...ev.parts];
  let base = ev.pts;
  if (ev.counts.backflips) { runBackflips += ev.counts.backflips; questDone(questProgress("backflips", runBackflips)); }
  if (air > 1.1) {
    parts.push(air > 2 ? "HUGE AIR" : "BIG AIR");
    base += Math.floor(air * 4);
  }
  // XP: one grant per landing, from trick complexity only (air time excluded), separate from wheels.
  const xp = ev.pts > 0 ? Math.round(ev.pts * (1 + (P.combo - 1) * 0.5)) : 0;
  if (xp) useSave.getState().addXp(xp);
  if (base > 0) {
    const reward = Math.round(base * P.combo * stats.trickReward);
    award(reward);
    P.runTricks += 1;
    const comboTxt = P.combo > 1 ? ` x${P.combo.toFixed(1)}` : "";
    useGame.getState().popup(parts.join(" + "), "hot", `+${reward} wheels${xp ? ` · +${xp} XP` : ""}${comboTxt}`);
    P.combo = Math.min(5, P.combo + 0.5);
    P.bestCombo = Math.max(P.bestCombo, P.combo);
    questDone(questProgress("combo", P.combo));
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
  for (const [f, r] of FOOT) {
    const px = x + Math.sin(yaw) * f + Math.cos(yaw) * r;
    const pz = z + Math.cos(yaw) * f - Math.sin(yaw) * r;
    for (const lp of LOOPS) {
      const base = hAt(lp.s);
      if (y > base + lp.R * 2 + 1 || y + 1.4 < base - 1) continue;
      if (Math.abs(pz + lp.s) < 0.4 && Math.abs(Math.abs(px - cAt(lp.s)) - 9) < 0.4) return "pillar";
      if (Math.abs(pz + lp.s) < 0.4 && Math.abs(px - cAt(lp.s)) < 9.5 &&
          y + 1.4 > base + lp.R * 2 + 1.4 && y < base + lp.R * 2 + 2.2) return "pillar";
    }
  }
  return null;
}

// Bounded substeps keep narrow decks, barrier noses and supports from being skipped.
export function step(rawDt: number) {
  const elapsed = Math.max(0, Math.min(rawDt, 0.05));
  ensureTrack(Math.max(0, -P.z));
  syncGenerated();
  if (freeMove(elapsed)) return;
  const count = Math.max(1, Math.ceil(elapsed / (1 / 120)));
  for (let i = 0; i < count; i++) stepPhysics(elapsed / count);
}

function collideLoopDeck(nx: number, nz: number, dt: number) {
  P.loopFallT = Math.max(0, P.loopFallT - dt);
  for (const lp of LOOPS) {
    if (Math.abs(-nz - lp.s) > lp.R + 3) continue;
    const nextY = P.y + P.vy * dt;
    const before = loopContact(lp, P.x, P.y, P.z);
    const after = loopContact(lp, nx, nextY, nz);
    const railDistance = Math.hypot(Math.abs(after.offset) - LOOP_WIDTH / 2, after.radial + LOOP_RAIL_HEIGHT);
    if (railDistance < LOOP_RAIL_RADIUS + 0.2 &&
        Math.abs(before.offset) < Math.abs(after.offset)) {
      impact("metal", Math.abs(P.lateral) + Math.abs(P.speed) * 0.3, "Hit the loop rail");
      P.lateral = 0; return true;
    }
    const hit = loopSweep(lp, P, { x: nx, y: nextY, z: nz });
    // The downhill approach sits slightly above the loop's tangent point. Sweep
    // the entry seam too, rather than requiring an exact circle intersection.
    const entrySeam = -P.z <= lp.s && -nz >= lp.s &&
      Math.abs(nextY - hAt(lp.s)) < 0.5 && Math.abs(after.offset) <= LOOP_WIDTH / 2;
    const crossing = hit !== null || entrySeam || (Math.abs(after.radial) < 0.03 && Math.abs(after.offset) <= LOOP_WIDTH / 2);
    const entering = after.th < 1.45 && -nz > -P.z && P.speed > 8;
    if (crossing && entering && P.loopFallT <= 0) {
      P.loop = { lp, th: after.th, offset: Math.max(-3.3, Math.min(3.3, after.offset)),
        heading: wrap(P.yaw - Math.PI) };
      P.speed = Math.max(12, P.speed * Math.max(0.5, Math.cos(P.loop.heading)));
      P.grounded = true; P.vy = 0; resetAir();
      const point = loopPoint(lp, after.th, P.loop.offset);
      P.x = point.x; P.y = point.y; P.z = point.z;
      return true;
    }
    // Any other crossing hits the actual deck (including its underside), not an invisible box.
    if (hit && Math.abs(after.radial - before.radial) > 0.001 &&
        hit.th > 0.12 && hit.th < TAU - 0.15) {
      // Only suppress immediate re-contact at the release point, not the entire loop.
      if (P.loopFallT > 1.1 && hit.t < 0.05) continue;
      impact("metal", Math.abs(P.speed), "Hit the loop deck");
      P.vy = -P.vy * 0.2; P.lateral *= 0.4;
      return true;
    }
  }
  return false;
}

function stepPhysics(rawDt: number) {
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
  if (game.settingsOpen || game.chestOpen || (game.milestone && mode === "run")) {
    audio.engine(0, false, false, P.electric);
    return;
  }

  if (mode === "title" || mode === "menu") {
    P.speed = 0;
    audio.engine(0, false, false, P.electric);
    publish(dt, mode);
    return;
  }

  // Recover before collision/ground snapping can disguise an invalid position.
  const sNow = -P.z;
  if (![P.x, P.y, P.z, P.speed, P.lateral].every(Number.isFinite) ||
      P.y < hAt(Math.max(0, sNow)) - 18 ||
      (P.z <= 0 && (Math.abs(P.x - cAt(sNow)) > HALF + 35)) ||
      (P.z > 0 && !game.testCar && (Math.abs(P.x) > 100 || P.z > HUB_BOUNDS.maxZ + 30)) ||
      (game.testCar && (P.x < TEST_BOUNDS.minX - 20 || P.x > TEST_BOUNDS.maxX + 20 || P.z < TEST_BOUNDS.minZ - 20 || P.z > TEST_BOUNDS.maxZ + 20))) {
    returnToLobby();
    game.popup("BACK ON TRACK", "cool");
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
  // Real downhill acceleration and travel speed, not a speedometer multiplier.
  const topEff = stats.top * (mode === "run" ? 1.15 : 1) * (P.boosting ? stats.boost : 1);
  P.topEff = topEff;

  if (P.comboT > 0) {
    P.comboT -= dt;
    if (P.comboT <= 0) P.combo = 1;
  }
  if (mode === "run") P.runTime += dt;

  if (mode === "run" && -P.z < 8 && k.down() && P.speed < 3) {
    teleport(Math.max(-GATE_HALF + 2, Math.min(GATE_HALF - 2, P.x)), 4, Math.PI);
    game.setMode("hub"); game.popup("RUN CANCELLED", "bad");
    return;
  }

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
    P.lateral *= Math.exp(-6 * dt);
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
    if (up && !down) a += stats.accel * (mode === "run" ? 1.35 : 1) * Math.max(0, 1 - P.speed / topEff) * (P.speed < 0 ? 2 : 1);
    if (down) {
      // S brakes to zero on the slope. In the lobby, continuing to hold S reverses.
      a = P.speed > 0 ? -BRAKE : mode === "run" ? 0 : -REVERSE_ACCEL;
    }
    if (P.boosting && !down) a += 26;
    a -= P.speed * 0.05;
    if (!up && !P.boosting) a -= Math.sign(P.speed) * 1.2;
    const wasForward = P.speed > 0;
    P.speed += a * dt;
    if (down && wasForward && P.speed < 0) P.speed = 0;
    if (mode === "run") P.speed = Math.max(0, P.speed);
    if (!up && !down && Math.abs(P.speed) < 0.4 && Math.abs(slopeDown) < 0.02) P.speed = 0;
    if (P.speed < -REVERSE_TOP) P.speed = -REVERSE_TOP;
    const maxV = topEff * 1.3;
    if (P.speed > maxV) P.speed -= (P.speed - maxV) * 2 * dt;
    if (mode === "finished") P.speed *= Math.exp(-1.4 * dt);

    const sf = Math.max(-1, Math.min(1, P.speed / 8)) * (1 - 0.35 * Math.min(1, Math.abs(P.speed) / 60));
    const turn = P.steer * stats.handling * sf * dt;
    P.yaw += turn;
    // Preserve momentum while the body turns, then regain lateral traction.
    const oldSpeed = P.speed;
    P.speed = oldSpeed * Math.cos(turn) + P.lateral * Math.sin(turn);
    P.lateral = P.lateral * Math.cos(turn) - oldSpeed * Math.sin(turn);
    const drift = Math.max(0, Math.min(1, (Math.abs(P.speed) - 22) / 18)) * Math.abs(P.steer);
    const grip = (ROAD_GRIP + (DRIFT_GRIP - ROAD_GRIP) * drift) * stats.traction;
    P.lateral *= Math.exp(-grip * dt);
    if (Math.abs(P.speed) < 0.1) P.lateral *= Math.exp(-12 * dt);
  } else {
    P.vy -= G * gravityScale() * dt;
    P.speed *= Math.exp(-0.05 * dt);
    if (P.boosting) P.speed += 10 * dt;
    if (controls) {
      const p0 = P.tPitch, r0 = P.tRoll, y0 = P.tYaw;
      // a little air steering so you can line up landings
      P.yaw += st * stats.handling * 0.35 * dt;
      // Double-tap starts a full rotation; tapping again mid-trick switches into the new one.
      if (doubleTap("up")) { autoFlip = TAU; audio.play("trick"); }
      if (doubleTap("down")) { autoFlip = -TAU; audio.play("trick"); }
      if (autoFlip !== 0) {
        const stepA = Math.min(Math.abs(autoFlip), (TAU / 0.8) * dt) * Math.sign(autoFlip);
        P.tPitch += stepA; autoFlip -= stepA;
        if (Math.abs(autoFlip) < 1e-4) autoFlip = 0;
      }
      if (doubleTap("left")) { autoRoll = -TAU; audio.play("trick"); }
      if (doubleTap("right")) { autoRoll = TAU; audio.play("trick"); }
      if (autoRoll !== 0) {
        const stepR = Math.min(Math.abs(autoRoll), (TAU / 0.7) * dt) * Math.sign(autoRoll);
        P.tRoll += stepR; autoRoll -= stepR;
        if (Math.abs(autoRoll) < 1e-4) autoRoll = 0;
      }
      // Release trick keys to ease toward the nearest full rotation; F levels faster.
      // Full turns are preserved so landing assistance does not erase trick rewards.
      const assist = k.level();
      const ease = 1 - Math.exp(-(assist ? AIR_LEVEL_RATE : 2.2) * stats.airLevel * dt);
      if (autoFlip === 0) {
        const angle = P.takeoffPitch + P.tPitch;
        P.tPitch += (Math.round(angle / TAU) * TAU - angle) * ease;
      }
      if (autoRoll === 0) {
        const angle = P.roll + P.tRoll;
        P.tRoll += (Math.round(angle / TAU) * TAU - angle) * ease;
      }
      P.tYaw += (Math.round(P.tYaw / TAU) * TAU - P.tYaw) * ease;
      if (assist) {
        P.speed *= Math.exp(-0.65 * dt);
        P.lateral *= Math.exp(-5 * dt);
      }
      tricks.feed("pitch", P.tPitch - p0);
      tricks.feed("roll", P.tRoll - r0);
      tricks.feed("yaw", P.tYaw - y0);
    }
    tricks.tick(dt);
    P.airT += dt;
  }

  // ---------- integrate ----------
  let nx = P.x + (Math.sin(P.yaw) * P.speed + Math.cos(P.yaw) * P.lateral) * dt;
  let nz = P.z + (Math.cos(P.yaw) * P.speed - Math.sin(P.yaw) * P.lateral) * dt;
  // This course is the downhill-only Slope; the lobby retains normal reverse driving.
  if (mode === "run" && nz > P.z) {
    nz = P.z;
    P.speed = 0;
    P.lateral = 0;
    P.yaw = lerpAngle(P.yaw, roadYaw(-P.z), 1 - Math.exp(-4 * dt));
  }
  P.wallT -= dt;

  if (game.testCar) {
    // ---- TEST TRACK (fenced, never leads to the run) ----
    const B = TEST_BOUNDS;
    if (nx < B.minX || nx > B.maxX || nz < B.minZ || nz > B.maxZ) {
      if (Math.abs(P.speed) > 12) impact("wood", Math.abs(P.speed), "Smashed the fence");
      nx = Math.max(B.minX, Math.min(B.maxX, nx));
      nz = Math.max(B.minZ, Math.min(B.maxZ, nz));
    }
  } else if (nz > 0) {
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
      const r = 1.1;
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
      const rr = o.r + 1.0;
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
    const lim = HALF - 1.0;
    if (Math.abs(dx) > lim) {
      nx = c + Math.sign(dx) * lim;
      P.lateral = 0;
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
  }

  if (mode === "run") {
    for (const b of BARRIERS) {
      const bs = -nz;
      if (Math.abs(bs - b.s) > BARRIER_DEPTH / 2 + 1.2 || Math.abs(nx - cAt(bs) - b.xo) > b.w / 2 + 0.6) continue;
      if (P.y > hAt(b.s) + BARRIER_HEIGHT + 0.1) continue;
      if (!P.grounded && P.vy > 0 && P.hitT > 0) continue;
      if ((P.grounded || P.y < hAt(bs) + 0.5) && P.speed >= BARRIER_OVER_SPEED) {
        // A visible sloped nose converts a bounded amount of forward momentum to a hop.
        P.grounded = false; P.vy = 12; P.speed *= 0.88; P.takeoffPitch = P.pitch;
        P.y = Math.max(P.y, surfaceY(bs, nx) + 0.05);
        P.airT = 0; P.tYaw = P.tPitch = P.tRoll = 0;
        P.hitT = 0.25; audio.crash("barrier", 0.25);
      } else if (!P.grounded && P.y > hAt(b.s) + BARRIER_HEIGHT - 0.6) {
        // Barrier tops are not a platform: deflect the car off instead of landing on it.
        const side = bs < b.s ? -1 : 1;
        nz = -(b.s + side * (BARRIER_DEPTH / 2 + 1.3));
        P.y = Math.max(P.y, hAt(b.s) + BARRIER_HEIGHT + 0.15);
        P.vy = Math.max(P.vy, 2); P.speed *= 0.9;
      } else if (P.hitT <= 0) {
        impact("barrier", Math.abs(P.speed), "Hit a barrier");
        nx = P.x; nz = P.z; P.lateral = 0;
      } else { nx = P.x; nz = P.z; }
    }
    if (collideLoopDeck(nx, nz, dt)) {
      stepCones(dt); publish(dt, mode); return;
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
        impact("metal", Math.abs(P.speed), "Hit the loop support");
        nx = P.x;
        nz = P.z;
        P.lateral = 0;
      }
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
      P.vy = Math.max(-MAX_LAUNCH_VY, Math.min(MAX_LAUNCH_VY, (gNew - P.y) / dt));
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
  // Stuck at a loop for 3s+: put the car back on clear road before it.
  const nearLoop = LOOPS.find((l) => Math.abs(ns - l.s) < 30);
  if (nearLoop && Math.abs(P.speed) < 2.5) {
    loopStuckT += dt;
    if (loopStuckT >= 3) {
      loopStuckT = 0;
      const rs = nearLoop.s - 40;
      P.x = cAt(rs); P.z = -rs; P.y = hAt(rs) + 0.5;
      P.yaw = roadYaw(rs); P.speed = 0; P.vy = 0; P.lateral = 0;
      P.pitch = 0; P.roll = 0; P.grounded = true; P.loop = null; P.snapCam = true;
      game.popup("UNSTUCK", "cool", "Moved back before the loop");
    }
  } else loopStuckT = 0;
  events(ns, mode, stats, game);
  P.lastS = ns;
  publish(dt, mode);
}

let loopStuckT = 0;
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
    // knocked-over cones respawn at home once the car is well away
    const moved = Math.abs(c.x - c.home[0]) + Math.abs(c.z - c.home[1]) > 1.5;
    if (moved && sp < 0.05 && Math.hypot(c.home[0] - P.x, c.home[1] - P.z) > 30) {
      c.away = (c.away || 0) + dt;
      if (c.away > 4) { c.x = c.home[0]; c.z = c.home[1]; c.vx = c.vz = 0; c.tilt = 0; c.away = 0; }
    } else c.away = 0;
    // sit slightly in the ground; lie lower when knocked on the side
    c.y = solidY(-c.z, c.x).y - 0.04 + 0.42 * Math.sin(c.tilt);
  }
}

function stepLoop(dt: number) {
  const loop = P.loop;
  if (!loop) return;
  const { lp } = loop;
  const stats = currentStats();
  // No steering on loops: the car follows the deck's centre line it entered on.
  P.steer += (0 - P.steer) * (1 - Math.exp(-10 * dt));
  loop.heading += (0 - loop.heading) * (1 - Math.exp(-6 * dt));
  P.lateral = 0;
  // Let go of the gas on the upper half and gravity wins: the car drops off.
  if (!k.up() && !P.boosting && loop.th > Math.PI * 0.55 && loop.th < Math.PI * 1.45) {
    const v = P.speed;
    P.loop = null;
    P.grounded = false; resetAir();
    P.vy = v * Math.sin(loop.th);
    P.speed = v * Math.cos(loop.th);
    P.yaw = roadYaw(lp.s); P.roll = 0;
    P.loopFallT = 1.2;
    useGame.getState().popup("FELL OFF THE LOOP", "bad", "Hold W to stay on");
    return;
  }
  const throttle = k.up() ? stats.accel * Math.max(0, 1 - P.speed / P.topEff) : 0;
  P.speed += (throttle - 14 * Math.sin(loop.th) - P.speed * 0.05 + (P.boosting ? 26 : 0) - (k.down() ? BRAKE : 0)) * dt;
  P.speed = Math.max(8, P.speed);
  loop.th = Math.min(TAU, loop.th + P.speed * Math.cos(loop.heading) / lp.R * dt);
  const point = loopPoint(lp, loop.th, loop.offset);
  P.x = point.x; P.y = point.y; P.z = point.z;
  P.yaw = Math.PI + loop.heading;
  const pitchTarget = -loop.th;
  P.pitch += (pitchTarget - P.pitch) * (1 - Math.exp(-18 * dt));
  P.roll += (-P.steer * 0.08 - P.roll) * (1 - Math.exp(-10 * dt));
  collectCoins(stats.magnet);
  if (loop.th >= TAU) {
    P.loop = null;
    // Equivalent whole-turn pose avoids a visual reset; camera blend decays independently.
    P.pitch = wrap(P.pitch); P.roll = 0;
    P.z = -(lp.s + 0.6); P.y = surfaceY(lp.s + 0.6, P.x);
    P.yaw = Math.PI + loop.heading;
    P.grounded = true; P.vy = 0; P.lastS = lp.s + 0.6;
    const reward = Math.round(25 * P.combo);
    award(reward); P.runTricks += 1; useSave.getState().addXp(20);
    P.combo = Math.min(5, P.combo + 0.5); P.bestCombo = Math.max(P.bestCombo, P.combo); P.comboT = 5;
    audio.play("loop"); useGame.getState().popup("LOOP DE LOOP!", "cool", `+${reward} wheels · +20 XP`);
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
  if (mode === "hub" && game.testCar) {
    game.setHint("TEST DRIVE · Press Esc to finish");
    return;
  }
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

    if (P.lastS < 0 && ns >= 0) {
      resetRun();
      game.setMode("run");
      game.setHint(null);
      game.popup("GO GO GO!", "hot", "Collect wheels · Hit ramps · Do tricks");
    }
    return;
  }

  if (mode === "run") {
    if (ns < 0) {
      teleport(P.x, 4, Math.PI);
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
        game.popup(p.flat ? "BOOST" : "BOOST RAMP", "cool");
        P.padT = 1.5;
        P.speed = Math.max(P.speed, P.topEff * 1.05);
        let hit = 0;
        for (let j = 0; j < runState.usedPads.length; j++) hit += runState.usedPads[j];
        questDone(questProgress("pads", hit));
      }
    }

    // Mega Launch: rare red spring pad, one shot per run, far stronger than a boost ramp.
    for (let i = 0; i < MEGAS.length; i++) {
      const m = MEGAS[i];
      if (runState.usedMegas[i] || Math.abs(ns - m.s) > MEGA_RADIUS) continue;
      if (Math.hypot(ns - m.s, dxc - m.xo) > MEGA_RADIUS || P.y - hAt(ns) > 1.4 || P.vy > 4) continue;
      runState.usedMegas[i] = 1;
      runState.megaHitAt[i] = performance.now();
      P.grounded = false;
      P.y += 0.3;
      P.vy = MEGA_LAUNCH_VY;
      P.speed = Math.max(P.speed, 30);
      P.takeoffPitch = P.pitch;
      P.airT = 0;
      P.tYaw = P.tPitch = P.tRoll = 0;
      audio.play("pad");
      audio.play("boost");
      game.popup("MEGA LAUNCH!", "hot", "Stick the landing");
    }

    for (let i = 0; i < SPLITS.length; i++) {
      const sp = SPLITS[i];
      if (P.lastS < sp.s && ns >= sp.s && splitNow[i] === undefined) {
        const t = P.runTime;
        splitNow[i] = t;
        const pb = splitPB[i];
        if (pb > 0) {
          const d = t - pb;
          game.popup(`${sp.name} ${t.toFixed(2)}s`, d <= 0 ? "cool" : "bad", `${d <= 0 ? "-" : "+"}${Math.abs(d).toFixed(2)}s vs best`);
        } else game.popup(`${sp.name} ${t.toFixed(2)}s`, "cool", "First split recorded");
      }
    }


    if (!finishMilestonePassed && P.lastS < MILESTONE_S && ns >= MILESTONE_S) {
      finishMilestonePassed = true;
      const time = P.runTime;
      const bonus = 50 + Math.max(0, Math.round((90 - time) * 3));
      award(bonus);
      audio.play("finish");
      game.setMilestone({ time, wheels: P.runWheels, tricks: P.runTricks, bestCombo: P.bestCombo, isBest: false, bonus });
    }

    if (ns >= FINISH) {
      const time = P.runTime;
      const bonus = 50 + Math.max(0, Math.round((90 - time) * 3));
      award(bonus);
      const isBest = useSave.getState().recordRun(time, P.runTricks);
      saveSplitPB(SPLITS.map((_, i) => {
        const now = splitNow[i]; const pb = splitPB[i] || 0;
        return now === undefined ? pb : pb > 0 ? Math.min(pb, now) : now;
      }));
      audio.play("finish");
      game.setMode("finished");
      game.setFinish({ time, wheels: P.runWheels, tricks: P.runTricks, bestCombo: P.bestCombo, isBest, bonus });
    }
  }
}

let idleT = 0;
function publish(dt: number, mode: string) {
  const speed01 = Math.min(1, Math.abs(P.speed) / 60);
  idleT = Math.abs(P.speed) > 0.3 || P.boosting || anyDriveKey() ? 0 : idleT + dt;
  if (mode !== "title" && mode !== "menu") audio.engine(speed01, P.boosting, idleT < 120, P.electric);
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
    progress: 0,
    distance: Math.max(0, s),
    time: P.runTime,
    combo: P.combo,
    section: s > 0 ? sectionAt(s) : "LOBBY",
    runWheels: P.runWheels,
    fps,
  });
}

function anyDriveKey() {
  return keys.size > 0;
  return false;
}

/** Spectator camera state (free camera, car frozen). */
export const spec = { active: false, x: 0, y: 0, z: 0, yaw: 0, pitch: -0.2 };

/** Fly / noclip / spectator cheats. Returns true when normal physics is skipped. */
function freeMove(dt: number) {
  const s = useSave.getState();
  const mode = useGame.getState().mode;
  const ch = s.cheatsUnlocked ? s.cheats : null;
  const playing = mode === "run" || mode === "hub";
  const specOn = !!ch?.spectator && playing;
  if (specOn && !spec.active) { spec.x = P.x; spec.y = P.y + 4; spec.z = P.z; spec.yaw = P.yaw; spec.pitch = -0.2; }
  spec.active = specOn;
  const flying = playing && (specOn || ch?.fly || ch?.noclip);
  if (!flying) return false;
  const SPEED = (k.boost() && !specOn ? 3 : 1) * (ch?.superSpeed ? 2 : 1) * 30;
  const turn = (k.left() ? 1 : 0) - (k.right() ? 1 : 0);
  const fwd = (k.up() ? 1 : 0) - (k.down() ? 1 : 0);
  const vert = (keys.has("KeyE") || keys.has("ShiftLeft") ? 1 : 0) - (keys.has("KeyQ") || keys.has("ControlLeft") ? 1 : 0);
  if (specOn) {
    spec.yaw += turn * 2 * dt;
    spec.x += Math.sin(spec.yaw) * fwd * SPEED * dt;
    spec.z += Math.cos(spec.yaw) * fwd * SPEED * dt;
    spec.y += vert * SPEED * dt;
    P.speed = 0; P.boosting = false;
    return true;
  }
  P.yaw += turn * 2 * dt;
  P.x += Math.sin(P.yaw) * fwd * SPEED * dt;
  P.z += Math.cos(P.yaw) * fwd * SPEED * dt;
  P.y += vert * SPEED * dt;
  if (!ch?.noclip) P.y = Math.max(P.y, hAt(-P.z) + 0.5);
  P.speed = fwd * SPEED; P.vy = 0; P.lateral = 0; P.grounded = false;
  P.pitch = 0; P.roll = 0; P.tPitch = 0; P.tRoll = 0; P.tYaw = 0; P.loop = null;
  P.boosting = k.boost() && fwd !== 0;
  return true;
}
