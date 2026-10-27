import { BELT_COLORS_ORDER } from "@zoonk/utils/belt-level";
import { type ColorGroup } from "./color";

/** The belts' colors, the learner's identity: a group of `COLOR_GROUPS` on the color page. */
export const BELT_GROUP: ColorGroup = {
  id: "belts",
  intro:
    "A belt wears its color once reached: the learner's identity, as a dot by their name, drawn with a stripe per level on the level page, every belt in its color on the rack, and on their buddy. Identity, not a meaning, so belts keep their full colors in every mode, the one place a strong color is the rule; nothing else borrows them. White and black take an outline where they'd vanish.",
  title: "Belts",
  tokens: BELT_COLORS_ORDER.map((belt) => ({
    meaning: `The ${belt} belt.`,
    name: `belt-${belt}`,
    use: "`BeltIndicator`, the level page's belt and rack, the buddy's belt.",
  })),
};
