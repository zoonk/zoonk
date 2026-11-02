"use client";

import { DEFAULT_BUDDY } from "@zoonk/core/profile/default-buddy";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";

export type LearnBuddy = {
  beltColor: BeltColor;
  /** Null until the learner has learned something. */
  energy: number | null;
  glasses: BuddyGlasses;
  kind: BuddyKind;
  name: string | null;
  /** A buddy never naps on a day the learner studied, even while Energy is still low. */
  studiedToday?: boolean;
};

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

export function resolveLearnBuddy(buddy: LearnBuddy | null): LearnBuddy {
  return buddy ?? { ...DEFAULT_BUDDY, beltColor: "white", energy: null };
}
