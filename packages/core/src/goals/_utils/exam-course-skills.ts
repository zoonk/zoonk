import { type CourseFormat } from "@zoonk/db/enums";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";

/**
 * The skills of a stored exam graph a course teaches, with the options of the exam's choices among
 * them, since each learner picks their own. A course the graph names teaches the ones it gives
 * that course and the ones it gives no course (a graph of one course often names none). An exam
 * course the graph names nowhere is the whole exam (pt ENEM's, whose graph gives every skill to a
 * subject course), so it teaches all of them. Other courses receive only their own and courseless
 * skills; reuse separately requires original shared course assignments. A course's full outline
 * teaches these (`plansFromCourseOutline`), and a start before then
 * plans these from the graph (`pinPlanGraphToCourse`), so both plan the same part of the exam.
 */
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
