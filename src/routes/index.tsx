import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
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
  component: Game,
});
