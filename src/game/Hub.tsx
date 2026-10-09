import { useFrame, type ThreeElements } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DAILY_PAD, GATE_HALF, HUB_BUILDINGS, STATS_BOARD, type HubBuilding } from "./hub";
import {
  boardTexture,
  brickTexture,
  grassTexture,
  panelTexture,
  plazaTexture,
  rollupTexture,
  signTexture,
  woodTexture,
  stoneTexture,
} from "./textures";
import { useSave } from "./store";

function Ground() {
  const plaza = useMemo(() => {
    const t = plazaTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(14, 10);
    return t;
  }, []);
  const grass = useMemo(() => {
    const t = grassTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(60, 40);
    return t;
  }, []);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 110]} receiveShadow>
        <planeGeometry args={[500, 220]} />
        <meshStandardMaterial map={grass} color="#8cbf55" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 49]} receiveShadow>
        <planeGeometry args={[140, 98]} />
        <meshStandardMaterial map={plaza} roughness={0.95} />
      </mesh>
      {/* painted drive lane to the gate */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 25]} receiveShadow>
        <planeGeometry args={[GATE_HALF * 2, 50]} />
        <meshStandardMaterial color="#6f7176" roughness={0.9} />
      </mesh>
      {[...Array(8)].map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.03, 4 + i * 6]}>
          <planeGeometry args={[0.6, 3]} />
          <meshBasicMaterial color="#ffcc1f" />
        </mesh>
      ))}
    </>
  );
}

function Sign({ text, sub, w, h, bg, border, ...props }: { text: string; sub?: string; w: number; h: number; bg: string; border: string } & ThreeElements["group"]) {
  const tex = signTexture(text, { sub, bg, border });
  return (
    <group {...props}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.4, h + 0.4, 0.3]} />
        <meshStandardMaterial color="#1a1a1e" />
      </mesh>
      <mesh position={[0, 0, 0.17]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function DoorMarker({ b }: { b: HubBuilding }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 6.2 + Math.sin(clock.elapsedTime * 3) * 0.35;
      ref.current.rotation.y = clock.elapsedTime * 1.5;
    }
  });
  const t = b.trigger;
  return (
    <group position={[t.x, 0, t.z]}>
      <group ref={ref}>
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.9, 1.6, 4]} />
          <meshStandardMaterial color="#ffcc1f" emissive="#ff9900" emissiveIntensity={0.8} />
        </mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <planeGeometry args={[t.hx * 2, t.hz * 2]} />
        <meshBasicMaterial color="#ffcc1f" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function Building({ b }: { b: HubBuilding }) {
  const [w, h, d] = b.size;
  const style = b.id;
  const wallMat = useMemo(() => {
    if (style === "garage") {
      const t = brickTexture().clone();
      t.needsUpdate = true;
      t.repeat.set(4, 2);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    }
    if (style === "tuning") {
      const t = panelTexture().clone();
      t.needsUpdate = true;
      t.repeat.set(5, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.3 });
    }
    return new THREE.MeshStandardMaterial({ color: "#eef3f6", roughness: 0.4 });
  }, [style]);

  const doorW = style === "tuning" ? 9 : 8;
  const doorH = 6;
  const signText = b.label;
  const signColors =
    style === "garage"
      ? { bg: "#d8321f", border: "#ffcc1f" }
      : style === "dealer"
        ? { bg: "#1554d1", border: "#ffffff" }
        : { bg: "#15151a", border: "#ff2bd6" };

  return (
    <group position={[b.center[0], 0, b.center[1]]}>
      {/* main body */}
      {style === "dealer" ? (
        <>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshPhysicalMaterial color="#a8d8ff" transparent opacity={0.28} roughness={0.05} metalness={0.1} depthWrite={false} />
          </mesh>
          {/* frame */}
          <mesh position={[0, h + 0.4, 0]} castShadow>
            <boxGeometry args={[w + 1, 0.8, d + 1]} />
            <meshStandardMaterial color="#f4f6f8" />
          </mesh>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <mesh key={i} position={[(sx * w) / 2, h / 2, (sz * d) / 2]} castShadow>
              <boxGeometry args={[0.6, h, 0.6]} />
              <meshStandardMaterial color="#f4f6f8" />
            </mesh>
          ))}
          <mesh position={[0, 0.1, 0]} receiveShadow>
            <boxGeometry args={[w - 0.4, 0.2, d - 0.4]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.2} metalness={0.2} />
          </mesh>
          <Showcase />
        </>
      ) : (
        <>
          <mesh position={[0, h / 2, 0]} material={wallMat} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
          </mesh>
          <mesh position={[0, h + 0.3, 0]} castShadow>
            <boxGeometry args={[w + 0.8, 0.6, d + 0.8]} />
            <meshStandardMaterial color={style === "garage" ? "#3a3a3f" : "#ff2bd6"} emissive={style === "tuning" ? "#5a0050" : "#000"} />
          </mesh>
        </>
      )}

      {/* door + sign on the door face */}
      <group
        position={[b.door.x - b.center[0], 0, b.door.z - b.center[1]]}
        rotation-y={b.door.rotY}
      >
        {style !== "dealer" && (
          <mesh position={[0, doorH / 2, 0.06]}>
            <planeGeometry args={[doorW, doorH]} />
            {style === "garage" ? (
              <meshStandardMaterial map={rollupTexture()} />
            ) : (
              <meshStandardMaterial color="#0d0d12" emissive="#ff2bd6" emissiveIntensity={0.15} />
            )}
          </mesh>
        )}
        {/* door frame */}
        <mesh position={[0, doorH + 0.25, 0.15]}>
          <boxGeometry args={[doorW + 1, 0.5, 0.3]} />
          <meshStandardMaterial color="#ffcc1f" emissive="#ffaa00" emissiveIntensity={0.5} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[(sd * (doorW + 0.5)) / 2, doorH / 2, 0.15]}>
            <boxGeometry args={[0.5, doorH, 0.3]} />
            <meshStandardMaterial color="#ffcc1f" emissive="#ffaa00" emissiveIntensity={0.5} />
          </mesh>
        ))}
        <Sign
          text={signText}
          sub={style === "garage" ? "PAINT · GLOW · TRAILS" : style === "dealer" ? "NEW RIDES FOR WHEELS" : "ENGINE · NITRO · GRIP"}
          w={Math.min(w, 16) - 1}
          h={3}
          position={[0, h + 2.4, 0.3]}
          {...signColors}
        />
      </group>
      {style === "tuning" && (
        <>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * (w / 2 + 0.05), h / 2, 0]}>
              <boxGeometry args={[0.1, 0.4, d]} />
              <meshBasicMaterial color="#22e4ff" toneMapped={false} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function Showcase() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.5;
  });
  const { scene } = useGLTF("/models/race-future.glb");
  const { scene: s2 } = useGLTF("/models/race.glb");
  return (
    <>
      <group ref={ref} position={[0, 0.4, -4]}>
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <cylinderGeometry args={[3.4, 3.4, 0.25, 40]} />
          <meshStandardMaterial color="#222" metalness={0.7} roughness={0.25} />
        </mesh>
        <Clone object={scene} scale={1.8} castShadow />
      </group>
      <group position={[0, 0.2, 5]} rotation-y={0.6}>
        <Clone object={s2} scale={1.8} castShadow />
      </group>
    </>
  );
}

function Fence() {
  const posts = useMemo(() => {
    const out: [number, number, number][] = [];
    const add = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.floor(len / 4);
      for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, Math.atan2(x1 - x0, z1 - z0)]);
    };
    add(-70, 0, -GATE_HALF - 2, 0);
    add(GATE_HALF + 2, 0, 70, 0);
    add(-70, 0, -70, 100);
    add(70, 0, 70, 100);
    add(-70, 100, 70, 100);
    return out;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const rail = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    posts.forEach(([x, z, r], i) => {
      d.position.set(x, 0.7, z);
      d.rotation.set(0, r, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      ref.current!.setMatrixAt(i, d.matrix);
      d.position.set(x, 1.0, z);
      d.updateMatrix();
      rail.current!.setMatrixAt(i, d.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    rail.current!.instanceMatrix.needsUpdate = true;
  }, [posts]);
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, posts.length]} castShadow>
        <boxGeometry args={[0.3, 1.4, 0.3]} />
        <meshStandardMaterial map={woodTexture()} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={rail} args={[undefined, undefined, posts.length]} castShadow>
        <boxGeometry args={[0.15, 0.25, 4.1]} />
        <meshStandardMaterial map={woodTexture()} roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function Gate() {
  const tex = signTexture("DOWNHILL DASH", { sub: "▼ DRIVE THROUGH TO START ▼", bg: "#ff5a1f", border: "#fff3d6", accent: "#fff3d6" });
  const flags = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (flags.current) flags.current.children.forEach((c, i) => (c.rotation.y = Math.sin(clock.elapsedTime * 4 + i) * 0.3));
  });
  return (
    <group position={[0, 0, 2]}>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (GATE_HALF + 1.5), 0, 0]}>
          <mesh position={[0, 5, 0]} castShadow>
            <boxGeometry args={[1.6, 10, 1.6]} />
            <meshStandardMaterial color="#2a2c33" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[2.4, 1, 2.4]} />
            <meshStandardMaterial color="#ffcc1f" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 10, 0]} castShadow>
        <boxGeometry args={[GATE_HALF * 2 + 5, 3.6, 1.2]} />
        <meshStandardMaterial color="#1a1a1e" />
      </mesh>
      <mesh position={[0, 10, 0.62]}>
        <planeGeometry args={[GATE_HALF * 2 + 4.4, 3.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 10, -0.62]} rotation-y={Math.PI}>
        <planeGeometry args={[GATE_HALF * 2 + 4.4, 3.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <group ref={flags}>
        {[-8, -4, 0, 4, 8].map((x, i) => (
          <mesh key={i} position={[x, 7.6, 0]}>
            <planeGeometry args={[1.6, 1.2]} />
            <meshStandardMaterial color={i % 2 ? "#ffcc1f" : "#ff3b30"} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Trees() {
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const side = i % 3;
      let x: number, z: number;
      if (side === 0) {
        x = -75 - r() * 60;
        z = r() * 140;
      } else if (side === 1) {
        x = 75 + r() * 60;
        z = r() * 140;
      } else {
        x = (r() - 0.5) * 260;
        z = 105 + r() * 50;
      }
      out.push([x, z, 0.8 + r() * 0.8]);
    }
    // a few inside the plaza
    [[-56, 70], [56, 70], [-56, 10], [56, 10], [-22, 90], [22, 90]].forEach(([x, z]) => out.push([x, z, 0.9]));
    return out;
  }, []);
  const trunk = useRef<THREE.InstancedMesh>(null);
  const top = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    spots.forEach(([x, z, s], i) => {
      d.position.set(x, 1.2 * s, z);
      d.scale.setScalar(s);
      d.rotation.set(0, i, 0);
      d.updateMatrix();
      trunk.current!.setMatrixAt(i, d.matrix);
      d.position.set(x, 4.6 * s, z);
      d.updateMatrix();
      top.current!.setMatrixAt(i, d.matrix);
    });
    trunk.current!.instanceMatrix.needsUpdate = true;
    top.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 2.4, 6]} />
        <meshStandardMaterial color="#7a5232" />
      </instancedMesh>
      <instancedMesh ref={top} args={[undefined, undefined, spots.length]} castShadow>
        <coneGeometry args={[2.6, 6, 7]} />
        <meshStandardMaterial color="#3f8a3a" flatShading roughness={0.9} />
      </instancedMesh>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _Lamps() {
  const spots: [number, number][] = [
    [-14, 10], [14, 10], [-14, 30], [14, 30], [-14, 55], [14, 55], [-30, 70], [30, 70],
  ];
  return (
    <>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 6, 8]} />
            <meshStandardMaterial color="#2a2c33" />
          </mesh>
          <mesh position={[0, 6.1, 0]}>
            <sphereGeometry args={[0.45, 12, 12]} />
            <meshBasicMaterial color="#fff2c4" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function DailyPad() {
  const ring = useRef<THREE.Mesh>(null);
  const sign = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime;
    if (sign.current) sign.current.rotation.y = clock.elapsedTime * 0.4;
  });
  const tex = useMemo(
    () => signTexture("DAILY REWARDS", { sub: "OPEN YOUR CHEST", bg: "#2bb673", border: "#fff3d6", accent: "#fff3d6" }),
    [],
  );
  const W = 6;
  return (
    <group position={[DAILY_PAD.x, 0, DAILY_PAD.z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[DAILY_PAD.r, DAILY_PAD.r, 0.2, 40]} />
        <meshStandardMaterial color="#2bb673" emissive="#0d5a35" />
      </mesh>
      <mesh ref={ring} position={[0, 0.25, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[DAILY_PAD.r - 0.5, DAILY_PAD.r - 0.2, 6]} />
        <meshBasicMaterial color="#fff3d6" />
      </mesh>
      <mesh position={[0, 3, -DAILY_PAD.r - 1]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 6, 12]} />
        <meshStandardMaterial color="#3a3d45" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* four-sided sign that slowly turns: readable from every direction */}
      <group ref={sign} position={[0, 6.6, -DAILY_PAD.r - 1]}>
        <mesh castShadow>
          <boxGeometry args={[W + 0.2, 1.7, W + 0.2]} />
          <meshStandardMaterial color="#1f2a24" />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation-y={(k * Math.PI) / 2}>
            <mesh position={[0, 0, W / 2 + 0.11]}>
              <planeGeometry args={[W, 1.5]} />
              <meshBasicMaterial map={tex} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function StatsBoard() {
  const best = useSave((s) => s.best);
  const runs = useSave((s) => s.runs);
  const bestTricks = useSave((s) => s.bestTricks);
  const owned = useSave((s) => s.owned.length);
  const tex = useMemo(
    () =>
      boardTexture(
        [
          `Best time: ${best ? best.toFixed(2) + "s" : "—"}`,
          `Runs: ${runs}`,
          `Most tricks: ${bestTricks}`,
          `Cars owned: ${owned}/8`,
        ],
        "YOUR STATS",
      ),
    [best, runs, bestTricks, owned],
  );
  const wood = "#7a4e2a";
  const dark = "#4a2f18";
  return (
    <group position={[STATS_BOARD.x, 0, STATS_BOARD.z]} rotation-y={Math.PI + 0.3}>
      {/* posts run the full height and sit on stone footings */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * 3.05, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.6, 0.9]} />
            <meshStandardMaterial map={stoneTexture()} roughness={0.95} />
          </mesh>
          <mesh position={[sd * 3.05, 3.9, 0]} castShadow>
            <boxGeometry args={[0.45, 7.2, 0.45]} />
            <meshStandardMaterial map={woodTexture()} roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* backing panel sits between the posts */}
      <mesh position={[0, 4.4, -0.05]} castShadow>
        <boxGeometry args={[5.65, 5.4, 0.2]} />
        <meshStandardMaterial map={woodTexture()} color={dark} roughness={0.85} />
      </mesh>
      {/* frame trim */}
      {[1.7 + 5.4 + 0.05, 1.7 - 0.05].map((y) => (
        <mesh key={y} position={[0, y, 0.08]} castShadow>
          <boxGeometry args={[5.65, 0.22, 0.18]} />
          <meshStandardMaterial map={woodTexture()} roughness={0.85} />
        </mesh>
      ))}
      {/* little roof cap */}
      <mesh position={[0, 7.65, 0]} castShadow>
        <boxGeometry args={[6.9, 0.25, 1.1]} />
        <meshStandardMaterial map={woodTexture()} color={dark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 4.4, 0.07]}>
        <planeGeometry args={[5.3, 5.1]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 4.4, -0.16]} rotation-y={Math.PI}>
        <planeGeometry args={[5.3, 5.1]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Props() {
  const box = useGLTF("/models/box.glb").scene;
  const amb = useGLTF("/models/ambulance.glb").scene;
  const truck = useGLTF("/models/truck.glb").scene;
  const taxi = useGLTF("/models/taxi.glb").scene;
  return (
    <>
      {[[-52, 52], [-50, 54], [-51, 50.5]].map(([x, z], i) => (
        <Clone key={i} object={box} position={[x, i === 2 ? 0 : 0, z]} scale={2.2} rotation-y={i} />
      ))}
      <Clone object={amb} position={[-58, 0, 80]} rotation-y={0.4} scale={1.8} castShadow />
      <Clone object={truck} position={[58, 0, 82]} rotation-y={-0.5} scale={1.6} castShadow />
      <Clone object={taxi} position={[52, 0, 8]} rotation-y={-2.3} scale={1.8} castShadow />
    </>
  );
}

export function Hub() {
  return (
    <group>
      <Ground />
      {HUB_BUILDINGS.map((b) => (
        <group key={b.id}>
          <Suspense fallback={null}>
            <Building b={b} />
          </Suspense>
          <DoorMarker b={b} />
        </group>
      ))}
      <Fence />
      <Gate />
      <Trees />

      <DailyPad />
      <StatsBoard />
      <Suspense fallback={null}>
        <Props />
      </Suspense>
    </group>
  );
}
