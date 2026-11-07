import "server-only";
import { type ExamLibrary, type LibrarySkill } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { type CourseLevel, prisma } from "@zoonk/db";
import { CHALLENGE_LESSON_KEY_SQL_PATTERN } from "../challenges/challenge-lesson-spec";
import { findSurvivingSkill } from "../skills/_utils/find-surviving-skill";

async function listExamSkillIds({
  examBlueprintId,
  language,
}: {
  examBlueprintId: string;
  language: string;
}) {
  const skills = await prisma.skill.findMany({
    where: {
      items: { some: { examBlueprintId, language, retiredAt: null } },
      language,
      targetLanguage: null,
      visibility: "public",
    },
  });

  const survivors = await Promise.all(
    skills.map((skill) =>
      skill.mergedIntoId ? findSurvivingSkill(skill.mergedIntoId) : Promise.resolve({ skill }),
    ),
  );

  return [...new Set(survivors.flatMap((result) => (result ? [result.skill.id] : [])))];
}

async function listCourseSkills({
  courseIds = [],
  examBlueprintId,
  language,
  skillIds = [],
}: {
  courseIds?: readonly string[];
  examBlueprintId: string;
  language: string;
  skillIds?: readonly string[];
}) {
  return prisma.$queryRaw<{ courseId: string; lessons: number; skillId: string }[]>`
    WITH chapter_courses AS (
      SELECT id AS chapter_id, home_course_id AS course_id FROM library_chapters
      WHERE home_course_id IS NOT NULL
      UNION
      SELECT chapter_id, course_id FROM course_chapters
    ), chapter_teaching AS (
      SELECT link.skill_id, placement.course_id, chapter.id AS chapter_id
      FROM chapter_skills AS link
      JOIN library_chapters AS chapter ON chapter.id = link.chapter_id
      JOIN chapter_courses AS placement ON placement.chapter_id = chapter.id
      WHERE chapter.visibility = 'public' AND chapter.language = ${language}
        AND chapter.target_language IS NULL
    ), taught AS (
      SELECT chapter.skill_id, chapter.course_id, lesson.id AS lesson_id
      FROM chapter_teaching AS chapter
      LEFT JOIN chapter_lessons AS placement ON placement.chapter_id = chapter.chapter_id
      LEFT JOIN library_lessons AS lesson ON lesson.id = placement.lesson_id
        AND lesson.visibility = 'public' AND lesson.set_aside_at IS NULL
        AND lesson.language = ${language} AND lesson.target_language IS NULL
        AND lesson.identity_key !~ ${CHALLENGE_LESSON_KEY_SQL_PATTERN}
      WHERE (chapter.course_id = ANY(${[...courseIds]}::uuid[]) AND lesson.id IS NOT NULL)
        OR chapter.skill_id = ANY(${[...skillIds]}::uuid[])
      UNION ALL
      SELECT link.skill_id, placement.course_id, lesson.id
      FROM lesson_skills AS link
      JOIN library_lessons AS lesson ON lesson.id = link.lesson_id
      JOIN chapter_lessons ON chapter_lessons.lesson_id = lesson.id
      JOIN library_chapters AS chapter ON chapter.id = chapter_lessons.chapter_id
      JOIN chapter_courses AS placement ON placement.chapter_id = chapter.id
      WHERE lesson.visibility = 'public' AND lesson.set_aside_at IS NULL
        AND lesson.language = ${language}
        AND lesson.target_language IS NULL
        AND chapter.visibility = 'public' AND chapter.language = ${language}
        AND chapter.target_language IS NULL
        AND link.skill_id = ANY(${[...skillIds]}::uuid[])
    ), memberships AS (
      SELECT skill_id::text, course_id::text,
        GREATEST(COUNT(DISTINCT lesson_id), 1)::int AS lessons, false AS is_placed
      FROM taught GROUP BY skill_id, course_id
      UNION ALL
      SELECT entry->>'skillId', placed.course_id, COALESCE((entry->>'lessons')::int, 1), true
      FROM exam_skill_graphs AS graph
      CROSS JOIN LATERAL jsonb_array_elements(graph.graph->'skills') AS entry
      CROSS JOIN LATERAL jsonb_array_elements_text(entry->'courseIds') AS placed(course_id)
      WHERE graph.exam_blueprint_id <> ${examBlueprintId}::uuid
    )
    SELECT membership.course_id AS "courseId", membership.skill_id AS "skillId",
      COALESCE(MAX(membership.lessons) FILTER (WHERE membership.is_placed),
        MAX(membership.lessons)) AS lessons
    FROM memberships AS membership
    JOIN courses AS course ON course.id::text = membership.course_id
    WHERE course.visibility = 'public' AND course.language = ${language}
      AND course.target_language IS NULL
      AND (membership.course_id = ANY(${[...courseIds]}::text[])
        OR membership.skill_id = ANY(${[...skillIds]}::text[]))
    GROUP BY membership.course_id, membership.skill_id
    ORDER BY BOOL_OR(membership.course_id = ANY(${[...courseIds]}::text[])) DESC,
      BOOL_OR(membership.is_placed) DESC, membership.course_id, membership.skill_id
  `;
}

/** Every link from these skills down to the skills they build on, however deep. */
async function listPrerequisiteLinks(skillIds: readonly string[]) {
  return prisma.$queryRaw<{ prerequisiteId: string; skillId: string }[]>`
    WITH RECURSIVE reached(skill_id, prerequisite_id) AS (
      SELECT skill_id, prerequisite_id FROM skill_prerequisites
      WHERE skill_id = ANY(${[...skillIds]}::uuid[])
      UNION
      SELECT link.skill_id, link.prerequisite_id
      FROM skill_prerequisites AS link
      JOIN reached ON link.skill_id = reached.prerequisite_id
    )
    SELECT skill_id AS "skillId", prerequisite_id AS "prerequisiteId" FROM reached
  `;
}

const FALLBACK_LEVEL: CourseLevel = "intermediate";

/** Library teaching and exam placements share one pool, including prerequisites across courses. */
async function loadExamLibrarySkills({
  courseIds,
  examBlueprintId,
  language,
}: {
  courseIds: readonly string[];
  examBlueprintId: string;
  language: string;
}): Promise<(Omit<LibrarySkill, "course"> & { courseId: string })[]> {
  const skillIds = await listExamSkillIds({ examBlueprintId, language });

  if (courseIds.length === 0 && skillIds.length === 0) {
    return [];
  }

  const inCourses = await listCourseSkills({ courseIds, examBlueprintId, language, skillIds });
  const placedIds = new Set(inCourses.map((entry) => entry.skillId));
  const links = await listPrerequisiteLinks([...placedIds]);

  const foundations = [...new Set(links.map((link) => link.prerequisiteId))].filter(
    (id) => !placedIds.has(id),
  );

  const placed = [
    ...inCourses,
    ...(foundations.length > 0
      ? await listCourseSkills({ examBlueprintId, language, skillIds: foundations })
      : []),
  ];

  const skills = await prisma.skill.findMany({
    where: {
      id: { in: [...new Set(placed.map((entry) => entry.skillId))] },
      language,
      mergedIntoId: null,
      targetLanguage: null,
      visibility: "public",
    },
  });

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const seen = new Set<string>();

  return placed.flatMap((entry) => {
    const skill = byId.get(entry.skillId);

    if (!skill || seen.has(skill.id)) {
      return [];
    }

    seen.add(skill.id);

    return [
      {
        courseId: entry.courseId,
        description: skill.description,
        id: skill.id,
        lessons: entry.lessons,
        level: skill.level ?? FALLBACK_LEVEL,
        name: skill.name,
        prerequisiteIds: links
          .filter((link) => link.skillId === skill.id)
          .map((link) => link.prerequisiteId),
      },
    ];
  });
}

/** Internal workflow bridge: reads the same resolved courses that saving uses. */
export async function findExamLibrary({
  courseIdsByKey,
  examBlueprintId,
  language,
}: {
  courseIdsByKey: Readonly<Record<string, string>>;
  examBlueprintId: string;
  language: string;
}): Promise<ExamLibrary> {
  const keyByCourseId = new Map(
    Object.entries(courseIdsByKey)
      .toReversed()
      .map(([key, id]) => [id, key]),
  );

  const skills = await loadExamLibrarySkills({
    courseIds: [...keyByCourseId.keys()],
    examBlueprintId,
    language,
  });

  const outside = await prisma.course.findMany({
    select: { id: true, title: true },
    where: {
      id: { in: skills.flatMap(({ courseId }) => (keyByCourseId.has(courseId) ? [] : courseId)) },
    },
  });

  const keys = new Map([...keyByCourseId, ...outside.map(({ id }) => [id, id] as const)]);

  return {
    courseIdsByKey: { ...courseIdsByKey, ...Object.fromEntries(outside.map(({ id }) => [id, id])) },
    courses: outside.map(({ id, title }) => ({ key: id, title })),
    skills: skills.flatMap(({ courseId, ...skill }) => {
      const course = keys.get(courseId);
      return course ? [{ ...skill, course }] : [];
    }),
  };
}
