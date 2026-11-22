import "server-only";
import { type OnboardingDraft, type TransactionClient } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag, getOnboardingDraftsCacheTag } from "../../cache/tags";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { claimAssistInWrite } from "../../entitlements/claim-usage";
import { type RefusedUsage, type UsageDecision } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSession } from "../../users/get-session";
import { completeDraft, toDraftView } from "./_utils/onboarding-draft";
import { findCompletableUnderstanding } from "./_utils/understanding-cache";
import { type GoalUnderstandingInput, type OnboardingDraftView } from "./onboarding-contract";

export type StartGoalUnderstandingResult =
  | RefusedUsage
  | { status: "unauthorized" }
  | { draft: OnboardingDraftView; status: "understanding" | "understood" };

type ReadingStart =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { draft: OnboardingDraft; status: "claimed" | "followed" };

function toDraftData({ input, userId }: { input: GoalUnderstandingInput; userId: string }) {
  return {
    language: input.language,
    prompt: input.goal,
    timeZone: input.timeZone ?? "UTC",
    userId,
  };
}

async function findDraftBeingRead({
  input,
  tx,
  userId,
}: {
  input: GoalUnderstandingInput;
  tx: TransactionClient;
  userId: string;
}): Promise<OnboardingDraft | null> {
  const drafts = await tx.onboardingDraft.findMany({
    where: { language: input.language, status: "understanding", userId },
  });

  const words = normalizeString(input.goal);

  return drafts.find((draft) => normalizeString(draft.prompt) === words) ?? null;
}

/** The learner's lock makes finding the draft already reading these words and claiming a new reading one step, so two starts at once read the words once. */
async function startReading(input: GoalUnderstandingInput): Promise<ReadingStart> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const started = await writeLearnerChange<ReadingStart>({ userId: viewer.userId }, async (tx) => {
    const beingRead = await findDraftBeingRead({ input, tx, userId: viewer.userId });

    if (beingRead) {
      return unchanged({ draft: beingRead, status: "followed" });
    }

    const usage = await claimAssistInWrite({ transaction: tx, viewer });

    if (usage.status !== "allowed") {
      return unchanged(usage);
    }

    const draft = await tx.onboardingDraft.create({
      data: toDraftData({ input, userId: viewer.userId }),
    });

    return { draft, status: "claimed" };
  });

  if (started.status === "claimed") {
    revalidateCacheTags([
      getAllowanceCacheTag(viewer.userId),
      getOnboardingDraftsCacheTag(viewer.userId),
    ]);
  }

  return started;
}

/** Requires a session, including guests; understands this learner's recent words at once unless they name an exam, follows the draft still reading the same words (a retry after a lost response, a second tab), otherwise claims AI allowance and returns a draft to start. */
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

  const cached = await findCompletableUnderstanding({
    language: input.language,
    normalizedPrompt: normalizeString(input.goal),
    now: new Date(),
    userId: session.user.id,
  });

  if (!cached) {
    const started = await startReading(input);

    return "draft" in started
      ? {
          draft: await toDraftView({ draft: started.draft, goalId: null }),
          status: "understanding",
        }
      : started;
  }

  const draft = await writeLearnerChange({ userId: session.user.id }, (tx) =>
    tx.onboardingDraft.create({ data: toDraftData({ input, userId: session.user.id }) }),
  );

  revalidateCacheTags([getOnboardingDraftsCacheTag(session.user.id)]);

  const understood = await completeDraft({ draft, exams: [], understanding: cached });

  return { draft: await toDraftView({ draft: understood, goalId: null }), status: "understood" };
}
