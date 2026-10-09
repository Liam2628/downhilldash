import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BARRIERS,
  BARRIER_DEPTH,
  BARRIER_HEIGHT,
  LOOP_WIDTH,
  loopPoint,
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
  padAdd,
  rampAdd,
  terrainY,
  terrainMeshY,
  TERRAIN_COLS,
  TERRAIN_DS,
  TERRAIN_S0,
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
      idx.push(a, b, c2, b, d, c2);
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
    const cols = TERRAIN_COLS;
    const grassA = new THREE.Color("#7fb04a");
    const grassB = new THREE.Color("#5f9a3c");
    const sand = new THREE.Color("#d9c08a");
    const rock = new THREE.Color("#9a8f80");
    const tmp = new THREE.Color();
    return stripGeometry(TERRAIN_S0, L + 700, TERRAIN_DS, cols, (s, dx) => terrainY(s, dx) - 0.05, 30, (s, dx, y) => {
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
        const rows = 24;
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
         // The open front blends into the road; the rear is a solid launch lip.
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
        const width = LOOP_WIDTH;
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        const rail: THREE.Vector3[][] = [[], []];
        const c = cAt(lp.s);
        const h = hAt(lp.s);
        for (let i = 0; i <= seg; i++) {
          const th = (i / seg) * Math.PI * 2;
          const point = loopPoint(lp, th);
          const xc = point.x;
          const y = point.y + 0.02;
          const z = point.z;
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
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const geos = useMemo(() => PADS.map((p) => {
    const rows = 18;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= rows; i++) {
      const s = p.s - p.len / 2 + p.len * i / rows;
      const x = cAt(s) + p.xo;
      const y = hAt(s);
      const top = y + padAdd(s, p.xo) + 0.04;
      for (let j = 0; j <= 10; j++) {
        const dx = -p.w / 2 + p.w * j / 10;
        positions.push(x + dx, y + padAdd(s, p.xo + dx) + 0.04, -s);
        uvs.push(j / 10, i / rows);
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < 10; j++) {
        const a = i * 11 + j;
        indices.push(a, a + 11, a + 1, a + 1, a + 11, a + 12);
      }
    }
    const end = rows * 11;
    for (let j = 0; j <= 10; j++) {
      const dx = -p.w / 2 + p.w * j / 10;
      positions.push(cAt(p.s + p.len / 2) + p.xo + dx, hAt(p.s + p.len / 2), -(p.s + p.len / 2)); uvs.push(j / 10, 1);
    }
    const base = (rows + 1) * 11;
    for (let j = 0; j < 10; j++) indices.push(end + j, base + j, end + j + 1, end + j + 1, base + j, base + j + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }), []);
  useFrame(({ clock }) => {
    mats.current.forEach((mat, i) => {
      if (mat) mat.emissiveIntensity = runState.usedPads[i] ? 0.08 : 1.2 + Math.sin(clock.elapsedTime * 8) * 0.5;
    });
  });
  return (
    <>
      {geos.map((geo, i) => (
          <mesh key={i} geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial ref={(material) => { mats.current[i] = material; }} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1.3} side={THREE.DoubleSide} roughness={0.65} />
          </mesh>
      ))}
    </>
  );
}

function Coins() {
  const tire = useRef<THREE.InstancedMesh>(null);
  const tread = useRef<THREE.InstancedMesh>(null);
  const rim = useRef<THREE.InstancedMesh>(null);
  const spokes = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // tire: fat cylinder on its side; tread: thin ribbed ring; rim: shiny disc; spokes: 5-arm star
  const tireGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.74, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.455, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.46, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 28 }).translate(0, 0, -0.23);
  }, []);
  const treadGeo = useMemo(() => new THREE.TorusGeometry(0.72, 0.06, 6, 28), []);
  const rimGeo = useMemo(() => new THREE.CylinderGeometry(0.46, 0.46, 0.44, 24).rotateX(Math.PI / 2), []);
  const spokeGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const b = new THREE.BoxGeometry(0.1, 0.42, 0.5);
      b.translate(0, 0.2, 0);
      b.rotateZ((k / 5) * Math.PI * 2);
      parts.push(b);
    }
    parts.push(new THREE.CylinderGeometry(0.13, 0.13, 0.52, 12).rotateX(Math.PI / 2));
    return mergeGeos(parts);
  }, []);
  useFrame(({ clock }) => {
    if (!tire.current || !tread.current || !rim.current || !spokes.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < COINS.length; i++) {
      const c = COINS[i];
      dummy.position.set(c.x, c.y + Math.sin(t * 3 + i) * 0.15, c.z);
      dummy.rotation.set(0, t * 2.5 + i * 0.3, 0);
      dummy.scale.setScalar(runState.collected[i] ? 0 : 1);
      dummy.updateMatrix();
      tire.current.setMatrixAt(i, dummy.matrix);
      rim.current.setMatrixAt(i, dummy.matrix);
      spokes.current.setMatrixAt(i, dummy.matrix);
      tread.current.setMatrixAt(i, dummy.matrix);
    }
    tire.current.instanceMatrix.needsUpdate = true;
    tread.current.instanceMatrix.needsUpdate = true;
    rim.current.instanceMatrix.needsUpdate = true;
    spokes.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={tire} args={[tireGeo, undefined, COINS.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#1a1a1d" roughness={0.85} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={tread} args={[treadGeo, undefined, COINS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={rim} args={[rimGeo, undefined, COINS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#ffc21a" emissive="#b07800" emissiveIntensity={0.6} metalness={0.85} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={spokes} args={[spokeGeo, undefined, COINS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#e8e8ee" metalness={0.9} roughness={0.2} />
      </instancedMesh>
    </>
  );
}

function mergeGeos(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.attributes['position'].array as Float32Array));
    nor.push(...(ng.attributes['normal'].array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}


function Cones() {
  const body = useRef<THREE.InstancedMesh>(null);
  const base = useRef<THREE.InstancedMesh>(null);
  const stripe = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!body.current || !stripe.current || !base.current) return;
    for (let i = 0; i < runState.cones.length; i++) {
      const st = runState.cones[i];
      dummy.position.set(st.x, st.y, st.z);
      dummy.rotation.set(st.tilt, st.rot, 0, "YXZ");
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.current.setMatrixAt(i, dummy.matrix);
      stripe.current.setMatrixAt(i, dummy.matrix);
      base.current.setMatrixAt(i, dummy.matrix);
    }
    body.current.instanceMatrix.needsUpdate = true;
    stripe.current.instanceMatrix.needsUpdate = true;
    base.current.instanceMatrix.needsUpdate = true;
  });
  const coneGeo = useMemo(() => new THREE.CylinderGeometry(0.06, 0.4, 1.15, 16).translate(0, 0.7, 0), []);
  const stripeGeo = useMemo(() => new THREE.CylinderGeometry(0.22, 0.29, 0.22, 16).translate(0, 0.72, 0), []);
  const baseGeo = useMemo(() => new THREE.BoxGeometry(1.0, 0.14, 1.0).translate(0, 0.07, 0), []);
  return (
    <>
      <instancedMesh ref={body} args={[coneGeo, undefined, runState.cones.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ff6a13" roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={base} args={[baseGeo, undefined, runState.cones.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#e2540c" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={stripe} args={[stripeGeo, undefined, runState.cones.length]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </instancedMesh>
    </>
  );
}

function Barriers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // Low broad nose, narrower crown: a visible concrete obstacle, not a box wall.
    const half = BARRIER_DEPTH / 2;
    const profile = [[-half, 0], [-0.5, BARRIER_HEIGHT], [0.5, BARRIER_HEIGHT], [half, 0]];
    const pos: number[] = []; const uv: number[] = []; const idx: number[] = [];
    for (const x of [-0.5, 0.5]) for (const [z, y] of profile) { pos.push(x, y, z); uv.push((x + 0.5) * 2, z / BARRIER_DEPTH + 0.5); }
    for (let i = 0; i < 3; i++) idx.push(i, i + 4, i + 1, i + 1, i + 4, i + 5);
    idx.push(0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 3, 4, 3, 7, 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }, []);
  useLayoutEffect(() => {
    if (!ref.current || !caps.current) return;
    const d = new THREE.Object3D();
    BARRIERS.forEach((b, i) => {
      d.position.set(cAt(b.s) + b.xo, hAt(b.s), -b.s);
      d.rotation.set(0, 0, 0); d.scale.set(b.w, 1, 1); d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
      d.position.y += BARRIER_HEIGHT + 0.035; d.scale.set(b.w - 0.3, 0.07, 0.65); d.updateMatrix();
      caps.current?.setMatrixAt(i, d.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true; caps.current.instanceMatrix.needsUpdate = true;
  }, []);
  const tex = useMemo(() => {
    const t = chevronTexture("#ff3b30", "#f4f1ea").clone(); t.needsUpdate = true; t.repeat.set(2, 0.5); return t;
  }, []);
  return <>
    <instancedMesh ref={ref} args={[geo, undefined, BARRIERS.length]} castShadow receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.85} side={THREE.DoubleSide} />
    </instancedMesh>
    <instancedMesh ref={caps} args={[undefined, undefined, BARRIERS.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#e4e6ea" roughness={0.5} metalness={0.2} />
    </instancedMesh>
  </>;
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
          border: isFinish ? "#ff6b00" : "#ffcc1f",
          sub: isFinish ? "YOU MADE IT" : `${Math.round(sec.s)} M`,
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
                <planeGeometry args={[HALF * 2, 1.2]} />
                <meshStandardMaterial color="#ff6b00" emissive="#ff6b00" emissiveIntensity={0.4} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

function Billboards() {
  const items = useMemo(
    () => [
        { s: 60, side: 1, text: "DOWNHILL DASH", sub: "Shift to boost · Q / E to spin" },
      { s: 240, side: -1, text: "FLIP IT", sub: "W / S in the air to flip" },
       { s: 470, side: 1, text: "SPIN IT", sub: "Q / E in the air to spin" },
      { s: 600, side: -1, text: "LOOP!", sub: "Keep your speed up" },
      { s: 860, side: 1, text: "MEGA RAMP", sub: "Boost pad ahead — commit" },
      { s: 990, side: -1, text: "DODGE!", sub: "Find the gap in the barriers" },
       { s: 1230, side: 1, text: "ROLL IT", sub: "Z / C for barrel rolls · F to level" },
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

function Rocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 420;
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const s = 20 + r() * (L + 300);
      const side = r() < 0.5 ? -1 : 1;
      const dx = side * (14 + r() * 260);
      const sc = 0.6 + r() * r() * 6;
      { const x = cAt(Math.min(s, L)) + dx; d.position.set(x, terrainMeshY(x, -s) - sc * 0.15, -s); }
      d.rotation.set(r() * 3, r() * 3, r() * 3);
      d.scale.set(sc, sc * (0.5 + r() * 0.5), sc);
      d.updateMatrix();
      ref.current!.setMatrixAt(i, d.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8d8478" roughness={1} flatShading />
    </instancedMesh>
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
      <Rocks />
    </group>
  );
}
