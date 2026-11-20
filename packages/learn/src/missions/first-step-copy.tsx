"use client";

import { useExtracted } from "next-intl";
import { type FirstStep } from "../buddies/buddy-status-view";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

export function useFirstStepName(buddy: LearnBuddy | null) {
  const t = useExtracted("missions");
  const buddyName = useBuddyName(buddy);

  return (kind: FirstStep["kind"]): string => {
    switch (kind) {
      case "somethingNew":
        return t("Finish your first lesson");
      case "review":
        return t("Do your first review");
      case "fixMistake":
        return t("Fix your first mistake");
      case "pattern":
        return t("Practice a pattern");
      case "askBuddy":
        return t("Ask {buddy} something", { buddy: buddyName });
      case "essay":
        return t("Write your first essay");
      case "call":
        return t("Have your first call");
      case "mock":
        return t("Take your first mock exam");
      case "challenge":
        return t("Beat the Trickster");
      default:
        return kind satisfies never;
    }
  };
}
