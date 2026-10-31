import { createStepStream, progressStep } from "@/workflows/_shared/stream-status";
import { type GoalUnderstanding } from "@zoonk/ai/tasks/goals/understand-goal";
import { type ExamDescription } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { type GoalUnderstandingStepName } from "@zoonk/core/library/generation/steps";
import { type OnboardingExamDate } from "@zoonk/core/view-models/onboarding/contract";
import {
  type ExamCandidate,
  type ExamLookup,
  type ExamMatch,
  type FoundExam,
  type GoalReading,
  type StoredExam,
  type StoredExamSearch,
  type UnderstandingRunDraft,
  type UnderstoodLanguagePair,
  type UnderstoodWords,
  completeUnderstandingDraft,
  decideStoredExam,
  failUnderstandingDraft,
  findKeptReading,
  isUnsafeGoal,
  loadUnderstandingDraft,
  readMatchedExam,
  recordUnderstandingRun,
  saveGoalReading,
  searchExamDates,
  searchStoredExam,
  understandGoalWords,
} from "@zoonk/core/view-models/onboarding/understanding-run";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";

type UnderstandingStreamStep = GoalUnderstandingStepName | typeof WORKFLOW_ERROR_STEP;

export const understandingProgressStep = progressStep<UnderstandingStreamStep>;

export async function recordUnderstandingRunStep(input: {
  draftId: string;
  runId: string;
}): Promise<UnderstandingRunDraft | null> {
  "use step";

  await recordUnderstandingRun(input);
  return loadUnderstandingDraft(input.draftId);
}

export async function findKeptReadingStep(
  draft: UnderstandingRunDraft,
): Promise<GoalReading | null> {
  "use step";

  await using stream = createStepStream<UnderstandingStreamStep>();
  await stream.status({ entityId: draft.id, status: "started", step: "readGoal" });

  return await findKeptReading(draft);
}

export async function understandGoalStep(draft: UnderstandingRunDraft): Promise<UnderstoodWords> {
  "use step";

  return understandGoalWords(draft);
}

export async function classifyGoalIntentStep(draft: UnderstandingRunDraft): Promise<boolean> {
  "use step";

  return isUnsafeGoal(draft);
}

export async function saveGoalReadingStep(input: {
  draft: UnderstandingRunDraft;
  unsafe: boolean;
  words: UnderstoodWords;
}): Promise<GoalReading> {
  "use step";

  return saveGoalReading(input);
}

export async function searchStoredExamStep(input: {
  language: string;
  lookup: ExamLookup;
}): Promise<StoredExamSearch> {
  "use step";

  return searchStoredExam(input);
}

export async function decideStoredExamStep(input: {
  candidate: ExamCandidate;
  request: ExamDescription;
}): Promise<ExamMatch | null> {
  "use step";

  return decideStoredExam(input);
}

export async function readMatchedExamStep(input: {
  lookup: ExamLookup;
  matches: (ExamMatch | null)[];
}): Promise<StoredExam | null> {
  "use step";

  return readMatchedExam(input);
}

export async function searchExamDatesStep(input: {
  lookup: ExamLookup;
  stored: StoredExam | null;
  userId: string;
}): Promise<OnboardingExamDate[]> {
  "use step";

  return searchExamDates(input);
}

export async function completeUnderstandingStep(input: {
  draft: UnderstandingRunDraft;
  exams: (FoundExam | null)[];
  understanding: GoalUnderstanding;
  platform?: AnalyticsPlatform | null;
}): Promise<UnderstoodLanguagePair[]> {
  "use step";

  return completeUnderstandingDraft(input);
}

export async function failUnderstandingStep(draftId: string): Promise<void> {
  "use step";

  await failUnderstandingDraft(draftId);
}
