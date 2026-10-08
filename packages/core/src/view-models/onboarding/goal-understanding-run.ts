import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { type GoalUnderstanding, understandGoal } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { completeDraft, parseStoredUnderstanding } from "./_utils/onboarding-draft";
import { saveUnderstanding } from "./_utils/understanding-cache";
import { getLearnerToday } from "./_utils/understanding-view";

/**
 * The run's side of a draft: system work for the workflow that reads a learner's typed goal, after
 * `prepareGoalUnderstandingRun` checked who asked. None of it reads a session.
 */

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

/** Keeps the run on its draft, so a refresh follows it instead of starting another. */
export async function recordUnderstandingRun({
  draftId,
  runId,
}: {
  draftId: string;
  runId: string;
}): Promise<void> {
  await prisma.onboardingDraft.updateMany({ data: { runId }, where: { id: draftId } });
}

/**
 * Reads the words with the model. Today's unsafe-intent classifier runs beside it, so a goal it
 * declines at routing today is declined here too, whatever route the understanding picked.
 */
export async function readGoalWords(
  draft: Pick<UnderstandingRunDraft, "language" | "prompt" | "timeZone" | "userId">,
): Promise<{ provenance: Provenance; result: GoalUnderstanding }> {
  const analytics = { contentScope: "personal" as const, distinctId: draft.userId };
  // The learner watches their words being read: two small one-off calls worth the premium.
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

/** A language the learner will take a level test in: the language they learn it from and it. */
export type UnderstoodLanguagePair = { language: string; targetLanguage: string };

/**
 * Keeps what was understood for the same words today, then puts the card on the draft, with the
 * named exam's dates. Returns the language goals it found, so their level tests can be written
 * before the learner gets there.
 */
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

/** The words couldn't be read: the learner sees it and can try again. */
export async function failUnderstandingDraft(draftId: string): Promise<void> {
  await prisma.onboardingDraft.updateMany({
    data: { status: "failed" },
    where: { id: draftId, status: "understanding" },
  });
}
