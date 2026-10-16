import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { signInPlayer, signUpPlayer, requestPasswordReset } from "@/lib/accounts.functions";
import { useAccount, signOut } from "../account";

const stop = (e: React.KeyboardEvent) => e.stopPropagation();
const input = "w-full rounded-xl bg-panel-foreground/10 px-3 py-2 text-panel-foreground outline-none focus:ring-2 focus:ring-hot";

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "forgot") {
        const r = await requestPasswordReset({ data: { username, origin: window.location.origin } });
        setMsg(r.message);
        return;
      }
      const r = mode === "up"
        ? await signUpPlayer({ data: { username, password, email } })
        : await signInPlayer({ data: { username, password } });
      if ("error" in r && r.error) return setMsg(r.error);
      if ("access_token" in r) await supabase.auth.setSession({ access_token: r.access_token!, refresh_token: r.refresh_token! });
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setMsg(m.includes("Username must") ? "Username must be 3–20 letters, numbers or _" : m.includes("8 characters") ? "Password must be at least 8 characters" : m.includes("email") ? "That email doesn't look right" : "Something went wrong, try again");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) setMsg(`${provider === "google" ? "Google" : "Apple"} sign-in didn't work, try again`);
  };

  return (
    <div className="space-y-3" onKeyDown={stop} onKeyUp={stop}>
      {mode !== "forgot" && (
        <div className="text-center">
          <div className="font-display text-xl text-gold">{mode === "up" ? "CREATE ACCOUNT" : "WELCOME BACK"}</div>
          <p className="text-xs opacity-70">
            {mode === "up" ? "Sign up to save your cars, wheels and upgrades." : "Log in to load your saved cars, wheels and upgrades."}
          </p>
        </div>
      )}
      <form className="space-y-2" onSubmit={submit}>
        <input className={input} placeholder={mode === "up" ? "Username" : "Username or email"} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        {mode !== "forgot" && (
          <input className={input} type="password" placeholder="Password" autoComplete={mode === "up" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
        )}
        {mode === "up" && (
          <>
            <input className={input} type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs opacity-70">Adding an email lets you reset your password if you forget it.</p>
          </>
        )}
        {msg && <p className="text-sm text-gold">{msg}</p>}
        <button className="btn-game w-full" disabled={busy}>
          {busy ? "..." : mode === "up" ? "SIGN UP" : mode === "in" ? "LOG IN" : "SEND RESET LINK"}
        </button>
      </form>
      {mode !== "forgot" && (
        <>
          <button className="btn-game btn-ghost w-full" onClick={() => void oauth("google")}>CONTINUE WITH GOOGLE</button>
          <button className="btn-game btn-ghost w-full" onClick={() => void oauth("apple")}>CONTINUE WITH APPLE</button>
        </>
      )}
      <div className="flex justify-between text-sm">
        <button className="underline opacity-80" onClick={() => { setMode(mode === "up" ? "in" : "up"); setMsg(null); }}>
          {mode === "up" ? "Already have an account? Log in" : "Need an account? Sign up"}
        </button>
        {mode === "in" && <button className="underline opacity-80" onClick={() => { setMode("forgot"); setMsg(null); }}>Forgot password?</button>}
        {mode === "forgot" && <button className="underline opacity-80" onClick={() => setMode("in")}>Back</button>}
      </div>
    </div>
  );
}

export function AccountSection() {
  const { ready, userId, username, email, syncing } = useAccount();
  if (!ready) return <p className="py-4 opacity-70">Loading…</p>;
  if (!userId) {
    return (
      <div className="py-2">
        <p className="mb-3 text-sm opacity-80">Sign in to save your wheels, cars and upgrades and play on any device.</p>
        <AuthForm />
      </div>
    );
  }
  return (
    <div className="space-y-3 py-2">
      <div className="rounded-xl bg-panel-foreground/10 p-3">
        <div className="font-display text-xl text-gold">{username ?? "Player"}</div>
        <div className="text-sm opacity-70">{email ?? "No email added"}</div>
        <div className="mt-1 text-xs opacity-70">{syncing ? "Syncing progress…" : "Progress saved to your account"}</div>
      </div>
      <button className="btn-game btn-ghost w-full" onClick={() => void signOut()}>SIGN OUT</button>
    </div>
  );
}

export function AccountPrompt() {
  const open = useAccount((s) => s.promptOpen && !s.userId);
  const setOpen = useAccount((s) => s.setPromptOpen);
  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-panel/40" onClick={() => setOpen(false)}>
      <div className="panel animate-scale-in w-[min(420px,94vw)] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-2xl text-gold">SAVE YOUR PROGRESS</h2>
          <button aria-label="Close" className="btn-game btn-ghost !p-2" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm opacity-80">Make a free account so you never lose your wheels and cars.</p>
        <AuthForm />
      </div>
    </div>
  );
}

export function TitleAccount() {
  const { ready, userId, username } = useAccount();
  const setOpen = useAccount((s) => s.setPromptOpen);
  if (!ready) return null;
  if (userId) return <div className="mt-3 font-display text-panel-foreground text-outline">Signed in as {username ?? "player"}</div>;
  return (
    <button className="btn-game btn-ghost mt-3 px-6 py-2" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
      LOG IN / SIGN UP
    </button>
  );
}
