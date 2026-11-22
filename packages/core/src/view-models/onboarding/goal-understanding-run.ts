import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { type GoalUnderstanding, understandGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getOnboardingDraftsCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../../plans/daily-minutes";
import { loadDraftMaterial } from "./_utils/draft-material";
import { type ExamLookup, type FoundExam, listExamLookups } from "./_utils/exam-facts";
import { completeDraft, parseStoredUnderstanding } from "./_utils/onboarding-draft";
import { findCachedUnderstanding, saveUnderstanding } from "./_utils/understanding-cache";
import { getLearnerToday } from "./_utils/understanding-view";
import { type MaterialIntent } from "./onboarding-contract";
import { formatReadingMaterial } from "./reading-material";

export {
  type ExamCandidate,
  type ExamLookup,
  type ExamMatch,
  type FoundExam,
  type StoredExam,
  type StoredExamSearch,
  decideStoredExam,
  readMatchedExam,
  searchExamDates,
  searchStoredExam,
} from "./_utils/exam-facts";

/** System-workflow input only, after prepareGoalUnderstandingRun authorized the learner; does not read a session. */
export type UnderstandingRunDraft = {
  id: string;
  language: string;
  materialIntent: MaterialIntent | null;
  prompt: string;
  /** Ids only: the material's text is read inside the step that sends it to the model. */
  sourceIds: string[];
  status: "failed" | "understanding" | "understood";
  timeZone: string;
  userId: string;
};

type Provenance = { model: string; promptVersion: string; runId: string };

export type UnderstoodWords = { provenance: Provenance; result: GoalUnderstanding };

/** `exams` has one entry per goal, in order: null for a goal that names no exam. */
export type GoalReading = { exams: (ExamLookup | null)[]; result: GoalUnderstanding };

const SERVICE_TIER = chooseServiceTier({ wait: "learner" });

/** The draft a run reads; null when it's gone, with the learner's account. */
export async function loadUnderstandingDraft(
  draftId: string,
): Promise<UnderstandingRunDraft | null> {
  return prisma.onboardingDraft.findUnique({
    select: {
      id: true,
      language: true,
      materialIntent: true,
      prompt: true,
      sourceIds: true,
      status: true,
      timeZone: true,
      userId: true,
    },
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

  const recorded = await writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const { count } = await tx.onboardingDraft.updateMany({
      data: { runId },
      where: {
        OR: [{ runId: null }, { runId: { not: runId } }],
        id: draftId,
        userId: draft.userId,
      },
    });

    return count === 0 ? unchanged(false) : true;
  });

  if (recorded) {
    revalidateCacheTags([getOnboardingDraftsCacheTag(draft.userId)]);
  }
}

function hasMaterial(draft: UnderstandingRunDraft): boolean {
  return draft.sourceIds.length > 0;
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

  if (!hasMaterial(draft)) {
    return { exams, result };
  }

  // A test on the learner's own material has no public dates, but a public exam they name does.
  const words = normalizeString(draft.prompt);

  return {
    exams: exams.map((lookup) =>
      lookup && words.includes(normalizeString(lookup.exam.examName)) ? lookup : null,
    ),
    result,
  };
}

/**
 * Today's reading of the same words, reused without a model call and without saving it again; null
 * when none is kept. Words sent with material are never read from or kept for the words alone.
 */
export async function findKeptReading(draft: UnderstandingRunDraft): Promise<GoalReading | null> {
  if (hasMaterial(draft)) {
    return null;
  }

  const cached = await findCachedUnderstanding({
    language: draft.language,
    normalizedPrompt: normalizeString(draft.prompt),
    now: new Date(),
    userId: draft.userId,
  });

  return cached ? toReading({ draft, result: cached }) : null;
}

/** Sharing an upload during the run moves the draft to the shared copy, so the ids are read now. */
async function readMaterial(draft: UnderstandingRunDraft) {
  const current = await prisma.onboardingDraft.findUnique({
    select: { sourceIds: true, userId: true },
    where: { id: draft.id },
  });

  const sources = current ? await loadDraftMaterial(current) : [];
  const overview = formatReadingMaterial({ sources });
  return overview === null ? null : { intent: draft.materialIntent, overview };
}

export async function understandGoalWords(draft: UnderstandingRunDraft): Promise<UnderstoodWords> {
  const understood = await understandGoal({
    analytics: { contentScope: "personal", distinctId: draft.userId },
    dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    goal: draft.prompt,
    language: draft.language,
    material: hasMaterial(draft) ? await readMaterial(draft) : null,
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

/** A declined unsafe intent overrides the understanding route; a reading of the words alone is kept for the learner's same words today. */
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

  if (!hasMaterial(draft)) {
    await saveUnderstanding({
      language: draft.language,
      normalizedPrompt: normalizeString(draft.prompt),
      provenance: words.provenance,
      result,
      userId: draft.userId,
    });
  }

  return toReading({ draft, result });
}

export type UnderstoodLanguagePair = { language: string; targetLanguage: string };

/** Saves the draft card with what the run found for each goal's exam; returns language pairs needing level-test preparation. */
export async function completeUnderstandingDraft({
  draft,
  exams,
  understanding: result,
  platform,
}: {
  draft: UnderstandingRunDraft;
  exams: (FoundExam | null)[];
  understanding: GoalUnderstanding;
  platform?: AnalyticsPlatform | null;
}): Promise<UnderstoodLanguagePair[]> {
  const completed = await completeDraft({ draft, exams, platform, understanding: result });
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

  const failed = await writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const { count } = await tx.onboardingDraft.updateMany({
      data: { status: "failed" },
      where: { id: draftId, status: "understanding", userId: draft.userId },
    });

    return count === 0 ? unchanged(false) : true;
  });

  if (failed) {
    revalidateCacheTags([getOnboardingDraftsCacheTag(draft.userId)]);
  }
}
