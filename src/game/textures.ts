import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas textures require a 2D context");
  return [c, ctx] as const;
}

function tex(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 8;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

export const woodTexture = () => cached("wood", () => {
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = "#9a7049"; ctx.fillRect(0, 0, 256, 512);
  for (let x = 0; x < 256; x += 3) {
    ctx.strokeStyle = x % 9 === 0 ? "rgba(60,32,15,0.3)" : "rgba(232,190,130,0.18)";
    ctx.lineWidth = x % 9 === 0 ? 2 : 1;
    ctx.beginPath();
    for (let y = 0; y <= 512; y += 8) {
      const gx = x + Math.sin(y / 35 + x / 16) * 2 + Math.sin(y / 81) * 3;
      if (y === 0) ctx.moveTo(gx, y); else ctx.lineTo(gx, y);
    }
    ctx.stroke();
  }
  for (const [x, y] of [[58, 142], [185, 350]]) {
    ctx.strokeStyle = "rgba(62,34,18,0.35)";
    for (let r = 3; r < 18; r += 3) { ctx.beginPath(); ctx.ellipse(x, y, r / 2, r * 1.8, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  speckle(ctx, 256, 512, 2500, 0.07);
  return tex(c);
});

export const stoneTexture = () => cached("stone", () => {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = "#b7b9b3"; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 10000, 0.16);
  for (let y = 0; y < 256; y += 64) {
    ctx.strokeStyle = "rgba(52,57,53,0.22)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    for (let x = (y / 64 % 2) * 64; x < 256; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
    }
  }
  return tex(c);
});

/** Concrete road: u across, v along. */
export const roadTexture = () =>
  cached("road", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#8d8f93";
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, 9000, 0.12);
    // slab joints
    ctx.strokeStyle = "rgba(40,40,45,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(512, 2);
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();
    // edge lines
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(14, 0, 10, 512);
    ctx.fillRect(488, 0, 10, 512);
    // center dashes
    ctx.fillStyle = "#ffcc1f";
    ctx.fillRect(250, 40, 12, 180);
    ctx.fillRect(250, 296, 12, 180);
    // tyre marks
    ctx.fillStyle = "rgba(30,30,30,0.08)";
    ctx.fillRect(150, 0, 22, 512);
    ctx.fillRect(340, 0, 22, 512);
    return tex(c);
  });

export const plazaTexture = () =>
  cached("plaza", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#c9c4b8";
    ctx.fillRect(0, 0, 512, 512);
    speckle(ctx, 512, 512, 6000, 0.08);
    ctx.strokeStyle = "rgba(90,85,75,0.35)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    return tex(c);
  });

export const grassTexture = () =>
  cached("grass", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#7fb04a";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const g = 120 + Math.random() * 80;
      ctx.fillStyle = `rgba(${g * 0.55},${g},${g * 0.3},0.35)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
    }
    return tex(c);
  });

export const kerbTexture = () =>
  cached("kerb", () => {
    const [c, ctx] = canvas(64, 128);
    ctx.fillStyle = "#f2efe8";
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = "#e8402a";
    ctx.fillRect(0, 0, 64, 64);
    return tex(c);
  });

export const chevronTexture = (a = "#ffcc1f", b = "#1d1d22") =>
  cached("chev" + a + b, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = a;
    for (let i = -256; i < 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 256);
      ctx.lineTo(i + 32, 256);
      ctx.lineTo(i + 32 + 128, 128);
      ctx.lineTo(i + 32, 0);
      ctx.lineTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.closePath();
      ctx.fill();
    }
    const t = tex(c);
    return t;
  });

export const padTexture = () =>
  cached("pad", () => {
    const [c, ctx] = canvas(256, 512);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#00e5ff");
    g.addColorStop(1, "#ff2bd6");
    ctx.fillStyle = "#101018";
    ctx.fillRect(0, 0, 256, 512);
    ctx.strokeStyle = g;
    ctx.lineWidth = 34;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let y = 60; y < 512; y += 150) {
      ctx.beginPath();
      ctx.moveTo(40, y + 80);
      ctx.lineTo(128, y);
      ctx.lineTo(216, y + 80);
      ctx.stroke();
    }
    return tex(c, false);
  });

export const windowsTexture = (hue: number) =>
  cached("win" + Math.round(hue * 6), () => {
    const [c, ctx] = canvas(128, 256);
    const palettes = ["#e9dcc6", "#c9d7e6", "#e6c3b3", "#d8e3cf", "#efe1a9", "#c8c3dd", "#b9c9cc"];
    ctx.fillStyle = palettes[Math.round(hue * 6)];
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 256; y += 24) {
      for (let x = 8; x < 128; x += 20) {
        const lit = Math.random() < 0.25;
        ctx.fillStyle = lit ? "#fff3c4" : "#3e5a73";
        ctx.fillRect(x, y, 12, 14);
      }
    }
    return tex(c);
  });

export const brickTexture = () =>
  cached("brick", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#7a3a2a";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) {
      for (let x = (y / 16) % 2 ? -16 : 0; x < 256; x += 32) {
        const v = 150 + Math.random() * 40;
        ctx.fillStyle = `rgb(${v},${v * 0.42},${v * 0.3})`;
        ctx.fillRect(x + 1, y + 1, 30, 14);
      }
    }
    return tex(c);
  });

export const rollupTexture = () =>
  cached("rollup", () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = "#d8d8d4";
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) {
      ctx.fillStyle = "#a8a8a4";
      ctx.fillRect(0, y, 128, 2);
    }
    return tex(c);
  });

export const panelTexture = () =>
  cached("panel", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#24252c";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#34363f";
    ctx.lineWidth = 4;
    for (let i = 0; i <= 256; i += 64) {
      ctx.strokeRect(i, 0, 64, 256);
    }
    ctx.fillStyle = "#ffcc1f";
    ctx.fillRect(0, 230, 256, 10);
    return tex(c);
  });

/** Big text sign texture */
export function signTexture(
  text: string,
  opts: { sub?: string; bg?: string; fg?: string; accent?: string; w?: number; h?: number; border?: string } = {},
) {
  const key = "sign" + text + JSON.stringify(opts);
  return cached(key, () => {
    const w = opts.w ?? 1024;
    const h = opts.h ?? 256;
    const [c, ctx] = canvas(w, h);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, w, h);
    }
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.floor(h * (opts.sub ? 0.5 : 0.62));
    ctx.font = `${size}px Bungee, Impact, sans-serif`;
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    const y = opts.sub ? h * 0.4 : h * 0.54;
    ctx.strokeText(text, w / 2, y, w * 0.92);
    ctx.fillStyle = opts.fg ?? "#ffffff";
    ctx.fillText(text, w / 2, y, w * 0.92);
    if (opts.sub) {
      ctx.font = `${Math.floor(h * 0.2)}px Rubik, sans-serif`;
      ctx.fillStyle = opts.accent ?? "#ffcc1f";
      ctx.fillText(opts.sub, w / 2, h * 0.8, w * 0.9);
    }
    return tex(c, false);
  });
}

export function boardTexture(lines: string[], title: string) {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = "#1b2a24";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#ffcc1f";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 500);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcc1f";
  ctx.font = "48px Bungee, Impact, sans-serif";
  ctx.fillText(title, 256, 80);
  ctx.font = "34px Rubik, sans-serif";
  ctx.fillStyle = "#f3efe2";
  lines.forEach((l, i) => ctx.fillText(l, 256, 170 + i * 70));
  return tex(c, false);
}
