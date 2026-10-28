import "server-only";
import { prisma } from "@zoonk/db";
import { type LibrarySource, readChapterTitles } from "../../../learner/_utils/plan-library-rows";
import {
  getCourseCardRows,
  getLessonSkillRows,
  toIdKey,
} from "../../../library/_utils/shared-rows";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { type PlanGraph } from "../../../plans/planner/plan-state";
import { type AreaCourse, type SyllabusItem } from "./syllabus-input";

/** Each area's Library course, from the first of its skills that names one. */
export async function loadAreaCourses(
  graph: PlanGraph,
  from: LibrarySource = prisma,
): Promise<Map<string, AreaCourse>> {
  const areaCourseIds = new Map(
    graph.skills
      .flatMap((skill) => {
        const courseId = skill.courseIds?.[0];
        return courseId ? [[getSkillArea({ graph, skill }), courseId] as const] : [];
      })
      .toReversed(),
  );

  const courseIds = [...new Set(areaCourseIds.values())];

  const courses =
    from === "shared"
      ? await getCourseCardRows(toIdKey(courseIds))
      : await from.course.findMany({
          select: { id: true, imageUrl: true, title: true },
          where: { id: { in: courseIds } },
        });

  const byId = new Map(courses.map((course) => [course.id, course]));

  return new Map(
    [...areaCourseIds].flatMap(([area, courseId]) => {
      const course = byId.get(courseId);
      return course ? [[area, { imageUrl: course.imageUrl, title: course.title }] as const] : [];
    }),
  );
}

type ContentSkill = { id: string; skillId: string };

function groupSkills(rows: readonly ContentSkill[]): Map<string, string[]> {
  return new Map(
    [...Map.groupBy(rows, (row) => row.id)].map(([id, group]) => [
      id,
      group.map((row) => row.skillId),
    ]),
  );
}

/**
 * The skills these lessons teach, oldest first. A GET reads the shared rows of every lesson in the
 * plan, the same entry the skill projection reads, and keeps these.
 */
async function loadLessonSkills({
  from,
  lessonIds,
  planLessonIds,
}: {
  from: LibrarySource;
  lessonIds: readonly string[];
  planLessonIds: readonly string[];
}) {
  if (from === "shared") {
    const wanted = new Set(lessonIds);
    const rows = await getLessonSkillRows(toIdKey(planLessonIds));
    return rows.filter((row) => wanted.has(row.lessonId));
  }

  return lessonIds.length > 0
    ? from.lessonSkill.findMany({
        orderBy: { createdAt: "asc" },
        select: { lessonId: true, skillId: true },
        where: { lessonId: { in: [...lessonIds] } },
      })
    : [];
}

/**
 * The skills a lesson or a chapter teaches, by lesson or chapter, oldest first. A chapter's skills
 * change under its id (an outline links them later), so they're always read fresh.
 */
async function loadContentSkills(items: readonly SyllabusItem[], from: LibrarySource) {
  const unknown = items.filter((item) => !item.skillId);
  const lessonIds = unknown.flatMap((item) => item.lessonId ?? []);
  const chapterIds = unknown.flatMap((item) => (item.lessonId ? [] : (item.chapterId ?? [])));
  const planLessonIds = items.flatMap((item) => item.lessonId ?? []);

  const [lessonRows, chapterRows] = await Promise.all([
    loadLessonSkills({ from, lessonIds, planLessonIds }),
    chapterIds.length > 0
      ? prisma.chapterSkill.findMany({
          orderBy: { createdAt: "asc" },
          select: { chapterId: true, skillId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [],
  ]);

  return {
    chapters: groupSkills(chapterRows.map((row) => ({ id: row.chapterId, skillId: row.skillId }))),
    lessons: groupSkills(lessonRows.map((row) => ({ id: row.lessonId, skillId: row.skillId }))),
  };
}

function getCandidates({
  item,
  skills,
}: {
  item: SyllabusItem;
  skills: Awaited<ReturnType<typeof loadContentSkills>>;
}): string[] {
  if (item.lessonId) {
    return skills.lessons.get(item.lessonId) ?? [];
  }

  return item.chapterId ? (skills.chapters.get(item.chapterId) ?? []) : [];
}

/**
 * Lessons and chapters saved without their skill take the one they teach that the plan's graph
 * has (else their first), so they still count for a subject.
 */
export async function withSkills({
  from,
  graphSkillIds,
  items,
}: {
  from: LibrarySource;
  graphSkillIds: ReadonlySet<string>;
  items: readonly SyllabusItem[];
}): Promise<SyllabusItem[]> {
  if (items.every((item) => item.skillId)) {
    return [...items];
  }

  const skills = await loadContentSkills(items, from);

  const pickSkill = (item: SyllabusItem): string | null => {
    const candidates = getCandidates({ item, skills });
    return candidates.find((skillId) => graphSkillIds.has(skillId)) ?? candidates[0] ?? null;
  };

  return items.map((item) => (item.skillId ? item : { ...item, skillId: pickSkill(item) }));
}

export async function loadChapterTitles(
  items: readonly SyllabusItem[],
  from: LibrarySource,
): Promise<Map<string, string>> {
  const chapterIds = [...new Set(items.flatMap((item) => item.chapterId ?? []))];
  const chapters = await readChapterTitles(chapterIds, from);

  return new Map(chapters.map((chapter) => [chapter.id, chapter.title]));
}
