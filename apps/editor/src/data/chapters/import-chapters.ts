import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { type ImportMode } from "@/lib/import-mode";
import { parseJsonFile } from "@/lib/parse-json-file";
import { isRecord } from "@/lib/validation";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, type TransactionClient, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type ChapterImportData = {
  description: string;
  slug?: string;
  title: string;
};

type ChaptersImport = {
  chapters: ChapterImportData[];
};

function validateChapterData(chapter: unknown): chapter is ChapterImportData {
  if (!isRecord(chapter)) {
    return false;
  }

  const hasValidTitle = typeof chapter.title === "string" && chapter.title.length > 0;
  const hasValidDescription = typeof chapter.description === "string";

  return hasValidTitle && hasValidDescription;
}

function validateImportData(data: unknown): data is ChaptersImport {
  if (!isRecord(data)) {
    return false;
  }

  if (!Array.isArray(data.chapters)) {
    return false;
  }

  return data.chapters.every(validateChapterData);
}

async function removeExistingChapters(tx: TransactionClient, courseId: number): Promise<void> {
  await tx.chapter.deleteMany({
    where: { courseId },
  });
}

export async function importChapters(params: {
  courseId: number;
  file: File;
  headers?: Headers;
  mode?: ImportMode;
}): Promise<SafeReturn<Chapter[]>> {
  const mode = params.mode ?? "merge";

  const { data: importData, error: parseError } = await parseJsonFile({
    file: params.file,
    invalidFormatError: ErrorCode.invalidChapterFormat,
    validate: validateImportData,
  });

  if (parseError) {
    return { data: null, error: parseError };
  }

  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      where: { id: params.courseId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!course) {
    return { data: null, error: new AppError(ErrorCode.courseNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: result, error: importError } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      let startPosition = 0;

      if (mode === "replace") {
        await removeExistingChapters(tx, params.courseId);
      } else {
        const existingChapters = await tx.chapter.findMany({
          orderBy: { position: "desc" },
          select: { position: true },
          take: 1,
          where: { courseId: params.courseId },
        });

        startPosition = (existingChapters[0]?.position ?? -1) + 1;
      }

      const chaptersToImport = importData.chapters.map((chapterData, i) => {
        const hasExplicitSlug = Boolean(chapterData.slug);

        const slug = chapterData.slug ? toSlug(chapterData.slug) : toSlug(chapterData.title);

        return {
          chapterData,
          hasExplicitSlug,
          index: i,
          normalizedTitle: normalizeString(chapterData.title),
          slug,
        };
      });

      const allSlugs = chaptersToImport.map((item) => item.slug);

      const existingChaptersInCourse = await tx.chapter.findMany({
        where: {
          courseId: params.courseId,
          slug: { in: allSlugs },
        },
      });

      const existingChapterMap = new Map(
        existingChaptersInCourse.map((chapter) => [chapter.slug, chapter]),
      );

      // Deduplicate slugs within the batch to prevent unique constraint violations
      const slugCounts = new Map<string, number>();
      const deduplicatedChapters = chaptersToImport.map((item) => {
        const count = slugCounts.get(item.slug) ?? 0;
        slugCounts.set(item.slug, count + 1);

        // If this slug already appeared in the batch, make it unique
        const batchUniqueSlug = count > 0 ? `${item.slug}-${Date.now()}-${item.index}` : item.slug;

        return { ...item, slug: batchUniqueSlug };
      });

      const imported: Chapter[] = [];

      const chapterOperations = deduplicatedChapters.map(async (item, i) => {
        const existingChapter = existingChapterMap.get(item.slug);

        let chapter: Chapter;

        if (item.hasExplicitSlug && existingChapter) {
          // If both course and chapter are unpublished, mark chapter as published
          // Otherwise keep current published state
          const isPublished =
            course.isPublished || existingChapter.isPublished ? existingChapter.isPublished : true;

          chapter = await tx.chapter.update({
            data: {
              courseId: params.courseId,
              isPublished,
              position: startPosition + i,
            },
            where: { id: existingChapter.id },
          });
        } else {
          const uniqueSlug =
            !item.hasExplicitSlug && existingChapter
              ? `${item.slug}-${Date.now()}-${item.index}`
              : item.slug;

          chapter = await tx.chapter.create({
            data: {
              courseId: params.courseId,
              description: item.chapterData.description,
              isPublished: !course.isPublished,
              language: course.language,
              normalizedTitle: item.normalizedTitle,
              organizationId: course.organizationId,
              position: startPosition + i,
              slug: uniqueSlug,
              title: item.chapterData.title,
            },
          });
        }

        return { chapter, index: i };
      });

      const results = await Promise.all(chapterOperations);

      results.sort((a, b) => a.index - b.index);

      for (const chapterResult of results) {
        imported.push(chapterResult.chapter);
      }

      return imported;
    }),
  );

  if (importError) {
    return { data: null, error: importError };
  }

  return { data: result, error: null };
}
