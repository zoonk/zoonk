import { type CourseLevel } from "@zoonk/db";
import {
  type CourseBandNeed,
  type CourseOutlineNeed,
  type CurriculumScope,
  type GoalSkillRef,
  toExamSkillAreas,
} from "./curriculum-scope";
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
    const position = graph.skills.findIndex((skill) => skill.course === course.key);

    return position === -1 ? [] : [{ key: course.key, position, title: course.title }];
  });

  return courses
    .toSorted((a, b) => a.position - b.position)
    .map(({ key, title }) => ({ key, title }));
}

export function toGoalCourses({
  courseIdsByKey,
  graph,
  idsByKey,
  needs,
  scope,
  withToolChapters,
}: {
  courseIdsByKey: Readonly<Record<string, string>>;
  graph: GoalSkillGraph;
  idsByKey: Readonly<Record<string, string>>;
  needs: readonly GoalCourseNeed[];
  scope: CurriculumScope;
  withToolChapters: boolean;
}): CourseOutlineNeed[] {
  const areas = toExamSkillAreas({
    scope,
    skills: graph.skills.flatMap((skill) => {
      const skillId = idsByKey[skill.key];
      return skillId ? [{ area: skill.area, skillId }] : [];
    }),
  });

  return needs.flatMap((need) => {
    const courseId = courseIdsByKey[need.key];
    const bands = scope.ownerId ? mergePrivateBands(need).bands : need.bands;

    if (!courseId) {
      return [];
    }

    return [
      { bands: bands.map((band) => ({ ...band, withToolChapters })), courseId, scope, ...areas },
    ];
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
