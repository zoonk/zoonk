import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { LEGACY_COVERAGE_LESSONS } from "./legacy-exam-estimates";
import { type GoalSkillGraph } from "./save-goal-skills";

export type PlannedSkillGraph = Omit<GoalSkillGraph, "extraSkills" | "skills"> & {
  courseOutline?: PlanGraph["courseOutline"];
  extraSkills?: PlannedSkill[];
  skills: PlannedSkill[];
};

type PlannedSkill = GoalSkillGraph["skills"][number] & {
  legacyEstimate?: boolean;
  outlined?: boolean;
  topicsUnknown?: boolean;
};

export function getSinglePlanCourseId({ skills, optionSkills = [] }: PlanGraph): string | null {
  const all = [...skills, ...optionSkills];
  const id = all[0]?.courseIds?.[0];

  return id && all.every(({ courseIds }) => courseIds?.length === 1 && courseIds[0] === id)
    ? id
    : null;
}

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
        ...(topics ? { topics } : {}),
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

  const toPlanSkills = (skills: readonly PlannedSkill[]) =>
    skills.flatMap((skill) => {
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
          ...(skill.estimatedLessons === LEGACY_COVERAGE_LESSONS &&
            !skill.legacyEstimate && { sizedEstimate: true as const }),
          topics: skill.topicsUnknown && skill.topics.length === 0 ? undefined : skill.topics,
          weight: skill.examWeight,
        },
      ];
    });

  const skills = mergeDuplicateSkills(toPlanSkills(graph.skills));
  const ids = new Set(skills.map((skill) => skill.skillId));

  const extras = mergeDuplicateSkills(toPlanSkills(graph.extraSkills ?? [])).filter(
    (skill) => !ids.has(skill.skillId),
  );

  return {
    ...(graph.courseOutline && { courseOutline: graph.courseOutline }),
    ...(extras.length > 0 && { extraSkills: extras }),
    phases: graph.phases.map((phase) => ({ milestone: phase.milestone, name: phase.title })),
    skills,
  };
}
