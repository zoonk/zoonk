import { type CourseLevel } from "@zoonk/db";
import { type CourseBandNeed, type GoalSkillRef } from "./curriculum-scope";
import { type GoalSkillGraph } from "./save-goal-skills";

/** One course a goal needs, with the level bands it must outline and the goal's skills in each. */
export type GoalCourseNeed = {
  key: string;
  title: string;
  /** The earliest phase any of its skills sits in, so the learner's first course is outlined first. */
  firstPhase: number;
  bands: (CourseBandNeed & { firstPhase: number })[];
};

type GraphSkill = GoalSkillGraph["skills"][number];

function toSkillRef({
  idsByKey,
  skill,
}: {
  idsByKey: Readonly<Record<string, string>>;
  skill: GraphSkill;
}): GoalSkillRef[] {
  const id = idsByKey[skill.key];
  return id ? [{ description: skill.description, id, key: skill.key, name: skill.name }] : [];
}

function toBand({
  idsByKey,
  level,
  skills,
}: {
  idsByKey: Readonly<Record<string, string>>;
  level: CourseLevel;
  skills: readonly GraphSkill[];
}) {
  const bandSkills = skills.filter((skill) => skill.level === level);

  return {
    firstPhase: Math.min(...bandSkills.map((skill) => skill.phase)),
    level,
    skills: bandSkills.flatMap((skill) => toSkillRef({ idsByKey, skill })),
  };
}

/**
 * Groups a goal's skills by the course and level band that teaches them, in the order the
 * learner reaches them: the course and band holding the first phase's skills come first, so
 * their outline is written while the learner is still in onboarding. Bands without a skill the
 * Library resolved are left out.
 */
export function groupGoalCourseBands({
  graph,
  idsByKey,
}: {
  graph: GoalSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
}): GoalCourseNeed[] {
  const courses = graph.courses.flatMap((course) => {
    const skills = graph.skills.filter((skill) => skill.course === course.key);
    const levels = [...new Set(skills.map((skill) => skill.level))];

    const bands = levels
      .map((level) => toBand({ idsByKey, level, skills }))
      .filter((band) => band.skills.length > 0)
      .toSorted((a, b) => a.firstPhase - b.firstPhase);

    const [first] = bands;

    return first
      ? [{ bands, firstPhase: first.firstPhase, key: course.key, title: course.title }]
      : [];
  });

  return courses.toSorted((a, b) => a.firstPhase - b.firstPhase);
}

/**
 * A private course has no levels: one band, at the level where its first skills sit, holds every
 * skill the goal needs from it.
 */
function mergePrivateBands(need: GoalCourseNeed): GoalCourseNeed {
  const [first] = need.bands;

  if (!first) {
    return need;
  }

  return { ...need, bands: [{ ...first, skills: need.bands.flatMap((band) => band.skills) }] };
}

/**
 * The courses a goal's skill graph names, in the order the learner reaches them (the phase of each
 * one's first skill), so the first is the goal's main course. Courses without skills are left out.
 * It needs only the graph, so the Library courses are found while the skills are.
 */
export function orderGoalCourses(graph: GoalSkillGraph): { key: string; title: string }[] {
  const courses = graph.courses.flatMap((course) => {
    const phases = graph.skills
      .filter((skill) => skill.course === course.key)
      .map((skill) => skill.phase);

    return phases.length > 0
      ? [{ firstPhase: Math.min(...phases), key: course.key, title: course.title }]
      : [];
  });

  return courses
    .toSorted((a, b) => a.firstPhase - b.firstPhase)
    .map(({ key, title }) => ({ key, title }));
}

/**
 * Each course need with the Library course found for its graph course, in the needs' order. A
 * private course has one band with every skill.
 */
export function toGoalCourses({
  courseIdsByKey,
  needs,
  ownerId,
}: {
  courseIdsByKey: Readonly<Record<string, string>>;
  needs: readonly GoalCourseNeed[];
  ownerId: string | null;
}): { bands: CourseBandNeed[]; courseId: string }[] {
  return needs.flatMap((need) => {
    const courseId = courseIdsByKey[need.key];
    const bands = ownerId ? mergePrivateBands(need).bands : need.bands;

    return courseId ? [{ bands, courseId }] : [];
  });
}
