import apex from "@/assets/models/apex.glb.asset.json";
import solaris from "@/assets/models/solaris.glb.asset.json";
import inferno from "@/assets/models/inferno.glb.asset.json";
import phantom from "@/assets/models/phantom.glb.asset.json";
import vortex from "@/assets/models/vortex.glb.asset.json";
import pulse from "@/assets/models/pulse.glb.asset.json";
import singularity from "@/assets/models/singularity.glb.asset.json";
import firetruck from "@/assets/models/firetruck.glb.asset.json";
import kart from "@/assets/models/kart-oopi.glb.asset.json";

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
  length?: number;
  electric?: boolean;
  elite?: boolean;
  special?: { name: string; desc: string; recharge?: number; magnet?: number; reward?: number; airAssist?: number; traction?: number; boostSeconds?: number };
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
    file: firetruck.url,
    price: 3200,
    tag: "EPIC",
    desc: "Massive boost, slow spins. Pure chaos on the mega ramp.",
    scale: 1.6,
    length: 6.2,
    stats: { top: 42, accel: 13, handling: 1.6, boost: 1.8, air: 4.6, landing: 1.3 },
  },
  {
    id: "ekart",
    name: "Spark Kart",
    file: kart.url,
    price: 1100,
    tag: "ELECTRIC",
    electric: true,
    desc: "Battery-powered go-kart. Instant torque and silly-fast spins.",
    scale: 2.1,
    length: 3.4,
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
    length: 5.2,
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
  { id: "apex", name: "Apex GT", file: apex.url, price: 18000, tag: "ELITE", desc: "Circuit-bred precision with planted traction.", scale: 1, elite: true, special: { name: "Track Grip", desc: "35% stronger lateral traction", traction: 1.35 }, stats: { top: 65, accel: 34, handling: 3, boost: 1.95, air: 9.2, landing: 1.6 } },
  { id: "solaris", name: "Solaris R", file: solaris.url, price: 32000, tag: "ELITE", desc: "A solar-orange racer with an endurance boost cell.", scale: 1, elite: true, special: { name: "Long Burn", desc: "2 extra seconds of boost", boostSeconds: 2 }, stats: { top: 68, accel: 36, handling: 3.05, boost: 2, air: 9.5, landing: 1.65 } },
  { id: "inferno", name: "Inferno RS", file: inferno.url, price: 55000, tag: "ELITE", desc: "Red-hot speed with a rapid-recharge turbo.", scale: 1, elite: true, special: { name: "Flash Recharge", desc: "Boost recharges 40% faster", recharge: 0.6 }, stats: { top: 71, accel: 38, handling: 3.1, boost: 2.05, air: 9.8, landing: 1.7 } },
  { id: "phantom", name: "Phantom GT", file: phantom.url, price: 85000, tag: "ELITE", desc: "Royal-violet precision with predictive air control.", scale: 1, elite: true, special: { name: "Flight Stabilizer", desc: "Twice the air-leveling response", airAssist: 2 }, stats: { top: 74, accel: 40, handling: 3.15, boost: 2.1, air: 10.1, landing: 1.75 } },
  { id: "vortex", name: "Vortex RX", file: vortex.url, price: 125000, tag: "ELITE", desc: "A compact stunt machine built for big trick payouts.", scale: 1, elite: true, special: { name: "Stunt Dividend", desc: "50% more wheels from tricks", reward: 1.5 }, stats: { top: 77, accel: 42, handling: 3.2, boost: 2.15, air: 10.4, landing: 1.8 } },
  { id: "pulse", name: "Pulse EV", file: pulse.url, price: 190000, tag: "ELITE ELECTRIC", electric: true, desc: "Instant electric torque and a long-range wheel collector.", scale: 1, elite: true, special: { name: "Magnetic Field", desc: "5 extra meters of pickup radius", magnet: 5 }, stats: { top: 80, accel: 44, handling: 3.25, boost: 2.2, air: 10.7, landing: 1.85 } },
  { id: "singularity", name: "Singularity X", file: singularity.url, price: 300000, tag: "ELITE ELECTRIC", electric: true, desc: "Next-generation open-wheel power with advanced energy recovery.", scale: 1, elite: true, special: { name: "Quantum Drive", desc: "Half boost cooldown + 75% more trick wheels", recharge: 0.5, reward: 1.75 }, stats: { top: 84, accel: 47, handling: 3.35, boost: 2.25, air: 11, landing: 1.9 } },
  { id: "avtr", name: "Mercedes Vision AVTR", file: "", price: 500000, tag: "ULTIMATE CONCEPT", electric: true, elite: true, desc: "Bionic flaps, illuminated spherical wheels and an organic silver canopy. The ultimate mountain machine.", scale: 1, special: { name: "Bionic Drive", desc: "2× trick wheels · 60% faster recharge · +7m magnet · adaptive grip and air leveling", recharge: 0.4, reward: 2, magnet: 7, traction: 1.5, airAssist: 2.5, boostSeconds: 3 }, stats: { top: 90, accel: 52, handling: 3.5, boost: 2.35, air: 11.5, landing: 2 } },
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

export type UpgradeId = "engine" | "nitro" | "cooler" | "grip" | "magnet" | "suspension" | "aero";

export const UPGRADES: { id: UpgradeId; name: string; desc: string; costs: number[] }[] = [
  { id: "engine", name: "Engine", desc: "+4% top speed & acceleration per level", costs: [150, 350, 700, 1200, 2000] },
  { id: "nitro", name: "Nitro Tank", desc: "+0.4s boost duration per level", costs: [120, 300, 600, 1000, 1600] },
  { id: "cooler", name: "Turbo Cooler", desc: "-0.8s boost cooldown per level", costs: [120, 300, 600, 1000, 1600] },
  { id: "grip", name: "Grip Tires", desc: "+7% steering per level", costs: [100, 250, 500, 850, 1400] },
  { id: "magnet", name: "Wheel Magnet", desc: "Bigger wheel pickup radius", costs: [100, 250, 500, 850, 1400] },
  { id: "suspension", name: "Adaptive Suspension", desc: "+8% landing tolerance per level", costs: [250, 600, 1400, 3000, 6000] },
  { id: "aero", name: "Active Aero", desc: "+2% top speed & faster air leveling per level", costs: [400, 1000, 2200, 5000, 10000] },
];

export type EquipmentId = "chrome" | "halo" | "wing";
export const EQUIPMENT: { id: EquipmentId; name: string; desc: string; price: number }[] = [
  { id: "chrome", name: "Chrome Rims", desc: "Polished silver wheel faces", price: 2500 },
  { id: "halo", name: "Halo Rims", desc: "Glowing rings matched to your underglow", price: 8000 },
  { id: "wing", name: "Carbon Wing", desc: "A sculpted rear spoiler", price: 5000 },
];
