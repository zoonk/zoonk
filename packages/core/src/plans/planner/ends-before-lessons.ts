import { listCoreLessonItems } from "../_utils/core-lessons";
import { type BuildPlanInput } from "./build-plan";
import { isPastCore } from "./core-first";
import { listWonPhases } from "./phase-time";
import { LEARN_KINDS } from "./plan-item-rules";
import { type PlannedItem } from "./plan-items";
import { type ScheduledUnit } from "./schedule-units";

export function listEndsBeforeLessons({
  ends,
  given,
  items,
  units,
}: {
  ends: ReadonlyMap<number, Date>;
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
  units: readonly Pick<ScheduledUnit, "depth" | "key" | "pastCore">[];
}): number[] {
  const skillPhases = new Map(given.graph.skills.map((skill) => [skill.skillId, skill.phase]));

  const courseLevels = new Map(
    given.lessons.flatMap((lesson) =>
      lesson.courseOrder ? [[lesson.lessonId, lesson.courseOrder.phase] as const] : [],
    ),
  );

  const laidOut = new Set(units.map((unit) => unit.key));
  const laidOutCore = new Set(units.flatMap((unit) => (isPastCore(unit) ? [] : [unit.key])));

  const keptCore = new Set(
    [...listCoreLessonItems({ graphSkills: given.graph.skills, items }).values()]
      .flat()
      .map((item) => item.key),
  );

  // Lessons this week's run kept as they were carry no flags, so they're sized as the challenge
  // sizes its skills' cores.
  const isWaitedFor = (item: (typeof items)[number]) =>
    laidOut.has(item.key)
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

  return [...ends].flatMap(([phase, date]) =>
    !won.has(phase) &&
    lessons.some(
      (item) => item.phase <= phase && item.scheduledFor !== null && item.scheduledFor > date,
    )
      ? [phase]
      : [],
  );
}
