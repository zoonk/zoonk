"use client";

import { BELT_COLORS_ORDER, type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";

/** Reads a belt color sent as a plain string by a view model. */
export function toBeltColor(value: string): BeltColor | null {
  return BELT_COLORS_ORDER.find((color) => color === value) ?? null;
}

/**
 * "Orange belt", "Yellow belt, level 5": the belt as the learner reads it. Its own namespace, since
 * the avatar shows it on every page, public ones included (see `learnSiteMessages`).
 */
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
