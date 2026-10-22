import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PRODUCTS } from "../src/simulator/products.js";
import { getLayout } from "../src/simulator/kinematics.js";
import {
  buildWorkstation,
  updateWorkstation,
} from "../src/simulator/workstations.js";
function fixture(product, id = "finishing") {
  const root = new THREE.Group(),
    layout = getLayout(product.id);
  const m = Object.fromEntries(
    ["blue", "steel", "dark", "yellow"].map((k) => [
      k,
      new THREE.MeshStandardMaterial(),
    ]),
  );
  const box = (g, x, y, z, w, h, d, mat = m.blue) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  const cyl = (g, x, y, z, r, h, mat = m.steel) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  const bar = (g, a, b, r, mat) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      delta = bv.clone().sub(av);
    const o = cyl(
      g,
      ...av.clone().add(bv).multiplyScalar(0.5).toArray(),
      r,
      delta.length(),
      mat,
    );
    o.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return o;
  };
  const model = buildWorkstation({
    id,
    root,
    THREE,
    box,
    cyl,
    bar,
    m,
    product,
    layout,
  });
  const origin = layout.conveyorTop + layout.clearance - layout.potBottom;
  updateWorkstation(model, {
    pose: {
      step: "polish",
      t: 0.5,
      x: 0,
      y: origin,
      z: 0,
      polishContact: 1,
      fixation: 1,
      polishAngle: Math.PI,
    },
    cell: {
      part: true,
      phase: "processing",
      unit: { id: "UT-001" },
      outputs: { work: true },
    },
    dt: 0.05,
    running: true,
    product,
    layout,
  });
  root.updateMatrixWorld(true);
  return { root, model, layout, origin };
}
function radiusAt(p, y) {
  const pts = [
    [p.rim * 0.72, -0.17],
    [p.rim * 0.8, -0.12],
    [p.rim * 0.86, -0.06],
    [p.rim * 0.91, p.height * 0.25],
    [p.rim * 0.95, p.height * 0.62],
    [p.rim * 0.99, p.height * 0.96],
    [p.rim, p.height],
  ];
  for (let i = 1; i < pts.length; i++) {
    const [a, ay] = pts[i - 1],
      [b, by] = pts[i];
    if (y <= by) return a + ((b - a) * (y - ay)) / (by - ay);
  }
}
for (const p of PRODUCTS)
  for (const id of ["finishing", "quality"])
    test(`${p.id}/${id}: garras não entram na parede`, () => {
      const f = fixture(p, id);
      if (id === "quality") {
        updateWorkstation(f.model, {
          pose: { step: "check", t: 0.5, y: f.origin, inspectionProbe: 1 },
          cell: { part: true, phase: "processing", outputs: {} },
          product: p,
          layout: f.layout,
        });
        f.root.updateMatrixWorld(true);
      }
      const jaw = f.model.jaws.find((j) => j.side === 1),
        pad = jaw.slide.children[0],
        bb = new THREE.Box3().setFromObject(pad);
      let penetration = 0;
      for (let y = bb.min.y; y <= bb.max.y; y += 0.001) {
        const r = radiusAt(p, y - f.origin);
        const z = Math.min(Math.abs(bb.min.z), Math.abs(bb.max.z));
        if (r > z)
          penetration = Math.max(
            penetration,
            Math.sqrt(r * r - z * z) - bb.min.x,
          );
      }
      assert.ok(
        penetration <= 0.001,
        `penetração medida ${penetration.toFixed(5)} unidades`,
      );
    });
for (const p of PRODUCTS)
  test(`${p.id}: painel tem apoio até o piso`, () => {
    const f = fixture(p),
      stem = f.model.panel.group.children[0],
      bb = new THREE.Box3().setFromObject(stem);
    assert.ok(
      bb.min.y <= 0.02,
      `pé do apoio está em y=${bb.min.y.toFixed(3)}, piso y=0`,
    );
  });
import { buildTruck } from "../src/simulator/trucks.js";
for (const p of PRODUCTS)
  test(`${p.id}: 12 caixas de expedição ficam no volume do baú`, () => {
    const layout = getLayout(p.id),
      root = new THREE.Group();
    const m = Object.fromEntries(
      ["dark", "steel", "white", "yellow"].map((k) => [
        k,
        new THREE.MeshStandardMaterial(),
      ]),
    );
    const box = (g, x, y, z, w, h, d, mat = m.steel) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      o.position.set(x, y, z);
      g.add(o);
      return o;
    };
    const cyl = (g, x, y, z, r, h, mat = m.steel) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
      o.position.set(x, y, z);
      g.add(o);
      return o;
    };
    const bar = (g, a, b, r, mat) => {
      const av = new THREE.Vector3(...a),
        bv = new THREE.Vector3(...b),
        d = bv.clone().sub(av);
      const o = cyl(
        g,
        ...av.clone().add(bv).multiplyScalar(0.5).toArray(),
        r,
        d.length(),
        mat,
      );
      o.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      );
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
    const truck = buildTruck({
      root,
      THREE: testThree,
      box,
      cyl,
      bar,
      m,
      shipping: true,
      layout,
    });
    root.updateMatrixWorld(true);
    const roof = new THREE.Box3().setFromObject(
      truck.truck.getObjectByName("cargo-roof"),
    );
    const pkg = layout.package,
      hd = Math.max(1.6, pkg.depth / 2 + 0.35);
    for (let i = 0; i < 12; i++) {
      const tier = Math.floor(i / 4),
        slot = 3 - (i % 4),
        x = 6.65 + slot * (pkg.width + 0.14),
        y = layout.conveyorTop + tier * (pkg.height + 0.08) + layout.clearance;
      assert.ok(x - pkg.width / 2 >= 9.2 - 3.4);
      assert.ok(x + pkg.width / 2 <= 9.2 + 3.3);
      assert.ok(y + pkg.height < roof.min.y);
      assert.ok(pkg.depth / 2 < hd - 0.035);
    }
  });
import { receivingState } from "../src/simulator/receiving.js";
for (const p of PRODUCTS)
  test(`${p.id}: trava do recebimento recolhe antes da saída`, () => {
    const state = receivingState(
      {
        part: true,
        phase: "unloading",
        stage: { id: "transfer", progress: 0 },
      },
      p,
    );
    const gateTop = 0.99 + 0.25 * state.gate + 0.05;
    assert.ok(gateTop < getLayout(p.id).conveyorTop);
    assert.equal(state.ready, true);
    assert.equal(state.checked, true);
  });
for (const p of PRODUCTS)
  test(`${p.id}: polimento gira a fixação e percorre a altura sem atravessar o corpo`, () => {
    const f = fixture(p),
      centres = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100,
        angle = 4 * Math.PI * t;
      updateWorkstation(f.model, {
        pose: {
          step: "polish",
          t,
          x: 0,
          y: f.origin,
          z: 0,
          polishContact: 1,
          fixation: 1,
          polishAngle: angle,
        },
        cell: { part: true, phase: "processing", outputs: { work: true } },
        dt: 0.01,
        running: true,
        product: p,
        layout: f.layout,
      });
      const tool = f.model.finishing;
      assert.equal(f.model.rotary.rotation.y, angle);
      assert.ok(f.model.jaws.every((j) => !j.slide.visible));
      centres.push(tool.tool.position.y);
      for (let j = 0; j <= 100; j++) {
        const y =
            tool.tool.position.y - tool.radius + (2 * tool.radius * j) / 100,
          local = y - f.origin;
        if (local < -0.17 || local > p.height) continue;
        const x =
          tool.tool.position.x -
          Math.sqrt(
            Math.max(0, tool.radius ** 2 - (y - tool.tool.position.y) ** 2),
          );
        assert.ok(
          x >= radiusAt(p, local) - 0.001,
          `rebolo atravessa perfil em ${t}/${local}`,
        );
      }
    }
    assert.ok(Math.max(...centres) - Math.min(...centres) > 0.08);
    const gasketTop = f.model.gasket.position.y + 0.006;
    assert.ok(Math.abs(gasketTop - (f.origin - 0.18)) < 1e-8);
  });

for (const p of PRODUCTS)
  test(`${p.id}: ponta esf�rica da sonda respeita o fundo inteiro`, () => {
    const f = fixture(p, "quality");
    updateWorkstation(f.model, {
      pose: { step: "scan", t: 1, y: f.origin, inspectionProbe: 1 },
      cell: { part: true, phase: "processing", outputs: {} },
      product: p,
      layout: f.layout,
    });
    const tipBottom = f.model.quality.depthTip.position.y - 0.02;
    assert.ok(tipBottom >= f.origin + f.layout.potBottom + 0.0009);
  });
