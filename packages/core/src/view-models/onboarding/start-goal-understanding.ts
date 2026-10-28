import "server-only";
import { normalizeString } from "@zoonk/utils/string";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { allowDateSearch } from "./_utils/date-search";
import { completeDraft, toDraftView } from "./_utils/onboarding-draft";
import { findCachedUnderstanding } from "./_utils/understanding-cache";
import { type GoalUnderstandingInput, type OnboardingDraftView } from "./onboarding-contract";

export type StartGoalUnderstandingResult =
  | RefusedUsage
  | { status: "unauthorized" }
  | { draft: OnboardingDraftView; status: "understanding" | "understood" };

/** Requires a session, including guests; reuses only this learner's recent words, otherwise claims AI allowance and returns a draft to start. */
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

  const cached = await findCachedUnderstanding({
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
        prompt: input.goal,
        timeZone: input.timeZone ?? "UTC",
        userId: session.user.id,
      },
    }),
  );

  if (!cached) {
    return { draft: toDraftView({ draft, goalId: null }), status: "understanding" };
  }

  const understood = await completeDraft({ allowDateSearch, draft, understanding: cached });

  return { draft: toDraftView({ draft: understood, goalId: null }), status: "understood" };
}
