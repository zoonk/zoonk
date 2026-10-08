"use client";

import { useExtracted, useFormatter } from "next-intl";

/** ENEM's competencies and OAB's brief sections have fixed ids; the app names them. */
export function useCriterionName() {
  const t = useExtracted();

  return ({ id, name }: { id: string; name: string }): string => {
    switch (id) {
      case "c1":
        return t("Formal writing");
      case "c2":
        return t("Topic and references");
      case "c3":
        return t("Argument");
      case "c4":
        return t("Cohesion");
      case "c5":
        return t("Intervention proposal");
      case "addressing-and-parties":
        return t("Addressing and parties");
      case "facts":
        return t("Facts");
      case "legal-basis":
        return t("Legal basis");
      case "requests":
        return t("Requests");
      case "closing-and-form":
        return t("Closing and form");
      default:
        return name;
    }
  };
}

/** The five elements ENEM expects in an intervention proposal, in the app's words. */
export function useInterventionElementName() {
  const t = useExtracted();

  return (key: "action" | "agent" | "detail" | "effect" | "means"): string => {
    switch (key) {
      case "agent":
        return t("Who acts");
      case "action":
        return t("What they do");
      case "means":
        return t("By what means");
      case "effect":
        return t("To what end");
      case "detail":
        return t("A detail");
      default:
        return key;
    }
  };
}

/**
 * Scores keep the rubric's own steps (whole points for ENEM, hundredths elsewhere), written the
 * learner's way ("7,67" in Portuguese).
 */
export function useFormatScore() {
  const format = useFormatter();
  return (value: number): string => format.number(value, { maximumFractionDigits: 2 });
}

/**
 * What the learner writes: an essay for ENEM's redação; an answer for every other written question
 * (a discursive question, a class test's dissertativa, an AP free-response question, a brief).
 */
export function useWritingName() {
  const t = useExtracted();
  return (rubric: string): string => (rubric === "enem" ? t("Your essay") : t("Your answer"));
}
