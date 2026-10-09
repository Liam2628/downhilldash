import { create } from "zustand";

/** Daily stunt quests + split-time personal bests (kept in their own browser storage keys). */
export type QuestId = "backflips" | "pads" | "combo";
export const QUESTS: { id: QuestId; label: string; goal: number; reward: number }[] = [
  { id: "backflips", label: "Do 2 backflips in one run", goal: 2, reward: 300 },
  { id: "pads", label: "Hit 4 boost pads in one run", goal: 4, reward: 250 },
  { id: "combo", label: "Reach a 4.0x combo", goal: 4, reward: 400 },
];

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

type QState = { day: string; best: Record<QuestId, number>; done: Record<QuestId, boolean> };
const blank = (): QState => ({ day: dayKey(), best: { backflips: 0, pads: 0, combo: 1 }, done: { backflips: false, pads: false, combo: false } });

function load(): QState {
  try {
    const raw = JSON.parse(localStorage.getItem("dd-quests") || "null") as QState | null;
    if (raw && raw.day === dayKey() && raw.best && raw.done) return raw;
  } catch { /* ignore */ }
  return blank();
}

export const useQuests = create<QState & { run: Record<QuestId, number> }>(() => ({
  ...(typeof window === "undefined" ? blank() : load()),
  run: { backflips: 0, pads: 0, combo: 1 },
}));

const persistQ = () => {
  const { day, best, done } = useQuests.getState();
  try { localStorage.setItem("dd-quests", JSON.stringify({ day, best, done })); } catch { /* ignore */ }
};

export function questsNewRun() {
  if (useQuests.getState().day !== dayKey()) useQuests.setState(blank());
  useQuests.setState({ run: { backflips: 0, pads: 0, combo: 1 } });
}

/** Records progress; returns completed quests (to be rewarded by the caller). */
export function questProgress(id: QuestId, value: number) {
  const s = useQuests.getState();
  const run = { ...s.run, [id]: value };
  const best = { ...s.best, [id]: Math.max(s.best[id], value) };
  const q = QUESTS.find((x) => x.id === id)!;
  let completed: typeof q | null = null;
  const done = { ...s.done };
  if (!done[id] && value >= q.goal) { done[id] = true; completed = q; }
  useQuests.setState({ run, best, done });
  persistQ();
  return completed;
}

// ---- split times ----
export const SPLITS = [
  { s: 150, name: "RAMP ALLEY" },
  { s: 560, name: "LOOP DE LOOP" },
  { s: 880, name: "MEGA JUMP" },
];

export function loadSplitPB(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem("dd-splits") || "null");
    if (Array.isArray(v) && v.length === SPLITS.length) return v.map((n) => (typeof n === "number" && n > 0 ? n : 0));
  } catch { /* ignore */ }
  return SPLITS.map(() => 0);
}
export function saveSplitPB(pb: number[]) {
  try { localStorage.setItem("dd-splits", JSON.stringify(pb)); } catch { /* ignore */ }
}

/** camera views cycled with V: 0 close chase, 1 far chase, 2 hood */
export const view = { mode: 0 };
export const VIEW_NAMES = ["CLOSE CHASE", "FAR CHASE", "HOOD CAM"];
