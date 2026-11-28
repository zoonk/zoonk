import { COURSE_LEVELS, type CourseLevel } from "./course-levels";
import { type CheckedGraphSkill, type SkillGraphProblem } from "./skill-graph-checks";

/** A path written one band at a time leaves the later bands to the paths that continue it. */
export function findPastCourseLevel({
  courseLevel,
  skills,
}: {
  courseLevel?: CourseLevel;
  skills: readonly CheckedGraphSkill[];
}): SkillGraphProblem[] {
  const last = courseLevel ? COURSE_LEVELS.indexOf(courseLevel) : COURSE_LEVELS.length;
  const past = skills.filter((skill) => skill.level && COURSE_LEVELS.indexOf(skill.level) > last);

  return past.length > 0
    ? [
        {
          code: "pastCourseLevel",
          keys: past.map((skill) => skill.key),
          problem: `Skills past the ${courseLevel} band this path teaches: ${past.map((skill) => skill.name).join(", ")}.`,
        },
      ]
    : [];
}
