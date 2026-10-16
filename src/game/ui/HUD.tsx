import { AccountPrompt, TitleAccount } from "./Account";
import { useEffect, useRef, useState } from "react";
import { QUESTS, useQuests } from "../quests";
import { useGame, useSave } from "../store";
import { audio } from "../audio";
import { returnToLobby } from "../physics";
import { WheelIcon } from "./WheelIcon";
import { MenuPanel } from "./Menus";
import { SettingsModal } from "./Settings";
import { Settings2, ShoppingCart, Volume2, VolumeX, X, Zap } from "lucide-react";
import { keyLabel, virtual } from "../input";
import type { Action } from "../store";
import { DailyChest } from "./DailyChest";
import tireLogo from "@/assets/tire-logo.png";
import { LOOPS, dcAt } from "../track";

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function WheelCounter() {
  const wheels = useSave((s) => s.wheels);
  const [bump, setBump] = useState(0);
  const prev = useRef(wheels);
  useEffect(() => {
    if (wheels > prev.current) setBump((b) => b + 1);
    prev.current = wheels;
  }, [wheels]);
  return (
    <div className="hud-chip flex items-center gap-2 px-3 py-1.5">
      <span key={bump} className="animate-wheel-bump inline-flex">
        <WheelIcon className="h-8 w-8" />
      </span>
      <span className="font-display text-2xl text-gold tabular-nums">{wheels.toLocaleString()}</span>
    </div>
  );
}

function XpCounter() {
  const xp = useSave((s) => s.xp);
  const [bump, setBump] = useState(0);
  const prev = useRef(xp);
  useEffect(() => {
    if (xp > prev.current) setBump((b) => b + 1);
    prev.current = xp;
  }, [xp]);
  return (
    <div className="hud-chip flex items-center gap-2 px-3 py-1" aria-label="Experience points">
      <span key={bump} className="animate-wheel-bump inline-flex rounded-md bg-cool px-1.5 font-display text-xs text-panel">XP</span>
      <span className="font-display text-lg text-cool tabular-nums">{xp.toLocaleString()}</span>
    </div>
  );
}

function TopBar() {
  const setSettingsOpen = useGame((s) => s.setSettingsOpen);
  const muted = useSave((s) => s.settings.muted);
  const setSettings = useSave((s) => s.setSettings);
  const showFps = useSave((s) => s.settings.showFps);
  const fps = useGame((s) => s.hud.fps);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="flex flex-col items-start gap-1.5">
          <WheelCounter />
          <XpCounter />
        </div>
        {showFps && <div className="hud-chip px-2 py-1 font-mono text-xs">{fps} FPS</div>}
      </div>
      <div className="pointer-events-auto flex gap-2">
        <button
          aria-label="Shop"
          className="hud-chip p-2.5"
          onClick={() => {
            audio.play("ui");
            useGame.getState().openMenu("tuning");
          }}
        >
          <ShoppingCart className="h-5 w-5" />
        </button>
        <button
          aria-label={muted ? "Unmute" : "Mute"}
          className="hud-chip p-2.5"
          onClick={() => setSettings({ muted: !muted })}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          aria-label="Settings"
          className="hud-chip p-2.5"
          onClick={() => {
            audio.play("ui");
            setSettingsOpen(true);
          }}
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function Speedo() {
  const speed = useGame((s) => s.hud.speed);
  const units = useSave((s) => s.settings.units);
  const v = units === "kmh" ? speed * 3.6 : speed * 2.237;
  const boostState = useGame((s) => s.hud.boostState);
  const boostFrac = useGame((s) => s.hud.boostFrac);
  const combo = useGame((s) => s.hud.combo);
  const label = boostState === "ready" ? "BOOST READY" : boostState === "active" ? "BOOSTING!" : "COOLING DOWN";
  const barColor = boostState === "ready" ? "bg-cool" : boostState === "active" ? "bg-hot" : "bg-panel-foreground/40";
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {combo > 1 && (
        <div className="font-display text-xl text-hot text-outline">COMBO x{combo.toFixed(1)}</div>
      )}
      <div className="flex items-end gap-1">
        <span className="font-display text-6xl leading-none text-panel-foreground text-outline tabular-nums">
          {Math.round(v)}
        </span>
        <span className="mb-1 font-display text-lg text-panel-foreground/80 text-outline">
          {units === "kmh" ? "KM/H" : "MPH"}
        </span>
      </div>
      <div className="panel w-72 px-3 py-2">
        <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wider">
          <span className={boostState === "ready" ? "text-cool" : boostState === "active" ? "text-hot" : "opacity-70"}>{label}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-panel-foreground/10">
          <div className={`h-full rounded-full ${barColor} transition-[width] duration-100`} style={{ width: `${boostFrac * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function RunBar() {
  const distance = useGame((s) => s.hud.distance);
  const time = useGame((s) => s.hud.time);
  const section = useGame((s) => s.hud.section);
  const runWheels = useGame((s) => s.hud.runWheels);
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 w-[min(560px,60vw)] -translate-x-1/2">
      <div className="hud-chip px-4 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-sm text-gold">{section}</span>
          <span className="font-display text-xl tabular-nums">{fmtTime(time)}</span>
          <span className="flex items-center gap-1 font-display text-sm text-gold">
            +{runWheels} <WheelIcon className="h-4 w-4" />
          </span>
        </div>
        <div className="text-center font-display text-lg tabular-nums text-hot">{Math.round(distance)} M</div>
        <AheadStrip distance={distance} />
      </div>
    </div>
  );
}

const AHEAD_RANGE = 300;
type AheadMark = { d: number; kind: "loop" | "left" | "right" };
function upcoming(s: number): AheadMark[] {
  const marks: AheadMark[] = [];
  for (const lp of LOOPS) {
    const d = lp.s - s;
    if (d > 0 && d <= AHEAD_RANGE) marks.push({ d, kind: "loop" });
  }
  // Sharp curve = strong heading change; mark the start of each bend.
  let inBend = false;
  for (let d = 5; d <= AHEAD_RANGE; d += 5) {
    const k = dcAt(s + d + 2) - dcAt(s + d - 2);
    const sharp = Math.abs(dcAt(s + d)) > 0.16 && Math.abs(k) > 0.004;
    if (sharp && !inBend) marks.push({ d, kind: dcAt(s + d) > 0 ? "right" : "left" });
    inBend = sharp;
  }
  return marks;
}

function AheadStrip({ distance }: { distance: number }) {
  const marks = upcoming(distance);
  const next = [...marks].sort((a, b) => a.d - b.d)[0];
  return (
    <div className="mt-1.5">
      <div className="relative h-5 rounded-full bg-foreground/10">
        <span className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-hot" />
        {marks.map((m, i) => (
          <span
            key={i}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xs leading-none ${m.kind === "loop" ? "text-hot" : "text-gold"}`}
            style={{ left: `${4 + (m.d / AHEAD_RANGE) * 92}%` }}
          >
            {m.kind === "loop" ? "◯" : m.kind === "left" ? "↰" : "↱"}
          </span>
        ))}
      </div>
      {next && (
        <div className="mt-0.5 text-center font-display text-xs text-gold">
          {next.kind === "loop" ? "LOOP" : next.kind === "left" ? "SHARP LEFT" : "SHARP RIGHT"} IN {Math.round(next.d)} M
        </div>
      )}
    </div>
  );
}


function Popups() {
  const popups = useGame((s) => s.popups);
  const tone = { gold: "text-gold", hot: "text-hot", cool: "text-cool", bad: "text-bad" } as const;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[22%] flex -translate-x-1/2 flex-col items-center gap-1">
      {popups.map((p) => (
        <div key={p.id} className="animate-pop-rise text-center">
          <div className={`font-display text-4xl md:text-5xl ${tone[p.tone]} text-outline`}>{p.text}</div>
          {p.sub && <div className="font-display text-lg text-panel-foreground text-outline">{p.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function Controls() {
  const mode = useGame((s) => s.mode);
  const hidden = useSave((s) => s.settings.hideControls);
  const keysB = useSave((s) => s.settings.keys);
  const setSettings = useSave((s) => s.setSettings);
  if (hidden) return null;
  const kb = (a: Action) => keysB[a].map(keyLabel).join(" / ") || "—";
  const drive = `${kb("up")} ${kb("left")} ${kb("down")} ${kb("right")}`;
  const rows: [string, string][] =
    mode === "run"
      ? [
          [drive, "Drive / steer"],
          [kb("boost"), "Boost"],
          ["AIR: double press " + kb("up") + "/" + kb("down"), "Front / back flip"],
          ["AIR: double press " + kb("left") + "/" + kb("right"), "Barrel roll"],
           ["AIR: " + kb("level"), "Airbrake / level"],
          ["V", "Camera view"],
          ["SPACE / R", "Back to lobby"],
        ]
      : [
          [drive, "Drive"],
          [kb("boost"), "Boost"],
          ["ESC", "Settings"],
        ];
  return (
    <div className="pointer-events-auto absolute bottom-5 left-5 hidden md:block">
      <div className="panel relative px-3 py-2 pr-8 text-xs">
        <button
          aria-label="Hide controls"
          title="Hide controls (turn back on in Settings)"
          className="absolute right-1.5 top-1.5 rounded-md p-1 opacity-70 hover:bg-panel-foreground/15 hover:opacity-100"
          onClick={() => {
            audio.play("ui");
            setSettings({ hideControls: true });
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {rows.map(([key, what]) => (
          <div key={what} className="flex items-center gap-2 py-0.5">
            <span className="min-w-16 rounded-md bg-panel-foreground/15 px-1.5 py-0.5 text-center font-display text-[10px]">{key}</span>
            <span className="opacity-85">{what}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestPanel() {
  const run = useQuests((s) => s.run);
  const best = useQuests((s) => s.best);
  const done = useQuests((s) => s.done);
  return (
    <div className="pointer-events-none absolute right-4 top-32 w-64 rounded-xl border-2 border-panel-border bg-panel/90 p-3 text-panel-foreground shadow-[var(--shadow-chunky)]">
      <div className="mb-2 font-display text-sm text-gold">DAILY QUESTS</div>
      {QUESTS.map((q) => {
        const v = Math.min(q.goal, Math.max(run[q.id], q.id === "combo" ? best[q.id] : run[q.id]));
        return (
          <div key={q.id} className={`mb-1.5 text-xs ${done[q.id] ? "opacity-60 line-through" : ""}`}>
            <div className="flex justify-between gap-2"><span>{q.label}</span><span className="text-gold">+{q.reward}</span></div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-panel-foreground/15">
              <div className="h-full rounded-full bg-cool" style={{ width: `${(done[q.id] ? 1 : v / q.goal) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useTouchDevice() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const on = () => setTouch(mq.matches || navigator.maxTouchPoints > 0 && !window.matchMedia("(pointer: fine)").matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return touch;
}

function BoostButton() {
  const touch = useTouchDevice();
  const boostState = useGame((s) => s.hud.boostState);
  const boostFrac = useGame((s) => s.hud.boostFrac);
  const release = () => (virtual.boost = false);
  const ready = boostState === "ready";
  if (!touch) return null;
  return (
    <button
      aria-label="Boost"
      className={`pointer-events-auto absolute bottom-6 right-6 flex h-24 w-24 select-none flex-col items-center justify-center rounded-full border-4 font-display text-lg shadow-[var(--shadow-chunky)] transition-transform active:translate-y-1 ${
        ready ? "border-panel-foreground bg-hot text-primary-foreground" : boostState === "active" ? "border-gold bg-gold text-gold-foreground" : "border-panel-border bg-panel text-panel-foreground/70"
      }`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        virtual.boost = true;
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      <Zap className="h-8 w-8" />
      <span className="text-xs">{ready ? "BOOST" : boostState === "active" ? "GO!" : `${Math.round(boostFrac * 100)}%`}</span>
    </button>
  );
}

function Hint() {
  const hint = useGame((s) => s.hint);
  const mode = useGame((s) => s.mode);
  if (!hint || mode !== "hub") return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2">
      <div className="hud-chip animate-fade-in px-5 py-2.5 font-display text-lg text-gold">{hint}</div>
    </div>
  );
}

function SpeedLines() {
  const speed = useGame((s) => s.hud.speed);
  const boost = useGame((s) => s.hud.boostState === "active");
  const enabled = useSave((s) => s.settings.speedLines);
  const mode = useGame((s) => s.mode);
  if (!enabled || mode === "menu" || mode === "title") return null;
  const o = boost ? 0.9 : Math.max(0, (speed - 40) / 30) * 0.6;
  if (o <= 0.02) return null;
  return <div className="speed-lines pointer-events-none absolute inset-0" style={{ opacity: o }} />;
}

function TitleScreen() {
  const setMode = useGame((s) => s.setMode);
  const wheels = useSave((s) => s.wheels);
  const runs = useSave((s) => s.runs);
  const start = () => {
    audio.init();
    audio.play("buy");
    setMode("hub");
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") start();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-transparent to-panel/60">
      <div className="animate-title-bob text-center">
        <div className="font-display text-sm tracking-[0.4em] text-panel-foreground text-outline">A DOWNHILL STUNT SIMULATOR</div>
        <h1 className="font-display text-6xl leading-[1.05] text-panel-foreground text-outline sm:text-7xl md:text-9xl">
          D
          <img
            src={tireLogo}
            alt="O"
            className="mx-[-0.08em] inline-block h-[0.95em] w-[0.95em] translate-y-[0.08em] rounded-full object-cover align-baseline"
          />
          WNHILL
          <br />
          <span className="inline-block skew-x-[-9deg] text-hot">DASH</span>
        </h1>
      </div>
      <p className="mt-6 max-w-md text-center text-lg font-medium text-panel-foreground text-outline">
        Roll out of the lobby, drop down the concrete mountain, hit ramps, loops and boost pads, and stack tricks for
        wheels.
      </p>
      <button className="btn-game btn-hot mt-8 px-10 py-4 text-3xl" onClick={start}>
        PLAY
      </button>
      <TitleAccount />
      {(wheels > 0 || runs > 0) && (
        <div className="mt-4 flex items-center gap-2 font-display text-panel-foreground text-outline">
          Welcome back · <WheelIcon className="h-5 w-5" /> {wheels.toLocaleString()}
        </div>
      )}
      <div className="absolute bottom-4 text-xs text-panel-foreground/80 text-outline">Best with keyboard</div>
    </div>
  );
}

function FinishPanel() {
  const f = useGame((s) => s.finish);
  const best = useSave((s) => s.best);
  if (!f) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-panel/30">
      <div className="panel animate-scale-in w-[min(440px,92vw)] p-7 text-center">
        <div className="font-display text-5xl text-gold text-outline">FINISH!</div>
        {f.isBest && <div className="mt-1 font-display text-hot">NEW PERSONAL BEST</div>}
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <Stat label="Time" value={fmtTime(f.time)} />
          <Stat label="Best" value={best ? fmtTime(best) : "—"} />
          <Stat label="Tricks" value={String(f.tricks)} />
          <Stat label="Best combo" value={`x${f.bestCombo.toFixed(1)}`} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gold/15 py-3 font-display text-2xl text-gold">
          +{f.wheels} <WheelIcon className="h-7 w-7" />
        </div>
        <div className="mt-1 text-xs opacity-70">includes +{f.bonus} finish & speed bonus</div>
        <button className="btn-game btn-hot mt-6 w-full py-3 text-xl" onClick={() => returnToLobby()}>
          BACK TO LOBBY
        </button>
        <div className="mt-2 text-xs opacity-60">or press Enter / Space</div>
      </div>
    </div>
  );
}

function MilestonePanel() {
  const m = useGame((s) => s.milestone);
  const setMilestone = useGame((s) => s.setMilestone);
  if (!m) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 flex cursor-pointer items-center justify-center bg-panel/40 backdrop-blur-sm" onClick={() => setMilestone(null)}>
      <div className="panel animate-scale-in w-[min(440px,92vw)] p-7 text-center">
        <div className="font-display text-4xl text-gold text-outline">FINISH LINE REACHED!</div>
        <div className="mt-1 font-display text-hot">1,000 M · KEEP GOING</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <Stat label="Time to 1,000 m" value={fmtTime(m.time)} />
          <Stat label="Tricks landed" value={String(m.tricks)} />
          <Stat label="Run wheels" value={m.wheels.toLocaleString()} />
          <Stat label="Finish bonus" value={`+${m.bonus}`} />
        </div>
        <div className="mt-6 animate-pulse rounded-xl bg-hot/20 py-3 font-display text-lg text-hot">CLICK ANYWHERE OR PRESS SPACE TO KEEP GOING</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-panel-foreground/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="font-display text-xl">{value}</div>
    </div>
  );
}

export function HUD() {
  const mode = useGame((s) => s.mode);
  const settingsOpen = useGame((s) => s.settingsOpen);
  const chestOpen = useGame((s) => s.chestOpen);
  const hideUi = useSave((s) => !!s.settings.hideUi);
  const milestone = useGame((s) => !!s.milestone);
  if (hideUi && !settingsOpen && !milestone && (mode === "hub" || mode === "run")) return null;
  return (
    <div className="pointer-events-none absolute inset-0 font-sans text-panel-foreground">
      <SpeedLines />
      {mode === "title" ? (
        <div className="pointer-events-auto absolute inset-0">
          <TitleScreen />
        </div>
      ) : (
        <>
          <TopBar />
          {(mode === "hub" || mode === "run") && (
            <>
              <Speedo />
              <Controls />
              <BoostButton />
              <QuestPanel />
            </>
          )}
          {mode === "run" && <RunBar />}
          {mode === "run" && <MilestonePanel />}
          <Hint />
          <Popups />
          {mode === "menu" && (
            <div className="pointer-events-auto">
              <MenuPanel />
            </div>
          )}
          {mode === "finished" && (
            <div className="pointer-events-auto">
              <FinishPanel />
            </div>
          )}
        </>
      )}
      {chestOpen && (
        <div className="pointer-events-auto">
          <DailyChest />
        </div>
      )}
      <AccountPrompt />
      {settingsOpen && (
        <div className="pointer-events-auto">
          <SettingsModal />
        </div>
      )}
    </div>
  );
}
