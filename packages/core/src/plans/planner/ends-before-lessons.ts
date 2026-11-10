import { listCoreLessonItems } from "../_utils/core-lessons";
import { type BuildPlanInput } from "./build-plan";
import { isPastCore, withPlannedLessons } from "./core-first";
import { listWonPhases } from "./phase-time";
import { LEARN_KINDS } from "./plan-item-rules";
import { type PlannedItem } from "./plan-items";
import { type ScheduledUnit } from "./schedule-units";

export function listEndsBeforeLessons({
  given,
  items,
  laidOut,
  phaseEnds,
  skillLessons,
}: {
  given: Pick<BuildPlanInput, "graph" | "lessons">;
  items: readonly Pick<
    PlannedItem,
    | "chapterId"
    | "key"
    | "kind"
    | "lessonId"
    | "lessons"
    | "phase"
    | "scheduledFor"
    | "skillId"
    | "status"
  >[];
  laidOut: readonly Pick<ScheduledUnit, "depth" | "key" | "pastCore">[];
  phaseEnds: ReadonlyMap<number, Date>;
  skillLessons: ReadonlyMap<string, number>;
}): number[] {
  const skillPhases = new Map(given.graph.skills.map((skill) => [skill.skillId, skill.phase]));

  const courseLevels = new Map(
    given.lessons.flatMap((lesson) =>
      lesson.courseOrder ? [[lesson.lessonId, lesson.courseOrder.phase] as const] : [],
    ),
  );

  const laidOutKeys = new Set(laidOut.map((unit) => unit.key));
  const laidOutCore = new Set(laidOut.flatMap((unit) => (isPastCore(unit) ? [] : [unit.key])));

  const { skills } = withPlannedLessons({ graph: given.graph, skillLessons });

  const keptCore = new Set(
    [...listCoreLessonItems({ graphSkills: skills, items }).values()]
      .flat()
      .map((item) => item.key),
  );

  // Lessons this week's run kept as they were carry no flags, so they're sized as this build's
  // challenges size their skills' cores.
  const isWaitedFor = (item: (typeof items)[number]) =>
    laidOutKeys.has(item.key)
      ? laidOutCore.has(item.key)
      : item.kind !== "lesson" || keptCore.has(item.key);

  // A lesson that spills past its phase's end is filed under the next phase but still belongs to
  // its skill's phase, or to its chapter's level in a course.
  const home = items.map((item) => ({
    ...item,
    phase:
      courseLevels.get(item.lessonId ?? "") ?? skillPhases.get(item.skillId ?? "") ?? item.phase,
  }));

  const lessons = home.filter(
    (item) =>
      LEARN_KINDS.has(item.kind) &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      isWaitedFor(item),
  );

  const won = listWonPhases(home);

  return [...phaseEnds].flatMap(([phase, date]) =>
    !won.has(phase) &&
    lessons.some(
      (item) => item.phase <= phase && item.scheduledFor !== null && item.scheduledFor > date,
    )
      ? [phase]
      : [],
  );
}
