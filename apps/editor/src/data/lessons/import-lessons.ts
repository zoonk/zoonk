import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { ErrorCode } from "@/lib/app-error";
import { parseJsonFile } from "@/lib/parse-json-file";

export type ImportedLesson = {
  lesson: Lesson;
  chapterLessonId: number;
};

export type LessonImportData = {
  description: string;
  slug?: string;
  title: string;
};

export type LessonsImport = {
  lessons: LessonImportData[];
};

export type ImportMode = "merge" | "replace";

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

function validateLessonData(lesson: unknown): lesson is LessonImportData {
  if (typeof lesson !== "object" || lesson === null) {
    return false;
  }

  const l = lesson as Record<string, unknown>;

  const hasValidTitle = typeof l.title === "string" && l.title.length > 0;
  const hasValidDescription = typeof l.description === "string";

  return hasValidTitle && hasValidDescription;
}

function validateImportData(data: unknown): data is LessonsImport {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.lessons)) {
    return false;
  }

  return d.lessons.every(validateLessonData);
}

async function removeExistingLessons(
  tx: TransactionClient,
  chapterId: number,
): Promise<void> {
  const existingChapterLessons = await tx.chapterLesson.findMany({
    select: { id: true, lessonId: true },
    where: { chapterId },
  });

  if (existingChapterLessons.length === 0) {
    return;
  }

  await tx.chapterLesson.deleteMany({
    where: { chapterId },
  });

  const lessonIds = existingChapterLessons.map((cl) => cl.lessonId);

  const lessonsWithOtherChapters = await tx.chapterLesson.groupBy({
    by: ["lessonId"],
    where: { lessonId: { in: lessonIds } },
  });

  const lessonsInOtherChapters = new Set(
    lessonsWithOtherChapters.map((l) => l.lessonId),
  );

  const lessonsToDelete = lessonIds.filter(
    (id) => !lessonsInOtherChapters.has(id),
  );

  if (lessonsToDelete.length > 0) {
    await tx.lesson.deleteMany({
      where: { id: { in: lessonsToDelete } },
    });
  }
}

export async function importLessons(params: {
  chapterId: number;
  file: File;
  headers?: Headers;
  mode?: ImportMode;
}): Promise<SafeReturn<ImportedLesson[]>> {
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

  const { data: result, error: importError } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      let startPosition = 0;

      if (mode === "replace") {
        await removeExistingLessons(tx, params.chapterId);
      } else {
        const existingLessons = await tx.chapterLesson.findMany({
          orderBy: { position: "desc" },
          select: { position: true },
          take: 1,
          where: { chapterId: params.chapterId },
        });

        startPosition = (existingLessons[0]?.position ?? -1) + 1;
      }

      const lessonsToImport = importData.lessons.map((lessonData, i) => {
        const hasExplicitSlug = Boolean(lessonData.slug);

        const slug = lessonData.slug
          ? toSlug(lessonData.slug)
          : toSlug(lessonData.title);

        return {
          hasExplicitSlug,
          index: i,
          lessonData,
          normalizedTitle: normalizeString(lessonData.title),
          slug,
        };
      });

      const allSlugs = lessonsToImport.map((l) => l.slug);

      const existingLessonsInOrg = await tx.lesson.findMany({
        where: {
          organizationId: chapter.organizationId,
          slug: { in: allSlugs },
        },
      });

      const existingLessonMap = new Map(
        existingLessonsInOrg.map((l) => [l.slug, l]),
      );

      // Deduplicate slugs within the batch to prevent unique constraint violations
      const slugCounts = new Map<string, number>();
      const deduplicatedLessons = lessonsToImport.map((item) => {
        const count = slugCounts.get(item.slug) ?? 0;
        slugCounts.set(item.slug, count + 1);

        // If this slug already appeared in the batch, make it unique
        const batchUniqueSlug =
          count > 0 ? `${item.slug}-${Date.now()}-${item.index}` : item.slug;

        return { ...item, slug: batchUniqueSlug };
      });

      const imported: ImportedLesson[] = [];

      const lessonOperations = deduplicatedLessons.map(async (item, i) => {
        const existingLesson = existingLessonMap.get(item.slug);

        let lesson: Lesson;

        if (item.hasExplicitSlug && existingLesson) {
          lesson = existingLesson;
        } else {
          const uniqueSlug =
            !item.hasExplicitSlug && existingLesson
              ? `${item.slug}-${Date.now()}-${item.index}`
              : item.slug;

          lesson = await tx.lesson.create({
            data: {
              description: item.lessonData.description,
              normalizedTitle: item.normalizedTitle,
              organizationId: chapter.organizationId,
              slug: uniqueSlug,
              title: item.lessonData.title,
            },
          });
        }

        const chapterLesson = await tx.chapterLesson.create({
          data: {
            chapterId: params.chapterId,
            lessonId: lesson.id,
            position: startPosition + i,
          },
        });

        return { chapterLessonId: chapterLesson.id, index: i, lesson };
      });

      const results = await Promise.all(lessonOperations);

      results.sort((a, b) => a.index - b.index);

      for (const lessonResult of results) {
        imported.push({
          chapterLessonId: lessonResult.chapterLessonId,
          lesson: lessonResult.lesson,
        });
      }

      return imported;
    }),
  );

  if (importError) {
    return { data: null, error: importError };
  }

  return { data: result, error: null };
}
