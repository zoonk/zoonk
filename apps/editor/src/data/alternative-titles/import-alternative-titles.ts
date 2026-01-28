import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { type ImportMode } from "@/lib/import-mode";
import { parseJsonFile } from "@/lib/parse-json-file";
import { isRecord } from "@/lib/validation";
import { prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";

function validateTitleData(title: unknown): title is string {
  return typeof title === "string" && title.trim().length > 0;
}

function validateImportData(data: unknown): data is {
  alternativeTitles: string[];
} {
  if (!isRecord(data)) {
    return false;
  }

  if (!Array.isArray(data.alternativeTitles)) {
    return false;
  }

  return data.alternativeTitles.every(validateTitleData);
}

export async function importAlternativeTitles(params: {
  courseId: number;
  file: File;
  language: string;
  mode?: ImportMode;
}): Promise<SafeReturn<string[]>> {
  const mode = params.mode ?? "merge";

  const { data: importData, error: parseError } = await parseJsonFile({
    file: params.file,
    invalidFormatError: ErrorCode.invalidAlternativeTitleFormat,
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

  const slugs = importData.alternativeTitles.map((title) => toSlug(title));
  const uniqueSlugs = [...new Set(slugs)].filter(Boolean);

  if (uniqueSlugs.length === 0) {
    return { data: [], error: null };
  }

  const { data: result, error: importError } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.courseAlternativeTitle.deleteMany({
          where: { courseId: params.courseId, language: params.language },
        });
      }

      await tx.courseAlternativeTitle.createMany({
        data: uniqueSlugs.map((slug) => ({
          courseId: params.courseId,
          language: params.language,
          slug,
        })),
        skipDuplicates: true,
      });

      return uniqueSlugs;
    }),
  );

  if (importError) {
    return { data: null, error: importError };
  }

  return { data: result, error: null };
}
