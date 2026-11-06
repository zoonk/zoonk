import { startLevelTestBank } from "@/lib/level-test-bank";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { GOAL_UNDERSTANDING_READY_STEP } from "@zoonk/core/library/generation/steps";
import {
  type ExamLookup,
  type FoundExam,
  type GoalReading,
  type StoredExam,
  type UnderstandingRunDraft,
  type UnderstoodLanguagePair,
} from "@zoonk/core/view-models/onboarding/understanding-run";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import {
  classifyGoalIntentStep,
  completeUnderstandingStep,
  decideStoredExamStep,
  failUnderstandingStep,
  findKeptReadingStep,
  readMatchedExamStep,
  recordUnderstandingRunStep,
  saveGoalReadingStep,
  searchExamDatesStep,
  searchStoredExamStep,
  understandGoalStep,
  understandingProgressStep,
} from "./steps/goal-understanding-steps";

async function startLevelTests({
  pairs,
  userId,
}: {
  pairs: UnderstoodLanguagePair[];
  userId: string;
}) {
  await Promise.allSettled(
    pairs.map((pair) => startLevelTestBank({ analytics: { distinctId: userId }, pair })),
  );
}

async function readGoal(draft: UnderstandingRunDraft): Promise<GoalReading> {
  const kept = await findKeptReadingStep(draft);

  if (kept) {
    return kept;
  }

  const [words, unsafe] = await Promise.all([
    understandGoalStep(draft),
    classifyGoalIntentStep(draft),
  ]);

  return saveGoalReadingStep({ draft, unsafe, words });
}

async function findStoredExamInLanguage({
  language,
  lookup,
}: {
  language: string;
  lookup: ExamLookup;
}): Promise<StoredExam | null> {
  const search = await searchStoredExamStep({ language, lookup });

  if (search.status === "settled") {
    return search.stored;
  }

  const matches = await Promise.all(
    search.candidates.map((candidate) =>
      decideStoredExamStep({ candidate, request: search.request }),
    ),
  );

  return readMatchedExamStep({ lookup, matches });
}

async function findStoredExamIn({
  languages: [language, ...others],
  lookup,
}: {
  languages: string[];
  lookup: ExamLookup;
}): Promise<StoredExam | null> {
  if (!language) {
    return null;
  }

  const stored = await findStoredExamInLanguage({ language, lookup }).catch(() => null);
  return stored ?? findStoredExamIn({ languages: others, lookup });
}

/** A lookup step that gives up leaves the date to be confirmed instead of failing the card: full notice research still runs after the goal is created. */
async function findExam({
  lookup,
  userId,
}: {
  lookup: ExamLookup;
  userId: string;
}): Promise<FoundExam> {
  const stored = await findStoredExamIn({ languages: lookup.noticeLanguages, lookup });
  const searched = await searchExamDatesStep({ lookup, stored, userId }).catch(() => []);

  return { lookup, searched, stored };
}

async function findExams({
  draft,
  reading,
}: {
  draft: UnderstandingRunDraft;
  reading: GoalReading;
}): Promise<(FoundExam | null)[]> {
  if (reading.exams.every((lookup) => lookup === null)) {
    return [];
  }

  await understandingProgressStep({ entityId: draft.id, status: "started", step: "findExamDates" });

  return Promise.all(
    reading.exams.map(async (lookup) => lookup && findExam({ lookup, userId: draft.userId })),
  );
}

async function understandDraft(
  draft: UnderstandingRunDraft,
  platform?: AnalyticsPlatform | null,
): Promise<UnderstoodLanguagePair[]> {
  if (draft.status === "understood") {
    return [];
  }

  try {
    const reading = await readGoal(draft);
    const exams = await findExams({ draft, reading });

    return await completeUnderstandingStep({
      draft,
      exams,
      platform: platform ?? null,
      understanding: reading.result,
    });
  } catch (error) {
    await Promise.all([
      failUnderstandingStep(draft.id),
      understandingProgressStep(
        {
          entityId: draft.id,
          reason: "aiGenerationFailed",
          status: "error",
          step: WORKFLOW_ERROR_STEP,
        },
        { last: true },
      ),
    ]);

    throw error;
  }
}

export type GoalUnderstandingRunResult = { draftId: string; status: "missing" | "understood" };

export function getGoalUnderstandingToken(draftId: string): string {
  return `goal-understanding:${draftId}`;
}

export async function goalUnderstandingWorkflow({
  draftId,
  platform,
}: {
  draftId: string;
  platform?: AnalyticsPlatform | null;
}): Promise<GoalUnderstandingRunResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const draft = await recordUnderstandingRunStep({ draftId, runId: workflowRunId });

  if (!draft) {
    await understandingProgressStep(
      { entityId: draftId, reason: "notFound", status: "error", step: WORKFLOW_ERROR_STEP },
      { last: true },
    );

    return { draftId, status: "missing" };
  }

  const pairs = await understandDraft(draft, platform);

  await understandingProgressStep(
    { entityId: draftId, status: "completed", step: GOAL_UNDERSTANDING_READY_STEP },
    { last: true },
  );

  await startLevelTests({ pairs, userId: draft.userId });

  return { draftId, status: "understood" };
}
