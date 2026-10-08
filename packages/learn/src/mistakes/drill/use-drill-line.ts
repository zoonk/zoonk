"use client";

import { useExtracted } from "next-intl";
import { type Drill, isIdeaFirst } from "./drill-types";

/** Each cause gets its own practice, said in one line before its questions. */
export function useDrillLine() {
  const t = useExtracted();

  return (drill: Drill): string => {
    switch (drill.kind) {
      case "reteach":
        return isIdeaFirst(drill)
          ? t("The idea first, then a few questions on it.")
          : t("A few questions on an idea you missed.");
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
