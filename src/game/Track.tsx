import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  BARRIERS as BARRIERS_ALL,
  BARRIER_DEPTH,
  BARRIER_HEIGHT,
  LOOP_WIDTH,
  LOOP_DECK_THICKNESS,
  LOOP_RAIL_RADIUS,
  LOOP_RAIL_HEIGHT,
  loopPoint,
  COINS,
  CONES,
  HALF,
  LOOPS as LOOPS_ALL,
  PADS as PADS_ALL,
  RAMPS as RAMPS_ALL,
  SCENERY_BUILDINGS as BUILDINGS_ALL,
  SCENERY_TREES as TREES_ALL,
  SCENERY_ROCKS as ROCKS_ALL,
  GANTRIES,
  BILLBOARDS as BILLBOARDS_ALL,
  genEnd,
  MEGAS,
  ensureTrack,
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
  stoneTexture,
} from "./textures";
import { runState, P } from "./physics";

/** Rendered window of the endless track; rebuilt every 100 m as the car advances. */
const W = { s0: -1, s1: 900 };
const inWin = (s: number) => s >= W.s0 - 5 && s <= W.s1 + 5;

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
    () => stripGeometry(W.s0, W.s1, 2, [-HALF, HALF], (s) => hAt(s) + 0.01, 16),
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
      const rows = Math.ceil((W.s1 - Math.max(0, W.s0)) / 2) + 1;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let r = 0; r < rows; r++) {
        const s = Math.max(0, W.s0) + r * 2;
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
    return stripGeometry(Math.max(TERRAIN_S0, W.s0), W.s1 + 300, TERRAIN_DS, cols, (s, dx) => terrainY(s, dx) - 0.05, 30, (s, dx, y) => {
      const a = Math.abs(dx);
      const downtown = false;
      const base = downtown ? rock : Math.sin(s / 700) > 0.75 ? sand : grassA;
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
  const RAMPS = useMemo(() => RAMPS_ALL.filter((r) => inWin(r.s)), []);
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
  const LOOPS = useMemo(() => LOOPS_ALL.filter((l) => inWin(l.s)), []);
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
          const y = point.y;
          const z = point.z;
          pos.push(xc - width / 2, y, z, xc + width / 2, y, z);
          pos.push(xc - width / 2, y - LOOP_DECK_THICKNESS * Math.cos(th), z - LOOP_DECK_THICKNESS * Math.sin(th), xc + width / 2, y - LOOP_DECK_THICKNESS * Math.cos(th), z - LOOP_DECK_THICKNESS * Math.sin(th));
          const v = (th * lp.R) / 16;
          uv.push(0, v, 1, v);
          uv.push(0, v, 1, v);
          rail[0].push(new THREE.Vector3(xc - width / 2, y + LOOP_RAIL_HEIGHT * Math.cos(th), z + LOOP_RAIL_HEIGHT * Math.sin(th)));
          rail[1].push(new THREE.Vector3(xc + width / 2, y + LOOP_RAIL_HEIGHT * Math.cos(th), z + LOOP_RAIL_HEIGHT * Math.sin(th)));
        }
        for (let i = 0; i < seg; i++) {
          const a = i * 4, b = a + 4;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
          idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
          idx.push(a, a + 2, b, a + 2, b + 2, b);
          idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const rails = rail.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, LOOP_RAIL_RADIUS, 8));
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
              <meshStandardMaterial map={stoneTexture()} roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[d.c, d.h + d.lp.R * 2 + 1.8, -d.lp.s]} castShadow>
            <boxGeometry args={[19, 0.8, 0.8]} />
            <meshStandardMaterial map={stoneTexture()} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Megas() {
  const list = useMemo(() => MEGAS.map((m, i) => ({ m, i })).filter(({ m }) => inWin(m.s)), []);
  const coil = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 1 / 160) {
      const a = t * Math.PI * 2 * 6;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.5, t, Math.sin(a) * 1.5));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, 0.13, 8, false);
  }, []);
  const springs = useRef<(THREE.Group | null)[]>([]);
  const tops = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const now = performance.now();
    list.forEach(({ i }, k) => {
      const hit = runState.megaHitAt[i] || 0;
      const t = (now - hit) / 1000;
      // compress hard on hit, then overshoot and settle
      let c = 1;
      if (hit && t < 1.2) c = t < 0.08 ? 1 - t / 0.08 * 0.75 : 1 + Math.sin((t - 0.08) * 14) * Math.exp(-(t - 0.08) * 4) * 0.6;
      else c = 1 + Math.sin(clock.elapsedTime * 3 + k) * 0.03;
      const h = Math.max(0.15, 0.9 * c);
      const sp = springs.current[k], tp = tops.current[k];
      if (sp) sp.scale.y = h;
      if (tp) tp.position.y = 0.25 + h;
    });
  });
  return (
    <>
      {list.map(({ m, i }, k) => {
        const x = cAt(m.s) + m.xo, y = hAt(m.s), yaw = Math.atan2(dcAt(m.s), -1);
        const used = !!runState.usedMegas[i];
        return (
          <group key={i} position={[x, y, -m.s]} rotation-y={yaw}>
            <mesh position-y={0.12} receiveShadow castShadow>
              <cylinderGeometry args={[2.2, 2.4, 0.25, 32]} />
              <meshStandardMaterial color="#3a3a40" metalness={0.6} roughness={0.4} />
            </mesh>
            <group ref={(g) => { springs.current[k] = g; }} position-y={0.25}>
              <mesh geometry={coil} castShadow>
                <meshStandardMaterial color="#d8dde3" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>
            <group ref={(g) => { tops.current[k] = g; }} position-y={1.15}>
              <mesh castShadow>
                <cylinderGeometry args={[2.6, 2.6, 0.3, 40]} />
                <meshStandardMaterial color="#e3121b" emissive="#ff2a1a" emissiveIntensity={used ? 0.05 : 0.6} roughness={0.35} />
              </mesh>
              <mesh position-y={0.16} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[1.2, 1.9, 40]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={used ? 0 : 0.4} />
              </mesh>
              <mesh position-y={0.17} rotation-x={-Math.PI / 2}>
                <circleGeometry args={[0.6, 32]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </group>
            {[-1, 1].map((sd) => (
              <mesh key={sd} position={[sd * 4.2, 2.2, 0]} castShadow>
                <boxGeometry args={[0.25, 4.4, 0.25]} />
                <meshStandardMaterial color="#e3121b" emissive="#ff2a1a" emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

function Pads() {
  const PADS = useMemo(() => PADS_ALL.map((p, gi) => Object.assign({ gi }, p)).filter((p) => inWin(p.s)), []);
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
    // Solid side skirts close the curved ramp, without changing its shared drive surface.
    if (!p.flat) for (const side of [0, 10]) {
      const start = positions.length / 3;
      for (let i = 0; i <= rows; i++) {
        const s = p.s - p.len / 2 + p.len * i / rows;
        const dx = -p.w / 2 + p.w * side / 10;
        positions.push(cAt(s) + p.xo + dx, hAt(s), -s); uvs.push(side / 10, i / rows);
      }
      for (let i = 0; i < rows; i++) {
        const a = i * 11 + side, b = a + 11, c = start + i;
        indices.push(a, c, b, b, c, c + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }), []);
  useFrame(({ clock }) => {
    mats.current.forEach((mat, i) => {
      if (mat) mat.emissiveIntensity = runState.usedPads[PADS[i].gi] ? 0.08 : 1.2 + Math.sin(clock.elapsedTime * 8) * 0.5;
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
  const ids = useMemo(() => COINS.flatMap((c, i) => (inWin(-c.z) ? [i] : [])), []);
  useFrame(({ clock }) => {
    if (!tire.current || !tread.current || !rim.current || !spokes.current) return;
    const t = clock.elapsedTime;
    for (let n = 0; n < ids.length; n++) {
      const i = ids[n];
      const c = COINS[i];
      dummy.position.set(c.x, c.y + Math.sin(t * 3 + i) * 0.15, c.z);
      dummy.rotation.set(0, t * 2.5 + i * 0.3, 0);
      dummy.scale.setScalar(runState.collected[i] ? 0 : 1);
      dummy.updateMatrix();
      tire.current.setMatrixAt(n, dummy.matrix);
      rim.current.setMatrixAt(n, dummy.matrix);
      spokes.current.setMatrixAt(n, dummy.matrix);
      tread.current.setMatrixAt(n, dummy.matrix);
    }
    tire.current.instanceMatrix.needsUpdate = true;
    tread.current.instanceMatrix.needsUpdate = true;
    rim.current.instanceMatrix.needsUpdate = true;
    spokes.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={tire} args={[tireGeo, undefined, Math.max(1, ids.length)]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#1a1a1d" roughness={0.85} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={tread} args={[treadGeo, undefined, Math.max(1, ids.length)]} frustumCulled={false}>
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={rim} args={[rimGeo, undefined, Math.max(1, ids.length)]} frustumCulled={false}>
        <meshStandardMaterial color="#ffc21a" emissive="#b07800" emissiveIntensity={0.6} metalness={0.85} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={spokes} args={[spokeGeo, undefined, Math.max(1, ids.length)]} frustumCulled={false}>
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
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ids = useMemo(() => runState.cones.flatMap((c, i) => (c.home[1] > 0 || inWin(-c.home[1]) ? [i] : [])), []);
  useFrame(() => {
    if (!mesh.current) return;
    for (let n = 0; n < ids.length; n++) {
      const st = runState.cones[ids[n]];
      dummy.position.set(st.x, st.y, st.z);
      dummy.rotation.set(st.tilt, st.rot, 0, "YXZ");
      dummy.updateMatrix();
      mesh.current.setMatrixAt(n, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  // One merged cone (base + body + stripe) so every part moves and rests together.
  const geo = useMemo(() => {
    const paint = (g: THREE.BufferGeometry, hex: string) => {
      const ng = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex);
      const n = ng.getAttribute("position").count; const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      ng.setAttribute("color", new THREE.BufferAttribute(col, 3)); ng.deleteAttribute("uv"); return ng;
    };
    return mergeGeometries([
      paint(new THREE.CylinderGeometry(0.06, 0.4, 1.15, 16).translate(0, 0.7, 0), "#ff6a13"),
      paint(new THREE.CylinderGeometry(0.235, 0.305, 0.22, 16).translate(0, 0.72, 0), "#ffffff"),
      paint(new THREE.BoxGeometry(1.0, 0.14, 1.0).translate(0, 0.07, 0), "#e2540c"),
    ])!;
  }, []);
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, Math.max(1, ids.length)]} castShadow frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  );
}

function Barriers() {
  const BARRIERS = useMemo(() => BARRIERS_ALL.filter((b) => inWin(b.s)), []);
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
  const SCENERY_BUILDINGS = useMemo(() => BUILDINGS_ALL.filter((b) => inWin(-b.z)), []);
  const SCENERY_TREES = useMemo(() => TREES_ALL.filter((tr) => inWin(-tr.z)), []);
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
        // Bury the footing to the lowest corner so the whole base meets sloping land.
        const footing = Math.min(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) =>
          terrainMeshY(b.x + sx * b.w / 2, b.z + sz * b.d / 2))));
        d.position.set(b.x, footing + b.h / 2 - 0.15, b.z);
        d.rotation.set(0, 0, 0);
        d.scale.set(b.w, b.h, b.d);
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    });
    const trunkMesh = trunk.current, leavesMesh = leaves.current;
    if (!trunkMesh || !leavesMesh) return;
    SCENERY_TREES.forEach((t, i) => {
      const ground = terrainMeshY(t.x, t.z) - 0.15 * t.s;
      d.position.set(t.x, ground + 1.2 * t.s, t.z);
      d.scale.setScalar(t.s);
      d.rotation.set(0, i, 0);
      d.updateMatrix();
      trunkMesh.setMatrixAt(i, d.matrix);
      d.position.set(t.x, ground + 4 * t.s, t.z);
      d.updateMatrix();
      leavesMesh.setMatrixAt(i, d.matrix);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    leavesMesh.instanceMatrix.needsUpdate = true;
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

function Gantries() {
  return (
    <>
      {GANTRIES.filter((g) => g.s > 0 && inWin(g.s)).map((g) => ({ s: g.s, name: g.name.split(" · ")[0] })).map((sec, i) => {
        const s = sec.s;
        const x = cAt(s);
        const y = hAt(s);
        const ry = Math.atan2(dcAt(s), -1) + Math.PI;
        const isFinish = false;
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

function FinishArch() {
  const s = 1000;
  const tex = useMemo(() => signTexture("FINISH LINE", { bg: "#111", border: "#ffc933", sub: "1,000 M · KEEP GOING" }), []);
  if (!inWin(s)) return null;
  const ry = Math.atan2(dcAt(s), -1) + Math.PI;
  return (
    <group position={[cAt(s), hAt(s), -s]} rotation-y={ry}>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * (HALF + 1.2), 4.8, 0]} castShadow>
            <boxGeometry args={[0.7, 9.6, 0.7]} />
            <meshStandardMaterial color="#f4f1ea" metalness={0.6} roughness={0.3} />
          </mesh>
          {[2, 5, 8].map((y) => (
            <mesh key={y} position={[sd * (HALF + 1.2), y, 0]}>
              <boxGeometry args={[0.8, 0.35, 0.8]} />
              <meshStandardMaterial color="#ffc933" metalness={0.9} roughness={0.25} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 9, 0]} castShadow>
        <boxGeometry args={[HALF * 2 + 3.4, 2.8, 0.45]} />
        <meshStandardMaterial color="#ffc933" metalness={0.8} roughness={0.3} />
      </mesh>
      {[0.24, -0.24].map((z) => (
        <mesh key={z} position={[0, 9, z]} rotation-y={z < 0 ? Math.PI : 0}>
          <planeGeometry args={[HALF * 2 + 2.8, 2.5]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[HALF * 2, 1.4]} />
        <meshStandardMaterial color="#ffc933" emissive="#ffc933" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Billboards() {
  const items = useMemo(() => BILLBOARDS_ALL.filter((b) => inWin(b.s)), []);
  return (
    <>
      {items.map((b, i) => {
        const dx = b.side * (HALF + 8);
        const x = cAt(b.s) + dx;
        const y = terrainMeshY(x, -b.s) - 0.15;
        const tex = signTexture(b.text, { bg: "#ff5a1f", border: "#fff3d6", sub: b.sub, accent: "#fff3d6" });
        return (
          <group key={i} position={[x, y, -b.s]} rotation-y={Math.atan2(dcAt(b.s), -1) - b.side * 0.35}>
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
  const rocks = useMemo(() => ROCKS_ALL.filter(r => inWin(-r.z)), []);
  const N = rocks.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    rocks.forEach((r, i) => {
      d.position.set(r.x, terrainMeshY(r.x, r.z) + r.sc * r.sy * 0.35, r.z);
      d.rotation.set(...r.rot);
      d.scale.set(r.sc, r.sc * r.sy, r.sc);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [rocks]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8d8478" roughness={1} flatShading />
    </instancedMesh>
  );
}

export function Track() {
  const [win, setWin] = useState(() => {
    ensureTrack(0);
    return { s0: -1, s1: Math.min(genEnd, 900) };
  });
  useFrame(() => {
    const s = Math.max(0, -P.z);
    const start = Math.max(0, Math.floor((s - 150) / 100) * 100);
    const s0 = start === 0 ? -1 : start;
    const s1 = Math.min(genEnd, start + 900);
    if (s0 !== win.s0 || s1 !== win.s1) setWin({ s0, s1 });
  });
  W.s0 = win.s0;
  W.s1 = win.s1;
  return (
    <group key={`${win.s0}:${win.s1}`}>
      <Terrain />
      <Road />
      <Walls />
      <Ramps />
      <Loops />
      <Pads />
      <Megas />
      <Coins />
      <Cones />
      <Barriers />
      <Gantries />
      <FinishArch />
      <Billboards />
      <Scenery />
      <Rocks />
    </group>
  );
}
