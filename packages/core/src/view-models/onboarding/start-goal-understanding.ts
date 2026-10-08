import "server-only";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { getSession } from "../../users/get-session";
import { allowDateSearch } from "./_utils/date-search";
import { completeDraft, toDraftView } from "./_utils/onboarding-draft";
import { findCachedUnderstanding } from "./_utils/understanding-cache";
import { type GoalUnderstandingInput, type OnboardingDraftView } from "./onboarding-contract";

export type StartGoalUnderstandingResult =
  | RefusedUsage
  | { status: "unauthorized" }
  | { draft: OnboardingDraftView; status: "understanding" | "understood" };

/**
 * Saves a goal the learner typed on the first onboarding screen as a draft, so a refresh shows the
 * same screen. The same words in the same language on the same day reuse one understanding, so
 * example goals are understood at once and cost nothing; other words come back `understanding`,
 * for the caller to start the run that reads them (`POST /v1/goal-understandings/{id}/generations`).
 * Anyone with a session can ask, guests included; reading new words is one of the learner's small
 * AI calls (`claimAssist`), so asking often is slowed down and a guest's day has a cap. A reused
 * understanding of an exam whose day no stored notice gives searches the web for it only as one
 * more small AI call (`allowDateSearch`); past the cap, its card says the day is to be confirmed. A guest
 * whose one goal is taken is refused before anything is read (`limitReached` on `goal`), since
 * only an account can add another.
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

  const cached = await findCachedUnderstanding({
    language: input.language,
    normalizedPrompt: normalizeString(input.goal),
    now: new Date(),
  });

  const usage = cached ? null : await claimAssist();

  if (usage && usage.status !== "allowed") {
    return usage;
  }

  const draft = await prisma.onboardingDraft.create({
    data: {
      language: input.language,
      prompt: input.goal,
      timeZone: input.timeZone ?? "UTC",
      userId: session.user.id,
    },
  });

  if (!cached) {
    return { draft: toDraftView({ draft, goalId: null }), status: "understanding" };
  }

  const understood = await completeDraft({ allowDateSearch, draft, understanding: cached });

  return { draft: toDraftView({ draft: understood, goalId: null }), status: "understood" };
}
