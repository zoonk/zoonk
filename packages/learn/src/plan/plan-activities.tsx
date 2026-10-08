"use client";

import {
  LANGUAGE_ACTIVITY_TYPES,
  type LanguageActivityType,
} from "@zoonk/core/language/activities";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
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
 * out of lessons from now on, and turning it on brings it back.
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
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("What you practice")}</legend>

      <div className="flex flex-wrap gap-2">
        {LANGUAGE_ACTIVITY_TYPES.map((activity) => {
          const isOn = !skipped.has(activity);

          return (
            <Toggle
              className="aria-pressed:bg-foreground aria-pressed:text-background h-11 px-4"
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

      {failed && <PlanFailedMessage />}
    </fieldset>
  );
}
