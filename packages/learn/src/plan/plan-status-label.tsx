"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export type PlanStatus = NonNullable<PlanView["status"]>;

/** One status in a few words, the same in both modes: Fun only draws it on the route. */
export function usePlanStatusText() {
  const t = useExtracted();

  return (status: PlanStatus): string => {
    switch (status.kind) {
      case "ahead":
        return t("{days, plural, one {# day ahead of plan} other {# days ahead of plan}}", {
          days: status.days,
        });
      case "behind":
        return t("A bit behind");
      case "needsAdjusting":
        return t("Needs adjusting");
      case "onTrack":
        return t("On track");
      default:
        return t("On track");
    }
  };
}

const DOT_CLASSES: Record<PlanStatus["kind"], string> = {
  ahead: "bg-success",
  behind: "bg-warning",
  needsAdjusting: "bg-destructive",
  onTrack: "bg-success",
};

/** A dot and the status in words. Screen readers hear it as one status line. */
export function PlanStatusLabel({ className, status }: { className?: string; status: PlanStatus }) {
  const statusText = usePlanStatusText();

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", DOT_CLASSES[status.kind])} />
      {statusText(status)}
    </span>
  );
}
