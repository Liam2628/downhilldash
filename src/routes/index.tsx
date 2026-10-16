import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Game = lazy(() => import("@/game/Game").then((m) => ({ default: m.Game })));

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Downhill Dash — Stunt Simulator & Car Racing Game" },
      {
        name: "description",
        content: "Drive out of the lobby and send your car down a concrete mountain of ramps, loops and boost pads. Collect wheels, do tricks, buy new cars.",
      },
      { property: "og:title", content: "Downhill Dash — Stunt Simulator & Car Racing Game" },
      { property: "og:description", content: "Ramps, loops, flips and boost. Collect wheels and unlock new rides in this browser stunt game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://downhilldash.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://downhilldash.lovable.app/" }],
  }),
  component: Home,
});

function About() {
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-sky p-6">
      <article className="panel max-w-xl p-6">
        <h1 className="font-display text-3xl text-gold">Downhill Dash</h1>
        <h2 className="mt-2 font-display text-xl">A free browser stunt simulator</h2>
        <p className="mt-3 text-sm opacity-80">
          Race down an endless mountain road packed with ramps, loops, boost pads and Mega Launches. Chain flips, barrel rolls,
          spins and combo tricks like corks and rodeos to earn wheels.
        </p>
        <p className="mt-2 text-sm opacity-80">
          Spend wheels on new cars plus tuning upgrades, paint, underglow, rims and
          wings. Open the daily reward chest and complete quests for bonuses.
        </p>
        <p className="mt-4 text-xs opacity-60">Loading the game…</p>
      </article>
    </main>
  );
}

function Home() {
  return (
    <ClientOnly fallback={<About />}>
      <Suspense fallback={<About />}>
        <Game />
      </Suspense>
    </ClientOnly>
  );
}
