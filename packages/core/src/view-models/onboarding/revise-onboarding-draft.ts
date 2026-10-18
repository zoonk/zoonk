import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type OnboardingDraft, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { assertTargetDates } from "../../plans/target-date-range";
import { getSession } from "../../users/get-session";
import {
  findDraftGoalId,
  findOwnedDraft,
  parseStoredUnderstanding,
  toDraftView,
} from "./_utils/onboarding-draft";
import { reviseUnderstanding } from "./_utils/revise-understanding";
import { getLearnerToday } from "./_utils/understanding-view";
import { type OnboardingDraftEdit, type OnboardingDraftView } from "./onboarding-contract";

export type ReviseOnboardingDraftResult =
  | { draft: OnboardingDraftView; status: "revised" }
  | { status: "conflict" | "invalid" | "notFound" | "unauthorized" };

/** Two fixes saved at the same moment: the later one is applied again over the earlier one. */
const MAX_ATTEMPTS = 2;

async function applyEdit({
  attempt = 1,
  draft,
  edit,
}: {
  attempt?: number;
  draft: OnboardingDraft;
  edit: OnboardingDraftEdit;
}): Promise<ReviseOnboardingDraftResult> {
  const understanding =
    draft.status === "understood" ? parseStoredUnderstanding(draft.understanding) : null;

  if (understanding?.status !== "goals" || (await findDraftGoalId(draft))) {
    return { status: "conflict" };
  }

  const today = getLearnerToday(draft.timeZone);

  // A deadline past what a plan reaches is refused before the card is saved; a past one is
  // `invalid`, as it always was.
  if (edit.field === "targetDate") {
    assertTargetDates({
      latestOnly: true,
      targets: [
        {
          current: understanding.goals[edit.goal]?.draft.targetDate,
          path: ["value"],
          targetDate: edit.value,
        },
      ],
      today,
    });
  }

  const revised = await reviseUnderstanding({ edit, today, understanding });

  if (!revised) {
    return { status: "invalid" };
  }

  // Saved only over the version it was computed from, so two quick fixes can't undo each other.
  const saved = await writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const current = await tx.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

    if (
      current.updatedAt.getTime() !== draft.updatedAt.getTime() ||
      !isDeepStrictEqual(current.understanding, draft.understanding)
    ) {
      return unchanged(false);
    }

    if (await findDraftGoalId(draft, tx)) {
      return unchanged(false);
    }

    const { count } = await tx.onboardingDraft.updateMany({
      data: { understanding: revised },
      where: {
        NOT: { understanding: { equals: revised } },
        id: draft.id,
        status: "understood",
        updatedAt: draft.updatedAt,
        userId: draft.userId,
      },
    });

    if (count > 0) {
      return true;
    }

    const same = await tx.onboardingDraft.findFirst({
      where: {
        id: draft.id,
        status: "understood",
        understanding: { equals: revised },
        updatedAt: draft.updatedAt,
      },
    });

    return unchanged(Boolean(same));
  });

  const current = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

  if (saved) {
    return { draft: toDraftView({ draft: current, goalId: null }), status: "revised" };
  }

  return attempt < MAX_ATTEMPTS
    ? applyEdit({ attempt: attempt + 1, draft: current, edit })
    : { status: "conflict" };
}

/**
 * Saves one fix the learner made on the "Here's what I understood" card and recomputes every
 * field that depends on it (another target's cut-off). Only goals still being confirmed can be
 * fixed: `conflict` while the words are being read or once goals were created from the draft;
 * `invalid` when the fix doesn't apply to that goal.
 */
export async function reviseOnboardingDraft({
  draftId,
  edit,
}: {
  draftId: string;
  edit: OnboardingDraftEdit;
}): Promise<ReviseOnboardingDraftResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const draft = await findOwnedDraft({ draftId, userId: session.user.id });

  return draft ? applyEdit({ draft, edit }) : { status: "notFound" };
}
