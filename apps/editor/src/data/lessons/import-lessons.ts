import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { ErrorCode } from "@/lib/app-error";
import { parseJsonFile } from "@/lib/parse-json-file";

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
  await tx.lesson.deleteMany({
    where: { chapterId },
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
        const existingLessons = await tx.lesson.findMany({
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
          language: chapter.language,
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

      const imported: Lesson[] = [];

      const lessonOperations = deduplicatedLessons.map(async (item, i) => {
        const existingLesson = existingLessonMap.get(item.slug);

        let lesson: Lesson;

        if (item.hasExplicitSlug && existingLesson) {
          if (chapter.isPublished || existingLesson.isPublished) {
            lesson = existingLesson;
          } else {
            lesson = await tx.lesson.update({
              data: { isPublished: true },
              where: { id: existingLesson.id },
            });
          }
        } else {
          const uniqueSlug =
            !item.hasExplicitSlug && existingLesson
              ? `${item.slug}-${Date.now()}-${item.index}`
              : item.slug;

          lesson = await tx.lesson.create({
            data: {
              chapterId: params.chapterId,
              description: item.lessonData.description,
              isPublished: !chapter.isPublished,
              language: chapter.language,
              normalizedTitle: item.normalizedTitle,
              organizationId: chapter.organizationId,
              position: startPosition + i,
              slug: uniqueSlug,
              title: item.lessonData.title,
            },
          });
        }

        return { index: i, lesson };
      });

      const results = await Promise.all(lessonOperations);

      results.sort((a, b) => a.index - b.index);

      for (const lessonResult of results) {
        imported.push(lessonResult.lesson);
      }

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
