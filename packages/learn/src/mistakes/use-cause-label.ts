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
        return t({
          description: "Why the learner got a question wrong: they misread the question.",
          message: "Misread",
        });
      case "trap":
        return t({
          description:
            "Why the learner got a question wrong, as a short tag on a mistake card: they fell for a trap in the question.",
          message: "Fell for a trap",
        });
      case "time":
        return t({
          description:
            "Why the learner got a question wrong, as a short tag on a mistake card: they ran out of time.",
          message: "Ran out of time",
        });
      case "guess":
        return t({
          description:
            "Why the learner got a question wrong, as a short tag on a mistake card: they guessed.",
          message: "Guessed",
        });
      case "unsorted":
        return t("Not sorted yet");
      default:
        return t("Not sorted yet");
    }
  };
}
