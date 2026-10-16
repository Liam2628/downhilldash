import { AccountSection } from "./Account";
import { useEffect, useRef, useState } from "react";
import { keyLabel, rebinding } from "../input";
import { DEFAULT_KEYS, type Action } from "../store";

const ACTIONS: { a: Action; label: string }[] = [
  { a: "up", label: "Accelerate / flip forward" },
  { a: "down", label: "Brake / reverse / flip back" },
  { a: "left", label: "Steer left" },
  { a: "right", label: "Steer right" },
  { a: "boost", label: "Boost" },
  { a: "level", label: "Airbrake / level (air)" },
];

function ControlsSection() {
  const s = useSave((st) => st.settings);
  const set = useSave((st) => st.setSettings);
  const [listen, setListen] = useState<{ a: Action; slot: number } | null>(null);

  useEffect(() => {
    rebinding.active = listen !== null;
    if (!listen) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        setListen(null);
        return;
      }
      if (e.code === "Space") return; // reserved: back to lobby
      const keys = { ...s.keys };
      // a key can only do one thing
      for (const k of Object.keys(keys) as Action[]) keys[k] = keys[k].filter((c) => c !== e.code);
      const list = [...keys[listen.a]];
      list[listen.slot] = e.code;
      keys[listen.a] = list.filter(Boolean);
      set({ keys });
      audio.play("ui");
      setListen(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      rebinding.active = false;
    };
  }, [listen, s.keys, set]);

  return (
    <div className="py-2.5">
      <Row label="Show controls card">
        <Seg value={s.hideControls ? "off" : "on"} options={[{ v: "on", label: "ON" }, { v: "off", label: "OFF" }]} onChange={(v) => set({ hideControls: v === "off" })} />
      </Row>
      <div className="mt-1 space-y-1.5">
        {ACTIONS.map(({ a, label }) => (
          <div key={a} className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-85">{label}</span>
            <div className="flex gap-1.5">
              {[0, 1].map((slot) => {
                const code = s.keys[a][slot];
                const active = listen?.a === a && listen.slot === slot;
                return (
                  <button
                    key={slot}
                    className={`min-w-20 rounded-lg px-2 py-1 font-display text-[11px] ${active ? "bg-hot text-primary-foreground animate-pulse" : "bg-panel-foreground/10 hover:bg-panel-foreground/20"}`}
                    onClick={() => setListen(active ? null : { a, slot })}
                  >
                    {active ? "PRESS A KEY" : code ? keyLabel(code) : "+ ADD"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] opacity-70">
        <span>Space always returns to the lobby during a run</span>
        <button className="underline" onClick={() => set({ keys: DEFAULT_KEYS })}>
          Reset keys
        </button>
      </div>
    </div>
  );
}
import { X } from "lucide-react";
import { useGame, useSave } from "../store";
import { audio } from "../audio";
import { returnToLobby } from "../physics";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-panel-foreground/10 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          className={`rounded-lg px-3 py-1 font-display text-xs ${value === o.v ? "bg-hot text-primary-foreground" : "opacity-75"}`}
          onClick={() => {
            audio.play("ui");
            onChange(o.v);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ value, min, max, step, onChange, fmt }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 accent-[var(--hot)]"
      />
      <span className="w-12 text-right font-mono text-xs">{fmt(value)}</span>
    </>
  );
}

export function SettingsModal() {
  const s = useSave((st) => st.settings);
  const set = useSave((st) => st.setSettings);
  const reset = useSave((st) => st.reset);
  const close = useGame((st) => st.setSettingsOpen);
  const mode = useGame((st) => st.mode);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<"general" | "controls" | "codes" | "account">("general");

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-panel/40" onClick={() => close(false)}>
      <div className="panel animate-scale-in w-[min(520px,94vw)] max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-3xl text-gold">SETTINGS</h2>
          <button aria-label="Close settings" className="btn-game btn-ghost !p-2" onClick={() => close(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-2 flex gap-2">
          {(["general", "controls", "codes", "account"] as const).map((t) => (
            <button
              key={t}
              className={`flex-1 rounded-xl py-2 font-display text-sm ${tab === t ? "bg-hot text-primary-foreground" : "bg-panel-foreground/10"}`}
              onClick={() => {
                audio.play("ui");
                setTab(t);
              }}
            >
              {t === "general" ? "GENERAL" : t === "controls" ? "CONTROLS" : t === "codes" ? "CODES" : "ACCOUNT"}
            </button>
          ))}
        </div>
        {tab === "controls" ? (
          <ControlsSection />
        ) : tab === "codes" ? (
          <CodesSection />
        ) : tab === "account" ? (
          <AccountSection />
        ) : (
        <div className="divide-y divide-panel-foreground/10">
          <Row label="Volume">
            <Slider value={s.volume} min={0} max={1} step={0.05} onChange={(v) => set({ volume: v, muted: false })} fmt={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Graphics">
            <Seg value={s.quality} options={[{ v: "high", label: "HIGH" }, { v: "low", label: "PERFORMANCE" }]} onChange={(v) => set({ quality: v })} />
          </Row>
          <Row label="Field of view">
            <Slider value={s.fov} min={50} max={85} step={1} onChange={(v) => set({ fov: v })} fmt={(v) => `${v}°`} />
          </Row>
          <Row label="Camera distance">
            <Slider value={s.camDist} min={0.7} max={1.5} step={0.05} onChange={(v) => set({ camDist: v })} fmt={(v) => `${v.toFixed(2)}x`} />
          </Row>
          <Row label="Speed units">
            <Seg value={s.units} options={[{ v: "kmh", label: "KM/H" }, { v: "mph", label: "MPH" }]} onChange={(v) => set({ units: v })} />
          </Row>
          <Row label="Speed lines">
            <Seg value={s.speedLines ? "on" : "off"} options={[{ v: "on", label: "ON" }, { v: "off", label: "OFF" }]} onChange={(v) => set({ speedLines: v === "on" })} />
          </Row>
          <Row label="Hide all UI on the road">
            <Seg value={s.hideUi ? "on" : "off"} options={[{ v: "on", label: "ON" }, { v: "off", label: "OFF" }]} onChange={(v) => set({ hideUi: v === "on" })} />
          </Row>
          <Row label="Show FPS">
            <Seg value={s.showFps ? "on" : "off"} options={[{ v: "on", label: "ON" }, { v: "off", label: "OFF" }]} onChange={(v) => set({ showFps: v === "on" })} />
          </Row>
        </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {(mode === "run" || mode === "hub") && (
            <button
              className="btn-game btn-cool flex-1"
              onClick={() => {
                returnToLobby();
                close(false);
              }}
            >
              BACK TO LOBBY
            </button>
          )}
          <button className="btn-game btn-ghost flex-1" onClick={() => setConfirm(true)}>
            RESET PROGRESS
          </button>
        </div>
        {confirm && (
          <ResetConfirm
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              reset();
              setConfirm(false);
              returnToLobby();
              close(false);
            }}
          />
        )}
        <p className="mt-3 text-center text-xs opacity-60">Esc to close · M to mute · Progress saves automatically</p>
      </div>
    </div>
  );
}

// SHA-256 of the unlock code; the code itself never appears in source.
const CODE_HASH = "51c94a510b50e68f490e35edd977845f9b008e3bb1a5c7f0d8eecf8b0b9794bf";

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function CodesSection() {
  const unlocked = useSave((st) => st.cheatsUnlocked);
  const cheats = useSave((st) => st.cheats);
  const save = useSave.getState;
  const popup = useGame((st) => st.popup);
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  if (!unlocked) {
    return (
      <form
        className="py-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if ((await sha256Hex(code.trim())) === CODE_HASH) {
            save().unlockCheats();
            audio.play("ui");
            popup("CHEATS UNLOCKED", "gold");
          } else setErr(true);
          setCode("");
        }}
      >
        <label className="text-sm font-medium">Enter code</label>
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setErr(false);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="flex-1 rounded-xl bg-panel-foreground/10 px-3 py-2 font-mono text-sm outline-none"
            placeholder="••••"
          />
          <button type="submit" className="btn-game btn-cool">UNLOCK</button>
        </div>
        {err && <p className="mt-2 text-xs text-bad">Wrong code</p>}
      </form>
    );
  }

  const toggles: { k: keyof typeof cheats; label: string }[] = [
    { k: "unlimitedBoost", label: "Unlimited Boost" },
    { k: "moonGravity", label: "Moon Gravity" },
    { k: "superSpeed", label: "Super Speed" },
    { k: "fly", label: "Fly (E up · Q down)" },
    { k: "noclip", label: "Noclip (fly through anything)" },
    { k: "spectator", label: "Spectator (free camera)" },
  ];
  const actions = [
    { label: "+50,000 WHEELS", run: () => save().addWheels(50_000) },
    { label: "UNLOCK ALL CARS", run: () => save().cheatAllCars() },
    { label: "MAX ALL UPGRADES", run: () => save().cheatMaxUpgrades() },
  ];
  return (
    <div className="py-2">
      <h3 className="font-display text-sm text-gold">RUN TOGGLES</h3>
      <div className="divide-y divide-panel-foreground/10">
        {toggles.map((t) => (
          <Row key={t.k} label={t.label}>
            <Seg
              value={cheats[t.k] ? "on" : "off"}
              options={[{ v: "on", label: "ON" }, { v: "off", label: "OFF" }]}
              onChange={(v) => save().setCheat(t.k, v === "on")}
            />
          </Row>
        ))}
      </div>
      <h3 className="mt-3 font-display text-sm text-gold">ONE-TAP ACTIONS</h3>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {actions.map((a) => (
          <button
            key={a.label}
            className="btn-game btn-cool text-xs"
            onClick={() => {
              a.run();
              audio.play("ui");
              popup(a.label, "gold");
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ARM_DELAY = 1000;
const HOLD_TIME = 1000;

function ResetConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_DELAY);
    return () => {
      clearTimeout(t);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const stop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setHolding(false);
    if (!done.current) setProgress(0);
  };
  const begin = (e: React.PointerEvent) => {
    if (!armed || done.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setHolding(true);
    start.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start.current) / HOLD_TIME);
      setProgress(p);
      if (p >= 1) {
        done.current = true;
        raf.current = null;
        setHolding(false);
        onConfirm();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const label = !armed ? "PLEASE WAIT..." : holding ? "KEEP HOLDING..." : "HOLD TO RESET";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel/60" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="reset-title" className="panel animate-scale-in w-[min(380px,90vw)] p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 id="reset-title" className="font-display text-2xl text-gold">ARE YOU SURE?</h3>
        <p className="mt-2 text-sm opacity-80">This erases all your wheels, cars, upgrades and records. It can't be undone.</p>
        <button
          disabled={!armed}
          aria-label="Hold to reset progress"
          className={`relative mt-5 w-full select-none overflow-hidden rounded-xl py-3 font-display text-sm text-primary-foreground transition-opacity ${armed ? "bg-bad/70 cursor-pointer" : "bg-bad/30 cursor-not-allowed opacity-60"}`}
          style={{ touchAction: "none" }}
          onPointerDown={begin}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="absolute inset-y-0 left-0 bg-bad" style={{ width: `${progress * 100}%` }} />
          <span className="relative">{label}</span>
        </button>
        <button className="btn-game btn-ghost mt-3 w-full" onClick={() => { audio.play("ui"); onCancel(); }}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
