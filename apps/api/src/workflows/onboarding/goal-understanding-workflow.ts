import { startLevelTestBank } from "@/lib/level-test-bank";
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
import { claimRunToken } from "../_shared/run-token";
import {
  classifyGoalIntentStep,
  completeUnderstandingStep,
  failUnderstandingStep,
  findKeptReadingStep,
  findStoredExamStep,
  recordUnderstandingRunStep,
  saveGoalReadingStep,
  searchExamDatesStep,
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

  const stored = await findStoredExamStep({ language, lookup }).catch(() => null);
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

async function understandDraft(draft: UnderstandingRunDraft): Promise<UnderstoodLanguagePair[]> {
  if (draft.status === "understood") {
    return [];
  }

  try {
    const reading = await readGoal(draft);
    const exams = await findExams({ draft, reading });

    return await completeUnderstandingStep({ draft, exams, understanding: reading.result });
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

export type GoalUnderstandingRunResult = {
  draftId: string;
  status: "joined" | "missing" | "understood";
};

export async function goalUnderstandingWorkflow({
  draftId,
}: {
  draftId: string;
}): Promise<GoalUnderstandingRunResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`goal-understanding:${draftId}`);

  if (conflict) {
    await understandingProgressStep(
      { entityId: conflict.runId, status: "started", step: "joinRunningUnderstanding" },
      { last: true },
    );

    return { draftId, status: "joined" };
  }

  const draft = await recordUnderstandingRunStep({ draftId, runId: workflowRunId });

  if (!draft) {
    await understandingProgressStep(
      { entityId: draftId, reason: "notFound", status: "error", step: WORKFLOW_ERROR_STEP },
      { last: true },
    );

    return { draftId, status: "missing" };
  }

  const pairs = await understandDraft(draft);

  await understandingProgressStep(
    { entityId: draftId, status: "completed", step: GOAL_UNDERSTANDING_READY_STEP },
    { last: true },
  );

  await startLevelTests({ pairs, userId: draft.userId });

  return { draftId, status: "understood" };
}
