import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { type ImportMode } from "@/lib/import-mode";
import { deduplicateImportSlugs, resolveImportSlug } from "@/lib/import-slug";
import { getLessonKind } from "@/lib/lesson-kind";
import { parseJsonFile } from "@/lib/parse-json-file";
import { isRecord } from "@/lib/validation";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, type LessonKind, type TransactionClient, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type LessonImportData = {
  description: string;
  slug?: string;
  title: string;
};

function validateLessonData(lesson: unknown): lesson is LessonImportData {
  if (!isRecord(lesson)) {
    return false;
  }

  const hasValidTitle = typeof lesson.title === "string" && lesson.title.length > 0;
  const hasValidDescription = typeof lesson.description === "string";

  return hasValidTitle && hasValidDescription;
}

function validateImportData(data: unknown): data is {
  lessons: LessonImportData[];
} {
  if (!isRecord(data)) {
    return false;
  }

  if (!Array.isArray(data.lessons)) {
    return false;
  }

  return data.lessons.every(validateLessonData);
}

async function removeExistingLessons(tx: TransactionClient, chapterId: number): Promise<void> {
  await tx.lesson.deleteMany({
    where: { chapterId },
  });
}

async function resolveLesson(
  tx: TransactionClient,
  params: {
    chapterId: number;
    chapterIsPublished: boolean;
    description: string;
    existingLesson: Lesson | undefined;
    hasExplicitSlug: boolean;
    index: number;
    kind: LessonKind;
    language: string;
    normalizedTitle: string;
    organizationId: number | null;
    position: number;
    slug: string;
    title: string;
  },
): Promise<Lesson> {
  if (params.hasExplicitSlug && params.existingLesson) {
    if (params.chapterIsPublished || params.existingLesson.isPublished) {
      return params.existingLesson;
    }

    return tx.lesson.update({
      data: { isPublished: true },
      where: { id: params.existingLesson.id },
    });
  }

  const slug = resolveImportSlug({
    existingRecord: params.existingLesson,
    hasExplicitSlug: params.hasExplicitSlug,
    index: params.index,
    slug: params.slug,
  });

  return tx.lesson.create({
    data: {
      chapterId: params.chapterId,
      description: params.description,
      isPublished: !params.chapterIsPublished,
      kind: params.kind,
      language: params.language,
      normalizedTitle: params.normalizedTitle,
      organizationId: params.organizationId,
      position: params.position,
      slug,
      title: params.title,
    },
  });
}

export async function importLessons(params: {
  chapterId: number;
  file: File;
  headers?: Headers;
  mode?: ImportMode;
}): Promise<SafeReturn<Lesson[]>> {
  const mode = params.mode ?? "merge";

  const { data: importData, error: parseError } = await parseJsonFile({
    file: params.file,
    invalidFormatError: ErrorCode.invalidLessonFormat,
    validate: validateImportData,
  });

  if (parseError) {
    return { data: null, error: parseError };
  }

  const { data: chapter, error: findError } = await safeAsync(() =>
    prisma.chapter.findUnique({
      include: {
        course: { include: { categories: true } },
        organization: true,
      },
      where: { id: params.chapterId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!chapter) {
    return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapter.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const kind = getLessonKind({
    courseCategories: chapter.course.categories.map((cat) => cat.category),
    orgSlug: chapter.organization?.slug,
  });

  const { data: result, error: importError } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      let startPosition = 0;

      if (mode === "replace") {
        await removeExistingLessons(tx, params.chapterId);
      } else {
        const existingLessons = await tx.lesson.findMany({
          orderBy: { position: "desc" },
          take: 1,
          where: { chapterId: params.chapterId },
        });

        startPosition = (existingLessons[0]?.position ?? -1) + 1;
      }

      const lessonsToImport = importData.lessons.map((lessonData, i) => {
        const hasExplicitSlug = Boolean(lessonData.slug);

        const slug = lessonData.slug ? toSlug(lessonData.slug) : toSlug(lessonData.title);

        return {
          hasExplicitSlug,
          index: i,
          lessonData,
          normalizedTitle: normalizeString(lessonData.title),
          slug,
        };
      });

      const allSlugs = lessonsToImport.map((item) => item.slug);

      const existingLessonsInChapter = await tx.lesson.findMany({
        where: {
          chapterId: params.chapterId,
          slug: { in: allSlugs },
        },
      });

      const existingLessonMap = new Map(
        existingLessonsInChapter.map((lesson) => [lesson.slug, lesson]),
      );

      const deduplicatedLessons = deduplicateImportSlugs(lessonsToImport);

      const lessonOperations = deduplicatedLessons.map(async (item, i) => {
        const lesson = await resolveLesson(tx, {
          chapterId: params.chapterId,
          chapterIsPublished: chapter.isPublished,
          description: item.lessonData.description,
          existingLesson: existingLessonMap.get(item.slug),
          hasExplicitSlug: item.hasExplicitSlug,
          index: item.index,
          kind,
          language: chapter.language,
          normalizedTitle: item.normalizedTitle,
          organizationId: chapter.organizationId,
          position: startPosition + i,
          slug: item.slug,
          title: item.lessonData.title,
        });

        return { index: i, lesson };
      });

      const results = await Promise.all(lessonOperations);

      const imported = results.toSorted((a, b) => a.index - b.index).map((item) => item.lesson);

      await tx.chapter.update({
        data: { generationStatus: "completed" },
        where: { id: params.chapterId },
      });

      return imported;
    }),
  );

  if (importError) {
    return { data: null, error: importError };
  }

  return { data: result, error: null };
}
