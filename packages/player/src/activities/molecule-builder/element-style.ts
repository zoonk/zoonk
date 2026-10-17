/**
 * Atoms keep the colors chemistry books use (carbon black, oxygen red, nitrogen blue), each with
 * a letter color that passes AA on it. Atoms are their own surface, so these don't change with
 * the theme; a thin ring keeps dark atoms visible on dark backgrounds.
 */
const ELEMENT_STYLES: ReadonlyMap<string, { fill: string; text: string }> = new Map([
  ["B", { fill: "fill-rose-300", text: "fill-neutral-900" }],
  ["Br", { fill: "fill-red-900", text: "fill-white" }],
  ["C", { fill: "fill-neutral-800", text: "fill-white" }],
  ["Cl", { fill: "fill-green-700", text: "fill-white" }],
  ["F", { fill: "fill-lime-300", text: "fill-neutral-900" }],
  ["H", { fill: "fill-white", text: "fill-neutral-900" }],
  ["I", { fill: "fill-violet-700", text: "fill-white" }],
  ["N", { fill: "fill-blue-600", text: "fill-white" }],
  ["O", { fill: "fill-red-600", text: "fill-white" }],
  ["P", { fill: "fill-orange-700", text: "fill-white" }],
  ["S", { fill: "fill-yellow-400", text: "fill-neutral-900" }],
  ["Si", { fill: "fill-stone-400", text: "fill-neutral-900" }],
]);

const FALLBACK = { fill: "fill-neutral-400", text: "fill-neutral-900" };

export function elementStyle(element: string): { fill: string; text: string } {
  return ELEMENT_STYLES.get(element) ?? FALLBACK;
}
