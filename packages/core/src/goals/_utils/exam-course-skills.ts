import { type CourseFormat } from "@zoonk/db/enums";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";

export function getExamCourseSkills({
  course,
  examGraph,
}: {
  course: { format: CourseFormat; id: string };
  examGraph: PlanGraph;
}): PlanGraphSkill[] {
  const { skills } = joinOptionSkills(examGraph);
  const named = skills.some((skill) => skill.courseIds?.includes(course.id));

  if (!named && course.format === "exam") {
    return skills;
  }

  return skills.filter((skill) => !skill.courseIds?.length || skill.courseIds.includes(course.id));
}
