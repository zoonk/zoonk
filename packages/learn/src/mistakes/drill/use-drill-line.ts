"use client";

import { useExtracted } from "next-intl";
import { type Drill, isIdeaFirst } from "./drill-types";

export function useDrillLine() {
  const t = useExtracted();

  return function drillLine(drill: Drill): string | null {
    switch (drill.kind) {
      case "reteach":
        return isIdeaFirst(drill) ? t("The idea first, then put it to use.") : null;
      case "spotTheTrap":
        return t("There's a trap in here. Find it before you answer.");
      case "timed":
        return t("{seconds, number} seconds a question, like on the day.", {
          seconds: drill.timeLimitSeconds ?? 0,
        });
      case "noGuessing":
        return t("Only answer when you're sure. Saying you're not sure is fine.");
      case "readCarefully":
      case "retry":
        return null;
      default:
        return null;
    }
  };
}
