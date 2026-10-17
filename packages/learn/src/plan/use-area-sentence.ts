"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { useExtracted, useFormatter } from "next-intl";

/** The changes that name some of the plan's areas. */
type AreaOperation = Extract<PlanOperation, { areas: string[] }>;

export function hasAreas(operation: PlanOperation): operation is AreaOperation {
  return "areas" in operation;
}

/** A change to some of the plan's areas, said the way the learner would. */
export function useAreaSentence() {
  const t = useExtracted();
  const format = useFormatter();

  return function areaSentence(operation: AreaOperation): string {
    // A focus on part of an area names that part ("Biology and Chemistry"), not the whole area.
    const parts = operation.kind === "focusAreas" ? (operation.parts ?? []) : [];

    const names = operation.areas.map(
      (area) => parts.find((part) => part.area === area)?.name ?? area,
    );

    const areas = format.list(names, { type: "conjunction" });

    switch (operation.kind) {
      case "focusAreas":
        return t("More time for {areas}.", { areas });
      case "reduceAreas":
        return t("Less time for {areas}.", { areas });
      case "skipAreas":
        return t("{areas} left out of the plan.", { areas });
      case "restoreAreas":
        return t("{areas} back in the plan.", { areas });
      case "setAreaStart":
        return operation.start === "pastBasics"
          ? t("Starting past the basics: {areas}.", { areas })
          : t("Starting from the basics again: {areas}.", { areas });
      default:
        return operation satisfies never;
    }
  };
}
