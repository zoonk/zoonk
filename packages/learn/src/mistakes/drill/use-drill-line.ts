"use client";

import { useExtracted } from "next-intl";
import { type Drill, isIdeaFirst } from "./drill-types";

export function useDrillLine() {
  const t = useExtracted();

  return (drill: Drill): string => {
    switch (drill.kind) {
      case "reteach":
        return isIdeaFirst(drill)
          ? t("The idea first, then put it to use.")
          : t("Back to an idea you missed.");
      case "readCarefully":
        return t("Read every word before you answer.");
      case "spotTheTrap":
        return t("There's a trap in here. Find it before you answer.");
      case "timed":
        return t("{seconds, number} seconds a question, like on the day.", {
          seconds: drill.timeLimitSeconds ?? 0,
        });
      case "noGuessing":
        return t("Only answer when you're sure. Saying you're not sure is fine.");
      case "retry":
        return t("Try it again.");
      default:
        return t("Try it again.");
    }
  };
}
