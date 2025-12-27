import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { ErrorCode } from "@/lib/app-error";

export type ImportedChapter = {
  chapter: Chapter;
  courseChapterId: number;
};

export type ChapterImportData = {
  description: string;
  slug?: string;
  title: string;
};

export type ChaptersImport = {
  chapters: ChapterImportData[];
};

export type ImportMode = "merge" | "replace";

const BYTES_PER_KB = 1024;
const KB_PER_MB = 1024;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * KB_PER_MB * BYTES_PER_KB;

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

function validateChapterData(chapter: unknown): chapter is ChapterImportData {
  if (typeof chapter !== "object" || chapter === null) {
    return false;
  }

  const c = chapter as Record<string, unknown>;

  const hasValidTitle = typeof c.title === "string" && c.title.length > 0;
  const hasValidDescription = typeof c.description === "string";

  return hasValidTitle && hasValidDescription;
}

function validateImportData(data: unknown): data is ChaptersImport {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.chapters)) {
    return false;
  }

  return d.chapters.every(validateChapterData);
}

async function parseChaptersFile(
  file: File,
): Promise<SafeReturn<ChaptersImport>> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      data: null,
      error: new AppError(ErrorCode.fileTooLarge),
    };
  }

  const isJsonType = file.type.includes("json");
  const isJsonFile = file.name.endsWith(".json");
  const isValidJsonFile = isJsonType || isJsonFile;

  if (!isValidJsonFile) {
    return {
      data: null,
      error: new AppError(ErrorCode.invalidFileType),
    };
  }

  const { data: text, error: readError } = await safeAsync(() => file.text());

  if (readError) {
    return { data: null, error: readError };
  }

  const { data: parsed, error: parseError } = await safeAsync(async () =>
    JSON.parse(text),
  );

  if (parseError) {
    return {
      data: null,
      error: new AppError(ErrorCode.invalidJsonFormat),
    };
  }

  if (!validateImportData(parsed)) {
    return {
      data: null,
      error: new AppError(ErrorCode.invalidChapterFormat),
    };
  }

  return { data: parsed, error: null };
}

async function removeExistingChapters(
  tx: TransactionClient,
  courseId: number,
): Promise<void> {
  const existingCourseChapters = await tx.courseChapter.findMany({
    select: { chapterId: true, id: true },
    where: { courseId },
  });

  if (existingCourseChapters.length === 0) {
    return;
  }

  await tx.courseChapter.deleteMany({
    where: { courseId },
  });

  const chapterIds = existingCourseChapters.map((cc) => cc.chapterId);

  const chaptersWithOtherCourses = await tx.courseChapter.groupBy({
    by: ["chapterId"],
    where: { chapterId: { in: chapterIds } },
  });

  const chaptersInOtherCourses = new Set(
    chaptersWithOtherCourses.map((c) => c.chapterId),
  );

  const chaptersToDelete = chapterIds.filter(
    (id) => !chaptersInOtherCourses.has(id),
  );

  if (chaptersToDelete.length > 0) {
    await tx.chapter.deleteMany({
      where: { id: { in: chaptersToDelete } },
    });
  }
}

export async function importChapters(params: {
  courseId: number;
  file: File;
  headers?: Headers;
  mode?: ImportMode;
}): Promise<SafeReturn<ImportedChapter[]>> {
  const mode = params.mode ?? "merge";

  const { data: importData, error: parseError } = await parseChaptersFile(
    params.file,
  );

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
        const existingChapters = await tx.courseChapter.findMany({
          orderBy: { position: "desc" },
          select: { position: true },
          take: 1,
          where: { courseId: params.courseId },
        });

        startPosition = (existingChapters[0]?.position ?? -1) + 1;
      }

      const chaptersToImport = importData.chapters.map((chapterData, i) => {
        const hasExplicitSlug = Boolean(chapterData.slug);

        const slug = chapterData.slug
          ? toSlug(chapterData.slug)
          : toSlug(chapterData.title);

        return {
          chapterData,
          hasExplicitSlug,
          index: i,
          normalizedTitle: normalizeString(chapterData.title),
          slug,
        };
      });

      const allSlugs = chaptersToImport.map((c) => c.slug);

      const existingChaptersInOrg = await tx.chapter.findMany({
        where: {
          organizationId: course.organizationId,
          slug: { in: allSlugs },
        },
      });

      const existingChapterMap = new Map(
        existingChaptersInOrg.map((c) => [c.slug, c]),
      );

      const imported: ImportedChapter[] = [];

      const chapterOperations = chaptersToImport.map(async (item, i) => {
        const existingChapter = existingChapterMap.get(item.slug);

        let chapter: Chapter;

        if (item.hasExplicitSlug && existingChapter) {
          chapter = existingChapter;
        } else {
          const uniqueSlug =
            !item.hasExplicitSlug && existingChapter
              ? `${item.slug}-${Date.now()}-${item.index}`
              : item.slug;

          chapter = await tx.chapter.create({
            data: {
              description: item.chapterData.description,
              normalizedTitle: item.normalizedTitle,
              organizationId: course.organizationId,
              slug: uniqueSlug,
              title: item.chapterData.title,
            },
          });
        }

        const courseChapter = await tx.courseChapter.create({
          data: {
            chapterId: chapter.id,
            courseId: params.courseId,
            position: startPosition + i,
          },
        });

        return { chapter, courseChapterId: courseChapter.id, index: i };
      });

      const results = await Promise.all(chapterOperations);

      results.sort((a, b) => a.index - b.index);

      for (const chapterResult of results) {
        imported.push({
          chapter: chapterResult.chapter,
          courseChapterId: chapterResult.courseChapterId,
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
