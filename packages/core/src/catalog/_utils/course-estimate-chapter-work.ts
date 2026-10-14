import { type CourseOutlineChapter } from "../../goals/_utils/course-plan-graph";
import { type BuiltPlan } from "../../plans/planner/build-plan";
import { daysBetween } from "../../plans/planner/plan-calendar";
import { type PlannedItem } from "../../plans/planner/plan-items";
import { type CourseEstimateData } from "./course-estimate-data";

type WorkKind = "original" | "quick" | "unwritten";

function getWorkKind({
  chapter,
  data,
  item,
  skillIds,
  unwrittenIds,
}: {
  chapter: CourseOutlineChapter;
  data: CourseEstimateData;
  item: PlannedItem;
  skillIds: ReadonlySet<string>;
  unwrittenIds: ReadonlySet<string>;
}): WorkKind | null {
  if (item.lessonId && chapter.lessonIds.includes(item.lessonId)) {
    return "original";
  }

  if (!item.skillId || !skillIds.has(item.skillId)) {
    return null;
  }

  if (item.lessonId === null) {
    return unwrittenIds.has(item.skillId) ? "unwritten" : null;
  }

  return data.quickLessons.get(item.skillId)?.lessonId === item.lessonId ? "quick" : null;
}

/** Area membership alone never links replacement work to every chapter of that subject. */
export function getCourseEstimateChapterWork({
  built,
  chapter,
  data,
  today,
}: {
  built: BuiltPlan;
  chapter: CourseOutlineChapter;
  data: CourseEstimateData;
  today: Date;
}) {
  const activeIds = new Set(data.graph.skills.map((skill) => skill.skillId));

  const skillIds = new Set(
    [...chapter.tags, ...chapter.lessons.flat()]
      .map((skill) => skill.id)
      .filter((skillId) => activeIds.has(skillId)),
  );

  const unwrittenIds = new Set(
    built.skillMinutes.flatMap((skill) =>
      (skill.standIn?.covered ?? 0) > 0 ? [skill.skillId] : [],
    ),
  );

  const work = built.items.flatMap((item, position) => {
    if (item.kind !== "lesson" || item.status !== "todo" || !item.scheduledFor) {
      return [];
    }

    const kind = getWorkKind({ chapter, data, item, skillIds, unwrittenIds });

    return kind
      ? [
          {
            date: item.scheduledFor,
            end: built.teachingEnds.get(item.key) ?? item.scheduledFor,
            kind,
            position,
          },
        ]
      : [];
  });

  const weeks = work.map(({ date }) => Math.floor(daysBetween(today, date) / 7) + 1);
  const endWeeks = work.map(({ end }) => Math.floor(daysBetween(today, end) / 7) + 1);

  /** Joined unwritten work retains its first date, not the completion dates of its parts. */
  const unknownEnd = work.some((entry) => entry.kind === "unwritten");

  return {
    endWeek: endWeeks.length > 0 && !unknownEnd ? Math.max(...endWeeks) : null,
    firstPosition: work[0]?.position ?? Number.MAX_SAFE_INTEGER,
    week: weeks.length > 0 ? Math.min(...weeks) : null,
    workKinds: (["original", "quick", "unwritten"] as const).filter((kind) =>
      work.some((entry) => entry.kind === kind),
    ),
  };
}
