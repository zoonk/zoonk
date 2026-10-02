"use client";

import { useExtracted } from "next-intl";

export type MistakeCauseKey = "gap" | "guess" | "misread" | "time" | "trap" | "unsorted";

export const MISTAKE_CAUSES: readonly MistakeCauseKey[] = [
  "gap",
  "misread",
  "trap",
  "time",
  "guess",
];

/** Why a mistake happened, in plain words. Each cause gets its own kind of practice. */
export function useCauseLabel() {
  const t = useExtracted();

  return (cause: MistakeCauseKey | null): string => {
    switch (cause ?? "unsorted") {
      case "gap":
        return t("Content gap");
      case "misread":
        return t("Misread");
      case "trap":
        return t("Fell for a trap");
      case "time":
        return t("Ran out of time");
      case "guess":
        return t("Guessed");
      case "unsorted":
        return t("Not sorted yet");
      default:
        return t("Not sorted yet");
    }
  };
}
