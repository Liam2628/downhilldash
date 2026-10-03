import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BARRIERS,
  COINS,
  CONES,
  FINISH,
  HALF,
  L,
  LOOPS,
  PADS,
  RAMPS,
  SCENERY_BUILDINGS,
  SCENERY_TREES,
  SECTIONS,
  TUNNEL,
  cAt,
  dcAt,
  hAt,
  rampAdd,
  terrainY,
} from "./track";
import {
  chevronTexture,
  kerbTexture,
  padTexture,
  roadTexture,
  signTexture,
  windowsTexture,
  grassTexture,
} from "./textures";
import { runState } from "./physics";

/** Build a strip surface along s. cols are dx offsets; heightFn(s, dx) */
function stripGeometry(
  s0: number,
  s1: number,
  ds: number,
  cols: number[],
  heightFn: (s: number, dx: number) => number,
  uvScaleV = 16,
  colorFn?: (s: number, dx: number, y: number) => [number, number, number],
) {
  const rows = Math.ceil((s1 - s0) / ds) + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const umin = cols[0];
  const umax = cols[cols.length - 1];
  for (let r = 0; r < rows; r++) {
    const s = Math.min(s1, s0 + r * ds);
    const c = cAt(s);
    for (const dx of cols) {
      const y = heightFn(s, dx);
      pos.push(c + dx, y, -s);
      uv.push((dx - umin) / (umax - umin), s / uvScaleV);
      if (colorFn) col.push(...colorFn(s, dx, y));
    }
  }
  const n = cols.length;
  for (let r = 0; r < rows - 1; r++) {
    for (let i = 0; i < n - 1; i++) {
      const a = r * n + i;
      const b = a + 1;
      const c2 = a + n;
      const d = c2 + 1;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Road() {
  const geo = useMemo(
    () => stripGeometry(-1, L + 4, 2, [-HALF, HALF], (s) => hAt(s) + 0.01, 16),
    [],
  );
  const tex = useMemo(() => {
    const t = roadTexture().clone();
    t.needsUpdate = true;
    return t;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.92} />
    </mesh>
  );
}

function Walls() {
  // fix duplicate-column lookups: use explicit builder
  const fixed = useMemo(() => {
    return [-1, 1].map((side) => {
      const rows = Math.ceil((L + 4) / 2) + 1;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let r = 0; r < rows; r++) {
        const s = r * 2;
        const c = cAt(s);
        const y = hAt(s);
        const a = c + side * HALF;
        const b = c + side * (HALF + 0.8);
        // inner-bottom, inner-top, outer-top, outer-bottom
        pos.push(a, y, -s, a, y + 1.1, -s, b, y + 1.1, -s, b, y - 0.5, -s);
        const v = s / 6;
        uv.push(0, v, 0.3, v, 0.6, v, 1, v);
      }
      for (let r = 0; r < rows - 1; r++) {
        for (let i = 0; i < 3; i++) {
          const p = r * 4 + i;
          const q = p + 1;
          const p2 = p + 4;
          const q2 = q + 4;
          if (side > 0) idx.push(p, p2, q, q, p2, q2);
          else idx.push(p, q, p2, q, q2, p2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    });
  }, []);
  const tex = kerbTexture();
  return (
    <>
      {fixed.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <meshStandardMaterial map={tex} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Terrain() {
  const geo = useMemo(() => {
    const cols = [-220, -140, -90, -60, -40, -26, -18, -12, -10.5, 10.5, 12, 18, 26, 40, 60, 90, 140, 220];
    const grassA = new THREE.Color("#7fb04a");
    const grassB = new THREE.Color("#5f9a3c");
    const sand = new THREE.Color("#d9c08a");
    const rock = new THREE.Color("#9a8f80");
    const tmp = new THREE.Color();
    return stripGeometry(-10, L + 260, 4, cols, (s, dx) => terrainY(s, dx) - 0.05, 30, (s, dx, y) => {
      const a = Math.abs(dx);
      const downtown = s > 620 && s < 900;
      const base = downtown ? rock : s > 1240 ? sand : grassA;
      tmp.copy(base).lerp(grassB, (Math.sin(s * 0.05 + dx * 0.07) * 0.5 + 0.5) * 0.5);
      if (a > 60 && !downtown) tmp.lerp(rock, Math.min(0.5, (y - hAt(Math.max(0, s))) / 60));
      return [tmp.r, tmp.g, tmp.b];
    });
  }, []);
  const g = grassTexture();
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors map={g} roughness={1} />
    </mesh>
  );
}

function Ramps() {
  const geos = useMemo(
    () =>
      RAMPS.map((r) => {
        const rows = 14;
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        for (let i = 0; i <= rows; i++) {
          const s = r.s + (i / rows) * r.len;
          const c = cAt(s) + r.xo;
          const base = hAt(s);
          const top = base + rampAdd(s, r.xo) + 0.03;
          const l = c - r.w / 2;
          const rr = c + r.w / 2;
          pos.push(l, base, -s, l, top, -s, rr, top, -s, rr, base, -s);
          const v = (i / rows) * (r.len / 4);
          uv.push(0, v, 0.05, v, r.w / 4, v, r.w / 4 + 0.05, v);
        }
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < 3; j++) {
            const a = i * 4 + j;
            const b = a + 1;
            const c = a + 4;
            const d = c + 1;
            idx.push(a, b, c, b, d, c);
          }
        }
        // back face (lip)
        const e = rows * 4;
        idx.push(e, e + 2, e + 1, e, e + 3, e + 2);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
      }),
    [],
  );
  const tex = chevronTexture();
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <meshStandardMaterial map={tex} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Loops() {
  const data = useMemo(
    () =>
      LOOPS.map((lp) => {
        const seg = 120;
        const width = 9;
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        const rail: THREE.Vector3[][] = [[], []];
        const c = cAt(lp.s);
        const h = hAt(lp.s);
        for (let i = 0; i <= seg; i++) {
          const th = (i / seg) * Math.PI * 2;
          const xc = c - 5 + (10 * th) / (Math.PI * 2);
          const y = h + lp.R - lp.R * Math.cos(th) + 0.02;
          const z = -(lp.s + lp.R * Math.sin(th));
          pos.push(xc - width / 2, y, z, xc + width / 2, y, z);
          const v = (th * lp.R) / 16;
          uv.push(0, v, 1, v);
          rail[0].push(new THREE.Vector3(xc - width / 2, y + 0.4 * Math.cos(th), z + 0.4 * Math.sin(th)));
          rail[1].push(new THREE.Vector3(xc + width / 2, y + 0.4 * Math.cos(th), z + 0.4 * Math.sin(th)));
        }
        for (let i = 0; i < seg; i++) {
          const a = i * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const rails = rail.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.25, 8));
        return { g, rails, lp, c, h };
      }),
    [],
  );
  const tex = roadTexture();
  return (
    <>
      {data.map((d, i) => (
        <group key={i}>
          <mesh geometry={d.g} castShadow receiveShadow>
            <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          {d.rails.map((r, j) => (
            <mesh key={j} geometry={r} castShadow>
              <meshStandardMaterial color={j ? "#ff3b6b" : "#22c7ff"} emissive={j ? "#7a0020" : "#004a66"} roughness={0.3} />
            </mesh>
          ))}
          {/* support pillars */}
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[d.c + sd * 9, d.h + d.lp.R, -d.lp.s]} castShadow>
              <boxGeometry args={[0.8, d.lp.R * 2 + 2, 0.8]} />
              <meshStandardMaterial color="#e8e2d4" roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[d.c, d.h + d.lp.R * 2 + 1.8, -d.lp.s]} castShadow>
            <boxGeometry args={[19, 0.8, 0.8]} />
            <meshStandardMaterial color="#e8e2d4" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Pads() {
  const tex = padTexture();
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 8) * 0.5;
  });
  return (
    <>
      {PADS.map((p, i) => {
        const x = cAt(p.s) + p.xo;
        const y = hAt(p.s) + 0.04;
        const ry = Math.atan2(dcAt(p.s), -1);
        const slope = Math.atan2(hAt(p.s - 3) - hAt(p.s + 3), 6);
        return (
          <mesh key={i} position={[x, y, -p.s]} rotation={[-Math.PI / 2 + slope, 0, ry + Math.PI, "YXZ"]}>
            <planeGeometry args={[5, 7]} />
            <meshStandardMaterial ref={i === 0 ? mat : undefined} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1.3} />
          </mesh>
        );
      })}
    </>
  );
}

function Coins() {
  const tire = useRef<THREE.InstancedMesh>(null);
  const hub = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const hubGeo = useMemo(() => new THREE.CylinderGeometry(0.42, 0.42, 0.2, 16).rotateX(Math.PI / 2), []);
  useFrame(({ clock }) => {
    if (!tire.current || !hub.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COINS.length; i++) {
      const c = COINS[i];
      dummy.position.set(c.x, c.y + Math.sin(t * 3 + i) * 0.15, c.z);
      dummy.rotation.set(0, t * 2.5 + i * 0.3, 0);
      const s = runState.collected[i] ? 0 : 1;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      tire.current.setMatrixAt(i, dummy.matrix);
      hub.current.setMatrixAt(i, dummy.matrix);
    }
    tire.current.instanceMatrix.needsUpdate = true;
    hub.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={tire} args={[undefined, undefined, COINS.length]} castShadow frustumCulled={false}>
        <torusGeometry args={[0.55, 0.22, 10, 22]} />
        <meshStandardMaterial color="#1e1e22" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={hub} args={[hubGeo, undefined, COINS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#ffc21a" emissive="#b07800" emissiveIntensity={0.7} metalness={0.8} roughness={0.25} />
      </instancedMesh>
    </>
  );
}


function Cones() {
  const body = useRef<THREE.InstancedMesh>(null);
  const stripe = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!body.current || !stripe.current) return;
    for (let i = 0; i < runState.cones.length; i++) {
      const st = runState.cones[i];
      dummy.position.set(st.x, st.y, st.z);
      dummy.rotation.set(st.tilt, st.rot, 0, "YXZ");
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.current.setMatrixAt(i, dummy.matrix);
      stripe.current.setMatrixAt(i, dummy.matrix);
    }
    body.current.instanceMatrix.needsUpdate = true;
    stripe.current.instanceMatrix.needsUpdate = true;
  });
  const coneGeo = useMemo(() => new THREE.ConeGeometry(0.45, 1.2, 14).translate(0, 0.6, 0), []);
  const stripeGeo = useMemo(() => new THREE.CylinderGeometry(0.25, 0.32, 0.22, 14).translate(0, 0.6, 0), []);
  return (
    <>
      <instancedMesh ref={body} args={[coneGeo, undefined, runState.cones.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ff6a13" roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={stripe} args={[stripeGeo, undefined, runState.cones.length]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </instancedMesh>
    </>
  );
}

function Barriers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    BARRIERS.forEach((b, i) => {
      d.position.set(cAt(b.s) + b.xo, hAt(b.s) + 0.6, -b.s);
      d.rotation.set(0, Math.atan2(dcAt(b.s), -1), 0);
      d.scale.set(b.w, 1, 1);
      d.updateMatrix();
      ref.current!.setMatrixAt(i, d.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  const tex = useMemo(() => {
    const t = chevronTexture("#ff3b30", "#f4f1ea").clone();
    t.needsUpdate = true;
    t.repeat.set(2, 0.5);
    return t;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BARRIERS.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1.2, 1.2]} />
      <meshStandardMaterial map={tex} roughness={0.6} />
    </instancedMesh>
  );
}

function Scenery() {
  const bRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const groups = useMemo(() => {
    const gs: (typeof SCENERY_BUILDINGS)[] = [[], [], [], [], [], [], []];
    SCENERY_BUILDINGS.forEach((b) => gs[Math.round(b.hue * 6)].push(b));
    return gs;
  }, []);
  const trunk = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    groups.forEach((g, gi) => {
      const m = bRefs.current[gi];
      if (!m) return;
      g.forEach((b, i) => {
        d.position.set(b.x, b.y + b.h / 2 - 1, b.z);
        d.rotation.set(0, 0, 0);
        d.scale.set(b.w, b.h, b.d);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
    SCENERY_TREES.forEach((t, i) => {
      d.position.set(t.x, t.y + 1.2 * t.s, t.z);
      d.scale.setScalar(t.s);
      d.rotation.set(0, i, 0);
      d.updateMatrix();
      trunk.current!.setMatrixAt(i, d.matrix);
      d.position.set(t.x, t.y + 4 * t.s, t.z);
      d.updateMatrix();
      leaves.current!.setMatrixAt(i, d.matrix);
    });
    trunk.current!.instanceMatrix.needsUpdate = true;
    leaves.current!.instanceMatrix.needsUpdate = true;
  }, [groups]);
  const mats = useMemo(
    () =>
      groups.map((_, gi) => {
        const t = windowsTexture(gi / 6).clone();
        t.needsUpdate = true;
        t.repeat.set(2, 3);
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
      }),
    [groups],
  );
  return (
    <>
      {groups.map((g, gi) => (
        <instancedMesh
          key={gi}
          ref={(m) => {
            bRefs.current[gi] = m;
          }}
          args={[undefined, mats[gi], Math.max(1, g.length)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1]} />
        </instancedMesh>
      ))}
      <instancedMesh ref={trunk} args={[undefined, undefined, SCENERY_TREES.length]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 2.4, 6]} />
        <meshStandardMaterial color="#7a5232" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, SCENERY_TREES.length]} castShadow>
        <icosahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial color="#4f9a3a" roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

function Tunnel() {
  const arches = useMemo(() => {
    const out: { x: number; y: number; z: number; ry: number }[] = [];
    for (let s = TUNNEL.s0; s <= TUNNEL.s1; s += 4) out.push({ x: cAt(s), y: hAt(s), z: -s, ry: Math.atan2(dcAt(s), -1) });
    return out;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    arches.forEach((a, i) => {
      d.position.set(a.x, a.y, a.z);
      d.rotation.set(0, a.ry, 0);
      d.updateMatrix();
      ref.current!.setMatrixAt(i, d.matrix);
      d.position.set(a.x, a.y + 9.6, a.z);
      d.updateMatrix();
      lights.current!.setMatrixAt(i, d.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    lights.current!.instanceMatrix.needsUpdate = true;
  }, [arches]);
  const archGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-12, 0);
    shape.lineTo(-12, 7);
    shape.absarc(0, 7, 12, Math.PI, 0, true);
    shape.lineTo(12, 0);
    shape.lineTo(11, 0);
    shape.absarc(0, 7, 11, 0, Math.PI, false);
    shape.lineTo(-11, 0);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false, curveSegments: 16 });
  }, []);
  return (
    <>
      <instancedMesh ref={ref} args={[archGeo, undefined, arches.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#d6cfc0" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, arches.length]}>
        <boxGeometry args={[6, 0.3, 0.6]} />
        <meshBasicMaterial color="#fff2b0" />
      </instancedMesh>
    </>
  );
}

function Gantries() {
  return (
    <>
      {SECTIONS.filter((s) => s.s > 0).map((sec, i) => {
        const s = sec.s;
        const x = cAt(s);
        const y = hAt(s);
        const ry = Math.atan2(dcAt(s), -1) + Math.PI;
        const isFinish = sec.s === FINISH;
        const tex = signTexture(sec.name, {
          bg: isFinish ? "#111" : "#1d6b4a",
          border: isFinish ? "#ffffff" : "#ffcc1f",
          sub: isFinish ? "CHECKERED FLAG" : `${Math.round(sec.s)} M`,
        });
        return (
          <group key={i} position={[x, y, -s]} rotation-y={ry}>
            {[-1, 1].map((sd) => (
              <mesh key={sd} position={[sd * (HALF + 1.2), 4.5, 0]} castShadow>
                <boxGeometry args={[0.6, 9, 0.6]} />
                <meshStandardMaterial color={isFinish ? "#f4f1ea" : "#3a3d45"} metalness={0.5} roughness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, 8.6, 0]} castShadow>
              <boxGeometry args={[HALF * 2 + 3, 2.6, 0.4]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0, 8.6, 0.22]}>
              <planeGeometry args={[HALF * 2 + 2.6, 2.4]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
            <mesh position={[0, 8.6, -0.22]} rotation-y={Math.PI}>
              <planeGeometry args={[HALF * 2 + 2.6, 2.4]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
            {isFinish && (
              <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[HALF * 2, 3]} />
                <meshStandardMaterial map={checkerTex()} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

let _checker: THREE.Texture | null = null;
function checkerTex() {
  if (_checker) return _checker;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? "#111" : "#fff";
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  _checker = new THREE.CanvasTexture(c);
  _checker.colorSpace = THREE.SRGBColorSpace;
  return _checker;
}

function Billboards() {
  const items = useMemo(
    () => [
      { s: 60, side: 1, text: "SEND IT", sub: "Space to hop · Shift to boost" },
      { s: 240, side: -1, text: "FLIP IT", sub: "W / S in the air to flip" },
      { s: 470, side: 1, text: "SPIN IT", sub: "A / D in the air to spin" },
      { s: 600, side: -1, text: "LOOP!", sub: "Keep your speed up" },
      { s: 860, side: 1, text: "MEGA RAMP", sub: "Boost pad ahead — commit" },
      { s: 990, side: -1, text: "DODGE!", sub: "Find the gap in the barriers" },
      { s: 1230, side: 1, text: "ROLL IT", sub: "Q / E for barrel rolls" },
      { s: 1470, side: -1, text: "FINAL SEND", sub: "Biggest jump on the mountain" },
    ],
    [],
  );
  return (
    <>
      {items.map((b, i) => {
        const dx = b.side * (HALF + 8);
        const x = cAt(b.s) + dx;
        const y = terrainY(b.s, dx);
        const tex = signTexture(b.text, { bg: "#ff5a1f", border: "#fff3d6", sub: b.sub, accent: "#fff3d6" });
        return (
          <group key={i} position={[x, y, -b.s]} rotation-y={Math.PI - b.side * 0.35}>
            <mesh position={[0, 3.5, 0]} castShadow>
              <boxGeometry args={[0.5, 7, 0.5]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            <mesh position={[0, 7.5, 0]} castShadow>
              <boxGeometry args={[12.4, 3.4, 0.3]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0, 7.5, 0.17]}>
              <planeGeometry args={[12, 3]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export function Track() {
  return (
    <group>
      <Terrain />
      <Road />
      <Walls />
      <Ramps />
      <Loops />
      <Pads />
      <Coins />
      <Cones />
      <Barriers />
      <Tunnel />
      <Gantries />
      <Billboards />
      <Scenery />
    </group>
  );
}
