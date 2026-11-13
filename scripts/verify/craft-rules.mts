/* oxlint-disable no-magic-numbers -- The design system's numbers, as the craft rubric lists them. */
import { type Finding } from "./checks.mts";

/**
 * The design system's numbers, as zoonk-design's craft reference states them. Corners step from
 * the page's own `--radius` as `globals.css` does (md, lg, option, xl, 2xl: H1); square, and 2 to
 * 4 px for meters, cells and keycaps. Type sizes are read from the checkout (`craft-scale.mts`).
 */
export const RADIUS_STEPS = [-2, 0, 2, 4, 8];
export const SMALL_RADII = [0, 2, 3, 4];
/** `Button`'s heights and chips' (Z1); 40 px is a bar's button from `lg`. */
export const CONTROL_HEIGHTS = [22, 24, 30, 36, 40, 44];
/** I2: beside text and as a list's mark (`ICON_RULES`), in a bar, in an `xs` button. */
export const ICON_SIZES = [12, 14, 16, 20];
/** Lucide's stroke on its 24-unit canvas; only a glyph of 12 px or less may be thickened (I3). */
export const ICON_STROKE = 2;
export const THICKENED_MAX = 12;
export const SPACING = [4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 96];
export const SAME_WITHIN = 0.5;
/** E8: 12 px, the page top's 44 px bar, its hairline, 12 px. */
export const PAGE_TITLE_TOP = 69;

/** The craft reference's "Within": the room an edge or a center line has. */
export const CRAFT_LINES = {
  /** Text and boxes. */
  aligned: 1,
  /** Any more of a glyph's ink outside its column's edge is a lead (E2's bound). */
  crossed: 0.05,
  /** A panel's sides may differ by this, a line box's rounding (S4). */
  evenRoom: 2,
  /** A glyph's ink past the letters of the text on its edge, toward the edge. */
  glyph: 1,
  /**
   * A glyph's ink short of those letters: one whole-pixel pull serves every first letter, and a
   * diagonal ("A") starts 2 px before a stem ("P") at a title's size.
   */
  glyphInside: 2,
  /** A glyph this near a text's box is on that text's edge: letters start up to 2.4 px inside it. */
  lettersNear: 3.5,
  /** Past this an edge is a different line on purpose, such as an indent. */
  nearMiss: 24,
  /** An icon's center to its line's center (E5). */
  offCenter: 1,
  /** Gaps under this (a heatmap's cells, a menu's rows, an icon and its label) aren't measured. */
  packed: 8,
  /** Type sizes in one list row or panel: the main thing, its supporting line, its meta. */
  typeSizes: 3,
};

/**
 * Each lead carries its rule's id and name from zoonk-design's craft reference. The ids are a
 * contract: the lanes' findings name the same rules.
 */
const RULES = {
  E1: "E1 one start edge per column",
  E2: "E2 a bare glyph sits on the edge by its ink",
  E3: "E3 one end edge",
  E5: "E5 an icon and its text share a line",
  E8: "E8 titles at one height",
  H1: "H1 one radius per role",
  H3: "H3 no pills, no mixed shapes",
  I2: "I2 sizes matched to the text",
  I3: "I3 one weight",
  S1: "S1 gaps come from the scale",
  S2: "S2 the same things sit the same distance apart",
  S4: "S4 padding is even",
  T1: "T1 sizes come from the roles",
  X3: "X3 a state change moves nothing",
  Z1: "Z1 heights from the set, one height per row",
};

const CRAFT_CHECKS = new Set<string>(Object.values(RULES));

export function isCraftLead(check: string) {
  return CRAFT_CHECKS.has(check);
}

const LISTED = 3;
const TENTH = 10;

export function names(labels: string[]): string {
  const unique = [...new Set(labels)];
  const shown = unique.slice(0, LISTED).join(", ");
  return unique.length > LISTED ? `${shown} and ${unique.length - LISTED} more` : shown;
}

function tenths(value: number) {
  return Math.round(value * TENTH) / TENTH;
}

export function px(value: number): string {
  return `${tenths(value)} px`;
}

export function lead(rule: keyof typeof RULES, message: string, value?: number): Finding {
  return {
    check: RULES[rule],
    level: "warn",
    message,
    ...(value === undefined ? {} : { unit: "px", value: tenths(value) }),
  };
}

export function grouped<Item, Key>(items: Item[], key: (item: Item) => Key): [Key, Item[]][] {
  return [...Map.groupBy(items, key)];
}

export function onScale(value: number, scale: number[]) {
  return scale.some((allowed) => Math.abs(allowed - value) < SAME_WITHIN);
}
