import "server-only";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { completeDraft, findOwnedDraft, loadDraftView } from "./_utils/onboarding-draft";
import { findCachedUnderstanding } from "./_utils/understanding-cache";
import { type OnboardingDraftView } from "./onboarding-contract";

export type GoalUnderstandingRunResult =
  | RefusedUsage
  | { status: "notFound" | "unauthorized" }
  | { draft: OnboardingDraftView; status: "start" | "understood" };

/**
 * Gets a draft ready for the run that reads its words, when the learner starts it or tries again:
 * `understood` when nothing needs to run (already read, or the same words were understood today),
 * `start` when a run should start. A new draft's first run was already claimed when it was saved;
 * starting one again is another of the learner's small AI calls (`claimAssist`). A failed draft
 * goes back to being read.
 */
export async function prepareGoalUnderstandingRun({
  draftId,
}: {
  draftId: string;
}): Promise<GoalUnderstandingRunResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const draft = await findOwnedDraft({ draftId, userId: session.user.id });

  if (!draft) {
    return { status: "notFound" };
  }

  if (draft.status === "understood") {
    return { draft: await loadDraftView(draft), status: "understood" };
  }

  const cached = await findCachedUnderstanding({
    language: draft.language,
    normalizedPrompt: normalizeString(draft.prompt),
    now: new Date(),
  });

  if (cached) {
    const understood = await completeDraft({ draft, understanding: cached });
    return { draft: await loadDraftView(understood), status: "understood" };
  }

  const usage = draft.runId === null ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const ready =
    draft.status === "failed"
      ? await prisma.onboardingDraft.update({
          data: { status: "understanding" },
          where: { id: draft.id },
        })
      : draft;

  return { draft: await loadDraftView(ready), status: "start" };
}
