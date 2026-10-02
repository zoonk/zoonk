import "server-only";
import { getSession } from "../../users/get-session";
import { findOwnedDraft, loadDraftView } from "./_utils/onboarding-draft";
import { type OnboardingDraftView } from "./onboarding-contract";

export type OnboardingDraftResult =
  | { draft: OnboardingDraftView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/**
 * A goal the learner typed, as it stands: still being read (with the run to follow), understood
 * with their fixes, or failed. Only its learner can read it. Uncached: it changes while it's read.
 */
export async function getOnboardingDraft({
  draftId,
}: {
  draftId: string;
}): Promise<OnboardingDraftResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const draft = await findOwnedDraft({ draftId, userId: session.user.id });

  if (!draft) {
    return { status: "notFound" };
  }

  return { draft: await loadDraftView(draft), status: "ready" };
}
