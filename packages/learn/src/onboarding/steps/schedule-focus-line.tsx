"use client";

import { type PlanTimeAdvice } from "@zoonk/core/plans/time-advice-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";

export function ScheduleFocusLine({
  advice,
  updating,
}: {
  advice: PlanTimeAdvice | null;
  updating: boolean;
}) {
  const t = useExtracted();
  const format = useFormatter();

  const subjects = (advice?.focusSubjects ?? []).map(
    (subject) => subject.shortName ?? subject.name,
  );

  if (subjects.length === 0) {
    return null;
  }

  return (
    <p
      className={cn(
        "text-muted-foreground text-sm leading-6 text-pretty transition-opacity",
        updating && "opacity-50",
      )}
      data-slot="schedule-focus"
    >
      {t("With this time, we suggest giving {subjects} more attention.", {
        subjects: format.list(subjects, { type: "conjunction" }),
      })}
    </p>
  );
}
