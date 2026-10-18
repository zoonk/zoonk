"use client";

import { type MapSkill } from "@zoonk/core/view-models/map/contract";
import { useExtracted } from "next-intl";

/** A skill's state in words. */
export function useStateLabel() {
  const t = useExtracted();

  return (card: Pick<MapSkill, "state">): string => {
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
