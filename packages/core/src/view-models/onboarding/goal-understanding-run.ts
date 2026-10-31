import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { type GoalUnderstanding, understandGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../../plans/daily-minutes";
import { type ExamLookup, type FoundExam, listExamLookups } from "./_utils/exam-facts";
import { completeDraft, parseStoredUnderstanding } from "./_utils/onboarding-draft";
import { findCachedUnderstanding, saveUnderstanding } from "./_utils/understanding-cache";
import { getLearnerToday } from "./_utils/understanding-view";

export {
  type ExamLookup,
  type FoundExam,
  type StoredExam,
  findStoredExam,
  searchExamDates,
} from "./_utils/exam-facts";

/** System-workflow input only, after prepareGoalUnderstandingRun authorized the learner; does not read a session. */
export type UnderstandingRunDraft = {
  id: string;
  language: string;
  prompt: string;
  status: "failed" | "understanding" | "understood";
  timeZone: string;
  userId: string;
};

type Provenance = { model: string; promptVersion: string; runId: string };

export type UnderstoodWords = { provenance: Provenance; result: GoalUnderstanding };

/** `exams` has one entry per goal, in order: null for a goal that names no exam. */
export type GoalReading = { exams: (ExamLookup | null)[]; result: GoalUnderstanding };

const SERVICE_TIER = chooseServiceTier({ reuse: "personal", small: true, wait: "learner" });

/** The draft a run reads; null when it's gone, with the learner's account. */
export async function loadUnderstandingDraft(
  draftId: string,
): Promise<UnderstandingRunDraft | null> {
  return prisma.onboardingDraft.findUnique({
    select: { id: true, language: true, prompt: true, status: true, timeZone: true, userId: true },
    where: { id: draftId },
  });
}

/** Retain the run identity so refreshes follow it without starting another. */
export async function recordUnderstandingRun({
  draftId,
  runId,
}: {
  draftId: string;
  runId: string;
}): Promise<void> {
  const draft = await prisma.onboardingDraft.findUnique({ where: { id: draftId } });

  if (!draft) {
    return;
  }

  await writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const { count } = await tx.onboardingDraft.updateMany({
      data: { runId },
      where: {
        OR: [{ runId: null }, { runId: { not: runId } }],
        id: draftId,
        userId: draft.userId,
      },
    });

    return count === 0 ? unchanged(null) : null;
  });
}

function toReading({
  draft,
  result,
}: {
  draft: UnderstandingRunDraft;
  result: GoalUnderstanding;
}): GoalReading {
  const exams = listExamLookups({
    language: draft.language,
    today: getLearnerToday(draft.timeZone),
    understanding: result,
    words: draft.prompt,
  });

  return { exams, result };
}

/** Today's reading of the same words, reused without a model call and without saving it again; null when none is kept. */
export async function findKeptReading(draft: UnderstandingRunDraft): Promise<GoalReading | null> {
  const cached = await findCachedUnderstanding({
    language: draft.language,
    normalizedPrompt: normalizeString(draft.prompt),
    now: new Date(),
    userId: draft.userId,
  });

  return cached ? toReading({ draft, result: cached }) : null;
}

export async function understandGoalWords(draft: UnderstandingRunDraft): Promise<UnderstoodWords> {
  const understood = await understandGoal({
    analytics: { contentScope: "personal", distinctId: draft.userId },
    dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    goal: draft.prompt,
    language: draft.language,
    serviceTier: SERVICE_TIER,
    today: getLearnerToday(draft.timeZone),
  });

  const { model, promptVersion, runId } = understood.provenance;

  return { provenance: { model, promptVersion, runId }, result: understood.data };
}

export async function isUnsafeGoal(draft: UnderstandingRunDraft): Promise<boolean> {
  const intent = await classifyCourseIntent({
    analytics: { contentScope: "personal", distinctId: draft.userId },
    prompt: draft.prompt,
    serviceTier: SERVICE_TIER,
  });

  return intent.data.intent === "unsafe";
}

/** A declined unsafe intent overrides the understanding route; the reading is kept for the learner's same words today. */
export async function saveGoalReading({
  draft,
  unsafe,
  words,
}: {
  draft: UnderstandingRunDraft;
  unsafe: boolean;
  words: UnderstoodWords;
}): Promise<GoalReading> {
  const result: GoalUnderstanding = unsafe ? { route: "unsafe" } : words.result;

  await saveUnderstanding({
    language: draft.language,
    normalizedPrompt: normalizeString(draft.prompt),
    provenance: words.provenance,
    result,
    userId: draft.userId,
  });

  return toReading({ draft, result });
}

export type UnderstoodLanguagePair = { language: string; targetLanguage: string };

/** Saves the draft card with what the run found for each goal's exam; returns language pairs needing level-test preparation. */
export async function completeUnderstandingDraft({
  draft,
  exams,
  understanding: result,
}: {
  draft: UnderstandingRunDraft;
  exams: (FoundExam | null)[];
  understanding: GoalUnderstanding;
}): Promise<UnderstoodLanguagePair[]> {
  const completed = await completeDraft({ draft, exams, understanding: result });
  const understanding = parseStoredUnderstanding(completed.understanding);

  if (understanding?.status !== "goals") {
    return [];
  }

  return understanding.goals.flatMap(({ draft: goal }) =>
    goal.kind === "language" && goal.targetLanguage
      ? [{ language: goal.language, targetLanguage: goal.targetLanguage }]
      : [],
  );
}

export async function failUnderstandingDraft(draftId: string): Promise<void> {
  const draft = await prisma.onboardingDraft.findUnique({ where: { id: draftId } });

  if (!draft) {
    return;
  }

  await writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const { count } = await tx.onboardingDraft.updateMany({
      data: { status: "failed" },
      where: { id: draftId, status: "understanding", userId: draft.userId },
    });

    return count === 0 ? unchanged(null) : null;
  });
}
