import { getCoreLessons } from "./core-first";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { type PlannerLesson, assignLessonSkills, countStandInLessons } from "./plan-units";

/**
 * How many lessons a skill's core has (see `getCoreLessons`), from its lessons the plan has,
 * outlined and still to write (as `findPlanBases` counts them).
 */
export function countCoreLessons({
  outlined,
  skill,
}: {
  outlined: number;
  skill: PlanGraphSkill;
}): number {
  return getCoreLessons(
    outlined + countStandInLessons({ lessons: skill.lessons, taught: outlined }),
  );
}

/**
 * The skills whose core the learner studied, none of their lessons still to do in the plan: a
 * choice that keeps no more than a base's core changes nothing for them. Kept, a quick lesson for
 * prokaryotes, whose core a class test's learner had studied, planned the plan the way a plan
 * with choices goes, and cell theory left it. The planner (`getKeptBaseChoices`) and the plan
 * rules (R15) both read a finished base with it.
 */
export function listStudiedCores(input: {
  graph: Pick<PlanGraph, "skills">;
  items: readonly Pick<ExistingPlanItem, "kind" | "skillId" | "status">[];
  lessons: readonly Pick<PlannerLesson, "chapterId" | "lessonId" | "skillIds">[];
}): Set<string> {
  const teaching = assignLessonSkills({ lessons: input.lessons, skills: input.graph.skills });
  const outlined = Map.groupBy(teaching.values(), (skillId) => skillId);
  const lessons = input.items.filter((item) => item.kind === "lesson" && item.skillId);
  const todo = new Set(lessons.flatMap((item) => (item.status === "todo" ? [item.skillId] : [])));

  const done = Map.groupBy(
    lessons.filter((item) => item.status === "done"),
    (item) => item.skillId ?? "",
  );

  return new Set(
    input.graph.skills.flatMap((skill) => {
      const core = countCoreLessons({ outlined: outlined.get(skill.skillId)?.length ?? 0, skill });
      const studied = (done.get(skill.skillId)?.length ?? 0) >= core;

      return studied && !todo.has(skill.skillId) ? [skill.skillId] : [];
    }),
  );
}
