import { type LearningEvent } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { findOpenedVersion, findPlayableLessonRow } from "./lesson-rows";
import { loadProgressRuns } from "./lesson-runs";

/** Completed runs retain skips even when a retry omits them or the lesson is rewritten. */
function readSkippedWritingStepIds(run: LearningEvent): string[] {
  const ids = isJsonObject(run.contentIds) ? run.contentIds.skippedWritingStepIds : null;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** Skipped writing also names the opened version when no recorded answer establishes it. */
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

  const lesson = await findPlayableLessonRow({ lessonId, userId, version });

  return { lesson, sittings, skippedWritingStepIds };
}
