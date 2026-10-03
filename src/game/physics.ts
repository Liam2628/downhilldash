import { carById, type CarStats } from "./data";
import { useGame, useSave } from "./store";
import {
  BARRIERS,
  CONES,
  COINS,
  FINISH,
  HALF,
  L,
  LOOPS,
  PADS,
  cAt,
  hAt,
  roadYaw,
  sectionAt,
  surfaceY,
  type Loop,
} from "./track";
import { DAILY_PAD, GATE_HALF, HUB_BOUNDS, HUB_BUILDINGS, SPAWN } from "./hub";
import { k } from "./input";
import { audio } from "./audio";

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
  cooldownMax: 7,
  boostMax: 2,
  padT: 0,
  combo: 1,
  comboT: 0,
  bestCombo: 1,
  runTime: 0,
  runWheels: 0,
  runTricks: 0,
  lastS: -SPAWN.z,
  jumpHeld: false,
  boostHeld: false,
  steer: 0,
  wallT: 0,
  topEff: 40,
  boosting: false,
  landFlash: 0,
};

export type ConeState = { hit: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number };
export const runState = {
  collected: new Uint8Array(COINS.length),
  cones: CONES.map(() => ({ hit: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0 }) as ConeState),
  version: 0,
};

export function resetRun() {
  runState.collected.fill(0);
  runState.cones.forEach((c) => (c.hit = false));
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
  P.y = surfaceY(-z, x);
  P.yaw = yaw;
  P.speed = 0;
  P.vy = 0;
  P.grounded = true;
  P.loop = null;
  P.wipe = 0;
  P.wipeSpin = 0;
  P.lastS = -z;
  resetAir();
}

export function returnToLobby() {
  teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
  P.boostT = 0;
  P.cooldownT = 0;
  const g = useGame.getState();
  g.setFinish(null);
  g.setMode("hub");
}

export function exitMenu() {
  const g = useGame.getState();
  const b = HUB_BUILDINGS.find((h) => h.id === g.menu);
  g.closeMenu();
  if (b) teleport(b.exit.x, b.exit.z, b.exit.yaw);
}

export function currentStats() {
  const s = useSave.getState();
  const base: CarStats = carById(s.selected).stats;
  const u = s.upgrades;
  const eng = 1 + 0.04 * u.engine;
  return {
    ...base,
    top: base.top * eng,
    accel: base.accel * eng,
    handling: base.handling * (1 + 0.07 * u.grip),
    boostDur: 2 + 0.4 * u.nitro,
    cooldown: Math.max(2.5, 7 - 0.8 * u.cooler),
    magnet: 2.6 + 0.9 * u.magnet,
  };
}

const wrap = (a: number) => {
  a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a;
};
const lerpAngle = (a: number, b: number, t: number) => a + wrap(b - a) * t;

export function groundAt(x: number, z: number) {
  return surfaceY(-z, x);
}

function award(n: number) {
  useSave.getState().addWheels(n);
  P.runWheels += n;
}

function wipeout(reason: string) {
  P.wipe = 1.3;
  P.speed *= 0.3;
  P.combo = 1;
  P.comboT = 0;
  resetAir();
  audio.play("crash");
  useGame.getState().popup("WIPEOUT!", "bad", reason);
}

function land(gy: number, stats: ReturnType<typeof currentStats>) {
  const air = P.airT;
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
  if (air > 0.25) audio.play("land");
  P.landFlash = Math.min(1, air);

  if (!clean && air > 0.3) {
    wipeout("Stick the landing next time");
    return;
  }
  const parts: string[] = [];
  let base = 0;
  if (flips) {
    const name = P.tPitch < 0 ? "BACKFLIP" : "FRONTFLIP";
    parts.push((flips > 1 ? `${flips}x ` : "") + name);
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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let hudAcc = 0;
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;

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

  if (mode === "title" || mode === "menu") {
    P.speed = 0;
    audio.engine(0, false, mode === "menu");
    publish(dt, mode);
    return;
  }

  const stats = currentStats();
  const controls = (mode === "hub" || mode === "run") && P.wipe <= 0 && !game.settingsOpen;
  P.cooldownMax = stats.cooldown;
  P.boostMax = stats.boostDur;
  P.landFlash = Math.max(0, P.landFlash - dt * 2);

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

  // combo decay
  if (P.comboT > 0) {
    P.comboT -= dt;
    if (P.comboT <= 0) P.combo = 1;
  }
  if (mode === "run") P.runTime += dt;

  // ---------- loop ----------
  if (P.loop) {
    stepLoop(dt);
    publish(dt, mode);
    return;
  }

  if (P.wipe > 0) {
    P.wipe -= dt;
    P.wipeSpin += dt * 9 * Math.max(0.2, P.wipe);
    if (P.wipe <= 0) P.wipeSpin = 0;
  }

  const sNow = -P.z;
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

    const sf =
      Math.min(1, Math.abs(P.speed) / 6) * (1 - 0.35 * Math.min(1, P.speed / 60)) * Math.sign(P.speed || 1);
    P.yaw += P.steer * stats.handling * sf * dt;

    if (controls && k.jump() && !P.jumpHeld) {
      P.grounded = false;
      P.vy = Math.max(P.vy, 0) + 9.5;
      P.takeoffPitch = P.pitch;
      P.airT = 0;
      P.tYaw = P.tPitch = P.tRoll = 0;
    }
  } else {
    P.vy -= G * dt;
    P.speed *= Math.exp(-0.05 * dt);
    if (P.boosting) P.speed += 10 * dt;
    if (controls) {
      P.tYaw += st * stats.air * dt;
      if (up) P.tPitch += stats.air * 0.85 * dt;
      if (down) P.tPitch -= stats.air * 0.85 * dt;
      if (k.rollL()) P.tRoll -= stats.air * 0.9 * dt;
      if (k.rollR()) P.tRoll += stats.air * 0.9 * dt;
    }
    P.takeoffPitch *= Math.exp(-2.5 * dt);
    P.airT += dt;
  }
  P.jumpHeld = controls && k.jump();

  // ---------- integrate ----------
  let nx = P.x + Math.sin(P.yaw) * P.speed * dt;
  let nz = P.z + Math.cos(P.yaw) * P.speed * dt;
  const ns = -nz;
  P.wallT -= dt;

  if (nz > 0) {
    // HUB
    nx = Math.max(HUB_BOUNDS.minX, Math.min(HUB_BOUNDS.maxX, nx));
    if (nz > HUB_BOUNDS.maxZ) nz = HUB_BOUNDS.maxZ;
    if (nz < 0.8 && Math.abs(nx) > GATE_HALF - 1.2 && P.z >= 0.8) {
      nz = 0.8;
      P.speed *= 0.5;
    }
    for (const b of HUB_BUILDINGS) {
      const r = 1.6;
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
        P.speed *= 0.6;
      }
    }
  } else {
    const c = cAt(ns);
    const dx = nx - c;
    const lim = HALF - 1.3;
    if (Math.abs(dx) > lim) {
      nx = c + Math.sign(dx) * lim;
      if (P.grounded && P.speed > 0) P.yaw = lerpAngle(P.yaw, roadYaw(ns), 0.35);
      P.speed *= 0.985;
      if (P.wallT <= 0 && P.speed > 8) {
        audio.play("wall");
        P.wallT = 0.3;
      }
    }
    if (ns > L - 4) {
      nz = -(L - 4);
      P.speed = 0;
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

  // visual ground alignment
  if (P.grounded) {
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const gf = groundAt(P.x + fx * 1.6, P.z + fz * 1.6);
    const gb = groundAt(P.x - fx * 1.6, P.z - fz * 1.6);
    const gl = groundAt(P.x + fz * 1, P.z - fx * 1);
    const gr = groundAt(P.x - fz * 1, P.z + fx * 1);
    const tp = -Math.atan2(gf - gb, 3.2);
    const tr = Math.atan2(gl - gr, 2) * 0.5 + P.steer * Math.min(1, P.speed / 40) * 0.05;
    P.pitch += (tp - P.pitch) * (1 - Math.exp(-14 * dt));
    P.roll += (tr - P.roll) * (1 - Math.exp(-10 * dt));
  }

  events(ns, mode, stats, game);
  P.lastS = ns;
  publish(dt, mode);
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

function events(
  ns: number,
  mode: string,
  stats: ReturnType<typeof currentStats>,
  game: ReturnType<typeof useGame.getState>,
) {
  // Hub triggers
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
        game.openMenu(b.id);
        return;
      }
      if (dx < t.hx + 12 && dz < t.hz + 12) hint = `Drive in to enter the ${b.label}`;
    }
    const dp = Math.hypot(P.x - DAILY_PAD.x, P.z - DAILY_PAD.z);
    if (dp < DAILY_PAD.r) {
      const day = todayKey();
      const save = useSave.getState();
      if (save.lastDaily !== day) {
        save.claimDaily(day);
        save.addWheels(150);
        audio.play("buy");
        game.popup("DAILY REWARD!", "gold", "+150 wheels — come back tomorrow");
      } else hint = "Daily reward claimed — come back tomorrow";
    } else if (dp < DAILY_PAD.r + 8 && useSave.getState().lastDaily !== todayKey()) {
      hint = "Free daily wheels! Drive onto the pad";
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

    // cones
    for (let i = 0; i < CONES.length; i++) {
      const cs = runState.cones[i];
      if (cs.hit) continue;
      const cn = CONES[i];
      if (Math.abs(cn.s - ns) > 2) continue;
      const x = cAt(cn.s) + cn.xo;
      if (Math.hypot(x - P.x, -cn.s - P.z) < 1.7 && P.y < hAt(cn.s) + 1.5) {
        cs.hit = true;
        cs.x = x;
        cs.z = -cn.s;
        cs.y = hAt(cn.s);
        cs.vx = Math.sin(P.yaw) * P.speed * 0.5 + (Math.random() - 0.5) * 8;
        cs.vz = Math.cos(P.yaw) * P.speed * 0.5;
        cs.vy = 6 + Math.random() * 6;
        cs.r = 0;
        P.speed *= 0.93;
        audio.play("cone");
        award(1);
      }
    }

    // barriers
    const dxc = P.x - cAt(ns);
    for (const b of BARRIERS) {
      if (ns > b.s - 1.2 && P.lastS <= b.s + 0.6 && ns < b.s + 1.5) {
        if (Math.abs(dxc - b.xo) < b.w / 2 + 0.9 && P.y < hAt(b.s) + 1.3) {
          P.z = -(b.s - 1.3);
          if (P.speed > 12) wipeout("Dodge the barriers!");
          P.speed = Math.min(P.speed, 3);
        }
      }
    }

    // pads
    if (P.grounded) {
      for (const p of PADS) {
        if (Math.abs(p.s - ns) < 3.5 && Math.abs(dxc - p.xo) < 2.8) {
          if (P.padT <= 0) {
            audio.play("pad");
            game.popup("BOOST PAD", "cool");
          }
          P.padT = 1.5;
          P.speed = Math.max(P.speed, P.topEff * 1.05);
        }
      }
    }

    // loops
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
      game.setFinish({
        time,
        wheels: P.runWheels,
        tricks: P.runTricks,
        bestCombo: P.bestCombo,
        isBest,
        bonus,
      });
    }
  }
}

function publish(dt: number, mode: string) {
  const speed01 = Math.min(1, Math.abs(P.speed) / 60);
  if (mode !== "title" && mode !== "menu") audio.engine(speed01, P.boosting, true);
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
