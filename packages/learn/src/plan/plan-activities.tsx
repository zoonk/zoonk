"use client";

import {
  LANGUAGE_ACTIVITY_TYPES,
  type LanguageActivityType,
} from "@zoonk/core/language/activities";
import { Toggle } from "@zoonk/ui/components/toggle";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { usePlanScreen } from "./plan-context";
import { usePlanChange } from "./use-plan-change";
import { useTappedChoice } from "./use-tapped-choice";

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

export function PlanActivities() {
  const t = useExtracted();
  const activityName = useActivityName();
  const { goal, plan } = usePlanScreen();
  const { change, failed, isPending } = usePlanChange();
  const tapped = useTappedChoice<{ activity: LanguageActivityType; isOn: boolean } | null>(null);

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
              className="h-11 px-4"
              disabled={isPending}
              focusableWhenDisabled
              key={activity}
              onPressedChange={() =>
                change(
                  [{ activities: [activity], kind: isOn ? "skipActivities" : "restoreActivities" }],
                  tapped.pick({ activity, isOn: !isOn }),
                )
              }
              pressed={tapped.shown?.activity === activity ? tapped.shown.isOn : isOn}
              variant="outline"
            >
              {activityName(activity)}
            </Toggle>
          );
        })}
      </div>

      {failed && <ChangeSaveError />}
    </fieldset>
  );
}
