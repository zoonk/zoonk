import { type PlanGraph } from "../planner/plan-state";

export type SkillCourses = ReadonlyMap<string, readonly string[]>;

export function getSkillCourses(graph: PlanGraph): SkillCourses {
  return new Map(
    graph.skills.flatMap((skill) =>
      skill.courseIds && skill.courseIds.length > 0
        ? [[skill.skillId, skill.courseIds] as const]
        : [],
    ),
  );
}

export function pickSkillPlaces<T>({
  getCourseIds,
  places,
  skillCourses,
  skillId,
}: {
  getCourseIds: (place: T) => readonly string[];
  places: readonly T[];
  skillCourses: SkillCourses;
  skillId: string;
}): T[] | null {
  const courses = skillCourses.get(skillId);

  if (!courses) {
    return [...places];
  }

  const inCourses = places.filter((place) =>
    getCourseIds(place).some((courseId) => courses.includes(courseId)),
  );

  return inCourses.length > 0 ? inCourses : null;
}
