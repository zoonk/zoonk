"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { useFormatter } from "next-intl";
import { useActivityName } from "./plan-activities";

type AreaOperation = Extract<PlanOperation, { areas: unknown }>;
type ActivityOperation = Extract<PlanOperation, { kind: "restoreActivities" | "skipActivities" }>;

export function useAreaNames() {
  const format = useFormatter();

  return (operation: AreaOperation): string => {
    const parts = operation.kind === "focusAreas" ? (operation.parts ?? []) : [];

    return format.list(
      operation.areas.map((area) => parts.find((part) => part.area === area)?.name ?? area),
      { type: "conjunction" },
    );
  };
}

export function useActivityNames() {
  const format = useFormatter();
  const activityName = useActivityName();

  return (operation: ActivityOperation): string =>
    format.list(
      operation.activities.map((activity) => activityName(activity)),
      { type: "conjunction" },
    );
}
