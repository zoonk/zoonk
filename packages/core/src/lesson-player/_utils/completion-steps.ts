import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  filterSkippedSteps,
  findUnfinishedActivities,
} from "../../language/activities/language-activities";
import { loadSkippedActivities } from "../../language/activities/skipped-activities";
import { isAnswerableStep } from "../lesson-run";
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
  const [steps, skippedActivities] = await Promise.all([
    loadPlayableSteps({ lesson, rows: lesson.steps }),
    lesson.targetLanguage
      ? loadSkippedActivities({ targetLanguage: lesson.targetLanguage, userId })
      : null,
  ]);

  const writingStepIds = new Set(
    steps.filter((step) => step.kind === "typedAnswer").map((step) => step.id),
  );

  if (skippedWritingStepIds.some((id) => !writingStepIds.has(id))) {
    return null;
  }

  return {
    optionalStepIds: new Set([
      ...getLatePictureStepIds({ rows: lesson.steps, runStartedAt }),
      ...skippedWritingStepIds,
    ]),
    hasLanguagePlan: skippedActivities !== null,
    steps,
  };
}

/**
 * Completion accepts any screens the learner's plan could have served, since their copy of a lesson may predate a plan
 * change (an app's cached copy, a change mid-lesson, on another device or between sittings) and the plan lets them
 * skip any kind of practice: in a language lesson of a language they have a plan for, a kind of practice they didn't
 * finish is left out, unless that leaves only the summary, which no read serves. A screen they answered still counts.
 */
export function findOptionalStepIds({
  answers,
  completionSteps: { hasLanguagePlan, optionalStepIds, steps },
}: {
  answers: readonly { stepId: string | null }[];
  completionSteps: NonNullable<Awaited<ReturnType<typeof loadCompletionSteps>>>;
}): ReadonlySet<string> {
  if (!hasLanguagePlan) {
    return optionalStepIds;
  }

  const unfinished = findUnfinishedActivities({
    doneStepIds: new Set([...optionalStepIds, ...answers.flatMap((answer) => answer.stepId ?? [])]),
    steps: steps.filter((step) => isAnswerableStep(step)),
  });

  const kept = new Set(
    filterSkippedSteps({ activities: unfinished, steps }).map((step) => step.id),
  );

  return new Set([
    ...optionalStepIds,
    ...steps.filter((step) => !kept.has(step.id)).map((step) => step.id),
  ]);
}
