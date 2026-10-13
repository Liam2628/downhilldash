import { describe, expect, it } from "vitest";
import { ensureTrack, genEnd, LOOPS, MEGAS, RAMPS, GANTRIES } from "./gen";
import { hAt, cAt } from "./track";

describe("endless track long run", () => {
  it("keeps generating 30 km with continuous road and occasional mega launches", () => {
    ensureTrack(30000);
    expect(genEnd).toBeGreaterThanOrEqual(30000);
    for (let s = 0; s < 30000; s += 1) {
      expect(Number.isFinite(hAt(s))).toBe(true);
      expect(Math.abs(hAt(s + 1) - hAt(s))).toBeLessThan(2);
      expect(Math.abs(cAt(s + 1) - cAt(s))).toBeLessThan(2);
    }
    expect(LOOPS.length).toBeGreaterThan(5);
    expect(RAMPS.length).toBeGreaterThan(20);
    expect(MEGAS.length).toBeGreaterThan(0);
    expect(MEGAS.length).toBeLessThan(RAMPS.length / 3);
    const names = GANTRIES.map((g) => g.name).join("|");
    expect(new Set(GANTRIES.map((g) => g.name)).size).toBeGreaterThan(3);
    expect(names.length).toBeGreaterThan(0);
  });
});
