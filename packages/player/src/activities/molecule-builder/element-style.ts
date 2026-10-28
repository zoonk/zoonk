// Atom colors follow chemistry conventions rather than app status colors and stay fixed across themes.
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
