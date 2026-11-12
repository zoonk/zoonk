import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
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
import { type FixUnit } from "./resolved-change";

const UNIT_TABLES = {
  chapter: sql`library_chapters`,
  course: sql`courses`,
  item: sql`items`,
  lesson: sql`library_lessons`,
} as const;

function idsOf(changes: readonly StoredChange[], model: StoredChange["model"]): string[] {
  return [
    ...new Set(changes.filter((change) => change.model === model).map((change) => change.id)),
  ];
}

/**
 * Lessons are locked before their screens, as publishing a version does, and rows in id order, so
 * two approvals and a publication never wait on each other in a cycle.
 */
export async function lockFixRows(
  tx: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: FixUnit },
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM ${UNIT_TABLES[unit.kind]} WHERE id = ${unit.id}::uuid FOR NO KEY UPDATE`;

  const rows = [
    { ids: idsOf(changes, "Step"), table: sql`library_steps` },
    { ids: idsOf(changes, "StepVariant"), table: sql`step_variants` },
    { ids: idsOf(changes, "AnswerExplanation"), table: sql`answer_explanations` },
  ].filter((entry) => entry.ids.length > 0);

  for (const { ids, table } of rows) {
    // oxlint-disable-next-line no-await-in-loop -- tables lock one after another, in a fixed order
    await tx.$queryRaw`SELECT id FROM ${table} WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR NO KEY UPDATE`;
  }
}

export async function lockFixPlans(
  tx: TransactionClient,
  changes: readonly StoredChange[],
): Promise<void> {
  const ids = idsOf(changes, "Item");
  const chapterIds = idsOf(changes, "Chapter");
  const lessonIds = idsOf(changes, "Lesson");

  if (ids.length === 0 && chapterIds.length === 0 && lessonIds.length === 0) {
    return;
  }

  const items =
    ids.length > 0
      ? await tx.item.findMany({
          select: { examBlueprintId: true, skillId: true },
          where: { id: { in: ids } },
        })
      : [];

  await lockPlanSourceWrite(tx, {
    blueprintIds: [...new Set(items.flatMap((item) => item.examBlueprintId ?? []))],
    chapterIds,
    lessonIds,
    skillIds: [...new Set(items.map((item) => item.skillId))],
  });
}

function textData(fields: readonly { after: unknown; field: string }[]) {
  const values = new Map(fields.map((field) => [field.field, field.after]));
  const title = values.get("title");
  const description = values.get("description");
  const summary = values.get("summary");

  return {
    ...(typeof title === "string" ? { normalizedTitle: normalizeString(title), title } : {}),
    ...(typeof description === "string" ? { description } : {}),
    ...(isJsonObject(summary) ? { summary } : {}),
  };
}

function clearedDescription(fields: readonly { after: unknown; field: string }[]) {
  return fields.some(({ after, field }) => field === "description" && after === null)
    ? { description: null }
    : {};
}

function contentOf(fields: readonly { after: unknown; field: string }[]) {
  const content = fields.find((field) => field.field === "content")?.after;

  if (!isJsonObject(content)) {
    throw new Error("A screen fix holds no content object");
  }

  return content;
}

function textOf(fields: readonly { after: unknown; field: string }[]): string {
  const text = fields.find((field) => field.field === "explanation")?.after;

  if (typeof text !== "string") {
    throw new TypeError("An explanation fix holds no text");
  }

  return text;
}

async function applyChange({
  change,
  now,
  tx,
}: {
  change: StoredChange;
  now: Date;
  tx: TransactionClient;
}): Promise<void> {
  const where = { id: change.id };

  if (change.op === "retire" || change.op === "unretire") {
    await tx.item.update({ data: { retiredAt: change.op === "retire" ? now : null }, where });
    return;
  }

  if (change.op === "detachPicture") {
    await tx.step.update({
      data: { mediaAssetId: null, pictureAvailableAt: null, pictureRemovedAt: now },
      where,
    });

    return;
  }

  if (change.op === "attachPicture") {
    await tx.step.update({
      data: { mediaAssetId: change.mediaAssetId, pictureAvailableAt: now, pictureRemovedAt: null },
      where,
    });

    return;
  }

  const { fields } = change;

  switch (change.model) {
    case "Course":
      await tx.course.update({
        data: { ...textData(fields), ...clearedDescription(fields) },
        where,
      });

      return;
    case "Chapter":
      await tx.chapter.update({ data: textData(fields), where });
      return;
    case "Lesson":
      await tx.lesson.update({ data: textData(fields), where });
      return;
    case "Step":
      await tx.step.update({ data: { content: contentOf(fields) }, where });
      await tx.answerExplanation.deleteMany({ where: { stepId: change.id } });
      return;
    case "StepVariant":
      await tx.stepVariant.update({ data: { content: contentOf(fields) }, where });
      return;
    case "AnswerExplanation":
      await tx.answerExplanation.update({ data: { explanation: textOf(fields) }, where });
      return;
    default:
      throw new Error("Unknown fixable model");
  }
}

/**
 * Writes exactly the prepared changes. Every fix under a lesson moves its `updatedAt`, which the
 * lesson player reads as the lesson's version in every app.
 */
export async function applyFixChanges(
  tx: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: FixUnit },
): Promise<void> {
  const now = new Date();

  for (const change of changes) {
    // oxlint-disable-next-line no-await-in-loop -- writes share one transaction's connection
    await applyChange({ change, now, tx });
  }

  if (unit.kind === "lesson") {
    await tx.lesson.update({ data: { updatedAt: now }, where: { id: unit.id } });
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
