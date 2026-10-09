export const keys = new Set<string>();

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export function bindInput() {
  const down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    keys.add(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => { keys.clear(); virtual.boost = false; };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

import { useSave, type Action } from "./store";

/** on-screen buttons */
export const virtual = { boost: false };

const has = (a: Action) => {
  const binds = useSave.getState().settings.keys[a] ?? [];
  for (const c of binds) if (keys.has(c)) return true;
  return false;
};

export const k = {
  up: () => has("up"),
  down: () => has("down"),
  left: () => has("left"),
  right: () => has("right"),
  boost: () => has("boost") || virtual.boost,
  spinL: () => has("spinL"),
  spinR: () => has("spinR"),
  rollL: () => has("rollL"),
  rollR: () => has("rollR"),
  level: () => has("level"),
};

/** Orbit camera drag state for menu views */
export const orbit = { yaw: 0, pitch: 0.28, dragging: false, lastX: 0, lastY: 0, idle: 0 };

/** Human-readable label for a KeyboardEvent.code */
export function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    ShiftLeft: "SHIFT", ShiftRight: "SHIFT", ControlLeft: "L-CTRL", ControlRight: "R-CTRL",
    AltLeft: "L-ALT", AltRight: "R-ALT", Space: "SPACE", Enter: "ENTER", Tab: "TAB",
  };
  return map[code] ?? code.replace("Numpad", "NUM ").toUpperCase();
}

/** true while Settings is waiting for a key to rebind */
export const rebinding = { active: false };
