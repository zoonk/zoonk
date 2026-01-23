import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { parseJsonFile } from "@/lib/parse-json-file";
import { isRecord } from "@/lib/validation";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Activity, type ActivityKind, prisma, type TransactionClient } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import type { ImportMode } from "@/lib/import-mode";

const validActivityKinds = new Set<ActivityKind>([
  "custom",
  "background",
  "explanation",
  "quiz",
  "mechanics",
  "examples",
  "story",
  "challenge",
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "review",
]);

export type ActivityImportData = {
  description?: string;
  kind: ActivityKind;
  title?: string;
};

export type ActivitiesImport = {
  activities: ActivityImportData[];
};

function isActivityKind(value: string): value is ActivityKind {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type guard pattern
  return validActivityKinds.has(value as ActivityKind);
}

function validateActivityData(activity: unknown): activity is ActivityImportData {
  if (!isRecord(activity)) {
    return false;
  }

  const hasValidKind = typeof activity.kind === "string" && isActivityKind(activity.kind);

  return hasValidKind;
}

function validateImportData(data: unknown): data is ActivitiesImport {
  if (!isRecord(data)) {
    return false;
  }

  if (!Array.isArray(data.activities)) {
    return false;
  }

  return data.activities.every(validateActivityData);
}

async function removeExistingActivities(tx: TransactionClient, lessonId: number): Promise<void> {
  await tx.activity.deleteMany({
    where: { lessonId },
  });
}

export async function importActivities(params: {
  file: File;
  headers?: Headers;
  lessonId: number;
  mode?: ImportMode;
}): Promise<SafeReturn<Activity[]>> {
  const mode = params.mode ?? "merge";

  const { data: importData, error: parseError } = await parseJsonFile({
    file: params.file,
    invalidFormatError: ErrorCode.invalidActivityFormat,
    validate: validateImportData,
  });

  if (parseError) {
    return { data: null, error: parseError };
  }

  const { data: lesson, error: findError } = await safeAsync(() =>
    prisma.lesson.findUnique({
      where: { id: params.lessonId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!lesson) {
    return { data: null, error: new AppError(ErrorCode.lessonNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: lesson.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: result, error: importError } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      let startPosition = 0;

      if (mode === "replace") {
        await removeExistingActivities(tx, params.lessonId);
      } else {
        const existingActivities = await tx.activity.findMany({
          orderBy: { position: "desc" },
          select: { position: true },
          take: 1,
          where: { lessonId: params.lessonId },
        });

        startPosition = (existingActivities[0]?.position ?? -1) + 1;
      }

      const imported: Activity[] = [];

      const activityOperations = importData.activities.map(async (activityData, i) => {
        const activity = await tx.activity.create({
          data: {
            description: activityData.description,
            isPublished: !lesson.isPublished,
            kind: activityData.kind,
            language: lesson.language,
            lessonId: params.lessonId,
            organizationId: lesson.organizationId,
            position: startPosition + i,
            title: activityData.title,
          },
        });

        return { activity, index: i };
      });

      const results = await Promise.all(activityOperations);

      results.sort((a, b) => a.index - b.index);

      for (const activityResult of results) {
        imported.push(activityResult.activity);
      }

      await tx.lesson.update({
        data: { generationStatus: "completed" },
        where: { id: params.lessonId },
      });

      return imported;
    }),
  );

  if (importError) {
    return { data: null, error: importError };
  }

  return { data: result, error: null };
}
