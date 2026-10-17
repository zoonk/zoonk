import { getChapterAreaFromEvidence } from "../../goals/_utils/chapter-area-evidence";
import { type BuiltPlan } from "../../plans/planner/build-plan";
import { type CourseEstimateData } from "./course-estimate-data";

type AreaWorkload = { plannedMinutes: number; quickLessons: number; unwrittenMinutes: number };

function labelArea({
  area,
  data,
}: {
  area: string | null | undefined;
  data: CourseEstimateData;
}): string | null {
  const label = area ? (data.areaLabels.get(area) ?? area) : null;
  return data.kind === "exam" && label === data.title ? null : label;
}

/** Partition original lesson time across distinct chapter areas, retaining unknown evidence. */
function getOriginalAreaParts({
  built,
  data,
  areaOf,
}: {
  built: BuiltPlan;
  data: CourseEstimateData;
  areaOf: (skillId: string | null) => string | null;
}) {
  const lessons = new Map(data.lessons.map((lesson) => [lesson.lessonId, lesson]));

  const placements = Map.groupBy(
    data.chapters.flatMap((chapter) => {
      const area = labelArea({
        area: getChapterAreaFromEvidence({ chapter, skillAreas: data.areaSkills }),
        data,
      });

      return chapter.lessonIds.map((lessonId) => ({ area, lessonId }));
    }),
    (placement) => placement.lessonId,
  );

  const planned = new Map(
    built.items.flatMap((item) =>
      item.kind === "lesson" && item.status === "todo" && item.lessonId
        ? [[item.lessonId, item] as const]
        : [],
    ),
  );

  return [...planned].flatMap(([lessonId, item]) => {
    const lesson = lessons.get(lessonId);
    const areas = [...new Set((placements.get(lessonId) ?? []).map((placement) => placement.area))];

    return lesson && areas.length > 0
      ? [{ areas, assignedArea: areaOf(item.skillId), minutes: lesson.minutes * data.pace.factor }]
      : [];
  });
}

/** A subject can be studied through quick/unwritten work even when no original outline lesson fits. */
export function getCourseEstimateAreaWorkload({
  built,
  data,
}: {
  built: BuiltPlan;
  data: CourseEstimateData;
}): Map<string | null, AreaWorkload> {
  const skills = new Map(data.graph.skills.map((skill) => [skill.skillId, skill]));
  const quickIds = new Set([...data.quickLessons.values()].map((lesson) => lesson.lessonId));

  const areaOf = (skillId: string | null) => {
    const raw = skills.get(skillId ?? "")?.area;

    return labelArea({ area: raw, data });
  };

  const originalParts = getOriginalAreaParts({ areaOf, built, data });

  const areas = new Set([
    ...built.skillMinutes.map((skill) => areaOf(skill.skillId)),
    ...originalParts.flatMap((part) => part.areas),
  ]);

  return new Map(
    [...areas].map((area) => {
      const covered = built.skillMinutes.filter((skill) => areaOf(skill.skillId) === area);

      const assignedOriginalMinutes = originalParts.reduce(
        (sum, part) => sum + (part.assignedArea === area ? part.minutes : 0),
        0,
      );

      const partitionedOriginalMinutes = originalParts.reduce(
        (sum, part) => sum + (part.areas.includes(area) ? part.minutes / part.areas.length : 0),
        0,
      );

      return [
        area,
        {
          plannedMinutes:
            Math.round(
              Math.max(
                0,
                covered.reduce((sum, skill) => sum + skill.covered, 0) -
                  assignedOriginalMinutes +
                  partitionedOriginalMinutes,
              ) * 10,
            ) / 10,
          quickLessons: built.items.filter(
            (item) =>
              item.kind === "lesson" &&
              item.lessonId &&
              quickIds.has(item.lessonId) &&
              areaOf(item.skillId) === area,
          ).length,
          unwrittenMinutes:
            Math.round(
              Math.max(
                0,
                covered.reduce((sum, skill) => sum + (skill.standIn?.covered ?? 0), 0),
              ) * 10,
            ) / 10,
        },
      ];
    }),
  );
}
