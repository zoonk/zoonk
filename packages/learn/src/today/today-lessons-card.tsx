"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { CoverageBar } from "../_components/coverage-bar";
import { useFormatProgressShare } from "../_utils/percent";
import { useLessonsProgressLine } from "../_utils/use-lessons-progress-line";
import { ProgressCard, useCardIds } from "./today-progress-card";

type TodayLessons = Extract<NonNullable<TodayView["progress"]>, { measure: "lessons" }>["lessons"];

function getLessonCounts({
  knownLessons,
  lessons,
}: {
  knownLessons: number;
  lessons: TodayLessons;
}) {
  const known = Math.min(lessons.done, knownLessons);

  return {
    known,
    studied: lessons.done - known,
    today: Math.min(lessons.today, Math.max(0, lessons.total - lessons.done)),
    total: lessons.total,
  };
}

export function LessonsCard({
  className,
  knownLessons,
  lessons,
  value,
}: {
  className?: string;
  /** Lessons the learner skipped because they already knew them. */
  knownLessons: number;
  lessons: TodayLessons;
  value: number;
}) {
  const t = useExtracted();
  const formatProgressShare = useFormatProgressShare();
  const lessonsProgressLine = useLessonsProgressLine();
  const ids = useCardIds();
  const counts = getLessonCounts({ knownLessons, lessons });

  return (
    <ProgressCard
      className={className}
      detail={lessonsProgressLine(counts)}
      ids={ids}
      summary={
        counts.today > 0
          ? `${t("Today")}: ${t("{count, plural, one {# lesson} other {# lessons}}", { count: counts.today })}`
          : null
      }
      title={t("Progress")}
      value={formatProgressShare(value)}
    >
      {counts.total > 0 && <CoverageBar studied={lessons.done / counts.total} />}
    </ProgressCard>
  );
}
