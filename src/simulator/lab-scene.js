import { buildLabModel, updateLabModel } from "./lab-model.js";
import {
  buildHandleAssembler,
  updateHandleAssembler,
} from "./handle-assembler.js";
import { buildRawLoader, updateRawLoader } from "./raw-loader.js";
import { getRawStock, RAW_PILE_X } from "./raw-stock.js";
import { buildLiftSupport, updateLiftSupport } from "./lift-support.js";
import { buildReceiving, updateReceiving } from "./receiving.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { getProduct } from "./products.js";
import { getPresentation } from "./presentation.js";
import {
  getLayout,
  boundsForPose,
  overlaps,
  sweptBounds,
  CONVEYOR_TOP,
  CLEARANCE,
  YAW,
} from "./kinematics.js";
import { buildWorkstation, updateWorkstation } from "./workstations.js";
import { buildTruck } from "./trucks.js";

export function createLabScene(
  canvas,
  onSensorPick = () => {},
  onMotionBlocked = () => {},
) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dce4ed");
  scene.fog = new THREE.Fog("#dce4ed", 42, 95);
  const room = new RoomEnvironment(),
    pmrem = new THREE.PMREMGenerator(renderer),
    env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.75;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#dae6f4", "#65717b", 1.7));
  const sun = new THREE.DirectionalLight("#fff8ec", 3);
  sun.position.set(-7, 15, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -18,
    right: 18,
    top: 18,
    bottom: -18,
    near: 0.1,
    far: 45,
  });
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 130),
    controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 5;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI * 0.49;
  const mat = (color, metalness = 0, roughness = 0.6) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const m = {
    blue: mat("#164193", 0.4, 0.35),
    white: mat("#cbd5df", 0.25, 0.44),
    steel: mat("#aebdc9", 0.84, 0.25),
    dark: mat("#25323e", 0.45, 0.48),
    belt: mat("#313c47", 0.12, 0.8),
    yellow: mat("#dfb249", 0.2, 0.46),
    box: mat("#ba9466", 0, 0.9),
    tape: mat("#ddc59f"),
    wood: mat("#967348"),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#b3d6e1",
      transparent: true,
      opacity: 0.12,
      roughness: 0.15,
    }),
    green: mat("#41816f"),
  };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    mat("#cbd6e1"),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(60, 60, "#aabccb", "#bfcedb");
  grid.position.y = 0.002;
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);
  let product = getProduct("saucepan"),
    layout = getLayout(product.id),
    selected = null,
    pointerStart = null;
  const cache = new Map(),
    raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();

  function select(id) {
    if (selected) selected.root.visible = false;
    selected =
      cache.get(id) ?? buildLabModel({ id, product, layout, m, scene });
    cache.set(id, selected);
    selected.root.visible = true;
    setView("front");
  }
  function setView(view) {
    const dock = ["receiving", "shipping"].includes(selected?.id),
      distance = dock ? 20 : 10,
      centre = dock ? (selected.id === "shipping" ? 5 : -5) : 0;
    const positions = {
      front: [centre, dock ? 10 : 6.5, distance],
      iso: [centre + (dock ? 15 : 9), dock ? 11 : 8, dock ? 23 : 14],
      top: [centre + 0.01, dock ? 32 : 21, 0.01],
    };
    camera.position.set(...(positions[view] ?? positions.front));
    controls.target.set(centre, 1.6, 0);
    controls.update();
  }
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();
  canvas.addEventListener("pointerdown", (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (
      !selected ||
      !pointerStart ||
      Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5
    )
      return;
    const r = canvas.getBoundingClientRect();
    mouse.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(
      Object.values(selected.sensors),
      false,
    )[0];
    if (hit) onSensorPick(hit.object.userData.signal);
  });
  function update(cell, dt, running, emergency, scope = "bench") {
    updateLabModel(
      selected,
      cell,
      product,
      dt,
      running,
      emergency,
      scope,
      onMotionBlocked,
    );
  }

  return {
    select,
    setView,
    update,
    setProduct(id) {
      for (const model of cache.values()) {
        model.assembler?.dispose?.();
        model.workstation?.dispose?.();
        model.receiving?.dispose?.();
        for (const material of model.truck?.materials ?? []) material.dispose();
        scene.remove(model.root);
        model.root.traverse((o) => o.geometry?.dispose());
      }
      cache.clear();
      const current = selected?.id;
      selected = null;
      product = getProduct(id);
      layout = getLayout(id);
      if (current) select(current);
    },
    hotspots() {
      return [
        [-4, 1.5, 1.5],
        [0, ["finishing", "quality"].includes(selected?.id) ? 3.2 : 4.6, 0],
        [4, 1.5, 1.5],
      ].map((p) => {
        const v = new THREE.Vector3(...p).project(camera);
        return { x: (v.x + 1) * 50, y: (1 - v.y) * 50, visible: v.z < 1 };
      });
    },
    render() {
      controls.update();
      renderer.render(scene, camera);
    },
    zoom(f) {
      camera.position
        .sub(controls.target)
        .multiplyScalar(f)
        .add(controls.target);
      controls.update();
    },
    dispose() {
      observer.disconnect();
      for (const m of cache.values()) {
        m.assembler?.dispose?.();
        m.workstation?.dispose?.();
        m.receiving?.dispose?.();
      }
      controls.dispose();
      renderer.dispose();
      env.texture.dispose();
    },
    get camera() {
      return camera;
    },
  };
}
