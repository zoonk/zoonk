import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { type ImportMode } from "@/lib/import-mode";
import { parseJsonFile } from "@/lib/parse-json-file";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { isJsonObject } from "@zoonk/utils/json";
import { toSlug } from "@zoonk/utils/string";
import { getAuthorizedCourse } from "../courses/get-authorized-course";

function validateTitleData(title: unknown): title is string {
  return typeof title === "string" && title.trim().length > 0;
}

function validateImportData(data: unknown): data is {
  alternativeTitles: string[];
} {
  if (!isJsonObject(data)) {
    return false;
  }

  if (!Array.isArray(data.alternativeTitles)) {
    return false;
  }

  return data.alternativeTitles.every(validateTitleData);
}

export async function importAlternativeTitles(params: {
  courseId: string;
  file: File;
  headers?: Headers;
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

  const { error: courseError } = await getAuthorizedCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const uniqueSlugs = [
    ...new Set(
      importData.alternativeTitles.flatMap((title) => {
        const slug = toSlug(title);
        return slug ? [slug] : [];
      }),
    ),
  ];

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
