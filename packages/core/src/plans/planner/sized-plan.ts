import { type BuildPlanInput } from "./build-plan";
import { type ExistingPlanItem } from "./plan-items";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";
import { getSettledSkillIds } from "./settled-skills";

/** The plan as its graph sizes it, and the minutes of each skill the learner already finished. */
export type SizedPlanInput = {
  /** Each skill's finished lessons, in minutes at the learner's pace. */
  doneMinutes: ReadonlyMap<string, number>;
  input: BuildPlanInput;
};

/**
 * A lesson of a skill the learner hasn't settled that asks for no more time, so it counts against
 * the skill's size: one they finished, or one the Library held back, which left the plan's lessons
 * (`plannable`) and nothing will teach. Lessons the plan set aside for time (a new day's settling,
 * a cut for time) are still left: a learner's change brings them back (see
 * `BuildPlanInput.bringBackSetAside`), so a plan never covers what it set aside.
 */
function isFinishedLesson(item: ExistingPlanItem, plannable: ReadonlySet<string>): boolean {
  if (item.kind !== "lesson" || item.lessonId === null || item.skillId === null) {
    return false;
  }

  return item.status === "done" || (item.status === "skipped" && !plannable.has(item.lessonId));
}

function countFinishedLessons(
  items: readonly ExistingPlanItem[],
  plannable: ReadonlySet<string>,
): Map<string, number> {
  return items
    .filter((item) => isFinishedLesson(item, plannable))
    .reduce((counts, item) => {
      const skillId = item.skillId ?? "";
      return counts.set(skillId, (counts.get(skillId) ?? 0) + 1);
    }, new Map<string, number>());
}

/**
 * The plan as its graph sizes it: every skill left to learn as the lessons the graph gives it, less
 * the ones of it the learner finished (work the plan set aside is left), planned from today, with
 * the skills placement or a test-out settled taking no time. Outlining a skill's lessons changes
 * which lessons the plan holds and how long each one takes, not how much the goal asks, so what the
 * learner's time covers, the time that covers everything and when a plan without a date ends read
 * this plan: they change when the learner's time, progress or pace, or the graph, change, never
 * because a stand-in got outlined.
 */
export function toSizedPlanInput(input: BuildPlanInput): SizedPlanInput {
  const settled = getSettledSkillIds(input);
  const plannable = new Set(input.lessons.map((lesson) => lesson.lessonId));
  const finished = countFinishedLessons(input.items, plannable);

  const outlined = new Set(
    input.graph.skills.flatMap((skill) => (skill.outlined ? [skill.skillId] : [])),
  );

  const doneLessons = new Set(
    input.items.filter((item) => isFinishedLesson(item, plannable)).map((item) => item.lessonId),
  );

  // A complete course outline is sized by its written lessons, including shared ones counted
  // once. Dropping them would turn its outlined skills into zero work and falsely advise deep.
  const outlinedLessons = input.lessons.flatMap((lesson) => {
    const skillIds = lesson.skillIds.filter((id) => outlined.has(id) && !settled.has(id));

    return !doneLessons.has(lesson.lessonId) && skillIds.length > 0
      ? [{ ...lesson, skillIds }]
      : [];
  });

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

  // Its phases follow the graph's size, not the ends a refresh keeps for written lessons.
  return {
    doneMinutes,
    input: {
      ...input,
      graph: { ...input.graph, skills },
      items: [],
      lessons: outlinedLessons,
      mode: "forced",
      phaseEnds: undefined,
    },
  };
}
