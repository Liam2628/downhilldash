import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./audio", () => ({ audio: { engine: vi.fn(), crash: vi.fn(), land: vi.fn(), play: vi.fn() } }));
import { P, resetRun, step, teleport } from "./physics";
import { keys } from "./input";
import { useGame, useSave } from "./store";
import { BARRIERS, RAMPS, LOOPS, PADS, cAt, hAt, loopPoint, loopSweep, padAdd, roadYaw, surfaceY, ensureTrack } from "./track";
import { syncGenerated } from "./physics";

// The course is generated randomly on demand; build a long stretch up front.
ensureTrack(6000);
// Longer areas mean a random 6 km sample need not contain every obstacle.
for (let s = 7000; s <= 40000 && (!LOOPS.length || !RAMPS.length || !BARRIERS.length || !PADS.length); s += 1000)
  ensureTrack(s);
syncGenerated();

function tick(seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) step(1 / 60); }
function road(s: number) {
  teleport(cAt(s), -s, roadYaw(s));
  useGame.getState().setMode("run");
}
beforeEach(() => {
  keys.clear();
  useSave.getState().reset();
  useGame.setState({ mode: "hub", settingsOpen: false, chestOpen: false, popups: [], finish: null });
  resetRun();
  teleport(0, 46, Math.PI);
  P.boostT = P.cooldownT = 0;
});

describe("Phase 2 track collisions", () => {
  it("sweeps both loop deck faces without colliding outside the visible width", () => {
    for (const lp of LOOPS) for (const th of [0.4, 1.5, 3, 4.5, 5.8]) {
      const p = loopPoint(lp, th);
      const from = { x: p.x, y: p.y + Math.cos(th), z: p.z + Math.sin(th) };
      const to = { x: p.x, y: p.y - Math.cos(th), z: p.z - Math.sin(th) };
      expect(loopSweep(lp, from, to)?.th).toBeCloseTo(th);
      expect(loopSweep(lp, { ...from, x: p.x + 6 }, { ...to, x: p.x + 6 })).toBeNull();
    }
  });
  it("generates both curved boost ramps and flat boost strips", () => {
    expect(PADS.some(p => p.flat)).toBe(true);
    expect(PADS.some(p => !p.flat)).toBe(true);
    for (const p of PADS.filter(p => !p.flat)) {
      expect(padAdd(p.s, p.xo)).toBeCloseTo(p.h * 0.25);
      expect(padAdd(p.s, p.xo + p.w / 2)).toBeCloseTo(p.h * 0.25);
    }
  });
  it.each([12, 22, 40, 70, 100])("keeps barrier impacts bounded at %s m/s", (speed) => {
    const b = BARRIERS[0]; road(b.s - 7); P.x += b.xo; P.y = surfaceY(-P.z, P.x); P.speed = speed;
    let maxVy = 0; const startY = P.y;
    for (let i = 0; i < 120; i++) { step(1 / 120); maxVy = Math.max(maxVy, P.vy); expect(Number.isFinite(P.y)).toBe(true); }
    expect(maxVy).toBeLessThanOrEqual(16);
    expect(P.y - startY).toBeLessThan(7); // never rockets upward, even where the road drops away
    if (speed >= 40) expect(-P.z).toBeGreaterThan(b.s + 3);
    else expect(-P.z).toBeLessThan(b.s + 3);
  });
  it("lets an airborne car clear a barrier without hitting an invisible wall", () => {
    const b = BARRIERS[0]; road(b.s - 5); P.x += b.xo; P.y += 5; P.grounded = false; P.speed = 50;
    tick(0.2); expect(-P.z).toBeGreaterThan(b.s + 3); expect(P.wipe).toBe(0);
  });
  it.each([-8.5, -4.5, 0, 4.5, 8.5])("keeps ramp edge driving stable at offset %s", (offset) => {
    for (const r of RAMPS) {
      road(r.s - 2); P.x += offset; P.y = surfaceY(-P.z, P.x); P.speed = 50; keys.clear();
      let airborne = false;
      for (let i = 0; i < 240; i++) {
        step(1 / 120); airborne ||= !P.grounded;
        expect(Math.abs(P.roll)).toBeLessThan(0.3); expect(P.wipe).toBe(0); expect(Math.abs(P.vy)).toBeLessThan(40);
        if (airborne) break;
      }
      expect(airborne).toBe(true);
    }
  });
  it.each([-0.5, 0, 0.5])("enters loops from angle %s without position snapping", (angle) => {
    const lp = LOOPS[0]; const point = loopPoint(lp, 0);
    teleport(point.x, point.z + 0.5, Math.PI + angle); useGame.setState({ mode: "run" }); P.speed = 40;
    const x = P.x; const y = P.y; tick(0.03);
    expect(P.loop).not.toBeNull(); expect(Math.abs(P.x - x)).toBeLessThan(2); expect(Math.abs(P.y - y)).toBeLessThan(1);
  });
  it("catches the loop deck when approaching airborne from the boost ramp", () => {
    road(LOOPS[0].s - 35); P.x = cAt(LOOPS[0].s) - 5; P.speed = 55; keys.add("KeyW");
    let entered = false;
    for (let i = 0; i < 300; i++) { step(1 / 120); entered ||= !!P.loop; if (entered) break; }
    expect(entered).toBe(true);
  });
  it("ignores steering on loops and drops the car without throttle at the top", () => {
    const lp = LOOPS[0]; const point = loopPoint(lp, 0);
    teleport(point.x, point.z, Math.PI); useGame.setState({ mode: "run" });
    P.loop = { lp, th: 0.2, offset: 0, heading: 0 }; P.speed = 35;
    keys.add("KeyW"); keys.add("KeyA"); tick(0.3); expect(Math.abs(P.loop?.offset ?? 1)).toBeLessThan(0.01);
    keys.clear(); P.loop = { lp, th: Math.PI, offset: 0, heading: 0 }; step(1 / 120);
    expect(P.loop).toBeNull(); expect(P.grounded).toBe(false);
  });
  it("makes loop boost meaningful and exits continuously", () => {
    const lp = LOOPS[0]; const point = loopPoint(lp, 0);
    teleport(point.x, point.z, Math.PI); useGame.setState({ mode: "run" });
    P.loop = { lp, th: 0.2, offset: 0, heading: 0 }; P.speed = 35;
    keys.add("KeyW"); tick(0.2);
    const speed = P.speed; keys.add("ShiftLeft"); tick(0.1);
    expect(P.boosting).toBe(true); expect(P.speed).toBeGreaterThan(speed);
    keys.clear(); keys.add("KeyW"); let exited = false;
    for (let i = 0; i < 600; i++) {
      const old = { x: P.x, y: P.y, z: P.z }; step(1 / 120);
      expect(Math.hypot(P.x - old.x, P.y - old.y, P.z - old.z)).toBeLessThan(1.5);
      if (!P.loop) { exited = true; break; }
    }
    expect(exited).toBe(true); expect(P.grounded).toBe(true); expect(P.wipe).toBe(0);
  });
  it("collides with the loop underside and finite support pillars", () => {
    const lp = LOOPS[0]; const point = loopPoint(lp, Math.PI / 2);
    teleport(point.x, point.z + 2, Math.PI); useGame.setState({ mode: "run" });
    P.y = point.y; P.grounded = false; P.speed = 45; tick(0.1);
    expect(P.wipe).toBeGreaterThan(0);
    road(lp.s - 4); P.x = cAt(lp.s) + 9; P.speed = 40; tick(0.1); expect(P.wipe).toBeGreaterThan(0);
    road(lp.s - 4); P.x = cAt(lp.s) + 9; P.y = hAt(lp.s) + 40; P.grounded = false; P.speed = 40;
    tick(0.1); expect(P.wipe).toBe(0);
  });
  it("cancels a slow gate crossing and allows reversing into the hub facing downhill", () => {
    teleport(0, 0.1, Math.PI); P.speed = 2; tick(0.1);
    expect(useGame.getState().mode).toBe("run");
    keys.add("KeyS"); tick(0.4); expect(useGame.getState().mode).toBe("hub");
    const z = P.z; tick(0.4); expect(P.z).toBeGreaterThan(z); expect(P.yaw).toBeCloseTo(Math.PI);
  });
  it("keeps control after an actual boosted loop exit", () => {
    road(LOOPS[0].s - 35); P.x = cAt(LOOPS[0].s) - 5; P.speed = 55; keys.add("KeyW");
    let entered = false; let exited = false;
    for (let i = 0; i < 800; i++) {
      step(1 / 120); entered ||= !!P.loop;
      if (entered && !P.loop) { exited = true; break; }
      expect(P.wipe).toBe(0);
    }
    expect(exited).toBe(true);
    for (let i = 0; i < 120; i++) { step(1 / 120); expect(P.wipe).toBe(0); }
    expect(-P.z).toBeGreaterThan(LOOPS[0].s + 10);
  });
  it("has solid loop rails when steering into their edge", () => {
    const lp = LOOPS[0]; const p = loopPoint(lp, Math.PI / 2, 4.1);
    teleport(p.x, p.z, Math.PI / 2); useGame.setState({ mode: "run" }); P.y = p.y; P.grounded = false; P.speed = 40;
    step(1 / 120); expect(P.x).toBeLessThan(p.x + 0.1);
  });
});

describe("Phase 1 driving", () => {
  it("actually travels farther with downhill throttle than lobby throttle", () => {
    keys.add("KeyW"); tick(1); const hubSpeed = P.speed;
    road(10); P.speed = 0; keys.add("KeyW"); const start = -P.z; tick(1);
    expect(P.speed).toBeGreaterThan(hubSpeed * 1.25);
    expect(-P.z - start).toBeGreaterThan(8);
  });
  it("accelerates, brakes to zero, and deliberately reverses in the hub", () => {
    keys.add("KeyW"); tick(1); expect(P.speed).toBeGreaterThan(8);
    keys.clear(); keys.add("KeyS"); tick(0.35); expect(Math.abs(P.speed)).toBeLessThan(2);
    tick(0.6); expect(P.speed).toBeLessThan(-3);
  });
  it("smoothly reverses steering direction with travel direction", () => {
    P.speed = -8; keys.add("KeyA"); const yaw = P.yaw; tick(0.3);
    expect(P.yaw).toBeLessThan(yaw); expect(P.z).toBeGreaterThan(46);
    expect(Math.abs(P.yaw - yaw)).toBeLessThan(0.6);
  });
  it("holds a stop and disallows backward progress on the slope", () => {
    road(40); P.speed = 12; keys.add("KeyS"); tick(1);
    expect(P.speed).toBe(0); const z = P.z; tick(1); expect(P.z).toBeCloseTo(z);
    keys.clear(); P.yaw = 0; P.speed = 10; tick(0.2); expect(P.z).toBeLessThanOrEqual(z);
  });
  it("has more lateral slip in fast hard turns and regains grip on release", () => {
    P.speed = 10; keys.add("KeyA"); tick(0.2); const slow = Math.abs(P.lateral);
    teleport(0, 46, Math.PI); P.speed = 38; tick(0.2); const fast = Math.abs(P.lateral);
    expect(fast).toBeGreaterThan(slow * 3);
    keys.clear(); tick(0.5); expect(Math.abs(P.lateral)).toBeLessThan(fast);
  });
  it("ignores held W/S in the air and keeps the body still", () => {
    road(40); P.grounded = false; P.y += 100; P.takeoffPitch = -0.4; keys.add("KeyS"); keys.add("KeyQ");
    tick(0.5); expect(Math.abs(P.tPitch)).toBeLessThan(0.5); expect(Math.abs(P.tYaw)).toBeLessThan(0.05);
    expect(P.takeoffPitch).toBe(-0.4);
  });
  it("levels an airborne car while preserving completed turns, and slows with F", () => {
    road(40); P.grounded = false; P.y += 80; P.speed = 30;
    P.tPitch = -Math.PI * 2 - 0.6; P.tRoll = 0.8; P.tYaw = 0.5;
    keys.add("KeyF"); tick(0.5);
    expect(Math.abs(P.tPitch + Math.PI * 2)).toBeLessThan(0.03);
    expect(Math.abs(P.tRoll)).toBeLessThan(0.03); expect(Math.abs(P.tYaw)).toBeLessThan(0.03);
    expect(P.speed).toBeLessThan(23);
  });
  it("takes off from a real ramp without a random side collision", () => {
    road(RAMPS[0].s - 2); P.x += RAMPS[0].xo; P.speed = 36; keys.add("KeyW");
    let airborne = false;
    for (let i = 0; i < 120 && !airborne; i++) { step(1 / 60); airborne ||= !P.grounded; expect(P.wipe).toBe(0); }
    expect(airborne).toBe(true);
  });
  it("recovers below the kill plane or outside the world", () => {
    road(400); P.y = hAt(400) - 40; step(1 / 60);
    expect(useGame.getState().mode).toBe("hub"); expect(P.grounded).toBe(true);
    road(400); P.x += 150; step(1 / 60); expect(useGame.getState().mode).toBe("hub");
  });
  it("backs away from a fence instead of getting stuck", () => {
    teleport(66, 75, Math.PI / 2); P.speed = 8; keys.add("KeyW"); tick(0.3);
    keys.clear(); keys.add("KeyS"); tick(1); expect(P.x).toBeLessThan(66);
  });
});