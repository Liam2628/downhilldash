import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CARS, EQUIPMENT, UPGRADES, type EquipmentId, type UpgradeId } from "./data";

// --- Save integrity -------------------------------------------------------
// The save lives in localStorage, which anyone can edit by hand. To stop a
// hand-edited balance from being trusted, every write is signed with a hash
// of the payload plus a per-install secret salt. On load the signature is
// re-computed; a mismatch (or any out-of-range value) discards the save.

const SALT_KEY = "downhill-dash-salt";

function getSalt(): string {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    salt = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
}

// FNV-1a over the payload twice with the salt — not cryptographic, but it
// means a tampered payload no longer matches its stored signature.
function sign(payload: string): string {
  const salt = getSalt();
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = salt + payload + salt;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 31) + c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

type Wrapped = { v: string; sig: string };

const signedStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const w = JSON.parse(raw) as Wrapped;
      if (typeof w.v !== "string" || typeof w.sig !== "string") return null;
      if (sign(w.v) !== w.sig) return null; // tampered — drop the save
      return w.v;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    localStorage.setItem(name, JSON.stringify({ v: value, sig: sign(value) } satisfies Wrapped));
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

// Clamp anything loaded from storage into known-safe ranges.
const CAR_IDS = new Set(CARS.map((c) => c.id));
const clampInt = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;

export function sanitizeSave(p: Partial<Save>): Partial<Save> {
  const out: Partial<Save> = { ...p };
  out.wheels = clampInt(p.wheels, 0, Number.MAX_SAFE_INTEGER, 0);
  out.xp = clampInt(p.xp, 0, Number.MAX_SAFE_INTEGER, 0);
  out.owned = Array.isArray(p.owned) ? p.owned.filter((id) => CAR_IDS.has(id)) : initial.owned;
  if (out.owned.length === 0) out.owned = initial.owned;
  out.selected = typeof p.selected === "string" && out.owned.includes(p.selected) ? p.selected : out.owned[0];
  out.best = typeof p.best === "number" && Number.isFinite(p.best) && p.best > 0 ? p.best : null;
  out.bestTricks = clampInt(p.bestTricks, 0, 9_999_999, 0);
  out.runs = clampInt(p.runs, 0, 9_999_999, 0);
  out.cheatsUnlocked = p.cheatsUnlocked === true;
  out.equipmentOwned = Array.isArray(p.equipmentOwned) ? p.equipmentOwned.filter((id) => EQUIPMENT.some((e) => e.id === id)) : [];
  out.rims = p.rims === "chrome" || p.rims === "halo" ? (out.equipmentOwned.includes(p.rims) ? p.rims : null) : null;
  out.wing = p.wing === true && out.equipmentOwned.includes("wing");
  out.upgrades = Object.fromEntries(UPGRADES.map((u) => [u.id, clampInt(p.upgrades?.[u.id], 0, u.costs.length, 0)])) as Record<UpgradeId, number>;
  const c = (p.cheats ?? {}) as Partial<Cheats>;
  out.cheats = out.cheatsUnlocked
    ? { unlimitedBoost: c.unlimitedBoost === true, moonGravity: c.moonGravity === true, superSpeed: c.superSpeed === true, fly: c.fly === true, noclip: c.noclip === true, spectator: c.spectator === true }
    : { ...initial.cheats };
  return out;
}

export type Settings = {
  volume: number; // 0..1
  muted: boolean;
  quality: "high" | "low";
  fov: number;
  camDist: number;
  units: "kmh" | "mph";
  showFps: boolean;
  hideUi?: boolean;
  speedLines: boolean;
  hideControls: boolean;
  keys: KeyBinds;
};

export type Action = "up" | "down" | "left" | "right" | "boost" | "spinL" | "spinR" | "rollL" | "rollR" | "level";
export type KeyBinds = Record<Action, string[]>;
export const DEFAULT_KEYS: KeyBinds = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  boost: ["ShiftLeft", "ShiftRight"],
  spinL: ["KeyQ"],
  spinR: ["KeyE"],
  rollL: ["KeyZ"],
  rollR: ["KeyC"],
  level: ["KeyF"],
};

export type Save = {
  wheels: number;
  xp: number;
  owned: string[];
  selected: string;
  paints: Record<string, string | null>;
  glow: string | null;
  glowUnlocked: boolean;
  trail: string | null;
  trailUnlocked: boolean;
  upgrades: Record<UpgradeId, number>;
  equipmentOwned: EquipmentId[];
  rims: "chrome" | "halo" | null;
  wing: boolean;
  settings: Settings;
  best: number | null;
  bestTricks: number;
  runs: number;
  lastDaily: string | null;
  cheatsUnlocked: boolean;
  cheats: Cheats;
};

export type Cheats = { unlimitedBoost: boolean; moonGravity: boolean; superSpeed: boolean; fly: boolean; noclip: boolean; spectator: boolean };

type SaveActions = {
  addWheels: (n: number) => void;
  addXp: (n: number) => void;
  spend: (n: number) => boolean;
  buyCar: (id: string, price: number) => boolean;
  selectCar: (id: string) => void;
  setPaint: (carId: string, hex: string | null) => void;
  setGlow: (hex: string | null) => void;
  setTrail: (hex: string | null) => void;
  unlockGlow: (price: number) => boolean;
  unlockTrail: (price: number) => boolean;
  buyUpgrade: (id: UpgradeId, cost: number) => boolean;
  buyEquipment: (id: EquipmentId) => boolean;
  setRims: (rims: "chrome" | "halo" | null) => void;
  setWing: (v: boolean) => void;
  setSettings: (p: Partial<Settings>) => void;
  recordRun: (time: number, tricks: number) => boolean;
  claimDaily: (day: string) => void;
  reset: () => void;
  unlockCheats: () => void;
  setCheat: (k: keyof Cheats, v: boolean) => void;
  cheatAllCars: () => void;
  cheatMaxUpgrades: () => void;
};

const initial: Save = {
  wheels: 0,
  xp: 0,
  owned: ["sedan"],
  selected: "sedan",
  paints: {},
  glow: null,
  glowUnlocked: false,
  trail: null,
  trailUnlocked: false,
  upgrades: { engine: 0, nitro: 0, cooler: 0, grip: 0, magnet: 0, suspension: 0, aero: 0 },
  equipmentOwned: [],
  rims: null,
  wing: false,
  settings: {
    volume: 1,
    muted: false,
    quality: "high",
    fov: 62,
    camDist: 1,
    units: "kmh",
    showFps: false,
    hideUi: false,
    speedLines: true,
    hideControls: false,
    keys: DEFAULT_KEYS,
  },
  best: null,
  bestTricks: 0,
  runs: 0,
  lastDaily: null,
  cheatsUnlocked: false,
  cheats: { unlimitedBoost: false, moonGravity: false, superSpeed: false, fly: false, noclip: false, spectator: false },
};

export const useSave = create<Save & SaveActions>()(
  persist(
    (set, get) => ({
      ...initial,
      addWheels: (n) => set({ wheels: get().wheels + n }),
      addXp: (n) => set({ xp: get().xp + Math.max(0, Math.round(n)) }),
      spend: (n) => {
        if (get().wheels < n) return false;
        set({ wheels: get().wheels - n });
        return true;
      },
      buyCar: (id, price) => {
        const s = get();
        // Derive the price from the car catalog instead of trusting the caller.
        const car = CARS.find((c) => c.id === id);
        if (!car || car.price !== price) return false;
        if (s.owned.includes(id) || s.wheels < car.price) return false;
        set({ wheels: s.wheels - car.price, owned: [...s.owned, id], selected: id });
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
        const def = UPGRADES.find((u) => u.id === id);
        const level = get().upgrades[id];
        if (!def || level >= def.costs.length || cost !== def.costs[level]) return false;
        if (!get().spend(cost)) return false;
        set({ upgrades: { ...get().upgrades, [id]: get().upgrades[id] + 1 } });
        return true;
      },
      buyEquipment: (id) => {
        const item = EQUIPMENT.find((e) => e.id === id);
        if (!item || get().equipmentOwned.includes(id) || !get().spend(item.price)) return false;
        set({ equipmentOwned: [...get().equipmentOwned, id] });
        return true;
      },
      setRims: (rims) => {
        if (rims === null || get().equipmentOwned.includes(rims)) set({ rims });
      },
      setWing: (v) => {
        if (!v || get().equipmentOwned.includes("wing")) set({ wing: v });
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
      unlockCheats: () => set({ cheatsUnlocked: true }),
      setCheat: (k, v) => {
        if (get().cheatsUnlocked) set({ cheats: { ...get().cheats, [k]: v } });
      },
      cheatAllCars: () => {
        if (get().cheatsUnlocked) set({ owned: CARS.map((c) => c.id) });
      },
      cheatMaxUpgrades: () => {
        if (!get().cheatsUnlocked) return;
        const u = { ...get().upgrades };
        for (const k of Object.keys(u) as UpgradeId[]) u[k] = 5;
        set({ upgrades: u });
      },
    }),
    {
      name: "downhill-drive-save-v1",
      storage: createJSONStorage(() => signedStorage),
      merge: (persisted, current) => {
        const p = sanitizeSave((persisted ?? {}) as Partial<Save>);
        return {
          ...current,
          ...p,
          upgrades: { ...initial.upgrades, ...(p.upgrades ?? {}) },
          settings: {
            ...initial.settings,
            ...(p.settings ?? {}),
            keys: Object.fromEntries(Object.entries({ ...DEFAULT_KEYS, ...(p.settings?.keys ?? {}) }).map(([action, codes]) => [
              action,
              // Migrate the old Q/E roll defaults without changing custom bindings.
              action === "rollL" && codes.length === 1 && codes[0] === "KeyQ" ? ["KeyZ"] :
              action === "rollR" && codes.length === 1 && codes[0] === "KeyE" ? ["KeyC"] : codes,
            ])) as KeyBinds,
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
  distance: number;
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
  testCar: string | null;
  setTestCar: (id: string | null) => void;
  settingsOpen: boolean;
  chestOpen: boolean;
  setChestOpen: (v: boolean) => void;
  hud: Hud;
  popups: Popup[];
  finish: FinishResult | null;
  milestone: FinishResult | null;
  setMilestone: (f: FinishResult | null) => void;
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
  testCar: null,
  setTestCar: (id) => set({ testCar: id }),
  settingsOpen: false,
  chestOpen: false,
  setChestOpen: (v) => set({ chestOpen: v }),
  hud: {
    speed: 0,
    boostState: "ready",
    boostFrac: 1,
    progress: 0,
    distance: 0,
    time: 0,
    combo: 1,
    section: "",
    runWheels: 0,
    fps: 0,
  },
  popups: [],
  finish: null,
  milestone: null,
  setMilestone: (f) => set({ milestone: f }),
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
