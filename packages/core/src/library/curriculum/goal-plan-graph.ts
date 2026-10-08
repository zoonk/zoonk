import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { type GoalSkillGraph } from "./save-goal-skills";

/**
 * A skill the Library resolved from two graph skills keeps its first place and area, and is
 * learned in the courses of both, teaching the topics of both: the goal needs it in each subject.
 */
function mergeDuplicateSkills(skills: readonly PlanGraphSkill[]): PlanGraphSkill[] {
  return skills
    .filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    )
    .map((skill) => {
      const same = skills.filter((other) => other.skillId === skill.skillId);
      const courseIds = same.flatMap((other) => other.courseIds ?? []);
      const topics = [...new Set(same.flatMap((other) => other.topics ?? []))];
      const outcome = same.some((other) => other.outcome);

      return {
        ...skill,
        courseIds: [...new Set(courseIds)],
        ...(outcome ? { outcome } : {}),
        ...(topics.length > 0 ? { topics } : {}),
      };
    });
}

/**
 * Turns a goal's skill graph into the graph the planner plans from. Phases keep their titles and
 * milestones; each skill keeps its size in lessons, its phase (counted from 0, as plans count
 * them), its exam weight, its area (an exam's notice subject or a learn goal's module, which the
 * syllabus shows, study days rotate through and "focus on math" edits act on; its course's title
 * on graphs without one), the notice topics it teaches, whether it's one of the goal's outcome
 * skills (kept whole when time is short), and the Library course found for its course, which the
 * plan takes the skill's lessons from. The graph is already in teaching order.
 * Two graph skills that the Library resolved to the same skill become one, at the place of the
 * first.
 */
export function toGoalPlanGraph({
  courseIdsByKey,
  graph,
  idsByKey,
}: {
  /** The Library course found for each graph course, by the graph's course key. */
  courseIdsByKey: Readonly<Record<string, string>>;
  graph: GoalSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
}): PlanGraph {
  const courseTitles = new Map(graph.courses.map((course) => [course.key, course.title]));

  const skills = graph.skills.flatMap((skill) => {
    const skillId = idsByKey[skill.key];
    const courseId = courseIdsByKey[skill.course];

    if (!skillId) {
      return [];
    }

    const topics = skill.topics ?? [];

    return [
      {
        area: skill.area || (courseTitles.get(skill.course) ?? null),
        courseIds: courseId ? [courseId] : [],
        lessons: skill.estimatedLessons,
        name: skill.name,
        ...(skill.outcome ? { outcome: true } : {}),
        phase: Math.max(0, skill.phase - 1),
        skillId,
        ...(topics.length > 0 ? { topics } : {}),
        weight: skill.examWeight,
      },
    ];
  });

  return {
    phases: graph.phases.map((phase) => ({ milestone: phase.milestone, name: phase.title })),
    skills: mergeDuplicateSkills(skills),
  };
}
