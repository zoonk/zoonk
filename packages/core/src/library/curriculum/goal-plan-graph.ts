import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { type GoalSkillGraph } from "./save-goal-skills";

export type PlannedSkillGraph = Omit<GoalSkillGraph, "skills"> & {
  courseOutline?: PlanGraph["courseOutline"];
  skills: (GoalSkillGraph["skills"][number] & { outlined?: boolean; topicsUnknown?: boolean })[];
};

function mergeTopics(copies: readonly PlanGraphSkill[]): string[] | undefined {
  const listed = [...new Set(copies.flatMap((copy) => copy.topics ?? []))];

  if (listed.length > 0) {
    return listed;
  }

  return copies.every((copy) => copy.topics) ? [] : undefined;
}

function mergeDuplicateSkills(skills: readonly PlanGraphSkill[]): PlanGraphSkill[] {
  return skills
    .filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    )
    .map(({ outlined: _outlined, topics: _topics, ...skill }) => {
      const same = skills.filter((other) => other.skillId === skill.skillId);
      const courseIds = same.flatMap((other) => other.courseIds ?? []);
      const topics = mergeTopics(same);
      const outcome = same.some((other) => other.outcome);
      const outlined = same.every((other) => other.outlined);

      return {
        ...skill,
        courseIds: [...new Set(courseIds)],
        ...(outcome ? { outcome } : {}),
        ...(outlined ? { outlined } : {}),
        ...(topics && (topics.length > 0 || outlined) ? { topics } : {}),
      };
    });
}

export function toGoalPlanGraph({
  courseIdsByKey,
  graph,
  idsByKey,
}: {
  courseIdsByKey: Readonly<Record<string, string>>;
  graph: PlannedSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
}): PlanGraph {
  const courseTitles = new Map(graph.courses.map((course) => [course.key, course.title]));

  const skills = graph.skills.flatMap((skill) => {
    const skillId = idsByKey[skill.key];
    const courseId = courseIdsByKey[skill.course];

    if (!skillId) {
      return [];
    }

    return [
      {
        area: skill.area || (courseTitles.get(skill.course) ?? null),
        courseIds: courseId ? [courseId] : [],
        lessons: skill.estimatedLessons,
        name: skill.name,
        ...(skill.outcome ? { outcome: true } : {}),
        ...(skill.outlined ? { outlined: true } : {}),
        phase: Math.max(0, skill.phase - 1),
        skillId,
        topics: skill.topicsUnknown ? undefined : skill.topics,
        weight: skill.examWeight,
      },
    ];
  });

  return {
    ...(graph.courseOutline && { courseOutline: graph.courseOutline }),
    phases: graph.phases.map((phase) => ({ milestone: phase.milestone, name: phase.title })),
    skills: mergeDuplicateSkills(skills),
  };
}
