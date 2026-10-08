import { type BuildPlanInput } from "./build-plan";
import { type ExistingPlanItem } from "./plan-items";
import { getSettledSkillIds } from "./plan-queue";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";

/** The plan as its graph sizes it, and the minutes of each skill the learner already finished. */
export type SizedPlanInput = {
  /** Each skill's finished lessons, in minutes at the learner's pace. */
  doneMinutes: ReadonlyMap<string, number>;
  input: BuildPlanInput;
};

/** A finished lesson of a skill the learner hasn't settled: it counts against the skill's size. */
function isFinishedLesson(item: ExistingPlanItem): boolean {
  return (
    item.kind === "lesson" &&
    item.lessonId !== null &&
    item.skillId !== null &&
    (item.status === "done" || item.status === "skipped")
  );
}

function countFinishedLessons(items: readonly ExistingPlanItem[]): Map<string, number> {
  return items
    .filter((item) => isFinishedLesson(item))
    .reduce((counts, item) => {
      const skillId = item.skillId ?? "";
      return counts.set(skillId, (counts.get(skillId) ?? 0) + 1);
    }, new Map<string, number>());
}

/**
 * The plan as its graph sizes it: every skill left to learn as the lessons the graph gives it, less
 * the ones of it the learner finished, planned from today, with the skills placement or a test-out
 * settled taking no time. Outlining a skill's lessons changes which lessons the plan holds and how
 * long each one takes, not how much the goal asks, so what the learner's time covers, the time
 * that covers everything and when a plan without a date ends read this plan: they change when the
 * learner's time, progress or pace, or the graph, change, never because a stand-in got outlined.
 */
export function toSizedPlanInput(input: BuildPlanInput): SizedPlanInput {
  const settled = getSettledSkillIds(input);
  const finished = countFinishedLessons(input.items);

  const skills = input.graph.skills.map((skill) => ({
    ...skill,
    lessons: settled.has(skill.skillId)
      ? 0
      : Math.max(0, skill.lessons - (finished.get(skill.skillId) ?? 0)),
  }));

  const doneMinutes = new Map(
    [...finished]
      .filter(([skillId]) => !settled.has(skillId))
      .map(([skillId, count]) => [skillId, count * DEFAULT_LESSON_MINUTES * input.paceFactor]),
  );

  return {
    doneMinutes,
    input: { ...input, graph: { ...input.graph, skills }, items: [], lessons: [], mode: "forced" },
  };
}
