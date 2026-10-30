"use client";

import { useExtracted } from "next-intl";
import { type AttachedSource } from "../onboarding-actions";
import { type MaterialIntent } from "./material-intent";

function useMaterialGoal() {
  const t = useExtracted();

  return ({ attached, intent }: { attached: AttachedSource[]; intent: MaterialIntent | null }) => {
    const titles = attached.map((source) => source.title || t("my notes")).join(", ");

    return intent === "exam"
      ? t({
          description:
            "The learner's goal, in their words: preparing themselves for an exam. {titles} lists the titles of their study material.",
          message: "Prepare for an exam on my material: {titles}",
          values: { titles },
        })
      : t("Understand my material: {titles}", { titles });
  };
}

export function useSubmitGoal({
  attached,
  intent,
  onAsk,
  understand,
}: {
  attached: AttachedSource[];
  intent: MaterialIntent | null;
  onAsk: () => void;
  understand: (goal: string) => void;
}) {
  const materialGoal = useMaterialGoal();

  return (typed: string) => {
    const withMaterial = attached.length > 0 ? intent : null;

    if (withMaterial === "questions") {
      onAsk();
      return;
    }

    understand(typed || materialGoal({ attached, intent: withMaterial }));
  };
}
