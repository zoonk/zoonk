"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { CoverageLegend } from "../_components/coverage-bar";
import { LessonCells } from "../_components/progress-cells";
import { useFormatGoalProgress } from "../_utils/percent";
import { ProgressCard, useCardIds } from "./today-progress-card";
import { SubjectRows, type TodaySyllabus, useSubjectRows } from "./today-subject-rows";

type TodayLessons = Extract<NonNullable<TodayView["progress"]>, { measure: "lessons" }>["lessons"];

function getLessonCounts({
  lessons,
  syllabus,
}: {
  lessons: TodayLessons;
  syllabus: TodaySyllabus | null;
}) {
  const known = Math.min(lessons.done, syllabus?.lessons.known ?? 0);

  return {
    known,
    studied: lessons.done - known,
    today: Math.min(lessons.today, Math.max(0, lessons.total - lessons.done)),
    total: lessons.total,
  };
}

export function LessonsCard({
  className,
  lessons,
  syllabus,
  value,
}: {
  className?: string;
  lessons: TodayLessons;
  syllabus: TodaySyllabus | null;
  value: number;
}) {
  const t = useExtracted();
  const formatGoalProgress = useFormatGoalProgress();
  const ids = useCardIds();
  const rows = useSubjectRows(syllabus);
  const counts = getLessonCounts({ lessons, syllabus });

  const states = [
    "studied" as const,
    ...(counts.known > 0 ? ["known" as const] : []),
    ...(counts.today > 0 ? ["today" as const] : []),
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
      value={formatGoalProgress(value)}
    >
      {counts.total > 0 && (
        <div className="flex flex-col gap-2.5">
          <LessonCells {...counts} />
          {states.length > 1 && <CoverageLegend states={states} />}
        </div>
      )}

      <SubjectRows labelledBy={ids.title} rows={rows} />
    </ProgressCard>
  );
}
