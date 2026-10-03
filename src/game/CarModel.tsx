import { useGLTF } from "@react-three/drei";
import { useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { CARS, carById } from "./data";

export type CarHandle = { wheels: THREE.Object3D[]; front: THREE.Object3D[] };

type Props = { carId: string; paint: string | null };

function paintMaterial(src: THREE.Material, paint: string | null) {
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
          float m = smoothstep(0.35, 0.55, sat) * uPaintAmt;
          diffuseColor.rgb = mix(c, uPaint * (0.45 + l * 1.4), m);
        }`,
      );
  };
  m.customProgramCacheKey = () => "paint";
  return m;
}

export const CarModel = forwardRef<CarHandle, Props>(function CarModel({ carId, paint }, ref) {
  const def = carById(carId);
  const { scene } = useGLTF(def.file);

  const { root, wheels, front } = useMemo(() => {
    const root = scene.clone(true);
    const wheels: THREE.Object3D[] = [];
    const front: THREE.Object3D[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.name.startsWith("body") || (mesh.parent && mesh.parent.name.startsWith("body"))) {
          mesh.material = paintMaterial(mesh.material as THREE.Material, paint);
        }
      }
      if (o.name.startsWith("wheel")) {
        o.rotation.order = "YXZ";
        wheels.push(o);
        if (o.name.includes("front")) front.push(o);
      }
    });
    return { root, wheels, front };
  }, [scene, paint]);

  useImperativeHandle(ref, () => ({ wheels, front }), [wheels, front]);

  useEffect(() => {
    return () => {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.Material).customProgramCacheKey?.() === "paint") {
          (mesh.material as THREE.Material).dispose();
        }
      });
    };
  }, [root]);

  return <primitive object={root} scale={def.scale} />;
});

CARS.forEach((c) => useGLTF.preload(c.file));
