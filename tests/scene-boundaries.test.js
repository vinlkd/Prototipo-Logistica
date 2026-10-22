import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildLabModel, updateLabModel } from "../src/simulator/lab-model.js";
import { PRODUCTS } from "../src/simulator/products.js";
import { createSimulation } from "../src/simulator/simulation.js";
THREE.TextureLoader.prototype.load = function () {
  return new THREE.Texture();
};
const ids = [
  "receiving",
  "raw",
  "production",
  "finishing",
  "quality",
  "packing",
  "finished",
  "shipping",
];
const materialNames = [
  "blue",
  "white",
  "steel",
  "dark",
  "belt",
  "yellow",
  "box",
  "tape",
  "wood",
  "glass",
  "green",
];
function visible(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function ownBounds(o) {
  o.geometry.computeBoundingBox();
  return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
}
function fixture(id, product) {
  const m = Object.fromEntries(
    materialNames.map((k) => [k, new THREE.MeshStandardMaterial()]),
  );
  const model = buildLabModel({ id, product, m });
  return {
    model,
    dispose() {
      model.workstation?.dispose();
      model.receiving?.dispose();
      model.assembler?.dispose();
      model.rawLoader?.dispose();
      model.root.traverse((o) => o.geometry?.dispose());
      for (const x of Object.values(m)) x.dispose();
    },
  };
}
for (const product of PRODUCTS)
  for (const id of ids) {
    test(`${product.id}/${id}: todos os elementos respeitam piso e não repetem faces externas`, () => {
      const f = fixture(id, product),
        sim = createSimulation(1, {
          scope: "bench",
          environment: id,
          product: product.id,
        });
      try {
        const cell = sim.snapshot.cells.find((c) => c.id === id);
        updateLabModel(f.model, cell, product, 0, false, false);
        f.model.root.updateMatrixWorld(true);
        let boxes = [];
        f.model.root.traverse((o) => {
          if (!o.isMesh || !visible(o) || o.name === "sector-floor") return;
          const b = ownBounds(o);
          assert.ok(
            Number.isFinite(
              b.min.x + b.min.y + b.min.z + b.max.x + b.max.y + b.max.z,
            ),
            o.name,
          );
          assert.ok(
            b.min.y >= f.model.root.position.y - 0.0001,
            `${o.name}: abaixo do piso ${b.min.y}`,
          );
          if (
            o.geometry.type === "BoxGeometry" &&
            Math.abs(o.rotation.x) +
              Math.abs(o.rotation.y) +
              Math.abs(o.rotation.z) <
              1e-8
          )
            boxes.push({ o, b });
        });
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i],
              b = boxes[j];
            for (const axis of ["x", "y", "z"])
              for (const side of ["min", "max"]) {
                const others = ["x", "y", "z"].filter((x) => x !== axis);
                const duplicate =
                  Math.abs(a.b[side][axis] - b.b[side][axis]) < 1e-6 &&
                  others.every(
                    (k) =>
                      Math.min(a.b.max[k], b.b.max[k]) -
                        Math.max(a.b.min[k], b.b.min[k]) >
                      0.005,
                  );
                assert.ok(
                  !duplicate,
                  `${a.o.name} / ${b.o.name}: faces sobrepostas ${axis}/${side}`,
                );
              }
          }
      } finally {
        f.dispose();
      }
    });
    test(`${product.id}/${id}: ciclo real completo sem colisão com estruturas nem geometria abaixo do piso`, () => {
      const f = fixture(id, product),
        sim = createSimulation(1, {
          scope: "bench",
          environment: id,
          product: product.id,
        });
      sim.start();
      const blocked = [];
      try {
        for (let tick = 0; tick < 3000 && sim.snapshot.done < 1; tick++) {
          sim.step(0.05);
          const cell = sim.snapshot.cells.find((c) => c.id === id);
          updateLabModel(
            f.model,
            cell,
            product,
            0.05,
            true,
            false,
            "bench",
            (...args) => blocked.push(args),
          );
          f.model.root.updateMatrixWorld(true);
          if (tick % 5 === 0)
            f.model.root.traverse((o) => {
              if (o.isMesh && visible(o) && o.name !== "sector-floor")
                assert.ok(
                  ownBounds(o).min.y >= f.model.root.position.y - 0.0001,
                  `${o.name}: atravessa o piso durante ${cell.stage?.id}`,
                );
            });
        }
        assert.equal(sim.snapshot.done, 1);
        assert.deepEqual(blocked, []);
      } finally {
        f.dispose();
      }
    });
  }
