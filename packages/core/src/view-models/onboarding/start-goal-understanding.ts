import "server-only";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getOnboardingDraftsCacheTag } from "../../cache/tags";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { findOwnUploadIds } from "./_utils/draft-material";
import { completeDraft, toDraftView } from "./_utils/onboarding-draft";
import { findCompletableUnderstanding } from "./_utils/understanding-cache";
import { type GoalUnderstandingInput, type OnboardingDraftView } from "./onboarding-contract";

export type StartGoalUnderstandingResult =
  | RefusedUsage
  | { status: "unauthorized" }
  | { draft: OnboardingDraftView; status: "understanding" | "understood" };

/**
 * Requires a session, including guests; understands this learner's recent words at once unless they
 * name an exam or come with material, otherwise claims AI allowance and returns a draft to start.
 * The draft keeps only material that's the learner's own uploads.
 */
export async function startGoalUnderstanding(
  input: GoalUnderstandingInput,
): Promise<StartGoalUnderstandingResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const guestLimit = await findGuestGoalLimit();

  if (guestLimit) {
    return { limit: guestLimit, status: "limitReached" };
  }

  const sourceIds = await findOwnUploadIds({
    sourceIds: input.sourceIds ?? [],
    userId: session.user.id,
  });

  // The words alone don't say what a reading with material found, so it's never reused.
  const cached =
    sourceIds.length > 0
      ? null
      : await findCompletableUnderstanding({
          language: input.language,
          normalizedPrompt: normalizeString(input.goal),
          now: new Date(),
          userId: session.user.id,
        });

  const usage = cached ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const draft = await writeLearnerChange({ userId: session.user.id }, (tx) =>
    tx.onboardingDraft.create({
      data: {
        language: input.language,
        materialIntent: sourceIds.length > 0 ? (input.materialIntent ?? null) : null,
        prompt: input.goal,
        sourceIds,
        timeZone: input.timeZone ?? "UTC",
        userId: session.user.id,
      },
    }),
  );

  revalidateCacheTags([getOnboardingDraftsCacheTag(session.user.id)]);

  if (!cached) {
    return { draft: await toDraftView({ draft, goalId: null }), status: "understanding" };
  }

  const understood = await completeDraft({ draft, exams: [], understanding: cached });

  return { draft: await toDraftView({ draft: understood, goalId: null }), status: "understood" };
}
