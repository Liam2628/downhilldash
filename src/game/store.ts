import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UpgradeId } from "./data";

export type Settings = {
  volume: number; // 0..1
  muted: boolean;
  quality: "high" | "low";
  fov: number;
  camDist: number;
  units: "kmh" | "mph";
  showFps: boolean;
  speedLines: boolean;
  hideControls: boolean;
  keys: KeyBinds;
};

export type Action = "up" | "down" | "left" | "right" | "boost" | "rollL" | "rollR";
export type KeyBinds = Record<Action, string[]>;
export const DEFAULT_KEYS: KeyBinds = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  boost: ["ShiftLeft", "ShiftRight"],
  rollL: ["KeyQ"],
  rollR: ["KeyE"],
};

type Save = {
  wheels: number;
  owned: string[];
  selected: string;
  paints: Record<string, string | null>;
  glow: string | null;
  glowUnlocked: boolean;
  trail: string | null;
  trailUnlocked: boolean;
  upgrades: Record<UpgradeId, number>;
  settings: Settings;
  best: number | null;
  bestTricks: number;
  runs: number;
  lastDaily: string | null;
};

type SaveActions = {
  addWheels: (n: number) => void;
  spend: (n: number) => boolean;
  buyCar: (id: string, price: number) => boolean;
  selectCar: (id: string) => void;
  setPaint: (carId: string, hex: string | null) => void;
  setGlow: (hex: string | null) => void;
  setTrail: (hex: string | null) => void;
  unlockGlow: (price: number) => boolean;
  unlockTrail: (price: number) => boolean;
  buyUpgrade: (id: UpgradeId, cost: number) => boolean;
  setSettings: (p: Partial<Settings>) => void;
  recordRun: (time: number, tricks: number) => boolean;
  claimDaily: (day: string) => void;
  reset: () => void;
};

const initial: Save = {
  wheels: 0,
  owned: ["sedan"],
  selected: "sedan",
  paints: {},
  glow: null,
  glowUnlocked: false,
  trail: null,
  trailUnlocked: false,
  upgrades: { engine: 0, nitro: 0, cooler: 0, grip: 0, magnet: 0 },
  settings: {
    volume: 0.7,
    muted: false,
    quality: "high",
    fov: 62,
    camDist: 1,
    units: "kmh",
    showFps: false,
    speedLines: true,
    hideControls: false,
    keys: DEFAULT_KEYS,
  },
  best: null,
  bestTricks: 0,
  runs: 0,
  lastDaily: null,
};

export const useSave = create<Save & SaveActions>()(
  persist(
    (set, get) => ({
      ...initial,
      addWheels: (n) => set({ wheels: get().wheels + n }),
      spend: (n) => {
        if (get().wheels < n) return false;
        set({ wheels: get().wheels - n });
        return true;
      },
      buyCar: (id, price) => {
        const s = get();
        if (s.owned.includes(id) || s.wheels < price) return false;
        set({ wheels: s.wheels - price, owned: [...s.owned, id], selected: id });
        return true;
      },
      selectCar: (id) => {
        if (get().owned.includes(id)) set({ selected: id });
      },
      setPaint: (carId, hex) => set({ paints: { ...get().paints, [carId]: hex } }),
      setGlow: (hex) => set({ glow: hex }),
      setTrail: (hex) => set({ trail: hex }),
      unlockGlow: (price) => {
        if (get().glowUnlocked || !get().spend(price)) return false;
        set({ glowUnlocked: true, glow: "#22e4ff" });
        return true;
      },
      unlockTrail: (price) => {
        if (get().trailUnlocked || !get().spend(price)) return false;
        set({ trailUnlocked: true, trail: "#ff2bd6" });
        return true;
      },
      buyUpgrade: (id, cost) => {
        if (!get().spend(cost)) return false;
        set({ upgrades: { ...get().upgrades, [id]: get().upgrades[id] + 1 } });
        return true;
      },
      setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      recordRun: (time, tricks) => {
        const s = get();
        const isBest = s.best === null || time < s.best;
        set({
          runs: s.runs + 1,
          best: isBest ? time : s.best,
          bestTricks: Math.max(s.bestTricks, tricks),
        });
        return isBest;
      },
      claimDaily: (day) => set({ lastDaily: day }),
      reset: () => set({ ...initial }),
    }),
    {
      name: "downhill-drive-save-v1",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Save>;
        return {
          ...current,
          ...p,
          upgrades: { ...initial.upgrades, ...(p.upgrades ?? {}) },
          settings: {
            ...initial.settings,
            ...(p.settings ?? {}),
            keys: { ...DEFAULT_KEYS, ...(p.settings?.keys ?? {}) },
          },
        };
      },
    },
  ),
);

export type Mode = "title" | "hub" | "run" | "menu" | "finished";
export type MenuId = "garage" | "dealer" | "tuning";

export type Popup = { id: number; text: string; sub?: string; tone: "gold" | "hot" | "cool" | "bad" };

export type FinishResult = {
  time: number;
  wheels: number;
  tricks: number;
  bestCombo: number;
  isBest: boolean;
  bonus: number;
};

type Hud = {
  speed: number;
  boostState: "ready" | "active" | "cooldown";
  boostFrac: number;
  progress: number;
  time: number;
  combo: number;
  section: string;
  runWheels: number;
  fps: number;
};

type GameState = {
  mode: Mode;
  menu: MenuId | null;
  preview: string | null;
  settingsOpen: boolean;
  chestOpen: boolean;
  setChestOpen: (v: boolean) => void;
  hud: Hud;
  popups: Popup[];
  finish: FinishResult | null;
  hint: string | null;
  setMode: (m: Mode) => void;
  openMenu: (m: MenuId) => void;
  closeMenu: () => void;
  setPreview: (id: string | null) => void;
  setSettingsOpen: (v: boolean) => void;
  setHud: (h: Partial<Hud>) => void;
  popup: (text: string, tone?: Popup["tone"], sub?: string) => void;
  dropPopup: (id: number) => void;
  setFinish: (f: FinishResult | null) => void;
  setHint: (h: string | null) => void;
};

let popupId = 0;

export const useGame = create<GameState>()((set, get) => ({
  mode: "title",
  menu: null,
  preview: null,
  settingsOpen: false,
  chestOpen: false,
  setChestOpen: (v) => set({ chestOpen: v }),
  hud: {
    speed: 0,
    boostState: "ready",
    boostFrac: 1,
    progress: 0,
    time: 0,
    combo: 1,
    section: "",
    runWheels: 0,
    fps: 0,
  },
  popups: [],
  finish: null,
  hint: null,
  setMode: (m) => set({ mode: m }),
  openMenu: (m) => set({ mode: "menu", menu: m, preview: null }),
  closeMenu: () => set({ mode: "hub", menu: null, preview: null }),
  setPreview: (id) => set({ preview: id }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setHud: (h) => set({ hud: { ...get().hud, ...h } }),
  popup: (text, tone = "gold", sub) => {
    const id = ++popupId;
    set({ popups: [...get().popups.slice(-4), { id, text, sub, tone }] });
    setTimeout(() => get().dropPopup(id), 1700);
  },
  dropPopup: (id) => set({ popups: get().popups.filter((p) => p.id !== id) }),
  setFinish: (f) => set({ finish: f }),
  setHint: (h) => {
    if (get().hint !== h) set({ hint: h });
  },
}));
