import { type PlanGraph } from "../planner/plan-state";

/**
 * The Library courses each plan skill's lessons come from. Skills are shared across courses, but
 * another subject's lessons for the same skill teach other content, so a listed skill is planned
 * only from its own courses' chapters. A skill that isn't listed (a setup skill, a prerequisite a
 * change added, a plan made before its courses were known) takes its lessons from any course.
 */
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

/**
 * The places (chapters, or a chapter's course placements) that may teach a skill in the plan:
 * every place for a skill without courses, else only those in its courses. Null when a skill with
 * courses has none here, so the lesson or chapter isn't planned for it.
 */
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
