"use client";

import { type PlanCourseView } from "@zoonk/core/plans/course-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useLevelName } from "./use-level-name";

/**
 * The levels of the subject, Overview to Advanced, with the plan's own marked "your plan", so the
 * learner sees there's more whenever they want it. A private course has no levels.
 */
export function CourseLevelsLadder({ course }: { course: PlanCourseView }) {
  const t = useExtracted();
  const levelName = useLevelName();

  // Without a level marked as the plan's (an explanation's chapter has none), the ladder says nothing.
  if (!course.levels.some((level) => level.inPlan)) {
    return null;
  }

  return (
    <section aria-labelledby="course-levels-title" className="flex flex-col gap-3">
      <SectionLabel id="course-levels-title">{t("Levels of this subject")}</SectionLabel>

      <ol className="grid grid-cols-4 gap-x-1">
        {course.levels.map((level, index) => (
          <li
            aria-current={level.inPlan ? "step" : undefined}
            className="relative flex min-w-0 flex-col items-center gap-1.5 text-center"
            key={level.level}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className="bg-border absolute top-[7px] right-1/2 h-0.5 w-[calc(100%+0.25rem)]"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 size-4 rounded-full border-2",
                level.inPlan
                  ? "border-foreground bg-foreground in-data-[mode=fun]:border-fun-accent-lime in-data-[mode=fun]:bg-fun-accent-lime"
                  : "border-muted-foreground bg-background in-data-[mode=fun]:bg-transparent",
              )}
            />
            <span
              // Small on phones, where a quarter of the width fits "Intermediate" and "Intermediário"
              // on one line; the longest names ("Fortgeschritten") break with hyphens.
              className={cn(
                "max-w-full text-xs wrap-break-word hyphens-auto sm:text-sm",
                level.inPlan ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {levelName(level.level)}
            </span>
            {level.inPlan && (
              <span className="text-success text-xs font-medium">{t("your plan")}</span>
            )}
          </li>
        ))}
      </ol>

      {course.nextLevel && (
        <p className="text-muted-foreground text-center text-sm">
          {t("Want to go deeper later? Just keep going.")}
        </p>
      )}
    </section>
  );
}
