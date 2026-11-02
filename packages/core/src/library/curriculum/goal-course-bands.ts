import { type CourseLevel } from "@zoonk/db";
import { type CourseBandNeed, type GoalSkillRef } from "./curriculum-scope";
import { type GoalSkillGraph } from "./save-goal-skills";

export type GoalCourseNeed = {
  key: string;
  title: string;
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

  return id
    ? [
        {
          area: skill.area,
          description: skill.description,
          id,
          key: skill.key,
          lessons: skill.estimatedLessons,
          name: skill.name,
        },
      ]
    : [];
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

function mergePrivateBands(need: GoalCourseNeed): GoalCourseNeed {
  const [first] = need.bands;

  if (!first) {
    return need;
  }

  return { ...need, bands: [{ ...first, skills: need.bands.flatMap((band) => band.skills) }] };
}

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

export function toGoalCourses({
  courseIdsByKey,
  needs,
  ownerId,
  withToolChapters,
}: {
  courseIdsByKey: Readonly<Record<string, string>>;
  needs: readonly GoalCourseNeed[];
  ownerId: string | null;
  withToolChapters: boolean;
}): { bands: CourseBandNeed[]; courseId: string }[] {
  return needs.flatMap((need) => {
    const courseId = courseIdsByKey[need.key];
    const bands = ownerId ? mergePrivateBands(need).bands : need.bands;

    return courseId
      ? [{ bands: bands.map((band) => ({ ...band, withToolChapters })), courseId }]
      : [];
  });
}

export function keepNearCourseBands({
  nearSkillIds,
  needs,
}: {
  nearSkillIds: ReadonlySet<string>;
  needs: readonly GoalCourseNeed[];
}): GoalCourseNeed[] {
  return needs.flatMap((need) => {
    const bands = need.bands.filter((band) =>
      band.skills.some((skill) => nearSkillIds.has(skill.id)),
    );

    return bands.length > 0 ? [{ ...need, bands }] : [];
  });
}
