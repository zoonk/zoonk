import "server-only";
import { getSession } from "../../users/get-session";
import { findOwnedDraft, loadDraftView } from "./_utils/onboarding-draft";
import { type OnboardingDraftView } from "./onboarding-contract";

export type OnboardingDraftResult =
  | { draft: OnboardingDraftView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** Requires draft ownership; uncached because generation and learner edits change it. */
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
