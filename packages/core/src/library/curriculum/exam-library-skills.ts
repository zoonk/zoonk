import "server-only";
import { type LibrarySkill } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { type CourseLevel, prisma } from "@zoonk/db";
import { findCourseByTitle } from "../identity/kinds/course-identity";
import { type CurriculumScope } from "./curriculum-scope";

type FrameCourse = { key: string; title: string };
type ExamScope = Pick<CurriculumScope, "language" | "ownerId" | "targetLanguage">;

/** A skill's size where another exam's graph places it; the largest when several do. */
async function listPlacedSkills({
  courseIds,
  examBlueprintId,
}: {
  courseIds: readonly string[];
  examBlueprintId: string;
}) {
  return prisma.$queryRaw<{ courseId: string; lessons: number; skillId: string }[]>`
    SELECT placed.course_id AS "courseId", entry->>'skillId' AS "skillId",
      MAX(COALESCE((entry->>'lessons')::int, 1)) AS lessons
    FROM exam_skill_graphs AS graph
    CROSS JOIN LATERAL jsonb_array_elements(graph.graph->'skills') AS entry
    CROSS JOIN LATERAL jsonb_array_elements_text(entry->'courseIds') AS placed(course_id)
    WHERE graph.exam_blueprint_id <> ${examBlueprintId}::uuid
      AND placed.course_id = ANY(${[...courseIds]}::text[])
    GROUP BY placed.course_id, entry->>'skillId'
    ORDER BY MIN(graph.created_at), placed.course_id, entry->>'skillId'
  `;
}

const FALLBACK_LEVEL: CourseLevel = "intermediate";

/**
 * The public skills other exams' graphs place in these courses: only what a current graph uses, so
 * an exam builds on how other exams cut a subject, not on content no exam plans from anymore.
 */
export async function loadExamLibrarySkills({
  courseIds,
  examBlueprintId,
  language,
}: {
  courseIds: readonly string[];
  examBlueprintId: string;
  language: string;
}): Promise<(Omit<LibrarySkill, "course"> & { courseId: string })[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const placed = await listPlacedSkills({ courseIds, examBlueprintId });
  const skillIds = [...new Set(placed.map((entry) => entry.skillId))];

  const [skills, links] = await Promise.all([
    prisma.skill.findMany({
      where: {
        id: { in: skillIds },
        language,
        mergedIntoId: null,
        targetLanguage: null,
        visibility: "public",
      },
    }),
    prisma.skillPrerequisite.findMany({ where: { skillId: { in: skillIds } } }),
  ]);

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

/**
 * Internal workflow bridge: what other exams teach in the frame's courses, read before its skills
 * are written. It runs inside the graph's step, so it only reads: it finds a course by its catalog
 * title, as saving the graph does first, and a course no exam has yet holds nothing to reuse.
 */
export async function findExamLibrary({
  courses,
  examBlueprintId,
  scope,
}: {
  courses: readonly FrameCourse[];
  examBlueprintId: string;
  scope: ExamScope;
}): Promise<LibrarySkill[]> {
  const found = await Promise.all(
    courses.map(async (course) => {
      const row = await findCourseByTitle({ ...scope, title: course.title });
      return row ? [{ courseId: row.id, key: course.key }] : [];
    }),
  );

  const keyByCourseId = new Map(
    found
      .flat()
      .toReversed()
      .map((course) => [course.courseId, course.key]),
  );

  const skills = await loadExamLibrarySkills({
    courseIds: [...keyByCourseId.keys()],
    examBlueprintId,
    language: scope.language,
  });

  return skills.map(({ courseId, ...skill }) => ({
    ...skill,
    course: keyByCourseId.get(courseId) ?? "",
  }));
}
