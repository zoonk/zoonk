"use client";

import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";

/**
 * What a Fun screen needs to draw the learner's buddy. Kind, name and glasses come
 * from the profile; the belt and Energy come from progress, so growth and glow
 * are always derived, never stored.
 */
export type LearnBuddy = {
  beltColor: BeltColor;
  energy: number;
  glasses: BuddyGlasses;
  kind: BuddyKind;
  name: string | null;
  /** A buddy never naps on a day the learner studied, even while Energy is still low. */
  studiedToday?: boolean;
};

/**
 * A learner's own name for the buddy wins. Otherwise each language has its own
 * playful name (the brain is Noodle in English and Cuca in Portuguese), which
 * the style guides keep in their glossaries.
 */
export function useBuddyName({ kind, name }: Pick<LearnBuddy, "kind" | "name">): string {
  const t = useExtracted();

  if (name) {
    return name;
  }

  switch (kind) {
    case "beep":
      return t("Beep");
    case "noodle":
      return t("Noodle");
    case "otto":
      return t("Otto");
    case "zu":
      return t("Zu");
    default:
      return t("Zu");
  }
}
