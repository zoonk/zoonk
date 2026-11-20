import { type LearningEvent, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findOpenedVersion, findPlayableLessonRow } from "./lesson-rows";
import { loadProgressRuns } from "./lesson-runs";

/** Closed runs retain their saved skips even when a retry omits them. */
function readSkippedWritingStepIds(run: LearningEvent): string[] {
  const ids = isJsonObject(run.contentIds) ? run.contentIds.skippedWritingStepIds : null;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** Skipped writing can identify the opened version when no recorded answer does. */
export async function loadPlayedLesson({
  lessonId,
  run,
  skippedWritingStepIds: inputSkippedWritingStepIds,
  userId,
}: {
  lessonId: string;
  run: LearningEvent;
  skippedWritingStepIds?: string[];
  userId: string;
}) {
  const skippedWritingStepIds = run.endedAt
    ? readSkippedWritingStepIds(run)
    : [...new Set(inputSkippedWritingStepIds)];

  const progress = await loadProgressRuns({ lessonId, until: run.startedAt, userId });
  const sittings = progress.length > 0 ? progress : [run];
  const since = sittings[0]?.startedAt;

  const version =
    (await findOpenedVersion({
      lessonId,
      since,
      /** Saved skips identify a closed run even if a later answer shares its end timestamp. */
      stepIds: run.endedAt ? skippedWritingStepIds : [],
      until: run.endedAt ?? undefined,
      userId,
    })) ??
    (skippedWritingStepIds.length > 0
      ? await findOpenedVersion({ lessonId, stepIds: skippedWritingStepIds, userId })
      : null);

  // An excused first answer leaves no attempt to identify the version the learner opened.
  const retired =
    version === null &&
    (await prisma.step.findFirst({
      orderBy: { retiredAt: "asc" },
      select: { version: true },
      where: {
        createdAt: { lte: run.startedAt },
        lessonId,
        retiredAt: { gte: run.startedAt },
        staged: false,
      },
    }));

  const lesson = await findPlayableLessonRow({
    lessonId,
    userId,
    version: version ?? (retired ? retired.version : null),
  });

  return { lesson, sittings, skippedWritingStepIds };
}
