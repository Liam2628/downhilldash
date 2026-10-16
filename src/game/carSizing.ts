import * as THREE from "three";

/** Normalize the clone, never the shared GLTF cache. Wheel pivots stay intact. */
export function sizeCar(source: THREE.Object3D, length: number) {
  const root = new THREE.Group();
  const model = source.clone(true);
  root.add(model);
  model.updateWorldMatrix(true, true);
  const initial = new THREE.Box3().setFromObject(model);
  const size = initial.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(length / Math.max(size.z, 0.001));
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  root.updateWorldMatrix(true, true);
  return root;
}