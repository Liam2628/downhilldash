export const keys = new Set<string>();

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export function bindInput() {
  const down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    keys.add(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const blur = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

export const k = {
  up: () => keys.has("KeyW") || keys.has("ArrowUp"),
  down: () => keys.has("KeyS") || keys.has("ArrowDown"),
  left: () => keys.has("KeyA") || keys.has("ArrowLeft"),
  right: () => keys.has("KeyD") || keys.has("ArrowRight"),
  boost: () => keys.has("ShiftLeft") || keys.has("ShiftRight"),
  jump: () => keys.has("Space"),
  rollL: () => keys.has("KeyQ"),
  rollR: () => keys.has("KeyE"),
};

/** Orbit camera drag state for menu views */
export const orbit = { yaw: 0, pitch: 0.28, dragging: false, lastX: 0, lastY: 0, idle: 0 };
