import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getCourseRouteCacheTag,
  getExamBlueprintCacheTag,
  getLibraryChapterCacheTag,
  getLibraryLessonCacheTag,
  getMediaAssetCacheTag,
  getSkillCacheTag,
  getSourceCacheTag,
} from "../../../cache/tags";
import {
  lockPlanBlueprintWrite,
  lockPlanSourceWrite,
} from "../../../library/_utils/plan-input-write";
import { getChapterCacheTags } from "../../../library/chapters/chapter-cache-tags";
import { type StoredChange } from "../contract";
import { type FixContext } from "../handlers/fix-handler";
import { findStoredHandler } from "../handlers/registry";
import { type FixUnit } from "./resolved-change";
import { applyVocabularyUnit, findLessonsShowing, isVocabularyUnit } from "./vocabulary-unit";

const UNIT_TABLES = {
  chapter: sql`library_chapters`,
  course: sql`courses`,
  examBlueprint: sql`exam_blueprints`,
  examSkillGraph: sql`exam_skill_graphs`,
  item: sql`items`,
  itemSet: sql`item_sets`,
  languageSkillGraph: sql`language_skill_graphs`,
  lesson: sql`library_lessons`,
  levelTest: sql`language_level_tests`,
  mediaAsset: sql`media_assets`,
  organization: sql`organizations`,
  product: sql`products`,
  sentence: sql`sentences`,
  skill: sql`skills`,
  source: sql`sources`,
  warmUp: sql`warm_ups`,
  word: sql`words`,
} as const;

/**
 * Lessons are locked before their screens, as publishing a version does, and rows in table and id
 * order, so two approvals and a publication never wait on each other in a cycle.
 */
export async function lockFixRows(
  tx: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: FixUnit },
): Promise<void> {
  const chapterCollections = changes.every(
    (change) => change.model === "Chapter" && change.op === "setLessons",
  );

  if (!chapterCollections) {
    await tx.$queryRaw`SELECT id FROM ${UNIT_TABLES[unit.kind]} WHERE id = ${unit.id}::uuid FOR NO KEY UPDATE`;
  }

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
  const courseIds = [...new Set(roots.flatMap((root) => root.courseIds ?? []))];
  const itemIds = [...new Set(roots.flatMap((root) => root.itemIds ?? []))];
  const chapterIds = [...new Set(roots.flatMap((root) => root.chapterIds ?? []))];
  const lessonIds = [...new Set(roots.flatMap((root) => root.lessonIds ?? []))];

  const skillIds = roots.flatMap((root) => root.skillIds ?? []);
  const blueprintIds = roots.flatMap((root) => root.blueprintIds ?? []);

  if (
    courseIds.length === 0 &&
    itemIds.length === 0 &&
    chapterIds.length === 0 &&
    lessonIds.length === 0 &&
    skillIds.length === 0 &&
    blueprintIds.length === 0
  ) {
    return;
  }

  const items =
    itemIds.length > 0
      ? await tx.item.findMany({
          select: { examBlueprintId: true, skillId: true },
          where: { id: { in: itemIds } },
        })
      : [];

  const [blueprintId] = blueprintIds;

  if (blueprintId && changes.every((change) => change.model === "ExamSkillGraph")) {
    await lockPlanBlueprintWrite(tx, blueprintId);
    return;
  }

  await lockPlanSourceWrite(tx, {
    blueprintIds: [
      ...new Set([...blueprintIds, ...items.flatMap((item) => item.examBlueprintId ?? [])]),
    ],
    chapterIds,
    courseIds,
    lessonIds,
    skillIds: [...new Set([...skillIds, ...items.map((item) => item.skillId)])],
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

  if (isVocabularyUnit(unit)) {
    await applyVocabularyUnit(tx, { changes, context, unit });
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
  if (unit.kind === "examSkillGraph" || unit.kind === "languageSkillGraph") {
    return [];
  }

  if (unit.kind === "source") {
    const [steps, lessons, blueprints] = await Promise.all([
      prisma.step.findMany({
        select: { lessonId: true },
        where: { OR: [{ sourceId: unit.id }, { sources: { some: { sourceId: unit.id } } }] },
      }),
      prisma.lessonSource.findMany({ select: { lessonId: true }, where: { sourceId: unit.id } }),
      prisma.examBlueprint.findMany({ select: { id: true }, where: { sourceId: unit.id } }),
    ]);

    const tags = await Promise.all(
      [...new Set([...steps, ...lessons].map((row) => row.lessonId))].map((id) =>
        lessonCacheTags(id),
      ),
    );

    return [
      ...new Set([
        getSourceCacheTag(unit.id),
        ...tags.flat(),
        ...blueprints.map((row) => getExamBlueprintCacheTag(row.id)),
      ]),
    ];
  }

  if (unit.kind === "skill") {
    return [getSkillCacheTag(unit.id)];
  }

  if (unit.kind === "mediaAsset") {
    return [getMediaAssetCacheTag(unit.id)];
  }

  if (unit.kind === "examBlueprint") {
    return [getExamBlueprintCacheTag(unit.id)];
  }

  if (unit.kind === "warmUp") {
    return [`warm-up:${unit.id}`];
  }

  if (unit.kind === "lesson") {
    return [...new Set(await lessonCacheTags(unit.id))];
  }

  if (isVocabularyUnit(unit)) {
    const lessonIds = await findLessonsShowing(prisma, unit);
    const tags = await Promise.all(lessonIds.map((id) => lessonCacheTags(id)));
    return [...new Set(tags.flat())];
  }

  if (unit.kind === "chapter") {
    return getChapterCacheTags(unit.id);
  }

  if (unit.kind === "organization") {
    const courses = await prisma.course.findMany({
      select: { id: true },
      where: { organizationId: unit.id },
    });

    const tags = await Promise.all(courses.map((course) => courseCacheTags(course.id)));
    return [...new Set([COURSE_LIST_CACHE_TAG, ...tags.flat()])];
  }

  return unit.kind === "course" ? courseCacheTags(unit.id) : [];
}
