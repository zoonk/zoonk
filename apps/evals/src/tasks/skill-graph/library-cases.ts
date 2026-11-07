import { type LibrarySkill, type SkillGraphParams } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { normalizeString } from "@zoonk/utils/string";

/** Skills other exams use in a course, named by its title: the frame picks its own course keys. */
export type LibraryCourse = { courseTitle: string; skills: Omit<LibrarySkill, "course">[] };

export type SkillGraphCase = Omit<SkillGraphParams, "findLibrarySkills"> & {
  library?: LibraryCourse[];
};

/**
 * Library skills the graph must reuse and those it must not (another jurisdiction's law), and the
 * courses it must have, each as the catalog titles accepted for one discipline.
 */
export type SkillGraphExpected = { courses?: string[][]; noReuse?: string[]; reuse?: string[] };

function isSameCourse(first: string, second: string): boolean {
  const [a, b] = [normalizeString(first), normalizeString(second)];
  return a.includes(b) || b.includes(a);
}

/** The frame's course that a library course is, the way course identity would find it. */
export function toLibraryLookup(
  library: readonly LibraryCourse[],
): SkillGraphParams["findLibrarySkills"] {
  return async ({ courses }) => ({
    courses: [],
    skills: library.flatMap(({ courseTitle, skills }) => {
      const course = courses.find((item) => isSameCourse(item.title, courseTitle));
      return course ? skills.map((skill) => ({ ...skill, course: course.key })) : [];
    }),
  });
}
