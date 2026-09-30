"use client";

import {
  LANGUAGE_ACTIVITY_TYPES,
  type LanguageActivityType,
} from "@zoonk/core/language/activities";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { usePlanScreen } from "./plan-context";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";

/** The names learners know each kind of language practice by. */
export function useActivityName() {
  const t = useExtracted();

  const names: Record<LanguageActivityType, string> = {
    listening: t("Listening"),
    speaking: t("Speaking"),
    vocabulary: t("New words"),
    writing: t("Writing"),
  };

  return (activity: LanguageActivityType) => names[activity];
}

/**
 * A language plan's practice, one toggle each: turning one off ("I don't need writing") leaves it
 * out of lessons from now on, and turning it on brings it back. Each change shows up in the
 * changes with an undo, like any other.
 */
export function PlanActivities() {
  const t = useExtracted();
  const activityName = useActivityName();
  const { goal, plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();

  if (goal.kind !== "language") {
    return null;
  }

  const skipped = new Set(plan.steering.skippedActivities);

  return (
    <section aria-labelledby="plan-activities-title" className="flex flex-col gap-2">
      <SectionLabel id="plan-activities-title">{t("What you practice")}</SectionLabel>

      <div className="flex flex-wrap gap-2">
        {LANGUAGE_ACTIVITY_TYPES.map((activity) => {
          const isOn = !skipped.has(activity);

          return (
            <Toggle
              className="in-data-[mode=fun]:fun-glass"
              disabled={isPending}
              focusableWhenDisabled
              key={activity}
              onPressedChange={() =>
                change([
                  { activities: [activity], kind: isOn ? "skipActivities" : "restoreActivities" },
                ])
              }
              pressed={isOn}
              variant="outline"
            >
              {activityName(activity)}
            </Toggle>
          );
        })}
      </div>

      <p className="text-muted-foreground text-sm">
        {skipped.size > 0
          ? t("Turned-off practice stays out of your lessons until you turn it back on.")
          : t("Turn off what you don't need. You can bring it back anytime.")}
      </p>

      {failed && <PlanFailedMessage />}
    </section>
  );
}
