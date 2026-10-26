"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { CoverageLegend } from "../_components/coverage-bar";
import { LessonCells } from "../_components/progress-cells";
import { useFormatGoalProgress } from "../_utils/percent";
import { ProgressCard, useCardIds } from "./today-progress-card";
import { SubjectRows, type TodaySyllabus, useSubjectRows } from "./today-subject-rows";

/** The plan's lessons as Today measures them: done of the total, and today's still to do. */
type TodayLessons = Extract<NonNullable<TodayView["progress"]>, { measure: "lessons" }>["lessons"];

/**
 * The plan's lessons by how they count: studied, skipped as known (the goal's own count, where a
 * lesson known in two subjects counts once), today's still to do (core's count: each once, while
 * still to do), and all of them.
 */
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

/**
 * Any other goal's progress in its plan's lessons, as the Plan says it ("31.58%", "6 of 19
 * lessons"), drawn as the lessons themselves: one cell each, studied in green, known muted, today's
 * still to do outlined in green, so the day's work shows on the way to the goal. A goal with
 * several modules lists them under it, on the same scale.
 */
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
      detail={t(
        "{total, plural, one {{done, number} of # lesson} other {{done, number} of # lessons}}",
        lessons,
      )}
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
