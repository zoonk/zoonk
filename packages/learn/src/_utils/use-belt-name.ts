"use client";

import { BELT_COLORS_ORDER, type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";

export function toBeltColor(value: string): BeltColor | null {
  return BELT_COLORS_ORDER.find((color) => color === value) ?? null;
}

/** Its own namespace, since the avatar shows it on every page (`learnSiteMessages`). */
export function useBeltName() {
  const t = useExtracted("belts");

  return (color: BeltColor): string => {
    switch (color) {
      case "yellow":
        return t("Yellow belt");
      case "orange":
        return t("Orange belt");
      case "green":
        return t("Green belt");
      case "blue":
        return t("Blue belt");
      case "purple":
        return t("Purple belt");
      case "brown":
        return t("Brown belt");
      case "red":
        return t("Red belt");
      case "gray":
        return t("Gray belt");
      case "black":
        return t("Black belt");
      case "white":
        return t("White belt");
      default:
        return t("White belt");
    }
  };
}

/** A belt with its number from 1 to 10, the one way the game's step is said: "White belt 4". */
export function useBeltStep() {
  const t = useExtracted("belts");
  const beltName = useBeltName();

  return ({ color, level }: { color: BeltColor; level: number }): string =>
    t({
      description:
        'A belt and its number from 1 to 10, such as "White belt 4". {belt} is the belt\'s name, such as "White belt".',
      message: "{belt} {level}",
      values: { belt: beltName(color), level: String(level) },
    });
}
