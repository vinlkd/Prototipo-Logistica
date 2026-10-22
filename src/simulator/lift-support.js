export function buildLiftSupport({ root, box, cyl, m, layout }) {
  const top = layout.conveyorTop,
    mastZ = 1.95;
  const base = box(root, 0, 0.095, mastZ, 2.1, 0.05, 0.36, m.blue);
  base.name = "Travessa sobre sapatas";
  const feet = [];
  for (const x of [-0.87, 0.87]) {
    const foot = box(root, x, 0.035, mastZ, 0.32, 0.07, 0.48, m.steel);
    foot.name = "Sapata do elevador";
    feet.push(foot);
    box(root, x, 2.17, mastZ + 0.085, 0.045, 4.1, 0.035, m.steel);
  }
  const crossbar = box(root, 0, top - 0.105, mastZ, 1.96, 0.18, 0.27, m.blue);
  const guides = [];
  for (const x of [-0.15, 0.15])
    guides.push(box(root, x, top - 0.105, 1, 0.1, 0.07, 1, m.steel));
  const housing = cyl(root, -0.7, 0.385, mastZ, 0.07, 0.53, m.steel);
  housing.name = "Corpo do atuador do elevador";
  const piston = cyl(root, -0.7, 0.825, mastZ, 0.04, 1, m.steel);
  return { base, feet, housing, crossbar, guides, piston, top, mastZ, layout };
}
export function updateLiftSupport(model, pose) {
  const y = model.top + pose.forkLift - 0.105,
    end =
      pose.forkZ +
      model.layout.package.centerZ +
      model.layout.package.depth / 2 +
      0.05;
  model.crossbar.position.y = y;
  for (const guide of model.guides) {
    guide.position.y = y;
    guide.position.z = (model.mastZ + end) / 2;
    guide.scale.z = model.mastZ - end;
  }
  const rodTop = y - 0.09;
  model.piston.position.y = (0.65 + rodTop) / 2;
  model.piston.scale.y = Math.max(0.001, rodTop - 0.65);
}
