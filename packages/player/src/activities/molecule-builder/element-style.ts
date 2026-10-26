/**
 * Atoms keep the colors chemistry books use (carbon black, oxygen red, nitrogen blue), an identity
 * like a belt's, never a meaning of the app's. They're the softer tints of those colors with a dark
 * letter that passes AA, so no atom shouts; carbon and bromine stay dark with a white letter. Atoms
 * are their own surface, so these don't change with the theme; a thin ring keeps dark atoms visible
 * on dark backgrounds.
 */
const ELEMENT_STYLES: ReadonlyMap<string, { fill: string; text: string }> = new Map([
  ["B", { fill: "fill-rose-300", text: "fill-neutral-900" }],
  ["Br", { fill: "fill-red-700", text: "fill-white" }],
  ["C", { fill: "fill-neutral-800", text: "fill-white" }],
  ["Cl", { fill: "fill-green-400", text: "fill-neutral-900" }],
  ["F", { fill: "fill-lime-300", text: "fill-neutral-900" }],
  ["H", { fill: "fill-white", text: "fill-neutral-900" }],
  ["I", { fill: "fill-violet-400", text: "fill-neutral-900" }],
  ["N", { fill: "fill-blue-400", text: "fill-neutral-900" }],
  ["O", { fill: "fill-red-400", text: "fill-neutral-900" }],
  ["P", { fill: "fill-orange-400", text: "fill-neutral-900" }],
  ["S", { fill: "fill-yellow-400", text: "fill-neutral-900" }],
  ["Si", { fill: "fill-stone-400", text: "fill-neutral-900" }],
]);

const FALLBACK = { fill: "fill-neutral-400", text: "fill-neutral-900" };

export function elementStyle(element: string): { fill: string; text: string } {
  return ELEMENT_STYLES.get(element) ?? FALLBACK;
}
