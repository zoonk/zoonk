import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { filterSkippedSteps } from "../../language/activities/language-activities";
import { loadSkippedActivities } from "../../language/activities/skipped-activities";
import { loadPlayableSteps } from "./load-playable-steps";
import { getLatePictureStepIds } from "./screen-pictures";

/** Completion skips must commit atomically without inventing graded attempts or reviews. */
export async function recordSkippedWritingSteps({
  run,
  skippedWritingStepIds,
  tx,
}: {
  run: LearningEvent;
  skippedWritingStepIds: string[];
  tx: TransactionClient;
}) {
  if (skippedWritingStepIds.length === 0) {
    return;
  }

  await tx.learningEvent.update({
    data: {
      contentIds: {
        ...(isJsonObject(run.contentIds) ? run.contentIds : {}),
        skippedWritingStepIds,
      },
    },
    where: { id: run.id },
  });
}

/** Temporary writing skips are not permanent Plan preferences and add no verdict. */
export async function loadCompletionSteps({
  lesson,
  runStartedAt,
  skippedWritingStepIds = [],
  userId,
}: {
  lesson: Parameters<typeof loadPlayableSteps>[0]["lesson"] & {
    steps: Parameters<typeof loadPlayableSteps>[0]["rows"];
  };
  runStartedAt: Date;
  skippedWritingStepIds?: string[];
  userId: string;
}) {
  const [allSteps, skippedActivities] = await Promise.all([
    loadPlayableSteps({ lesson, rows: lesson.steps }),
    lesson.targetLanguage
      ? loadSkippedActivities({ targetLanguage: lesson.targetLanguage, userId })
      : [],
  ]);

  const writingStepIds = new Set(
    allSteps.filter((step) => step.kind === "typedAnswer").map((step) => step.id),
  );

  if (skippedWritingStepIds.some((id) => !writingStepIds.has(id))) {
    return null;
  }

  return {
    optionalStepIds: new Set([
      ...getLatePictureStepIds({ rows: lesson.steps, runStartedAt }),
      ...skippedWritingStepIds,
    ]),
    steps: filterSkippedSteps({ activities: skippedActivities, steps: allSteps }),
  };
}
