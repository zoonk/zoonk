import "server-only";
import { randomUUID } from "node:crypto";
import { type Chapter, type CourseLevel, type TransactionClient, prisma } from "@zoonk/db";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { revalidateTag } from "next/cache";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
} from "../../cache/tags";
import { CORE_COURSE_LEVELS, LANGUAGE_COURSE_LEVELS } from "../../courses/learning-plan-contract";
import { snapshotCourseHistory } from "./course-history";

export type CourseRevisionContext = {
  courseId: string;
  contentRevision: number;
  workflowRunId?: string;
  target?: { kind: "chapter" | "lesson"; id: string };
};

export type PlannedCourseChapter = {
  key: string;
  title: string;
  description: string;
  level: CourseLevel | null;
  outcomes: string[];
  prerequisiteKeys?: string[];
};

/** All curriculum writers share this lock, so a completed old AI call cannot race a replacement. */
async function lockCourse(transaction: TransactionClient, courseId: string) {
  await transaction.$queryRaw`SELECT id FROM courses WHERE id = ${courseId}::uuid FOR UPDATE`;
  return transaction.course.findUnique({ where: { id: courseId } });
}

async function matchesRun(transaction: TransactionClient, context: CourseRevisionContext) {
  if (!context.workflowRunId) {
    return true;
  }

  if (context.target?.kind === "chapter") {
    const target = await transaction.chapter.findFirst({
      where: { courseId: context.courseId, id: context.target.id },
    });

    return target?.generationRunId === context.workflowRunId;
  }

  if (context.target?.kind === "lesson") {
    const target = await transaction.lesson.findFirst({
      where: { chapter: { courseId: context.courseId }, id: context.target.id },
    });

    return target?.generationRunId === context.workflowRunId;
  }

  const course = await transaction.course.findUnique({ where: { id: context.courseId } });
  return course?.generationRunId === context.workflowRunId;
}

/** Trusted workflow-only persistence. Public callers must authorize the persisted generation intent first. */
export async function withCurrentCourseRevision<T>({
  context,
  operation,
  transactionOptions,
}: {
  context: CourseRevisionContext;
  operation: (transaction: TransactionClient) => Promise<T>;
  transactionOptions?: { maxWait?: number; timeout?: number };
}): Promise<{ status: "applied"; value: T } | { status: "superseded" }> {
  return prisma.$transaction(async (transaction) => {
    const course = await lockCourse(transaction, context.courseId);

    if (
      !course ||
      course.contentRevision !== context.contentRevision ||
      !(await matchesRun(transaction, context))
    ) {
      return { status: "superseded" };
    }

    return { status: "applied", value: await operation(transaction) };
  }, transactionOptions);
}

const MIN_OVERVIEW_CHAPTERS = 3;
const MAX_OVERVIEW_CHAPTERS = 6;

function outlineLevels(format: string): readonly CourseLevel[] {
  if (format === "language") {
    return LANGUAGE_COURSE_LEVELS;
  }

  if (format === "core") {
    return CORE_COURSE_LEVELS;
  }

  return [];
}

function validateOutline({
  chapters,
  format,
}: {
  chapters: PlannedCourseChapter[];
  format: string;
}) {
  if (chapters.length === 0) {
    throw new Error("A curriculum needs at least one chapter");
  }

  if (format === "question" && chapters.length !== 1) {
    throw new Error("Question courses need one chapter");
  }

  const keys = chapters.map((chapter) => chapter.key);

  if (new Set(keys).size !== keys.length) {
    throw new Error("Chapter keys must be unique");
  }

  const requiredLevels = outlineLevels(format);

  if (requiredLevels.some((level) => !chapters.some((chapter) => chapter.level === level))) {
    throw new Error("The replacement curriculum is missing a required level");
  }

  const overviewCount = chapters.filter((chapter) => chapter.level === "overview").length;

  if (
    format === "core" &&
    (overviewCount < MIN_OVERVIEW_CHAPTERS || overviewCount > MAX_OVERVIEW_CHAPTERS)
  ) {
    throw new Error("The course overview needs three to six chapters");
  }

  chapters.forEach((chapter, index) => {
    if (!chapter.key.trim() || !chapter.title.trim() || !chapter.description.trim()) {
      throw new Error("Chapter identity and content are required");
    }

    if (requiredLevels.length > 0 && !requiredLevels.some((level) => chapter.level === level)) {
      throw new Error("Chapter level does not match its course");
    }

    if ((chapter.prerequisiteKeys ?? []).some((key) => !keys.slice(0, index).includes(key))) {
      throw new Error("Chapter prerequisites must identify earlier chapters in this curriculum");
    }
  });
}

function requiredChapterId(ids: Map<string, string>, key: string) {
  const id = ids.get(key);

  if (!id) {
    throw new Error("The chapter key is not present in this curriculum");
  }

  return id;
}

function chapterRows({
  chapters,
  course,
}: {
  chapters: PlannedCourseChapter[];
  course: { id: string; language: string; organizationId: string | null };
}) {
  const ids = new Map(chapters.map((chapter) => [chapter.key, randomUUID()]));

  return chapters.map((chapter, position) => ({
    conceptKey: chapter.key,
    courseId: course.id,
    description: chapter.description,
    id: requiredChapterId(ids, chapter.key),
    isPublished: true,
    language: course.language,
    level: chapter.level,
    normalizedTitle: normalizeString(chapter.title),
    organizationId: course.organizationId,
    outcomes: chapter.outcomes,
    position,
    prerequisiteIds: (chapter.prerequisiteKeys ?? []).map((key) => requiredChapterId(ids, key)),
    slug: `${toSlug(chapter.title) || "chapter"}-${position + 1}`,
    title: chapter.title,
  }));
}

/** Installs only a complete validated outline; failed or obsolete generation leaves the old tree usable. */
export async function replaceCourseCurriculum({
  context,
  curriculumVersion,
  chapters,
}: {
  context: CourseRevisionContext;
  curriculumVersion: number;
  chapters: PlannedCourseChapter[];
}): Promise<
  { status: "replaced"; contentRevision: number; chapters: Chapter[] } | { status: "superseded" }
> {
  const result = await prisma.$transaction(async (transaction) => {
    const course = await lockCourse(transaction, context.courseId);

    if (!course || !(await matchesRun(transaction, context))) {
      return { status: "superseded" as const };
    }
    // A durable step may commit successfully before its response is recorded. Its
    // original run can acknowledge that exact outline without replacing it again.
    if (
      context.workflowRunId &&
      course.contentRevision === context.contentRevision + 1 &&
      course.curriculumVersion === curriculumVersion
    ) {
      const saved = await transaction.chapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      const keys = new Map(saved.map((chapter) => [chapter.id, chapter.conceptKey]));

      const matches =
        saved.length === chapters.length &&
        saved.every((chapter, position) => {
          const planned = chapters[position];

          if (!planned) {
            return false;
          }

          return (
            chapter.conceptKey === planned.key &&
            chapter.title === planned.title &&
            chapter.description === planned.description &&
            chapter.level === planned.level &&
            JSON.stringify(chapter.outcomes) === JSON.stringify(planned.outcomes) &&
            JSON.stringify(chapter.prerequisiteIds.map((id) => keys.get(id))) ===
              JSON.stringify(planned.prerequisiteKeys ?? [])
          );
        });

      return matches
        ? { chapters: saved, contentRevision: course.contentRevision, status: "replaced" as const }
        : { status: "superseded" as const };
    }

    if (course.contentRevision !== context.contentRevision) {
      return { status: "superseded" as const };
    }

    const format = ["coding", "instrument", "practical"].includes(course.format)
      ? "core"
      : course.format;

    if (format === "exam") {
      throw new Error("Exam curricula are not supported");
    }

    validateOutline({ chapters, format });
    await snapshotCourseHistory({ courseId: course.id, transaction });
    await transaction.chapter.deleteMany({ where: { courseId: course.id } });

    const saved = await transaction.chapter.createManyAndReturn({
      data: chapterRows({ chapters, course }),
    });

    const updated = await transaction.course.update({
      data: { contentRevision: { increment: 1 }, curriculumVersion, format },
      where: { id: course.id },
    });

    return {
      chapters: saved.toSorted((left, right) => left.position - right.position),
      contentRevision: updated.contentRevision,
      status: "replaced" as const,
    };
  });

  if (result.status === "superseded") {
    return result;
  }

  revalidateTag(COURSE_LIST_CACHE_TAG, { expire: 0 });
  revalidateTag(getCourseCacheTag(context.courseId), { expire: 0 });
  revalidateTag(getCourseCurriculumCacheTag(context.courseId), { expire: 0 });
  return result;
}
