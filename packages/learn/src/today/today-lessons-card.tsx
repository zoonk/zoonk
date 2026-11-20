"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { CoverageBar } from "../_components/coverage-bar";
import { useFormatProgressShare } from "../_utils/percent";
import { ProgressCard, useCardIds } from "./today-progress-card";

type TodayLessons = Extract<NonNullable<TodayView["progress"]>, { measure: "lessons" }>["lessons"];

export function LessonsCard({
  className,
  lessons,
  value,
}: {
  className?: string;
  lessons: TodayLessons;
  value: number;
}) {
  const t = useExtracted();
  const formatProgressShare = useFormatProgressShare();
  const ids = useCardIds();
  const today = Math.min(lessons.today, Math.max(0, lessons.total - lessons.done));

  const meaning = t({
    description: "What the goal's progress number is made of",
    message: "The share of your plan's lessons you've studied or already knew.",
  });

  return (
    <ProgressCard
      className={className}
      ids={ids}
      summary={
        today > 0
          ? `${meaning} ${t("Today")}: ${t("{count, plural, one {# lesson} other {# lessons}}", { count: today })}`
          : meaning
      }
      title={t("Progress")}
      value={formatProgressShare(value)}
    >
      {lessons.total > 0 && <CoverageBar studied={lessons.done / lessons.total} />}
    </ProgressCard>
  );
}
