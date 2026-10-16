import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSave, useSave, useGame, type Save } from "./store";

type AccountState = {
  ready: boolean;
  userId: string | null;
  username: string | null;
  email: string | null;
  syncing: boolean;
  promptOpen: boolean;
  setPromptOpen: (v: boolean) => void;
};

export const useAccount = create<AccountState>()((set) => ({
  ready: false,
  userId: null,
  username: null,
  email: null,
  syncing: false,
  promptOpen: false,
  setPromptOpen: (v) => set({ promptOpen: v }),
}));

const SAVE_KEYS: (keyof Save)[] = [
  "wheels", "xp", "owned", "selected", "paints", "glow", "glowUnlocked", "trail", "trailUnlocked",
  "upgrades", "equipmentOwned", "rims", "wing", "best", "bestTricks", "runs", "lastDaily", "cheatsUnlocked", "cheats",
];

function snapshot() {
  const s = useSave.getState();
  return Object.fromEntries(SAVE_KEYS.map((k) => [k, s[k]]));
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubSave: (() => void) | null = null;

async function push(userId: string) {
  await supabase.from("saves").upsert({ user_id: userId, data: snapshot() as never, updated_at: new Date().toISOString() });
}

async function attach(userId: string) {
  useAccount.setState({ syncing: true });
  const { data } = await supabase.from("saves").select("data").eq("user_id", userId).maybeSingle();
  if (data?.data && typeof data.data === "object") {
    // Cloud save wins so progress follows the player to any device.
    useSave.setState(sanitizeSave(data.data as Partial<Save>));
  } else {
    await push(userId);
  }
  useAccount.setState({ syncing: false });
  unsubSave?.();
  unsubSave = useSave.subscribe(() => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(userId), 2500);
  });
}

function detach() {
  unsubSave?.();
  unsubSave = null;
  if (pushTimer) clearTimeout(pushTimer);
}

async function loadUser() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    detach();
    useAccount.setState({ ready: true, userId: null, username: null, email: null });
    return;
  }
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const email = user.email && !user.email.endsWith("@players.downhilldash.app") ? user.email : null;
  const changed = useAccount.getState().userId !== user.id;
  useAccount.setState({ ready: true, userId: user.id, username: profile?.username ?? null, email, promptOpen: false });
  if (changed) await attach(user.id);
}

let started = false;
export function startAccount() {
  if (started) return () => {};
  started = true;
  void loadUser();
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void loadUser();
  });
  // Ask signed-out players to make an account after 3 minutes of playing.
  let played = 0;
  let asked = false;
  const tick = setInterval(() => {
    const mode = useGame.getState().mode;
    if (mode === "hub" || mode === "run" || mode === "menu") played++;
    const a = useAccount.getState();
    if (!asked && played >= 180 && a.ready && !a.userId) {
      asked = true;
      a.setPromptOpen(true);
    }
  }, 1000);
  return () => {
    started = false;
    data.subscription.unsubscribe();
    clearInterval(tick);
    detach();
  };
}

export async function signOut() {
  const id = useAccount.getState().userId;
  if (id) await push(id);
  detach();
  await supabase.auth.signOut();
}
