"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

export type PlanStatus = NonNullable<PlanView["status"]>;

/**
 * One status in a few words: "One day ahead", "Keeping pace", "3 lessons to catch up" (lessons
 * earlier days left, until they're done), "2 days behind". Each is the learner's pace against
 * their plan, never whether the plan reaches the goal, which the plan's notice says (Marcos read
 * "On track" beside a plan covering 49% of his goal). Being behind is a count to catch up on,
 * never a judgment.
 */
function usePlanStatusText() {
  const t = useExtracted();

  return (status: PlanStatus): string => {
    switch (status.kind) {
      case "ahead":
        return t("{days, plural, one {One day ahead} other {# days ahead}}", { days: status.days });
      case "behind":
        return status.lessons
          ? t("{lessons, plural, one {# lesson to catch up} other {# lessons to catch up}}", {
              lessons: status.lessons,
            })
          : t("{days, plural, one {One day behind} other {# days behind}}", { days: status.days });
      case "needsAdjusting":
        return t("Needs adjusting");
      case "onTrack":
        return t("Keeping pace");
      default:
        return t("Keeping pace");
    }
  };
}

/**
 * Being behind is a calm, neutral fact: an orange "127 lessons to catch up" read as an alarm to a
 * learner just back from a break, while the plan already spreads them over the next days. A plan
 * that no longer fits says so in red, and its notice asks what to do.
 */
const DOT_CLASSES: Record<PlanStatus["kind"], string> = {
  ahead: "bg-success",
  behind: "bg-muted-foreground/60",
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
