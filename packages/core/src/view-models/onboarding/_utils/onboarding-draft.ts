import "server-only";
import { type GoalUnderstanding } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { type OnboardingDraft, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type GoalUnderstandingView, type OnboardingDraftView } from "../onboarding-contract";
import { goalUnderstandingViewSchema } from "../onboarding-view-schemas";
import { getLearnerToday, toUnderstandingView } from "./understanding-view";

/** The learner's own draft; another learner's reads as missing. */
export async function findOwnedDraft({
  draftId,
  userId,
}: {
  draftId: string;
  userId: string;
}): Promise<OnboardingDraft | null> {
  if (!isUuid(draftId)) {
    return null;
  }

  return prisma.onboardingDraft.findFirst({ where: { id: draftId, userId } });
}

/**
 * The main goal created from a draft: goals created from it carry its id as
 * `details.onboardingId`. Goals the learner archived by starting over don't count.
 */
export async function findDraftGoalId(draft: Pick<OnboardingDraft, "id" | "userId">) {
  const goal = await prisma.goal.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: {
      details: { equals: draft.id, path: ["onboardingId"] },
      status: { not: "archived" },
      userId: draft.userId,
    },
  });

  return goal?.id ?? null;
}

/** A stored understanding is read back through its contract, so an old shape can't leak out. */
export function parseStoredUnderstanding(value: unknown): GoalUnderstandingView | null {
  return goalUnderstandingViewSchema.safeParse(value).data ?? null;
}

export function toDraftView({
  draft,
  goalId,
}: {
  draft: OnboardingDraft;
  goalId: string | null;
}): OnboardingDraftView {
  const understanding =
    draft.status === "understood" ? parseStoredUnderstanding(draft.understanding) : null;

  return {
    generationId: draft.runId,
    goalId,
    id: draft.id,
    prompt: draft.prompt,
    // One this version can't read anymore is read again, like a failed one.
    status: draft.status === "understood" && !understanding ? "failed" : draft.status,
    understanding,
  };
}

export async function loadDraftView(draft: OnboardingDraft): Promise<OnboardingDraftView> {
  return toDraftView({ draft, goalId: await findDraftGoalId(draft) });
}

/**
 * Turns what was understood into the card the learner sees and keeps it on the draft: the goals'
 * details carry the draft's id, and exam dates are read for the learner's own today.
 */
export async function completeDraft({
  draft,
  understanding,
}: {
  draft: Pick<OnboardingDraft, "id" | "language" | "prompt" | "timeZone">;
  understanding: GoalUnderstanding;
}): Promise<OnboardingDraft> {
  const view = await toUnderstandingView({
    context: {
      goal: draft.prompt,
      language: draft.language,
      onboardingId: draft.id,
      today: getLearnerToday(draft.timeZone),
    },
    understanding,
  });

  return prisma.onboardingDraft.update({
    data: { status: "understood", understanding: view },
    where: { id: draft.id },
  });
}
