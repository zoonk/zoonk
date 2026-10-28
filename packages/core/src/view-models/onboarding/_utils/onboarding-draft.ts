import "server-only";
import { type GoalUnderstanding } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { type OnboardingDraft, type TransactionClient, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
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

/** Excludes archived goals even when they retain details.onboardingId. */
export async function findDraftGoalId(
  draft: Pick<OnboardingDraft, "id" | "userId">,
  client: TransactionClient = prisma,
) {
  const goal = await client.goal.findFirst({
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
    // An unreadable stored understanding must be retried rather than exposed as understood.
    status: draft.status === "understood" && !understanding ? "failed" : draft.status,
    understanding,
  };
}

export async function loadDraftView(draft: OnboardingDraft): Promise<OnboardingDraftView> {
  return toDraftView({ draft, goalId: await findDraftGoalId(draft) });
}

/** Persists the card using the draft's learner-local today and carries its identity into each goal. */
export async function completeDraft({
  allowDateSearch,
  draft,
  understanding,
}: {
  /** A reused understanding's exam day is searched for only as small AI help (`allowDateSearch`). */
  allowDateSearch?: () => Promise<boolean>;
  draft: Pick<OnboardingDraft, "id" | "language" | "prompt" | "timeZone" | "userId">;
  understanding: GoalUnderstanding;
}): Promise<OnboardingDraft> {
  const view = await toUnderstandingView({
    context: {
      allowDateSearch,
      goal: draft.prompt,
      language: draft.language,
      onboardingId: draft.id,
      today: getLearnerToday(draft.timeZone),
      userId: draft.userId,
    },
    understanding,
  });

  return writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const { count } = await tx.onboardingDraft.updateMany({
      data: { status: "understood", understanding: view },
      where: {
        NOT: { status: "understood", understanding: { equals: view } },
        id: draft.id,
        userId: draft.userId,
      },
    });

    const current = await tx.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });
    return count === 0 ? unchanged(current) : current;
  });
}
