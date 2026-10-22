export const PRODUCTS = [
  {
    id: "saucepan",
    name: "Panela de cabo",
    size: "18 cm",
    description: "Corpo alto em inox e cabo longo.",
    rim: 0.46,
    height: 0.52,
    handles: "long",
  },
  {
    id: "casserole",
    name: "Caçarola",
    size: "24 cm",
    description: "Corpo largo em inox e duas alças.",
    rim: 0.54,
    height: 0.45,
    handles: "double",
  },
  {
    id: "frying-pan",
    name: "Frigideira",
    size: "24 cm",
    description: "Corpo baixo em inox e cabo longo.",
    rim: 0.56,
    height: 0.05,
    handles: "long",
  },
];
export const getProduct = (id) =>
  PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
export function productIcon(product) {
  const p = typeof product === "string" ? getProduct(product) : product;
  const low = p.id === "frying-pan",
    top = low ? 43 : 29,
    bottom = 55;
  return `<svg viewBox="0 0 112 76" fill="none" aria-hidden="true"><path d="M30 ${top}L34 ${bottom}Q55 ${bottom + 9} 76 ${bottom}L80 ${top}" fill="#d7dfe7" stroke="currentColor" stroke-width="2"/><ellipse cx="55" cy="${top}" rx="25" ry="6" fill="#f1f4f8" stroke="currentColor" stroke-width="2"/>${p.handles === "double" ? `<path d="M30 ${top + 6}H19Q12 ${top + 13} 21 ${top + 16}H32M80 ${top + 6}H91Q98 ${top + 13} 89 ${top + 16}H78" stroke="currentColor" stroke-width="4"/>` : `<path d="M80 ${top + 6}L104 ${top + 1}" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`}<path d="M39 ${top + 11}L41 ${bottom - 2}" stroke="#fff" stroke-width="3" opacity=".8"/></svg>`;
}
