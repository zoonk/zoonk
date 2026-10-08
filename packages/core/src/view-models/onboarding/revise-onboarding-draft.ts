import "server-only";
import { type OnboardingDraft, prisma } from "@zoonk/db";
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

  const revised = await reviseUnderstanding({
    edit,
    today: getLearnerToday(draft.timeZone),
    understanding,
  });

  if (!revised) {
    return { status: "invalid" };
  }

  // Saved only over the version it was computed from, so two quick fixes can't undo each other.
  const saved = await prisma.onboardingDraft.updateMany({
    data: { understanding: revised },
    where: { id: draft.id, updatedAt: draft.updatedAt },
  });

  const current = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

  if (saved.count > 0) {
    return { draft: toDraftView({ draft: current, goalId: null }), status: "revised" };
  }

  return attempt < MAX_ATTEMPTS
    ? applyEdit({ attempt: attempt + 1, draft: current, edit })
    : { status: "conflict" };
}

/**
 * Saves one fix the learner made on the "Here's what I understood" card and recomputes every
 * field that depends on it (a new exam year reads that year's dates and drops the old deadline).
 * Only goals still being confirmed can be fixed: `conflict` while the words are being read or once
 * goals were created from the draft; `invalid` when the fix doesn't apply to that goal. A new exam
 * year's day is searched for on the web only as one of the learner's small AI calls (`allowDateSearch`).
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
