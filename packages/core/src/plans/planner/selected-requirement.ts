import { type SelectedSummary } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices, withBaseChoices } from "./chosen-bases";
import { type PlannedItem } from "./plan-items";
import { DEFAULT_LESSON_MINUTES, getStandInLessons } from "./plan-units";
import { getSettledSkillIds } from "./settled-skills";

/** One skill's chosen requirement (see `readRequirement`): its written lessons and stand-in part. */
export type SkillRequirement = {
  /** Its written lessons as the chosen variant keeps them, raw minutes at pace, by lesson. */
  lessons: ReadonlyMap<string, number>;
  /** What its stand-in plans, raw minutes at pace: the lessons the Library hasn't written yet. */
  standIn: number;
};

/**
 * The chosen requirement before any time cut: each skill's written lessons as the learner's kept
 * base choices study it (`withBaseChoices`: a base's core, its quick lesson, or all of it), a
 * shared lesson counting for every skill it teaches, and its stand-in's lessons at their default
 * size.
 */
export function readRequirement(input: BuildPlanInput): Map<string, SkillRequirement> {
  const chosen = withBaseChoices({ choices: getKeptBaseChoices(input), input });
  const standIns = getStandInLessons({ lessons: chosen.lessons, skills: chosen.graph.skills });

  const linked = Map.groupBy(
    chosen.lessons.flatMap((lesson) => lesson.skillIds.map((skillId) => ({ lesson, skillId }))),
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

/** Whether an item's work is credited whole: the learner did it, or showed they know it. */
export function isCredited(item: Pick<PlannedItem, "status">): boolean {
  return item.status === "done" || item.status === "testedOut";
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

  const credited = new Set(
    built.items.flatMap((item) => (item.lessonId && isCredited(item) ? [item.lessonId] : [])),
  );

  const totalRaw = [...lessons.values()].reduce((sum, minutes) => sum + minutes, standIns);

  const doneRaw = [...lessons].reduce(
    (sum, [lessonId, minutes]) => (credited.has(lessonId) ? sum + minutes : sum),
    0,
  );

  return { doneRaw, remainingRaw: Math.max(0, totalRaw - doneRaw), totalRaw };
}
