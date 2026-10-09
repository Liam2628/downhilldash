import type { MenuId } from "./store";

export type HubBuilding = {
  id: MenuId;
  label: string;
  center: [number, number]; // x,z
  size: [number, number, number]; // w(x), h, d(z)
  trigger: { x: number; z: number; hx: number; hz: number };
  exit: { x: number; z: number; yaw: number };
  door: { x: number; z: number; rotY: number };
};

export const HUB_BUILDINGS: HubBuilding[] = [
  {
    id: "garage",
    label: "GARAGE",
    center: [-42, 34],
    size: [18, 10, 22],
    trigger: { x: -30.5, z: 34, hx: 2.5, hz: 4.5 },
    exit: { x: -23, z: 34, yaw: Math.PI / 2 },
    door: { x: -33, z: 34, rotY: Math.PI / 2 },
  },
  {
    id: "dealer",
    label: "DEALERSHIP",
    center: [42, 34],
    size: [18, 11, 24],
    trigger: { x: 30.5, z: 34, hx: 2.5, hz: 4.5 },
    exit: { x: 23, z: 34, yaw: -Math.PI / 2 },
    door: { x: 33, z: 34, rotY: -Math.PI / 2 },
  },
  {
    id: "tuning",
    label: "TUNING SHOP",
    center: [0, 86],
    size: [26, 9, 14],
    trigger: { x: 0, z: 76.5, hx: 4.5, hz: 2.5 },
    exit: { x: 0, z: 68, yaw: Math.PI },
    door: { x: 0, z: 79, rotY: Math.PI },
  },
];

export const SPAWN = { x: 0, z: 46, yaw: Math.PI };
export const HUB_BOUNDS = { minX: -68, maxX: 68, minZ: 0, maxZ: 98 };
export const DAILY_PAD = { x: -18, z: 62, r: 3.2 };
export const STATS_BOARD = { x: 20, z: 64 };
export const GATE_HALF = 10;

/** Solid round obstacles in the lobby: x, z, radius, kind */
export const HUB_SOLIDS: { x: number; z: number; r: number; kind: "metal" | "wood" | "tree" | "concrete" }[] = [
  { x: -GATE_HALF - 1.5, z: 2, r: 1.3, kind: "concrete" },
  { x: GATE_HALF + 1.5, z: 2, r: 1.3, kind: "concrete" },
  { x: -58, z: 80, r: 2.4, kind: "metal" },
  { x: 58, z: 82, r: 2.6, kind: "metal" },
  { x: 52, z: 8, r: 2.4, kind: "metal" },
  { x: -52, z: 52, r: 1.4, kind: "wood" },
  { x: -50, z: 54, r: 1.4, kind: "wood" },
  { x: -51, z: 50.5, r: 1.4, kind: "wood" },
  { x: 20, z: 64, r: 3.2, kind: "wood" },
  { x: -18, z: 62 - 4.2, r: 0.6, kind: "metal" },
  { x: -56, z: 70, r: 0.5, kind: "tree" },
  { x: 56, z: 70, r: 0.5, kind: "tree" },
  { x: -56, z: 10, r: 0.5, kind: "tree" },
  { x: 56, z: 10, r: 0.5, kind: "tree" },
  { x: -22, z: 90, r: 0.5, kind: "tree" },
  { x: 22, z: 90, r: 0.5, kind: "tree" },
];

export const HUB_CONES: [number, number][] = [
  [-24, 22], [-24, 26], [-24, 42], [-24, 46], [24, 22], [24, 26], [24, 42], [24, 46], [-8, 60], [8, 60],
];
