import { useEffect, useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { useGame, useSave } from "../store";
import { CARS, EQUIPMENT, GLOWS, GLOW_UNLOCK, PAINTS, TRAIL_UNLOCK, UPGRADES, carById, type CarStats } from "../data";
import { audio } from "../audio";
import { exitMenu, startTestDrive } from "../physics";
import { WheelIcon } from "./WheelIcon";

function Price({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {n.toLocaleString()} <WheelIcon className="h-4 w-4" />
    </span>
  );
}

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-4 right-4 top-20 flex w-[min(420px,94vw)] flex-col">
      <div className="panel flex min-h-0 flex-1 flex-col animate-slide-in-right">
        <div className="flex items-start justify-between border-b border-panel-border p-5">
          <div>
            <h2 className="font-display text-3xl text-gold">{title}</h2>
            <p className="text-sm opacity-75">{sub}</p>
          </div>
          <button aria-label="Leave" className="btn-game btn-ghost !p-2" onClick={() => exitMenu()}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        <div className="border-t border-panel-border p-4">
          <button className="btn-game btn-hot w-full py-3 text-lg" onClick={() => exitMenu()}>
            DRIVE OUT
          </button>
          <p className="mt-2 text-center text-xs opacity-60">Drag to rotate the view · Esc to leave</p>
        </div>
      </div>
    </div>
  );
}

function StatBars({ stats }: { stats: CarStats }) {
  const rows: [string, number][] = [
    ["Speed", (stats.top - 30) / 32],
    ["Accel", (stats.accel - 10) / 18],
    ["Handling", (stats.handling - 1.4) / 1.5],
    ["Boost", (stats.boost - 1.2) / 0.7],
    ["Air spin", (stats.air - 4) / 5],
    ["Landing", (stats.landing - 0.8) / 0.7],
  ];
  return (
    <div className="space-y-1.5">
      {rows.map(([l, v]) => (
        <div key={l} className="flex items-center gap-2 text-xs">
          <span className="w-16 opacity-75">{l}</span>
          <div className="h-2 flex-1 rounded-full bg-panel-foreground/10">
            <div className="h-full rounded-full bg-cool" style={{ width: `${Math.max(6, Math.min(100, v * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Swatch({ hex, active, onClick, label }: { hex: string | null; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative h-11 w-11 rounded-xl border-2 transition-transform hover:scale-110 ${active ? "border-gold scale-110" : "border-panel-border"}`}
      style={{ background: hex ?? "repeating-linear-gradient(45deg, #bbb 0 6px, #eee 6px 12px)" }}
    >
      {active && <Check className="absolute inset-0 m-auto h-5 w-5 text-panel-foreground drop-shadow" />}
    </button>
  );
}

function Garage() {
  const s = useSave();
  const [tab, setTab] = useState<"paint" | "glow" | "trail" | "cars">("paint");
  const car = carById(s.selected);
  const paint = s.paints[s.selected] ?? null;
  const deny = (msg: string) => {
    audio.play("deny");
    useGame.getState().popup(msg, "bad");
  };
  return (
    <Shell title="GARAGE" sub={`Customizing: ${car.name}`}>
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-panel-foreground/10 p-1">
        {(["paint", "glow", "trail", "cars"] as const).map((t) => (
          <button
            key={t}
            className={`rounded-lg py-1.5 font-display text-xs ${tab === t ? "bg-hot text-primary-foreground" : "opacity-75"}`}
            onClick={() => {
              audio.play("ui");
              setTab(t);
            }}
          >
            {t === "glow" ? "UNDERGLOW" : t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === "paint" && (
        <>
          <p className="mb-3 text-sm opacity-75">Paint is free and saved per car.</p>
          <div className="grid grid-cols-6 gap-2">
            {PAINTS.map((p) => (
              <Swatch key={p.name} label={p.name} hex={p.hex} active={paint === p.hex} onClick={() => { audio.play("ui"); s.setPaint(s.selected, p.hex); }} />
            ))}
          </div>
        </>
      )}
      {tab === "glow" && (
        <>
          {!s.glowUnlocked ? (
            <Unlock what="Neon underglow" price={GLOW_UNLOCK} onBuy={() => (s.unlockGlow(GLOW_UNLOCK) ? audio.play("buy") : deny("Not enough wheels"))} />
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {GLOWS.map((p) => (
                <Swatch key={p.name} label={p.name} hex={p.hex} active={s.glow === p.hex} onClick={() => { audio.play("ui"); s.setGlow(p.hex); }} />
              ))}
            </div>
          )}
        </>
      )}
      {tab === "trail" && (
        <>
          {!s.trailUnlocked ? (
            <Unlock what="Light trail" price={TRAIL_UNLOCK} onBuy={() => (s.unlockTrail(TRAIL_UNLOCK) ? audio.play("buy") : deny("Not enough wheels"))} />
          ) : (
            <>
              <p className="mb-3 text-sm opacity-75">A ribbon of light follows your car.</p>
              <div className="grid grid-cols-6 gap-2">
                {GLOWS.map((p) => (
                  <Swatch key={p.name} label={p.name} hex={p.hex} active={s.trail === p.hex} onClick={() => { audio.play("ui"); s.setTrail(p.hex); }} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === "cars" && (
        <div className="space-y-2">
          {CARS.filter((c) => s.owned.includes(c.id)).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                audio.play("ui");
                s.selectCar(c.id);
              }}
              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left ${s.selected === c.id ? "border-gold bg-gold/10" : "border-panel-border bg-panel-foreground/5"}`}
            >
              <div>
                <div className="font-display">{c.name}</div>
                <div className="text-xs opacity-70">{c.tag}</div>
              </div>
              {s.selected === c.id && <span className="font-display text-xs text-gold">DRIVING</span>}
            </button>
          ))}
          <p className="pt-2 text-xs opacity-60">Buy more cars at the Dealership across the plaza.</p>
        </div>
      )}
    </Shell>
  );
}

function Unlock({ what, price, onBuy }: { what: string; price: number; onBuy: () => void }) {
  const wheels = useSave((s) => s.wheels);
  return (
    <div className="rounded-2xl border-2 border-dashed border-panel-border p-6 text-center">
      <Lock className="mx-auto mb-2 h-8 w-8 text-gold" />
      <div className="font-display text-xl">{what}</div>
      <p className="mb-4 text-sm opacity-70">One-time unlock, works on every car.</p>
      <button className="btn-game btn-gold" disabled={wheels < price} onClick={onBuy}>
        UNLOCK · <Price n={price} />
      </button>
    </div>
  );
}

function Dealer() {
  const s = useSave();
  const setPreview = useGame((g) => g.setPreview);
  const [idx, setIdx] = useState(Math.max(0, CARS.findIndex((c) => c.id === (useGame.getState().preview ?? s.selected))));
  const car = CARS[idx];
  useEffect(() => {
    setPreview(car.id);
  }, [car.id, setPreview]);
  const owned = s.owned.includes(car.id);
  const go = (d: number) => {
    audio.play("ui");
    setIdx((i) => (i + d + CARS.length) % CARS.length);
  };
  return (
    <Shell title="DEALERSHIP" sub={`${s.owned.length} of ${CARS.length} cars owned`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button className="btn-game btn-ghost" onClick={() => go(-1)} aria-label="Previous car">◀</button>
        <div className="text-center">
          <div className="font-display text-xs text-cool">{car.tag}</div>
          <div className="font-display text-2xl">{car.name}</div>
        </div>
        <button className="btn-game btn-ghost" onClick={() => go(1)} aria-label="Next car">▶</button>
      </div>
      <p className="mb-4 text-sm opacity-80">{car.desc}</p>
      <StatBars stats={car.stats} />
      <div className="mt-5">
        {owned ? (
          s.selected === car.id ? (
            <div className="rounded-xl bg-gold/15 py-3 text-center font-display text-gold">CURRENTLY DRIVING</div>
          ) : (
            <button className="btn-game btn-cool w-full py-3" onClick={() => { audio.play("ui"); s.selectCar(car.id); }}>
              DRIVE THIS CAR
            </button>
          )
        ) : (
          <button
            className="btn-game btn-gold w-full py-3 text-lg"
            disabled={s.wheels < car.price}
            onClick={() => {
              if (s.buyCar(car.id, car.price)) {
                audio.play("buy");
                useGame.getState().popup("NEW CAR!", "gold", car.name);
              }
            }}
          >
            BUY · <Price n={car.price} />
          </button>
        )}
        <button
          className="btn-game btn-ghost mt-2 w-full py-2"
          onClick={() => { audio.play("ui"); startTestDrive(car.id); }}
        >
          TEST DRIVE (PRACTICE TRACK)
        </button>
        {!owned && s.wheels < car.price && (
          <p className="mt-2 text-center text-xs opacity-70">You need {(car.price - s.wheels).toLocaleString()} more wheels</p>
        )}
      </div>
      <div className="mt-5 flex justify-center gap-1.5">
        {CARS.map((c, i) => (
          <button
            key={c.id}
            aria-label={c.name}
            onClick={() => setIdx(i)}
            className={`h-2.5 rounded-full transition-all ${i === idx ? "w-6 bg-gold" : s.owned.includes(c.id) ? "w-2.5 bg-cool" : "w-2.5 bg-panel-foreground/25"}`}
          />
        ))}
      </div>
    </Shell>
  );
}

function Tuning() {
  const s = useSave();
  return (
    <Shell title="TUNING SHOP" sub="Upgrades apply to every car you own">
      <div className="space-y-3">
        {UPGRADES.map((u) => {
          const lvl = s.upgrades[u.id];
          const maxed = lvl >= u.costs.length;
          const cost = u.costs[lvl];
          return (
            <div key={u.id} className="rounded-xl bg-panel-foreground/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display">{u.name}</div>
                  <div className="text-xs opacity-70">{u.desc}</div>
                </div>
                <button
                  className="btn-game btn-gold shrink-0 !px-3 !py-1.5 text-sm"
                  disabled={maxed || s.wheels < cost}
                  onClick={() => {
                    if (s.buyUpgrade(u.id, cost)) {
                      audio.play("buy");
                      useGame.getState().popup(`${u.name.toUpperCase()} LV ${lvl + 1}`, "cool");
                    }
                  }}
                >
                  {maxed ? "MAX" : <Price n={cost} />}
                </button>
              </div>
              <div className="mt-2 flex gap-1">
                {u.costs.map((_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded-full ${i < lvl ? "bg-hot" : "bg-panel-foreground/15"}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <h3 className="mb-2 mt-6 font-display text-xl text-gold">PARTS SHOP</h3>
      <div className="space-y-3">
        {EQUIPMENT.map((e) => {
          const has = s.equipmentOwned.includes(e.id);
          const on = e.id === "wing" ? s.wing : s.rims === e.id;
          return (
            <div key={e.id} className="flex items-center justify-between rounded-xl bg-panel-foreground/5 p-3">
              <div>
                <div className="font-display">{e.name}</div>
                <div className="text-xs opacity-70">{e.desc}</div>
              </div>
              {has ? (
                <button
                  className={`btn-game shrink-0 !px-3 !py-1.5 text-sm ${on ? "btn-cool" : "btn-ghost"}`}
                  onClick={() => {
                    audio.play("ui");
                    if (e.id === "wing") s.setWing(!s.wing);
                    else s.setRims(on ? null : e.id);
                  }}
                >
                  {on ? "EQUIPPED" : "EQUIP"}
                </button>
              ) : (
                <button
                  className="btn-game btn-gold shrink-0 !px-3 !py-1.5 text-sm"
                  disabled={s.wheels < e.price}
                  onClick={() => {
                    if (s.buyEquipment(e.id)) {
                      audio.play("buy");
                      if (e.id === "wing") s.setWing(true);
                      else s.setRims(e.id);
                      useGame.getState().popup(e.name.toUpperCase(), "gold");
                    }
                  }}
                >
                  <Price n={e.price} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function MenuPanel() {
  const menu = useGame((s) => s.menu);
  if (menu === "garage") return <Garage />;
  if (menu === "dealer") return <Dealer />;
  if (menu === "tuning") return <Tuning />;
  return null;
}
