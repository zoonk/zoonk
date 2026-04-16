import "server-only";
import { getAuthorizedActiveCourse } from "@/data/courses/get-authorized-course";
import { ErrorCode } from "@/lib/app-error";
import { type ImportMode } from "@/lib/import-mode";
import { deduplicateImportSlugs, resolveImportSlug } from "@/lib/import-slug";
import { parseJsonFile } from "@/lib/parse-json-file";
import { getDefaultContentManagementMode } from "@zoonk/core/content/management";
import {
  type Chapter,
  type ContentManagementMode,
  type TransactionClient,
  getActiveChapterWhere,
  prisma,
} from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
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
    courseId: string;
    courseIsPublished: boolean;
    description: string;
    existingChapter: Chapter | undefined;
    hasExplicitSlug: boolean;
    index: number;
    language: string;
    managementMode: ContentManagementMode;
    normalizedTitle: string;
    organizationId: string | null;
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
  courseId: string;
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

  const { data: course, error: courseError } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const { data: result, error: importError } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      let startPosition = 0;

      if (mode === "replace") {
        await replaceCourseChapters({
          courseId: course.id,
          tx,
        });
      } else {
        const existingChapters = await tx.chapter.findMany({
          orderBy: { position: "desc" },
          take: 1,
          where: getActiveChapterWhere({
            chapterWhere: { courseId: course.id },
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
            courseId: course.id,
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
          courseId: course.id,
          courseIsPublished: course.isPublished,
          description: item.chapterData.description,
          existingChapter: existingChapterMap.get(item.slug),
          hasExplicitSlug: item.hasExplicitSlug,
          index: item.index,
          language: course.language,
          managementMode: getDefaultContentManagementMode({
            organizationSlug: course.organization.slug,
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
