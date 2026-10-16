import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { sizeCar } from "./carSizing";

describe("car sizing", () => {
  it("makes tiny imported cars full sized, centered and grounded without changing the source", () => {
    const source = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 2));
    mesh.position.set(3, 2, -4);
    source.add(mesh);
    const car = sizeCar(source, 4.8);
    const box = new THREE.Box3().setFromObject(car);
    expect(box.getSize(new THREE.Vector3()).z).toBeCloseTo(4.8);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0);
    expect(mesh.position.toArray()).toEqual([3, 2, -4]);
    expect(source.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("preserves wheel hierarchy and local rotation pivots", () => {
    const source = new THREE.Group();
    const wheel = new THREE.Group();
    wheel.name = "wheel-front-left";
    wheel.position.set(0.5, 0.3, 0.8);
    wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.6)));
    source.add(wheel, new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 2)));
    const clone = sizeCar(source, 4.6).getObjectByName(wheel.name);
    expect(clone?.position.toArray()).toEqual(wheel.position.toArray());
    expect(clone).not.toBe(wheel);
  });
});