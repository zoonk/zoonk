import { type SelectedSummary } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices, withBaseChoices } from "./chosen-bases";
import { type PlannedItem } from "./plan-items";
import { DEFAULT_LESSON_MINUTES, type PlannerLesson, getStandInLessons } from "./plan-units";
import { getTitleKey } from "./repeated-titles";
import { getSettledSkillIds } from "./settled-skills";

/** One skill's chosen requirement (see `readRequirement`): its written lessons and stand-in part. */
export type SkillRequirement = {
  /** Its written lessons as the chosen variant keeps them, raw minutes at pace, by lesson. */
  lessons: ReadonlyMap<string, number>;
  /** What its stand-in plans, raw minutes at pace: the lessons the Library hasn't written yet. */
  standIn: number;
};

/**
 * The lesson that teaches each lesson's title in the plan: the plan teaches a title once (see
 * `withoutRepeatedTitles`), so a lesson whose title another lesson it holds has is taught by that
 * one, for its own skills too. A lesson the plan holds, or whose title it holds no lesson of,
 * stands for itself.
 */
function toTaughtLesson({
  built,
  lessons,
}: {
  built: BuiltPlan;
  lessons: readonly PlannerLesson[];
}): (lesson: PlannerLesson) => PlannerLesson {
  const held = new Set(built.items.flatMap((item) => (item.lessonId ? [item.lessonId] : [])));

  const holders = new Map(
    lessons
      .filter((lesson) => held.has(lesson.lessonId))
      .map((lesson) => [getTitleKey(lesson.title), lesson] as const),
  );

  return (lesson) =>
    held.has(lesson.lessonId) ? lesson : (holders.get(getTitleKey(lesson.title)) ?? lesson);
}

/**
 * The chosen requirement before any time cut: each skill's written lessons as the learner's kept
 * base choices study it (`withBaseChoices`: a base's core, its quick lesson, or all of it), a
 * shared lesson counting for every skill it teaches, a repeated title as the lesson the plan
 * teaches it with (see `toTaughtLesson`), and its stand-in's lessons at their default size.
 */
export function readRequirement({
  built,
  input,
}: {
  built: BuiltPlan;
  input: BuildPlanInput;
}): Map<string, SkillRequirement> {
  const chosen = withBaseChoices({ choices: getKeptBaseChoices(input), input });
  const standIns = getStandInLessons({ lessons: chosen.lessons, skills: chosen.graph.skills });
  const taught = toTaughtLesson({ built, lessons: chosen.lessons });

  const linked = Map.groupBy(
    chosen.lessons.flatMap((lesson) =>
      lesson.skillIds.map((skillId) => ({ lesson: taught(lesson), skillId })),
    ),
    (entry) => entry.skillId,
  );

  return new Map(
    chosen.graph.skills.map((skill) => [
      skill.skillId,
      {
        lessons: new Map(
          (linked.get(skill.skillId) ?? []).map(({ lesson }) => [
            lesson.lessonId,
            lesson.minutes * input.paceFactor,
          ]),
        ),
        standIn: (standIns.get(skill.skillId) ?? 0) * DEFAULT_LESSON_MINUTES * input.paceFactor,
      },
    ]),
  );
}

/** Completion credits the shared lesson; a test-out credits only its settled skill (see `listSettled`). */
export function isCompleted(item: Pick<PlannedItem, "status">): boolean {
  return item.status === "done";
}

/** The skills the learner settled: tested out, or known, as the plan reads them. */
export function listSettled(input: BuildPlanInput): Set<string> {
  return new Set([
    ...getSettledSkillIds({
      items: input.items,
      lessons: input.lessons,
      missedSkillIds: input.missedSkillIds,
    }),
    ...(input.knownSkillIds ?? []),
  ]);
}

/**
 * The chosen requirement's raw minutes in all, done and left, each lesson once whatever skills it
 * teaches, without the skills the learner settled, whose lessons ask no study (see `readRequirement`).
 */
export function sumRequirement({
  built,
  requirement,
  settled,
}: {
  built: BuiltPlan;
  requirement: ReadonlyMap<string, SkillRequirement>;
  settled: ReadonlySet<string>;
}): SelectedSummary["requirement"] {
  const studied = [...requirement].filter(([skillId]) => !settled.has(skillId));
  const lessons = new Map(studied.flatMap(([, skill]) => [...skill.lessons]));
  const standIns = studied.reduce((sum, [, skill]) => sum + skill.standIn, 0);

  const completed = new Set(
    built.items.flatMap((item) => (item.lessonId && isCompleted(item) ? [item.lessonId] : [])),
  );

  const totalRaw = [...lessons.values()].reduce((sum, minutes) => sum + minutes, standIns);

  const doneRaw = [...lessons].reduce(
    (sum, [lessonId, minutes]) => (completed.has(lessonId) ? sum + minutes : sum),
    0,
  );

  return { doneRaw, remainingRaw: Math.max(0, totalRaw - doneRaw), totalRaw };
}
