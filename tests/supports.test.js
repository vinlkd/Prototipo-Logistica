import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PRODUCTS } from "../src/simulator/products.js";
import { getLayout } from "../src/simulator/kinematics.js";
import { buildReceiving, updateReceiving } from "../src/simulator/receiving.js";
import {
  buildLiftSupport,
  updateLiftSupport,
} from "../src/simulator/lift-support.js";
import { buildTruck } from "../src/simulator/trucks.js";

function helpers(product) {
  const root = new THREE.Group(),
    records = [],
    layout = getLayout(product.id);
  const m = Object.fromEntries(
    ["blue", "white", "steel", "dark", "yellow"].map((k) => [
      k,
      new THREE.MeshStandardMaterial(),
    ]),
  );
  const box = (g, x, y, z, w, h, d, material = m.blue) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    o.position.set(x, y, z);
    g.add(o);
    records.push({ o, g, x, y, z, w, h, d, kind: "box" });
    return o;
  };
  const cyl = (g, x, y, z, r, h, material = m.steel) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), material);
    o.position.set(x, y, z);
    g.add(o);
    records.push({ o, g, x, y, z, r, h, kind: "cylinder" });
    return o;
  };
  const bar = (g, a, b, r, material = m.steel) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      v = bv.clone().sub(av);
    const o = cyl(
      g,
      ...av.clone().add(bv).multiplyScalar(0.5).toArray(),
      r,
      v.length(),
      material,
    );
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return o;
  };
  const testThree = {
    ...THREE,
    TextureLoader: class {
      load() {
        return new THREE.Texture();
      }
    },
  };
  return {
    root,
    records,
    layout,
    m,
    box,
    cyl,
    bar,
    THREE: testThree,
    dispose(model) {
      model.dispose?.();
      for (const t of model.textures ?? []) t.dispose();
      for (const mat of model.materials ?? []) mat.dispose();
      root.traverse((o) => o.geometry?.dispose());
      for (const mat of Object.values(m)) mat.dispose();
    },
  };
}
const bb = (o) => new THREE.Box3().setFromObject(o);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const penetration = (a, b) =>
  Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 1e-5 &&
  Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 1e-5 &&
  Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 1e-5;

for (const product of PRODUCTS) {
  test(`${product.id}: balança apoia as quatro células e trava não corta a plataforma`, () => {
    const f = helpers(product),
      model = buildReceiving(f);
    try {
      f.root.updateMatrixWorld(true);
      const cells = f.records.filter(
        (r) => r.kind === "cylinder" && r.r === 0.07 && r.h === 0.14,
      );
      const legs = f.records.filter(
        (r) => r.kind === "box" && r.w === 0.09 && r.d === 0.09,
      );
      assert.equal(cells.length, 4);
      assert.equal(legs.length, 4);
      for (const cell of cells) {
        const leg = legs.find((l) => l.x === cell.x && l.z === cell.z);
        near(bb(leg.o).min.y, 0);
        near(bb(leg.o).max.y, bb(cell.o).min.y);
        near(bb(cell.o).max.y, bb(model.plate).min.y);
      }
      const toolTop = model.reader.children.find(
        (o) => o.geometry?.parameters?.width === 0.32,
      );
      const beam = f.records.find(
        (r) => r.w === 0.18 && r.h === 0.1 && r.d === 1.95,
      ).o;
      near(bb(toolTop).max.y, bb(beam).min.y);
      assert.equal(penetration(bb(toolTop), bb(beam)), false);
      for (let i = 0; i <= 100; i++) {
        updateReceiving(model, {
          cell: {
            part: true,
            phase: "processing",
            stage: { id: "release", progress: i / 100 },
            outputs: { work: true },
          },
          product,
          layout: f.layout,
          running: true,
        });
        f.root.updateMatrixWorld(true);
        assert.equal(
          penetration(bb(model.gate.children[0]), bb(model.plate)),
          false,
        );
      }
    } finally {
      f.dispose(model);
    }
  });

  test(`${product.id}: sapatas, travessa e cilindro do elevador se tocam sem ocupar o mesmo volume`, () => {
    const f = helpers(product),
      model = buildLiftSupport(f);
    try {
      for (const lift of [0, 0.4, 1, 1.6, 1.64])
        for (const z of [0, -1, -3.6]) {
          updateLiftSupport(model, { forkLift: lift, forkZ: z });
          f.root.updateMatrixWorld(true);
          for (const foot of model.feet) {
            near(bb(foot).min.y, 0);
            near(bb(foot).max.y, bb(model.base).min.y);
            assert.equal(penetration(bb(foot), bb(model.base)), false);
          }
          near(bb(model.housing).min.y, bb(model.base).max.y);
          near(bb(model.piston).min.y, bb(model.housing).max.y);
          near(bb(model.piston).max.y, bb(model.crossbar).min.y);
          assert.equal(
            penetration(bb(model.piston), bb(model.crossbar)),
            false,
          );
          assert.equal(penetration(bb(model.piston), bb(model.housing)), false);
        }
    } finally {
      f.dispose(model);
    }
  });

  for (const shipping of [false, true])
    test(`${product.id}/${shipping ? "expedição" : "recebimento"}: portas, vidros e pneus respeitam limites do caminhão`, () => {
      const f = helpers(product),
        model = buildTruck({ ...f, shipping }),
        direction = shipping ? 1 : -1;
      try {
        f.root.updateMatrixWorld(true);
        const wall = f.records.find(
          (r) => r.g === model.truck && r.w === 6.6 && r.d === 0.07,
        ).o;
        for (const door of model.doors) {
          const panel = door.children[0];
          assert.equal(penetration(bb(panel), bb(wall)), false);
        }
        for (const wheel of model.wheels) {
          near(bb(wheel).min.y, 0);
        }
        const glass = f.records.find(
          (r) => r.w === 0.035 && r.h === 0.9 && r.d === 2.5,
        ).o;
        const cabin = f.records.find(
          (r) => r.w === 2.35 && r.h === 1.82 && r.d === 2.85,
        ).o;
        assert.equal(penetration(bb(glass), bb(cabin)), false);
        assert.ok(
          direction > 0
            ? bb(glass).min.x > bb(cabin).max.x
            : bb(glass).max.x < bb(cabin).min.x,
        );
        const deck = f.records.find(
          (r) => r.g === model.truck && r.w === 6.8 && r.h === 0.14,
        ).o;
        near(bb(deck).max.y, f.layout.conveyorTop);
        const platform = model.lift.children[0];
        near(bb(platform).max.y, bb(deck).max.y);
        // Every mesh is checked against the ground, including nested rotated wheels.
        f.root.traverse((o) => {
          if (o.isMesh)
            assert.ok(
              bb(o).min.y >= -1e-6,
              `mesh below ground: ${o.name || o.geometry.type} ${bb(o).min.y}`,
            );
        });
      } finally {
        f.dispose(model);
      }
    });
}
