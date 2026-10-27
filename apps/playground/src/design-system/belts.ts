import { BELT_COLORS_ORDER } from "@zoonk/utils/belt-level";
import { type ColorGroup } from "./color";

/** The belts' colors, the learner's identity: a group of `COLOR_GROUPS` on the color page. */
export const BELT_GROUP: ColorGroup = {
  id: "belts",
  intro:
    "A belt wears its color once reached: the learner's identity, as a dot by their name, drawn on the level page and on their buddy. Each keeps its hue, softened like every colored thing, blue and purple apart from progress's blue and Brain Power's violet; with more contrast they're the full-strength colors. White and black take an outline where they'd vanish.",
  title: "Belts",
  tokens: BELT_COLORS_ORDER.map((belt) => ({
    meaning: `The ${belt} belt.`,
    name: `belt-${belt}`,
    use: "`BeltIndicator`, the level page's belt and rack, the buddy's belt.",
  })),
};
