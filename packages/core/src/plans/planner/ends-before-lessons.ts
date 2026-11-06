import { type BuildPlanInput } from "./build-plan";
import { listWonPhases } from "./phase-time";
import { LEARN_KINDS } from "./plan-item-rules";
import { type PlannedItem } from "./plan-items";
import { type ScheduledUnit } from "./schedule-units";

export function listEndsBeforeLessons({
  ends,
  input,
  items,
  units,
}: {
  ends: ReadonlyMap<number, Date>;
  input: Pick<BuildPlanInput, "graph" | "lessons">;
  items: readonly Pick<
    PlannedItem,
    "key" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId" | "status"
  >[];
  units: readonly Pick<ScheduledUnit, "depth" | "key">[];
}): number[] {
  const skillPhases = new Map(input.graph.skills.map((skill) => [skill.skillId, skill.phase]));

  const courseLevels = new Map(
    input.lessons.flatMap((lesson) =>
      lesson.courseOrder ? [[lesson.lessonId, lesson.courseOrder.phase] as const] : [],
    ),
  );

  const core = new Set(units.flatMap((unit) => (unit.depth ? [] : [unit.key])));

  const depth = new Set(
    units.flatMap((unit) => (unit.depth && !core.has(unit.key) ? [unit.key] : [])),
  );

  const lessons = items.filter(
    (item) =>
      LEARN_KINDS.has(item.kind) &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      !depth.has(item.key),
  );

  const won = listWonPhases(items);

  // A lesson that spills past its phase's end is filed under the next phase but still belongs to
  // its skill's phase, or to its chapter's level in a course.
  const homePhase = (item: (typeof lessons)[number]) =>
    courseLevels.get(item.lessonId ?? "") ?? skillPhases.get(item.skillId ?? "") ?? item.phase;

  return [...ends].flatMap(([phase, date]) =>
    !won.has(phase) &&
    lessons.some(
      (item) => homePhase(item) <= phase && item.scheduledFor !== null && item.scheduledFor > date,
    )
      ? [phase]
      : [],
  );
}
