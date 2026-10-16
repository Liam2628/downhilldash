import { useGLTF } from "@react-three/drei";
import { useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { CARS, carById } from "./data";
import { useSave } from "./store";
import { sizeCar } from "./carSizing";

export type CarHandle = { wheels: THREE.Object3D[]; front: THREE.Object3D[] };

type Props = { carId: string; paint: string | null };

function paintMaterial(src: THREE.Material, paint: string | null, light = false) {
  const m = (src as THREE.MeshStandardMaterial).clone();
  m.metalness = 0.25;
  m.roughness = 0.45;
  const uPaint = { value: new THREE.Color(paint ?? "#ffffff") };
  const uAmt = { value: paint ? 1 : 0 };
  m.onBeforeCompile = (shader) => {
    shader.uniforms['uPaint'] = uPaint;
    shader.uniforms['uPaintAmt'] = uAmt;
    shader.fragmentShader =
      "uniform vec3 uPaint;\nuniform float uPaintAmt;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float mx = max(max(c.r, c.g), c.b);
          float mn = min(min(c.r, c.g), c.b);
          float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          float m = smoothstep(0.35, 0.55, sat);
          ${light ? "m = max(m, smoothstep(0.55, 0.75, l) * (1.0 - smoothstep(0.15, 0.35, sat)));" : ""}
          m *= uPaintAmt;
          diffuseColor.rgb = mix(c, uPaint * ${light ? "(0.2 + l * 0.45)" : "(0.45 + l * 1.4)"}, m);
        }`,
      );
  };
  m.customProgramCacheKey = () => (light ? "paint-light" : "paint");
  return m;
}

/** Adds rim faces / wing to a car root. Wheels spin around their local X axis. */
function decorate(root: THREE.Object3D, wheels: THREE.Object3D[], rims: "chrome" | "halo" | null, wing: boolean, glow: string | null) {
  if (rims) {
    const mat =
      rims === "chrome"
        ? new THREE.MeshStandardMaterial({ color: "#e8eef5", metalness: 1, roughness: 0.12 })
        : new THREE.MeshBasicMaterial({ color: glow ?? "#22e4ff", toneMapped: false });
    for (const w of wheels) {
      const box = new THREE.Box3().setFromObject(w);
      const size = box.getSize(new THREE.Vector3());
      const r = Math.max(size.y, size.z) * 0.5;
      const ws = new THREE.Vector3();
      w.getWorldScale(ws);
      const local = r / (ws.y || 1);
      const geo = rims === "chrome" ? new THREE.CylinderGeometry(local * 0.62, local * 0.62, (size.x / (ws.x || 1)) * 1.04, 20) : new THREE.TorusGeometry(local * 0.72, local * 0.07, 8, 28);
      const m = new THREE.Mesh(geo, mat);
      if (rims === "chrome") m.rotation.z = Math.PI / 2;
      else m.rotation.y = Math.PI / 2;
      m.name = "equip";
      // center on wheel geometry
      const c = box.getCenter(new THREE.Vector3());
      w.worldToLocal(c);
      m.position.copy(c);
      w.add(m);
    }
  }
  if (wing) {
    const box = new THREE.Box3().setFromObject(root);
    const carbon = new THREE.MeshStandardMaterial({ color: "#1c1d22", metalness: 0.6, roughness: 0.35 });
    const g = new THREE.Group();
    g.name = "equip";
    const w = (box.max.x - box.min.x) * 0.9;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.45), carbon);
    blade.position.y = 0.35;
    blade.rotation.x = -0.12;
    g.add(blade);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.18), carbon);
      post.position.set(sx * w * 0.3, 0.17, 0);
      g.add(post);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.55), carbon);
      plate.position.set(sx * w * 0.5, 0.35, 0);
      g.add(plate);
    }
    g.position.set((box.min.x + box.max.x) / 2, box.max.y - 0.15, box.min.z + 0.35);
    root.add(g);
  }
}

/** Procedural Mercedes Vision AVTR: silver one-bow body, glass canopy, bionic back flaps, glowing spherical wheels. Faces +Z. */
function buildAvtr(paint: string | null) {
  const root = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: paint ?? "#cfd4da", metalness: 0.9, roughness: 0.22 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#2a3a44", metalness: 0.2, roughness: 0.05, transmission: 0.3, transparent: true, opacity: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: "#15181c", metalness: 0.5, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: "#5fe8ff", toneMapped: false });
  const copper = new THREE.MeshStandardMaterial({ color: "#c98a5a", metalness: 0.8, roughness: 0.3 });

  // lower body: stretched rounded capsule
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 3.0, 8, 20), silver);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.75, 1, 0.55);
  body.position.y = 0.62;
  root.add(body);
  // canopy: one-bow glass dome
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(0.78, 0.62, 1.75);
  canopy.position.set(0, 0.86, 0.1);
  root.add(canopy);
  // silver spine over canopy
  const spine = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 40, Math.PI), silver);
  spine.rotation.y = Math.PI / 2;
  spine.scale.set(1, 0.42, 1.05);
  spine.position.set(0, 0.86, 0.1);
  root.add(spine);
  // light strip front + rear
  const front = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.05), glow);
  front.position.set(0, 0.66, 2.2);
  root.add(front);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: "#ff3355", toneMapped: false }));
  rear.position.set(0, 0.75, -2.15);
  root.add(rear);
  // 33 bionic flaps on the back, in 3 rows
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 11; i++) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.22), i % 2 ? copper : dark);
      flap.position.set((i - 5) * 0.13, 0.98 - row * 0.1, -1.55 - row * 0.18);
      flap.rotation.x = 0.45 + row * 0.15;
      root.add(flap);
      if ((i + row) % 3 === 0) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), glow);
        dot.position.set(flap.position.x, flap.position.y + 0.03, flap.position.z);
        root.add(dot);
      }
    }
  }
  // dark skirt
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 3.6), dark);
  skirt.position.y = 0.36;
  root.add(skirt);
  // spherical illuminated wheels
  const wheelPos: [string, number, number][] = [
    ["wheel-front-left", 0.98, 1.35],
    ["wheel-front-right", -0.98, 1.35],
    ["wheel-back-left", 0.98, -1.3],
    ["wheel-back-right", -0.98, -1.3],
  ];
  const tire = new THREE.MeshStandardMaterial({ color: "#d9dde2", metalness: 0.7, roughness: 0.25 });
  for (const [name, x, z] of wheelPos) {
    const w = new THREE.Group();
    w.name = name;
    w.position.set(x, 0.45, z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), tire);
    ball.scale.set(0.75, 1, 1);
    w.add(ball);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 24), glow);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = Math.sign(x) * 0.3;
    w.add(ring);
    for (let k = 0; k < 6; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.05), glow);
      spoke.rotation.x = (k / 6) * Math.PI;
      spoke.position.x = Math.sign(x) * 0.31;
      w.add(spoke);
    }
    root.add(w);
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  return root;
}

function collect(root: THREE.Object3D) {
  const wheels: THREE.Object3D[] = [];
  const front: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.name.toLowerCase().startsWith("wheel")) {
      o.rotation.order = "YXZ";
      wheels.push(o);
      if (o.name.toLowerCase().includes("front")) front.push(o);
    }
  });
  return { wheels, front };
}

function useEquip() {
  const rims = useSave((s) => s.rims);
  const wing = useSave((s) => s.wing);
  const glow = useSave((s) => s.glow);
  return { rims, wing, glow };
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let p: THREE.Object3D | null = mesh;
    let equip = false;
    while (p) {
      if (p.name === "equip") equip = true;
      p = p.parent;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) if (equip || material.customProgramCacheKey?.().startsWith("paint")) material.dispose();
    if (equip) mesh.geometry.dispose();
  });
}

const GltfCar = forwardRef<CarHandle, Props>(function GltfCar({ carId, paint }, ref) {
  const def = carById(carId);
  const { scene } = useGLTF(def.file);
  const { rims, wing, glow } = useEquip();

  const { root, wheels, front } = useMemo(() => {
    const root = sizeCar(scene, def.length ?? 4.6);
    const isBody = (m: THREE.Object3D) => m.name.toLowerCase().startsWith("body") || !!(m.parent && m.parent.name.toLowerCase().startsWith("body"));
    let hasBody = false;
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh && isBody(o)) hasBody = true; });
    const factory: Record<string, string> = { apex: "#36b77c", solaris: "#ff8a00", inferno: "#f43b44", phantom: "#6a2bd9", vortex: "#e0a800", pulse: "#20c4be", singularity: "#2f6fe0" };
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const isWheel = (() => { let p: THREE.Object3D | null = mesh; while (p) { if (p.name.toLowerCase().startsWith("wheel")) return true; p = p.parent; } return false; })();
        if (isBody(mesh) || (!hasBody && def.elite && !isWheel)) {
          const finish = (m: THREE.Material) => paintMaterial(m, paint ?? factory[carId] ?? null, carId === "vortex" || carId === "singularity");
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(finish) : finish(mesh.material);
        }
      }
    });
    const { wheels, front } = collect(root);
    root.updateMatrixWorld(true);
    decorate(root, wheels, rims, wing, glow);
    if (def.elite) {
      const trim = new THREE.MeshStandardMaterial({ color: "#20262e", metalness: 0.7, roughness: 0.3 });
      const accent = new THREE.MeshBasicMaterial({ color: carId === "pulse" ? "#5fe8ff" : "#e7edf3" });
      const add = (size: [number, number, number], pos: [number, number, number], mat: THREE.Material = trim) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
        mesh.position.set(...pos); mesh.name = "equip"; mesh.castShadow = true; root.add(mesh);
        return mesh;
      };
      const bounds = new THREE.Box3().setFromObject(root);
      const width = bounds.max.x - bounds.min.x;
      if (carId === "apex") { // Wide GT wing and splitter, not the formula profile of Solaris.
        add([width * 0.95, 0.09, 0.5], [0, bounds.max.y + 0.25, -1.7]);
        for (const x of [-0.55, 0.55]) add([0.06, 0.5, 0.16], [x, bounds.max.y, -1.7]);
        add([width, 0.1, 0.45], [0, 0.18, 1.9]);
      }
      if (carId === "inferno") {
        add([width * 0.9, 0.08, 0.4], [0, bounds.max.y + 0.15, -1.65]);
        for (const x of [-0.65, 0.65]) add([0.22, 0.15, 0.9], [x, 0.25, 0.2]);
      }
      if (carId === "phantom") {
        add([0.12, 0.025, 2.9], [-0.18, bounds.max.y + 0.01, 0], accent);
        add([0.12, 0.025, 2.9], [0.18, bounds.max.y + 0.01, 0], accent);
      }
      if (carId === "pulse") {
        add([width * 0.85, 0.055, 0.07], [0, 0.85, 2], accent);
        for (const x of [-width * 0.45, width * 0.45]) add([0.06, 0.06, 3], [x, 0.28, 0], accent);
      }
      if (carId === "singularity") {
        const fin = add([0.07, 0.65, 1.3], [0, bounds.max.y + 0.2, -0.8]);
        fin.rotation.x = -0.15;
        add([width, 0.08, 0.5], [0, bounds.max.y + 0.45, -1.7]);
      }
    }
    return { root, wheels, front };
  }, [scene, paint, def.length, rims, wing, glow]);

  useImperativeHandle(ref, () => ({ wheels, front }), [wheels, front]);
  useEffect(() => () => dispose(root), [root]);
  return <primitive object={root} />;
});

const AvtrCar = forwardRef<CarHandle, Props>(function AvtrCar({ paint }, ref) {
  const { rims, wing, glow } = useEquip();
  const { root, wheels, front } = useMemo(() => {
    const root = sizeCar(buildAvtr(paint), 5.2);
    const { wheels, front } = collect(root);
    root.updateMatrixWorld(true);
    decorate(root, wheels, rims, wing, glow);
    return { root, wheels, front };
  }, [paint, rims, wing, glow]);
  useImperativeHandle(ref, () => ({ wheels, front }), [wheels, front]);
  useEffect(
    () => () =>
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      }),
    [root],
  );
  return <primitive object={root} />;
});

export const CarModel = forwardRef<CarHandle, Props>(function CarModel(props, ref) {
  const def = carById(props.carId);
  return def.file ? <GltfCar ref={ref} {...props} /> : <AvtrCar ref={ref} {...props} />;
});

CARS.forEach((c) => c.file && useGLTF.preload(c.file));
