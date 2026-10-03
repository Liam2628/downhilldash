export type CarStats = {
  top: number; // m/s top speed on flat throttle
  accel: number;
  handling: number; // rad/s
  boost: number; // boost top-speed multiplier
  air: number; // trick rotation speed rad/s
  landing: number; // landing tolerance multiplier
};

export type CarDef = {
  id: string;
  name: string;
  file: string;
  price: number;
  tag: string;
  desc: string;
  scale: number;
  electric?: boolean;
  stats: CarStats;
};

export const CARS: CarDef[] = [
  {
    id: "sedan",
    name: "Daily Driver",
    file: "/models/sedan.glb",
    price: 0,
    tag: "STARTER",
    desc: "Reliable, forgiving, a little boring. Everyone starts somewhere.",
    scale: 1.8,
    stats: { top: 38, accel: 14, handling: 1.9, boost: 1.35, air: 5, landing: 1.15 },
  },
  {
    id: "taxi",
    name: "Yellow Cab",
    file: "/models/taxi.glb",
    price: 300,
    tag: "COMMON",
    desc: "Knows every shortcut. Slightly faster spins than the sedan.",
    scale: 1.8,
    stats: { top: 40, accel: 15, handling: 2.0, boost: 1.4, air: 5.6, landing: 1.1 },
  },
  {
    id: "police",
    name: "Interceptor",
    file: "/models/police.glb",
    price: 800,
    tag: "RARE",
    desc: "Pursuit-tuned engine. Lights not included in the warranty.",
    scale: 1.8,
    stats: { top: 44, accel: 17, handling: 2.1, boost: 1.45, air: 6, landing: 1.0 },
  },
  {
    id: "suv",
    name: "Luxe SUV",
    file: "/models/suv-luxury.glb",
    price: 1500,
    tag: "RARE",
    desc: "Heavy and planted. The most forgiving landings in the lot.",
    scale: 1.75,
    stats: { top: 43, accel: 15, handling: 1.85, boost: 1.55, air: 5.2, landing: 1.4 },
  },
  {
    id: "hatch",
    name: "Hot Hatch",
    file: "/models/hatchback-sports.glb",
    price: 2200,
    tag: "EPIC",
    desc: "Tiny, twitchy and stupidly quick in the air.",
    scale: 1.8,
    stats: { top: 47, accel: 20, handling: 2.35, boost: 1.5, air: 7, landing: 0.95 },
  },
  {
    id: "firetruck",
    name: "Big Red",
    file: "/models/firetruck.glb",
    price: 3200,
    tag: "EPIC",
    desc: "Massive boost, slow spins. Pure chaos on the mega ramp.",
    scale: 1.6,
    stats: { top: 42, accel: 13, handling: 1.6, boost: 1.8, air: 4.6, landing: 1.3 },
  },
  {
    id: "ekart",
    name: "Spark Kart",
    file: "/models/kart-oopi.glb",
    price: 1100,
    tag: "ELECTRIC",
    electric: true,
    desc: "Battery-powered go-kart. Instant torque and silly-fast spins.",
    scale: 2.1,
    stats: { top: 41, accel: 24, handling: 2.6, boost: 1.45, air: 7.4, landing: 1.0 },
  },
  {
    id: "evan",
    name: "Volt Van",
    file: "/models/van.glb",
    price: 2600,
    tag: "ELECTRIC",
    electric: true,
    desc: "Silent delivery van with a massive battery. Huge boosts, steady landings.",
    scale: 1.7,
    stats: { top: 44, accel: 21, handling: 1.8, boost: 1.75, air: 5, landing: 1.35 },
  },
  {
    id: "ecoupe",
    name: "Ion Coupe",
    file: "/models/sedan-sports.glb",
    price: 5200,
    tag: "ELECTRIC",
    electric: true,
    desc: "Electric super-coupe. Brutal launch and razor handling.",
    scale: 1.8,
    stats: { top: 55, accel: 30, handling: 2.6, boost: 1.6, air: 7.8, landing: 1.05 },
  },
  {
    id: "race",
    name: "Track Racer",
    file: "/models/race.glb",
    price: 4500,
    tag: "LEGENDARY",
    desc: "Open-wheel speed. Built for flips, not for forgiveness.",
    scale: 1.7,
    stats: { top: 53, accel: 23, handling: 2.55, boost: 1.55, air: 7.6, landing: 0.9 },
  },
  {
    id: "future",
    name: "Hyperion X",
    file: "/models/race-future.glb",
    price: 7000,
    tag: "MYTHIC",
    desc: "From the year 3000. The fastest thing on the mountain.",
    scale: 1.7,
    stats: { top: 59, accel: 26, handling: 2.7, boost: 1.65, air: 8.4, landing: 1.0 },
  },
];

export const carById = (id: string) => CARS.find((c) => c.id === id) ?? CARS[0];

export const PAINTS: { name: string; hex: string | null }[] = [
  { name: "Factory", hex: null },
  { name: "Lava", hex: "#ff3b30" },
  { name: "Tangerine", hex: "#ff8a00" },
  { name: "Solar", hex: "#ffd60a" },
  { name: "Lime", hex: "#7ed321" },
  { name: "Mint", hex: "#00d1a7" },
  { name: "Sky", hex: "#2f9bff" },
  { name: "Cobalt", hex: "#2b4cff" },
  { name: "Bubblegum", hex: "#ff4fa3" },
  { name: "Pearl", hex: "#f4f1ea" },
  { name: "Carbon", hex: "#26262b" },
  { name: "Copper", hex: "#b8673a" },
];

export const GLOWS: { name: string; hex: string | null }[] = [
  { name: "Off", hex: null },
  { name: "Cyan", hex: "#22e4ff" },
  { name: "Magenta", hex: "#ff2bd6" },
  { name: "Toxic", hex: "#7dff3a" },
  { name: "Inferno", hex: "#ff5a1f" },
  { name: "Gold", hex: "#ffc933" },
  { name: "Ice", hex: "#bfe9ff" },
];

export const GLOW_UNLOCK = 250;
export const TRAIL_UNLOCK = 400;

export type UpgradeId = "engine" | "nitro" | "cooler" | "grip" | "magnet";

export const UPGRADES: { id: UpgradeId; name: string; desc: string; costs: number[] }[] = [
  { id: "engine", name: "Engine", desc: "+4% top speed & acceleration per level", costs: [150, 350, 700, 1200, 2000] },
  { id: "nitro", name: "Nitro Tank", desc: "+0.4s boost duration per level", costs: [120, 300, 600, 1000, 1600] },
  { id: "cooler", name: "Turbo Cooler", desc: "-0.8s boost cooldown per level", costs: [120, 300, 600, 1000, 1600] },
  { id: "grip", name: "Grip Tires", desc: "+7% steering per level", costs: [100, 250, 500, 850, 1400] },
  { id: "magnet", name: "Wheel Magnet", desc: "Bigger wheel pickup radius", costs: [100, 250, 500, 850, 1400] },
];
