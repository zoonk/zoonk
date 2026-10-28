"use client";

import { useExtracted, useFormatter } from "next-intl";

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

export function useFormatScore() {
  const format = useFormatter();
  return (value: number): string => format.number(value, { maximumFractionDigits: 2 });
}

export function useWritingName() {
  const t = useExtracted();
  return (rubric: string): string => (rubric === "enem" ? t("Your essay") : t("Your answer"));
}
