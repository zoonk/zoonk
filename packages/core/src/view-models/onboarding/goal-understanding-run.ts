import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { type GoalUnderstanding, understandGoal } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { completeDraft, parseStoredUnderstanding } from "./_utils/onboarding-draft";
import { saveUnderstanding } from "./_utils/understanding-cache";
import { getLearnerToday } from "./_utils/understanding-view";

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

/** A declined unsafe intent overrides the understanding route. */
export async function readGoalWords(
  draft: Pick<UnderstandingRunDraft, "language" | "prompt" | "timeZone" | "userId">,
): Promise<{ provenance: Provenance; result: GoalUnderstanding }> {
  const analytics = { contentScope: "personal" as const, distinctId: draft.userId };
  const serviceTier = chooseServiceTier({ reuse: "personal", small: true, wait: "learner" });

  const [understood, intent] = await Promise.all([
    understandGoal({
      analytics,
      goal: draft.prompt,
      language: draft.language,
      serviceTier,
      today: getLearnerToday(draft.timeZone),
    }),
    classifyCourseIntent({ analytics, prompt: draft.prompt, serviceTier }),
  ]);

  const { model, promptVersion, runId } = understood.provenance;

  return {
    provenance: { model, promptVersion, runId },
    result: intent.data.intent === "unsafe" ? { route: "unsafe" } : understood.data,
  };
}

export type UnderstoodLanguagePair = { language: string; targetLanguage: string };

/** Saves today's learner-private reading and draft card; returns language pairs needing level-test preparation. */
export async function completeUnderstandingDraft({
  draft,
  provenance,
  result,
}: {
  draft: UnderstandingRunDraft;
  provenance: Provenance;
  result: GoalUnderstanding;
}): Promise<UnderstoodLanguagePair[]> {
  await saveUnderstanding({
    language: draft.language,
    normalizedPrompt: normalizeString(draft.prompt),
    provenance,
    result,
    userId: draft.userId,
  });

  const completed = await completeDraft({ draft, understanding: result });
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
