"use client";

import { DEFAULT_BUDDY } from "@zoonk/core/profile/default-buddy";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";

/**
 * What a screen needs to draw the learner's buddy. Kind, name and glasses come
 * from the profile; the belt and Energy come from progress, so growth and glow
 * are always derived, never stored.
 */
export type LearnBuddy = {
  beltColor: BeltColor;
  /** Null until the learner has learned something: a new buddy is awake, without a glow. */
  energy: number | null;
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
export function useBuddyName(buddy: Pick<LearnBuddy, "kind" | "name"> | null): string {
  const t = useExtracted("buddyNames");
  const { kind, name } = buddy ?? DEFAULT_BUDDY;

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

/** Hosts without a learner profile draw the same default buddy, before progress has started. */
export function resolveLearnBuddy(buddy: LearnBuddy | null): LearnBuddy {
  return buddy ?? { ...DEFAULT_BUDDY, beltColor: "white", energy: null };
}
