import { useEffect, useState } from "react";
import { useGame, useSave } from "../store";
import { audio } from "../audio";
import { todayKey } from "../physics";
import { WheelIcon } from "./WheelIcon";

/** Weighted daily prize: 100..1500, usually 130..250, big amounts rare. */
export function rollDailyPrize() {
  const r = Math.random();
  const between = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
  let n: number;
  if (r < 0.72) n = between(130, 250);
  else if (r < 0.82) n = between(100, 130);
  else if (r < 0.93) n = between(250, 450);
  else if (r < 0.985) n = between(450, 900);
  else n = between(900, 1500);
  return Math.max(100, Math.min(1500, Math.round(n / 5) * 5));
}

function rarity(n: number) {
  if (n >= 900) return { label: "LEGENDARY!", cls: "text-hot" };
  if (n >= 450) return { label: "EPIC!", cls: "text-cool" };
  if (n > 250) return { label: "RARE", cls: "text-cool" };
  return { label: "NICE!", cls: "text-gold" };
}

export function DailyChest() {
  const setChestOpen = useGame((s) => s.setChestOpen);
  const [phase, setPhase] = useState<"closed" | "open">("closed");
  const [prize, setPrize] = useState(0);
  const [shown, setShown] = useState(0);

  const open = () => {
    if (phase !== "closed") return;
    const n = rollDailyPrize();
    const save = useSave.getState();
    save.addWheels(n);
    save.claimDaily(todayKey());
    setPrize(n);
    setPhase("open");
    audio.play("buy");
    setTimeout(() => audio.play("coin"), 250);
  };

  // count-up animation
  useEffect(() => {
    if (phase !== "open") return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setShown(Math.round(prize * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, prize]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        if (phase === "closed") open();
        else setChestOpen(false);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const r = rarity(prize);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-panel/40 backdrop-blur-md">
      <h2 className="font-display text-5xl text-gold text-outline md:text-6xl">DAILY REWARDS</h2>
      <p className="mt-1 font-display text-panel-foreground text-outline">
        {phase === "closed" ? "Click the chest to open it!" : "Come back tomorrow for another chest"}
      </p>

      <button
        aria-label="Open chest"
        onClick={open}
        className={`relative mt-8 h-64 w-72 ${phase === "closed" ? "animate-chest-shake cursor-pointer" : "cursor-default"}`}
      >
        {phase === "open" && <div className="chest-rays pointer-events-none absolute -inset-24 rounded-full" />}
        {/* base */}
        <div className="absolute bottom-0 left-0 right-0 h-36 rounded-b-2xl border-4 border-[oklch(0.3_0.06_50)] bg-[linear-gradient(180deg,oklch(0.55_0.12_55),oklch(0.42_0.1_50))] shadow-[var(--shadow-chunky)]">
          <div className="absolute inset-y-0 left-6 w-5 bg-[oklch(0.78_0.14_85)]" />
          <div className="absolute inset-y-0 right-6 w-5 bg-[oklch(0.78_0.14_85)]" />
          <div className="absolute left-1/2 top-2 h-12 w-10 -translate-x-1/2 rounded-md border-4 border-[oklch(0.3_0.06_50)] bg-[oklch(0.82_0.15_88)]" />
        </div>
        {/* lid */}
        <div
          className="absolute bottom-[8.5rem] left-0 right-0 h-24 origin-bottom rounded-t-[3rem] border-4 border-[oklch(0.3_0.06_50)] bg-[linear-gradient(180deg,oklch(0.6_0.13_55),oklch(0.5_0.12_52))] transition-transform duration-500"
          style={{ transform: phase === "open" ? "perspective(600px) rotateX(70deg) translateY(-30px)" : "none" }}
        >
          <div className="absolute inset-y-0 left-6 w-5 bg-[oklch(0.78_0.14_85)]" />
          <div className="absolute inset-y-0 right-6 w-5 bg-[oklch(0.78_0.14_85)]" />
        </div>
        {phase === "open" && (
          <div className="animate-pop-in absolute inset-x-0 -top-6 flex flex-col items-center">
            <WheelIcon className="h-20 w-20 drop-shadow-xl" />
          </div>
        )}
      </button>

      {phase === "open" ? (
        <div className="mt-8 flex flex-col items-center">
          <div className={`font-display text-2xl ${r.cls} text-outline`}>{r.label}</div>
          <div className="flex items-center gap-3 font-display text-6xl text-gold text-outline tabular-nums">
            +{shown} <WheelIcon className="h-12 w-12" />
          </div>
          <button className="btn-game btn-hot mt-6 px-10 py-3 text-2xl" onClick={() => setChestOpen(false)}>
            COLLECT
          </button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button className="btn-game btn-gold px-10 py-3 text-2xl" onClick={open}>
            OPEN
          </button>
          <button className="text-sm text-panel-foreground/80 underline text-outline" onClick={() => setChestOpen(false)}>
            Maybe later
          </button>
        </div>
      )}
    </div>
  );
}
