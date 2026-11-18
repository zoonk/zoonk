"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { CoverageBar, CoverageLegend } from "../_components/coverage-bar";
import { useFormatProgressShare } from "../_utils/percent";
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
  const ids = useCardIds();
  const counts = getLessonCounts({ knownLessons, lessons });

  const states = [
    "studied" as const,
    ...(counts.known > 0 ? ["known" as const] : []),
    "new" as const,
  ];

  return (
    <ProgressCard
      className={className}
      detail={t({
        description: "A short line under the progress percent, in a small tile.",
        message:
          "{studied, plural, =0 {No lessons studied yet} one {# lesson studied} other {# lessons studied}}",
        values: { studied: counts.studied },
      })}
      ids={ids}
      summary={
        counts.today > 0
          ? `${t("Today")}: ${t("{count, plural, one {# lesson} other {# lessons}}", { count: counts.today })}`
          : null
      }
      title={t("Progress")}
      value={formatProgressShare(value)}
    >
      {counts.total > 0 && (
        <div className="flex flex-col gap-2.5">
          <CoverageBar
            known={counts.known / counts.total}
            studied={counts.studied / counts.total}
          />
          <CoverageLegend states={states} />
        </div>
      )}
    </ProgressCard>
  );
}
