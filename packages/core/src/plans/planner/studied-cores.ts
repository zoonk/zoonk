import { getCoreLessons } from "./core-first";
import { type ExistingPlanItem } from "./plan-items";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { type PlannerLesson, assignLessonSkills } from "./plan-units";
import { countStandInLessons } from "./stand-in-size";

export function countCoreLessons({
  outlined,
  skill,
}: {
  outlined: number;
  skill: PlanGraphSkill;
}): number {
  return getCoreLessons(
    outlined +
      countStandInLessons({ lessons: skill.lessons, outlined: skill.outlined, taught: outlined }),
  );
}

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
