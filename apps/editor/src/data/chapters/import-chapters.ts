import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { type ImportMode } from "@/lib/import-mode";
import { deduplicateImportSlugs, resolveImportSlug } from "@/lib/import-slug";
import { parseJsonFile } from "@/lib/parse-json-file";
import { getDefaultContentManagementMode } from "@zoonk/core/content/management";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import {
  type Chapter,
  type ContentManagementMode,
  type TransactionClient,
  getActiveChapterWhere,
  getActiveCourseWhere,
  prisma,
} from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { replaceCourseChapters } from "../curriculum-replace";

type ChapterImportData = {
  description: string;
  slug?: string;
  title: string;
};

function validateChapterData(chapter: unknown): chapter is ChapterImportData {
  if (!isJsonObject(chapter)) {
    return false;
  }

  const hasValidTitle = typeof chapter.title === "string" && chapter.title.length > 0;
  const hasValidDescription = typeof chapter.description === "string";

  return hasValidTitle && hasValidDescription;
}

function validateImportData(data: unknown): data is {
  chapters: ChapterImportData[];
} {
  if (!isJsonObject(data)) {
    return false;
  }

  if (!Array.isArray(data.chapters)) {
    return false;
  }

  return data.chapters.every(validateChapterData);
}

async function resolveChapter(
  tx: TransactionClient,
  params: {
    courseId: number;
    courseIsPublished: boolean;
    description: string;
    existingChapter: Chapter | undefined;
    hasExplicitSlug: boolean;
    index: number;
    language: string;
    managementMode: ContentManagementMode;
    normalizedTitle: string;
    organizationId: number | null;
    position: number;
    slug: string;
    title: string;
  },
): Promise<Chapter> {
  if (params.hasExplicitSlug && params.existingChapter) {
    const isPublished =
      params.courseIsPublished || params.existingChapter.isPublished
        ? params.existingChapter.isPublished
        : true;

    return tx.chapter.update({
      data: {
        courseId: params.courseId,
        isPublished,
        position: params.position,
      },
      where: { id: params.existingChapter.id },
    });
  }

  const slug = resolveImportSlug({
    existingRecord: params.existingChapter,
    hasExplicitSlug: params.hasExplicitSlug,
    index: params.index,
    slug: params.slug,
  });

  return tx.chapter.create({
    data: {
      courseId: params.courseId,
      description: params.description,
      isPublished: !params.courseIsPublished,
      language: params.language,
      managementMode: params.managementMode,
      normalizedTitle: params.normalizedTitle,
      organizationId: params.organizationId,
      position: params.position,
      slug,
      title: params.title,
    },
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
    prisma.course.findFirst({
      include: { organization: true },
      where: getActiveCourseWhere({ id: params.courseId }),
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
        await replaceCourseChapters({
          courseId: params.courseId,
          tx,
        });
      } else {
        const existingChapters = await tx.chapter.findMany({
          orderBy: { position: "desc" },
          take: 1,
          where: getActiveChapterWhere({
            chapterWhere: { courseId: params.courseId },
          }),
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
        where: getActiveChapterWhere({
          chapterWhere: {
            courseId: params.courseId,
            slug: { in: allSlugs },
          },
        }),
      });

      const existingChapterMap = new Map(
        existingChaptersInCourse.map((chapter) => [chapter.slug, chapter]),
      );

      const deduplicatedChapters = deduplicateImportSlugs(chaptersToImport);

      const chapterOperations = deduplicatedChapters.map(async (item, i) => {
        const chapter = await resolveChapter(tx, {
          courseId: params.courseId,
          courseIsPublished: course.isPublished,
          description: item.chapterData.description,
          existingChapter: existingChapterMap.get(item.slug),
          hasExplicitSlug: item.hasExplicitSlug,
          index: item.index,
          language: course.language,
          managementMode: getDefaultContentManagementMode({
            organizationSlug: course.organization?.slug,
          }),
          normalizedTitle: item.normalizedTitle,
          organizationId: course.organizationId,
          position: startPosition + i,
          slug: item.slug,
          title: item.chapterData.title,
        });

        return { chapter, index: i };
      });

      const results = await Promise.all(chapterOperations);

      return results.toSorted((a, b) => a.index - b.index).map((item) => item.chapter);
    }),
  );

  if (importError) {
    return { data: null, error: importError };
  }

  return { data: result, error: null };
}
