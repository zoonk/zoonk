import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getCourseRouteCacheTag,
  getLibraryChapterCacheTag,
  getLibraryLessonCacheTag,
} from "../../../cache/tags";
import { lockPlanSourceWrite } from "../../../library/_utils/plan-input-write";
import { getChapterCacheTags } from "../../../library/chapters/chapter-cache-tags";
import { type StoredChange } from "../contract";
import { type FixContext } from "../handlers/fix-handler";
import { findStoredHandler } from "../handlers/registry";
import { type FixUnit } from "./resolved-change";

const UNIT_TABLES = {
  chapter: sql`library_chapters`,
  course: sql`courses`,
  item: sql`items`,
  lesson: sql`library_lessons`,
} as const;

/**
 * Lessons are locked before their screens, as publishing a version does, and rows in table and id
 * order, so two approvals and a publication never wait on each other in a cycle.
 */
export async function lockFixRows(
  tx: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: FixUnit },
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM ${UNIT_TABLES[unit.kind]} WHERE id = ${unit.id}::uuid FOR NO KEY UPDATE`;

  const rows = changes.map((change) => findStoredHandler(change).lockRows(change));
  const tables = [...new Map(rows.map((row) => [row.table.sql, row.table])).entries()];

  for (const [name, table] of tables.toSorted(([left], [right]) => left.localeCompare(right))) {
    const ids = [
      ...new Set(rows.filter((row) => row.table.sql === name).flatMap((row) => row.ids)),
    ];

    // oxlint-disable-next-line no-await-in-loop -- tables lock one after another, in a fixed order
    await tx.$queryRaw`SELECT id FROM ${table} WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR NO KEY UPDATE`;
  }
}

export async function lockFixPlans(
  tx: TransactionClient,
  changes: readonly StoredChange[],
): Promise<void> {
  const roots = changes.map((change) => findStoredHandler(change).planRoots(change));
  const itemIds = [...new Set(roots.flatMap((root) => root.itemIds ?? []))];
  const chapterIds = [...new Set(roots.flatMap((root) => root.chapterIds ?? []))];
  const lessonIds = [...new Set(roots.flatMap((root) => root.lessonIds ?? []))];

  if (itemIds.length === 0 && chapterIds.length === 0 && lessonIds.length === 0) {
    return;
  }

  const items =
    itemIds.length > 0
      ? await tx.item.findMany({
          select: { examBlueprintId: true, skillId: true },
          where: { id: { in: itemIds } },
        })
      : [];

  await lockPlanSourceWrite(tx, {
    blueprintIds: [...new Set(items.flatMap((item) => item.examBlueprintId ?? []))],
    chapterIds,
    lessonIds,
    skillIds: [...new Set(items.map((item) => item.skillId))],
  });
}

/**
 * Writes exactly the prepared changes. Every fix under a lesson moves its `updatedAt`, which the
 * lesson player reads as the lesson's version in every app.
 */
export async function applyFixChanges(
  tx: TransactionClient,
  {
    changes,
    context,
    unit,
  }: { changes: readonly StoredChange[]; context: FixContext; unit: FixUnit },
): Promise<void> {
  for (const change of changes) {
    // oxlint-disable-next-line no-await-in-loop -- writes share one transaction's connection
    await findStoredHandler(change).apply(tx, change, context);
  }

  if (unit.kind === "lesson") {
    await tx.lesson.update({ data: { updatedAt: context.now }, where: { id: unit.id } });
  }
}

async function lessonCacheTags(lessonId: string): Promise<string[]> {
  const chapters = await prisma.chapterLesson.findMany({
    select: { chapter: { select: { courses: { select: { courseId: true } } } }, chapterId: true },
    where: { lessonId },
  });

  return [
    getLibraryLessonCacheTag(lessonId),
    ...chapters.map((chapter) => getLibraryChapterCacheTag(chapter.chapterId)),
    ...chapters.flatMap((chapter) =>
      chapter.chapter.courses.map((course) => getCourseCurriculumCacheTag(course.courseId)),
    ),
  ];
}

async function courseCacheTags(courseId: string): Promise<string[]> {
  const course = await prisma.course.findUnique({
    select: { organization: { select: { slug: true } }, slug: true },
    where: { id: courseId },
  });

  const brandSlug = course?.organization?.slug;

  return [
    getCourseCacheTag(courseId),
    getCourseCurriculumCacheTag(courseId),
    COURSE_LIST_CACHE_TAG,
    ...(course && brandSlug
      ? [getCourseRouteCacheTag({ brandSlug, courseSlug: course.slug })]
      : []),
  ];
}

/** The cached reads in every app that show what a fix of `unit` changes. */
export async function getFixCacheTags(unit: FixUnit): Promise<string[]> {
  if (unit.kind === "lesson") {
    return [...new Set(await lessonCacheTags(unit.id))];
  }

  if (unit.kind === "chapter") {
    return getChapterCacheTags(unit.id);
  }

  return unit.kind === "course" ? courseCacheTags(unit.id) : [];
}
