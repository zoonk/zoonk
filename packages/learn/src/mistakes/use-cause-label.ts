"use client";

import { useExtracted } from "next-intl";

type MistakeCauseKey = "gap" | "guess" | "misread" | "time" | "trap" | "unsorted";

export function useCauseLabel() {
  const t = useExtracted();

  return (cause: MistakeCauseKey | null): string => {
    switch (cause ?? "unsorted") {
      case "gap":
        return t({
          description:
            "Why the learner got a question wrong: they didn't know the content yet. Not missing course content.",
          message: "Content gap",
        });
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
