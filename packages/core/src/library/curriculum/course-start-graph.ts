import { type CourseLevel } from "@zoonk/db";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalSkillGraph } from "./save-goal-skills";

/** The Library course a goal was started from, whose outline its first run writes. */
export type StartedCourse = { id: string; ownerId: string | null; title: string };

/**
 * A goal started from a Library course learns that course: every course its skill graph names
 * becomes that one, so the goal's skills are outlined in the course's own level bands and its
 * plan is built from the course, instead of from the other courses identity search would find.
 */
export function pinGraphToCourse({
  course,
  graph,
}: {
  course: StartedCourse;
  graph: GoalSkillGraph;
}): GoalSkillGraph {
  const key = graph.courses[0]?.key ?? course.id;
  const levels = [...new Set<CourseLevel>(graph.courses.flatMap((item) => item.levels))];

  return {
    ...graph,
    courses: [{ key, levels, title: course.title }],
    skills: graph.skills.map((skill) => ({ ...skill, course: key })),
  };
}

/**
 * Who a started course's curriculum is for: the course's own audience, so a shared course stays
 * shared and the learner's private one stays theirs. The course already says what's shareable,
 * so no model decides it.
 */
export function getStartedCourseScope({
  course,
  goal,
}: {
  course: StartedCourse;
  goal: { language: string; targetLanguage: string | null; title: string };
}): CurriculumScope {
  return {
    generalGoal: course.ownerId ? null : goal.title,
    language: goal.language,
    ownerId: course.ownerId,
    targetLanguage: goal.targetLanguage,
  };
}

/** Each of the graph's course keys points at the started course. */
export function toStartedCourseIds({
  course,
  graph,
}: {
  course: StartedCourse;
  graph: GoalSkillGraph;
}): Record<string, string> {
  return Object.fromEntries(graph.courses.map((item) => [item.key, course.id]));
}
