"use client";

import { useExtracted } from "next-intl";
import { type AttachedSource } from "../onboarding-actions";
import { type MaterialIntent } from "./material-intent";

/** A goal in words for material attached without any: what to do with it, and its titles. */
function useMaterialGoal() {
  const t = useExtracted();

  return ({ attached, intent }: { attached: AttachedSource[]; intent: MaterialIntent | null }) => {
    const titles = attached.map((source) => source.title || t("my notes")).join(", ");

    return intent === "exam"
      ? t("Prepare for an exam on my material: {titles}", { titles })
      : t("Understand my material: {titles}", { titles });
  };
}

/**
 * With material attached, what the learner chose to do with it decides the goal: questions open
 * answers from their pages, and a plan without words is read from the material's titles.
 */
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
