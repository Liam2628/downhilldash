import { describe, expect, it } from "vitest";
import { chunkTypes } from "./gen";
import { ensureTrack, GANTRIES, RAMPS, PADS, LOOPS, MEGAS, CONES, COINS, BILLBOARDS, SCENERY_BUILDINGS, SCENERY_TREES, cAt, hAt, terrainY, terrainMeshY, TERRAIN_COLS } from "./track";

ensureTrack(20000);

describe("track pacing and grounded scenery", () => {
  it("opens with exactly 100 m of straight downhill and natural scenery", () => {
    expect(chunkTypes[0]).toBe("normal");
    expect(chunkTypes[1]).not.toBe("normal");
    for (let s = 1; s < 100; s++) {
      expect(hAt(s)).toBeLessThan(hAt(s - 1));
      expect(cAt(s)).toBe(0);
    }
    for (const list of [RAMPS, PADS, LOOPS, MEGAS, CONES, BILLBOARDS, GANTRIES])
      expect(list.some(o => o.s < 100)).toBe(false);
    expect(COINS.some(o => -o.z < 100)).toBe(false);
    expect(SCENERY_BUILDINGS.some(o => -o.z < 100)).toBe(false);
    expect(SCENERY_TREES.some(o => -o.z < 100)).toBe(true);
  });
  it("keeps interesting areas 300–600 m long without normal filler", () => {
    for (let i = 1; i < GANTRIES.length; i++) {
      const length = GANTRIES[i].s - GANTRIES[i - 1].s;
      expect(length).toBeGreaterThanOrEqual(300);
      expect(length).toBeLessThanOrEqual(600);
    }
    expect(chunkTypes.slice(1).includes("normal")).toBe(false);
    expect(PADS.some(p => !p.flat)).toBe(true);
    expect(PADS.some(p => p.flat)).toBe(true);
  });
  it("matches the actual terrain triangle faces between grid vertices", () => {
    for (const s0 of [40, 500, 1700, 8000]) for (const j of [5, 8, 18, 21]) {
      const left = TERRAIN_COLS[j], right = TERRAIN_COLS[j + 1];
      const a = terrainY(s0, left), b = terrainY(s0, right);
      const c = terrainY(s0 + 2, left), d = terrainY(s0 + 2, right);
      for (const [f, g] of [[0.2, 0.3], [0.8, 0.7]]) {
        const x = cAt(s0) * (1 - f) + cAt(s0 + 2) * f + left + (right - left) * g;
        const expected = f + g <= 1 ? a + (b - a) * g + (c - a) * f : d + (c - d) * (1 - g) + (b - d) * (1 - f);
        expect(terrainMeshY(x, -(s0 + f * 2))).toBeCloseTo(expected - 0.05, 8);
      }
    }
  });
});