import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { Trail } from "@react-three/drei";
import { CarModel, type CarHandle } from "./CarModel";
import { P, step } from "./physics";
import { useGame, useSave } from "./store";
import { orbit } from "./input";
import { view } from "./quests";
import { cAt, hAt } from "./track";

const tmpV = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");

export function Player() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const car = useRef<CarHandle>(null);
  const flames = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowLight = useRef<THREE.PointLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const turntable = useRef<THREE.Mesh>(null);
  const camLook = useRef(new THREE.Vector3(0, 1, 30));
  const loopView = useRef(new THREE.Vector3());
  const airLift = useRef(0);
  const { camera } = useThree();

  const mode = useGame((s) => s.mode);
  const menu = useGame((s) => s.menu);
  const preview = useGame((s) => s.preview);
  const selected = useSave((s) => s.selected);
  const paints = useSave((s) => s.paints);
  const glow = useSave((s) => s.glow);
  const trail = useSave((s) => s.trail);
  const carId = mode === "menu" && menu === "dealer" && preview ? preview : selected;
  const paint = paints[carId] ?? null;

  useFrame((state, rawDt) => {
    step(rawDt);
    const dt = Math.min(rawDt, 0.05);
    const g = useGame.getState();
    const settings = useSave.getState().settings;
    const t = state.clock.elapsedTime;

    if (root.current && body.current) {
      root.current.position.set(P.x, P.y, P.z);
      const spin = P.wipeSpin;
      euler.set(
        P.pitch + P.takeoffPitch * 0 + (P.grounded ? 0 : P.tPitch),
        P.yaw + (P.grounded ? 0 : P.tYaw) + spin,
        P.roll + (P.grounded ? 0 : P.tRoll),
        "YXZ",
      );
      if (!P.grounded && !P.loop) euler.x = P.takeoffPitch + P.tPitch;
      if (g.mode === "menu") {
        euler.set(0, P.yaw + t * 0.35, 0, "YXZ");
      }
      root.current.rotation.copy(euler);
      // suspension bob on landing
      body.current.position.y = -P.landFlash * 0.25 + (g.mode === "menu" ? 0.35 : 0);
    }

    // wheels
    if (car.current) {
      const spinAmt = (P.speed / 0.55) * dt;
      for (const w of car.current.wheels) w.rotation.x += spinAmt;
      for (const w of car.current.front) w.rotation.y = P.steer * 0.45;
    }

    // flames
    if (flames.current) {
      const on = P.boosting && g.mode !== "menu";
      const s = on ? 0.8 + Math.sin(t * 60) * 0.2 + Math.random() * 0.2 : 0.001;
      flames.current.scale.set(1, 1, s);
      flames.current.visible = on;
    }

    // underglow
    if (glowMat.current && glowLight.current) {
      glowLight.current.intensity = glow ? 18 + Math.sin(t * 3) * 3 : 0;
    }

    if (turntable.current) {
      turntable.current.visible = g.mode === "menu";
      turntable.current.rotation.y = t * 0.35;
    }

    // sun follows player for crisp shadows
    if (sun.current) {
      sun.current.position.set(P.x + 40, P.y + 70, P.z + 30);
      sun.current.target.position.set(P.x, P.y, P.z);
      sun.current.target.updateMatrixWorld();
    }

    // ---------- camera ----------
    const cam = camera as THREE.PerspectiveCamera;
    const k = 1 - Math.exp(-6 * dt);
    let fovTarget = Math.min(110, settings.fov + Math.min(18, Math.abs(P.speed) * 0.24) + (P.boosting ? 8 : 0));

    if (g.mode === "title") {
      const a = t * 0.08;
      tmpV.set(Math.sin(a) * 60, 26, 40 + Math.cos(a) * 60);
      cam.position.lerp(tmpV, 1 - Math.exp(-2 * dt));
      tmpLook.set(0, 2, 20);
      camLook.current.lerp(tmpLook, k);
      fovTarget = 55;
    } else if (g.mode === "menu") {
      if (!orbit.dragging) orbit.yaw += dt * 0.25;
      const r = 8.5;
      tmpV.set(
        P.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * r,
        P.y + 1 + Math.sin(orbit.pitch) * r,
        P.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * r,
      );
      cam.position.lerp(tmpV, 1 - Math.exp(-8 * dt));
      tmpLook.set(P.x, P.y + 1.1, P.z);
      camLook.current.lerp(tmpLook, 1 - Math.exp(-10 * dt));
      fovTarget = 45;
    } else {
      // One continuous camera rig: blend into side view, then ease back after the exit.
      P.loopCamera += ((P.loop ? 1 : 0) - P.loopCamera) * (1 - Math.exp(-(P.loop ? 4 : 2.5) * dt));
      const far = view.mode === 1 ? 1.6 : 1;
      const hood = view.mode === 2;
      const rush = g.mode === "run" ? Math.min(1, Math.abs(P.speed) / 55) : 0;
      const d = hood ? -0.4 : (8.5 - rush * 1.2) * settings.camDist * far;
      const h = hood ? 1.35 : (3.6 - rush * 0.7) * settings.camDist * (view.mode === 1 ? 1.45 : 1);
      const fx = Math.sin(P.yaw); const fz = Math.cos(P.yaw);
      airLift.current += ((P.grounded || hood || P.loop ? 0 : 1) - airLift.current) * (1 - Math.exp(-5 * dt));
      tmpV.set(P.x - fx * d, P.y + h + airLift.current, P.z - fz * d);
      const lp = P.loop?.lp;
      if (lp) loopView.current.set(cAt(lp.s) + 34, hAt(lp.s) + lp.R + 3, -lp.s + 4);
      if (P.loopCamera > 0.001) tmpV.lerp(loopView.current, P.loopCamera);
      cam.position.lerp(tmpV, hood && P.loopCamera < 0.01 ? 1 : k);
      const ahead = hood ? 14 : 4;
      tmpLook.set(P.x + fx * ahead * (1 - P.loopCamera), P.y + (hood ? 1.1 : 1.4) * (1 - P.loopCamera), P.z + fz * ahead * (1 - P.loopCamera));
      camLook.current.lerp(tmpLook, 1 - Math.exp(-10 * dt));
    }
    if (P.snapCam) {
      cam.position.copy(tmpV); camLook.current.copy(tmpLook); P.snapCam = false;
    }
    cam.fov += (fovTarget - cam.fov) * (1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
    cam.lookAt(camLook.current);
  });

  const shadows = useSave((s) => s.settings.quality === "high");

  return (
    <>
      <directionalLight
        ref={sun}
        intensity={2.4}
        color="#fff4e0"
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
      />
      <group ref={root}>
        <group ref={body}>
          <Suspense fallback={null}>
            <CarModel ref={car} carId={carId} paint={paint} key={carId + (paint ?? "")} />
          </Suspense>
          <group ref={flames} position={[0, 0.55, -2.3]}>
            <mesh position={[0.45, 0, -0.6]} rotation-x={-Math.PI / 2}>
              <coneGeometry args={[0.22, 1.4, 10]} />
              <meshBasicMaterial color="#ffb21a" transparent opacity={0.9} />
            </mesh>
            <mesh position={[-0.45, 0, -0.6]} rotation-x={-Math.PI / 2}>
              <coneGeometry args={[0.22, 1.4, 10]} />
              <meshBasicMaterial color="#ffb21a" transparent opacity={0.9} />
            </mesh>
            <mesh position={[0, 0, -0.9]} rotation-x={-Math.PI / 2}>
              <coneGeometry args={[0.35, 2, 10]} />
              <meshBasicMaterial color="#4fd8ff" transparent opacity={0.5} />
            </mesh>
          </group>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} visible={!!glow}>
            <planeGeometry args={[2.6, 4.6]} />
            <meshBasicMaterial ref={glowMat} color={glow ?? "#000"} transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <pointLight ref={glowLight} position={[0, 0.3, 0]} color={glow ?? "#ffffff"} distance={7} decay={1.6} intensity={0} />
        </group>
        {trail && mode !== "menu" && (
          <Trail width={1.6} length={5} color={trail} attenuation={(w) => w * w} decay={1.5}>
            <mesh position={[0, 0.6, -2]}>
              <sphereGeometry args={[0.01, 4, 4]} />
              <meshBasicMaterial color={trail} />
            </mesh>
          </Trail>
        )}
      </group>
      <mesh ref={turntable} position={[P.x, 0.02, P.z]} rotation-x={-Math.PI / 2} visible={false}>
        <cylinderGeometry args={[4, 4, 0.3, 48]} />
        <meshStandardMaterial color="#26272e" metalness={0.6} roughness={0.3} />
      </mesh>
    </>
  );
}
