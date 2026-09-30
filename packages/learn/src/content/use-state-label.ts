"use client";

import { useExtracted } from "next-intl";
import { type ContentCard } from "./content-context";

/** A skill's state in words: the same four states in both modes, with gold for Mastered in Fun. */
export function useStateLabel() {
  const t = useExtracted();

  return (card: Pick<ContentCard, "state">): string => {
    switch (card.state) {
      case "learning":
        return t("Learning");
      case "solid":
        return t("Solid");
      case "mastered":
        return t("Mastered");
      case "new":
        return t("New");
      default:
        return t("New");
    }
  };
}
