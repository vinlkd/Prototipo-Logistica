import { getProduct } from "./products.js";
export const CONVEYOR_TOP = 1.195,
  CLEARANCE = 0.012,
  POT_BOTTOM = -0.18,
  YAW = Math.PI / 2;
export const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
export function getLayout(id) {
  const product = getProduct(id),
    r = product.rim;
  const footprint = {
    minX: -r - 0.02,
    maxX: r + 0.02,
    minZ: product.handles === "long" ? -r - 1.01 : -r - 0.33,
    maxZ: product.handles === "long" ? r + 0.02 : r + 0.33,
  };
  const packageSize = {
    width: footprint.maxX - footprint.minX + 0.24,
    depth: footprint.maxZ - footprint.minZ + 0.24,
    height: Math.max(0.5, product.height + 0.18 + 0.19),
    centerZ: (footprint.minZ + footprint.maxZ) / 2,
  };
  return {
    conveyorTop: CONVEYOR_TOP,
    clearance: CLEARANCE,
    potBottom: POT_BOTTOM,
    yaw: YAW,
    footprint,
    package: packageSize,
    opening: {
      halfWidth: packageSize.width / 2 + 0.34,
      minZ: packageSize.centerZ - packageSize.depth / 2 - 0.35,
      maxZ: packageSize.centerZ + packageSize.depth / 2 + 0.35,
      height: CONVEYOR_TOP + packageSize.height + 0.65,
    },
  };
}
export function boundsForPose(pose, productId) {
  const layout = getLayout(productId),
    pkg = layout.package;
  if (pose.isBox)
    return {
      minX: pose.x - pkg.width / 2,
      maxX: pose.x + pkg.width / 2,
      minY: pose.support + CLEARANCE,
      maxY: pose.support + CLEARANCE + pkg.height,
      minZ: pose.z + pkg.centerZ - pkg.depth / 2,
      maxZ: pose.z + pkg.centerZ + pkg.depth / 2,
    };
  const f = pose.form,
    fp =
      f > 0.99
        ? layout.footprint
        : { minX: -0.62, maxX: 0.62, minZ: -0.62, maxZ: 0.62 };
  return {
    minX: pose.x + fp.minX,
    maxX: pose.x + fp.maxX,
    minY: pose.y + 0.21 - 0.39 * f,
    maxY: pose.y + 0.21 + (getProduct(productId).height - 0.21) * f,
    minZ: pose.z + fp.minZ,
    maxZ: pose.z + fp.maxZ,
  };
}
export function overlaps(a, b, margin = 0) {
  return (
    a.minX < b.maxX - margin &&
    a.maxX > b.minX + margin &&
    a.minY < b.maxY - margin &&
    a.maxY > b.minY + margin &&
    a.minZ < b.maxZ - margin &&
    a.maxZ > b.minZ + margin
  );
}
export function sweptBounds(a, b) {
  return Object.fromEntries(
    ["X", "Y", "Z"].flatMap((axis) => [
      [`min${axis}`, Math.min(a[`min${axis}`], b[`min${axis}`])],
      [`max${axis}`, Math.max(a[`max${axis}`], b[`max${axis}`])],
    ]),
  );
}
