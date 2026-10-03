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
