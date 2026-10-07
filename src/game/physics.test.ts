import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./audio", () => ({ audio: { engine: vi.fn(), crash: vi.fn(), land: vi.fn(), play: vi.fn() } }));
import { P, resetRun, step, teleport } from "./physics";
import { keys } from "./input";
import { useGame, useSave } from "./store";
import { cAt, hAt, roadYaw } from "./track";

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

describe("Phase 1 driving", () => {
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
  it("uses Q/E for spin without making A/D spin the body", () => {
    road(40); P.grounded = false; P.y += 80; keys.add("KeyQ"); tick(0.3);
    expect(P.tYaw).toBeGreaterThan(1.5); expect(P.tRoll).toBe(0);
    keys.clear(); keys.add("KeyE"); tick(0.3); expect(Math.abs(P.tYaw)).toBeLessThan(0.01);
    keys.clear(); keys.add("KeyA"); tick(0.2); expect(Math.abs(P.tYaw)).toBeLessThan(0.01);
  });
  it("supports single and double flips and retains the launch pitch", () => {
    road(40); P.grounded = false; P.y += 100; P.takeoffPitch = -0.4; keys.add("KeyS");
    tick(1); expect(P.tPitch).toBeLessThan(-Math.PI * 2); expect(P.takeoffPitch).toBe(-0.4);
    tick(1); expect(P.tPitch).toBeLessThan(-Math.PI * 4);
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
    road(88); P.speed = 36; keys.add("KeyW");
    let airborne = false;
    for (let i = 0; i < 50; i++) { step(1 / 60); airborne ||= !P.grounded; expect(P.wipe).toBe(0); }
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