import { describe, expect, it } from "vitest";
import { TrickTracker } from "./tricks";

const feedSteps = (t: TrickTracker, axis: "pitch" | "roll" | "yaw", total: number, steps = 40) => {
  for (let i = 0; i < steps; i++) { t.feed(axis, total / steps); t.tick(0.02); }
};

describe("tricks", () => {
  it("recognises a backflip", () => {
    const t = new TrickTracker();
    feedSteps(t, "pitch", -Math.PI * 2);
    const e = t.evaluate();
    expect(e.parts).toEqual(["BACKFLIP"]);
    expect(e.counts.backflips).toBe(1);
  });
  it("wiggling never scores", () => {
    const t = new TrickTracker();
    for (let i = 0; i < 20; i++) { feedSteps(t, "roll", 2.5); feedSteps(t, "roll", -2.5); }
    expect(t.evaluate().pts).toBe(0);
  });
  it("half flip into barrel roll counts as a transition", () => {
    const t = new TrickTracker();
    feedSteps(t, "pitch", Math.PI * 1.1);
    t.tick(1);
    feedSteps(t, "roll", Math.PI * 2);
    const e = t.evaluate();
    expect(e.transitions).toBe(1);
    expect(e.parts[0]).toContain("HALF FRONTFLIP");
    expect(e.parts[1]).toContain("BARREL ROLL");
  });
  it("simultaneous flip and spin is a cork", () => {
    const t = new TrickTracker();
    for (let i = 0; i < 40; i++) { t.feed("pitch", -Math.PI / 20); t.feed("yaw", Math.PI / 20); t.tick(0.02); }
    expect(t.evaluate().parts[0]).toContain("BACK CORK");
  });
});
