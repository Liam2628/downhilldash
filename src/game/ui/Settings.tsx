import { useState } from "react";
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

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-panel/40" onClick={() => close(false)}>
      <div className="panel animate-scale-in w-[min(480px,94vw)] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-3xl text-gold">SETTINGS</h2>
          <button aria-label="Close settings" className="btn-game btn-ghost !p-2" onClick={() => close(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
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
          <Row label="Show FPS">
            <Seg value={s.showFps ? "on" : "off"} options={[{ v: "on", label: "ON" }, { v: "off", label: "OFF" }]} onChange={(v) => set({ showFps: v === "on" })} />
          </Row>
        </div>
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
          {confirm ? (
            <button
              className="btn-game flex-1 bg-bad text-primary-foreground"
              onClick={() => {
                reset();
                setConfirm(false);
                returnToLobby();
                close(false);
              }}
            >
              REALLY RESET?
            </button>
          ) : (
            <button className="btn-game btn-ghost flex-1" onClick={() => setConfirm(true)}>
              RESET PROGRESS
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-xs opacity-60">Esc to close · M to mute · Progress saves automatically</p>
      </div>
    </div>
  );
}
