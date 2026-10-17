import { getChapterAreaFromEvidence } from "../../goals/_utils/chapter-area-evidence";
import { type BuiltPlan } from "../../plans/planner/build-plan";
import { type CoursePlanEstimate } from "../course-estimate-contract";
import { getCourseEstimateAreaWorkload } from "./course-estimate-area-workload";
import { getCourseEstimateChapterWork } from "./course-estimate-chapter-work";
import { type CourseEstimateData } from "./course-estimate-data";
import { getCourseEstimateWorkload } from "./course-estimate-workload";

type DatedEstimate = Omit<
  Extract<CoursePlanEstimate, { fittingLessons: number }>,
  "numbers" | "publishedContent"
>;

/**
 * Chapters count each covered placement of a reused lesson; area and global outline counts use
 * unique lesson IDs. Covered quick/unwritten work is reported separately from original lessons.
 */
export function summarizeCourseEstimate({
  built,
  data,
  today,
}: {
  built: BuiltPlan;
  data: CourseEstimateData;
  today: Date;
}): DatedEstimate {
  const outlineLessons = new Set(data.chapters.flatMap((chapter) => chapter.lessonIds));

  const fitting = built.items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      item.lessonId !== null &&
      outlineLessons.has(item.lessonId),
  );

  const byLesson = new Map(fitting.map((item) => [item.lessonId, item]));

  const rows = data.chapters.map((chapter, position) => {
    const items = chapter.lessonIds.flatMap((lessonId) => byLesson.get(lessonId) ?? []);
    const rawArea = getChapterAreaFromEvidence({ chapter, skillAreas: data.areaSkills });
    const labeledArea = rawArea === null ? null : (data.areaLabels.get(rawArea) ?? rawArea);
    const area = data.kind === "exam" && labeledArea === data.title ? null : labeledArea;

    return {
      area,
      chapterId: chapter.chapterId,
      ...getCourseEstimateChapterWork({ built, chapter, data, today }),
      fittingLessonIds: items.flatMap((item) => item.lessonId ?? []),
      lessonIds: chapter.lessonIds,
      lessonsInPlan: items.length,
      outlinePosition: position,
    };
  });

  const byArea = Map.groupBy(rows, (row) => row.area);
  const areaWorkload = getCourseEstimateAreaWorkload({ built, data });

  const areas = [
    ...new Set([
      ...byArea.keys(),
      ...[...areaWorkload].flatMap(([area, workload]) =>
        workload.plannedMinutes > 0 ? [area] : [],
      ),
    ]),
  ];

  return {
    areas: areas.map((area) => {
      const chapters = byArea.get(area) ?? [];

      return {
        area,
        fitting: new Set(chapters.flatMap((chapter) => chapter.fittingLessonIds)).size,
        total: new Set(chapters.flatMap((chapter) => chapter.lessonIds)).size,
        ...(areaWorkload.get(area) ?? { plannedMinutes: 0, quickLessons: 0, unwrittenMinutes: 0 }),
      };
    }),
    chapters: rows
      .toSorted(
        (a, b) => a.firstPosition - b.firstPosition || a.outlinePosition - b.outlinePosition,
      )
      .map((row, index) => ({
        area: row.area,
        chapterId: row.chapterId,
        endWeek: row.endWeek,
        lessonsInPlan: row.lessonsInPlan,
        studyOrder: index + 1,
        week: row.week,
        workKinds: row.workKinds,
      })),
    fittingLessons: byLesson.size,
    workload: getCourseEstimateWorkload({ built, data }),
  };
}
