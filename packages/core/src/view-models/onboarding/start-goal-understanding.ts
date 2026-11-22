import "server-only";
import { type OnboardingDraft, type TransactionClient } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getAllowanceCacheTag, getOnboardingDraftsCacheTag } from "../../cache/tags";
import {
  type EntitlementViewer,
  getEntitlementViewer,
} from "../../entitlements/_utils/entitlement-viewer";
import { claimAssistInWrite } from "../../entitlements/claim-usage";
import { type RefusedUsage, type UsageDecision } from "../../entitlements/contract";
import { findGuestGoalLimit } from "../../entitlements/find-guest-goal-limit";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { findOwnSources } from "../../library/sources/own-sources";
import { getSession } from "../../users/get-session";
import { completeDraft, toDraftView } from "./_utils/onboarding-draft";
import { findCompletableUnderstanding } from "./_utils/understanding-cache";
import { type GoalUnderstandingInput, type OnboardingDraftView } from "./onboarding-contract";

export type StartGoalUnderstandingResult =
  | RefusedUsage
  | { status: "unauthorized" }
  | { sourceIds: string[]; status: "materialUnavailable" }
  | { draft: OnboardingDraftView; status: "understanding" | "understood" };

type ReadingStart =
  | Exclude<UsageDecision, { status: "allowed" }>
  | { draft: OnboardingDraft; status: "cached" | "claimed" | "followed" };

type SentMaterial = Pick<OnboardingDraft, "materialIntent" | "sourceIds">;

function toDraftData({
  input,
  material,
  userId,
}: {
  input: GoalUnderstandingInput;
  material: SentMaterial;
  userId: string;
}) {
  return {
    ...material,
    language: input.language,
    prompt: input.goal,
    timeZone: input.timeZone ?? "UTC",
    userId,
  };
}

function isSameMaterial(draft: SentMaterial, material: SentMaterial): boolean {
  return (
    draft.materialIntent === material.materialIntent &&
    draft.sourceIds.join(",") === material.sourceIds.join(",")
  );
}

async function findDraftBeingRead({
  input,
  material,
  tx,
  userId,
}: {
  input: GoalUnderstandingInput;
  material: SentMaterial;
  tx: TransactionClient;
  userId: string;
}): Promise<OnboardingDraft | null> {
  const drafts = await tx.onboardingDraft.findMany({
    where: { language: input.language, status: "understanding", userId },
  });

  const words = normalizeString(input.goal);

  return (
    drafts.find(
      (draft) => normalizeString(draft.prompt) === words && isSameMaterial(draft, material),
    ) ?? null
  );
}

/**
 * The learner's lock makes finding the draft already reading these words and saving a new one a
 * single step, so two starts at once read the words once. A null viewer saves words already read.
 */
async function startReading({
  input,
  material,
  userId,
  viewer,
}: {
  input: GoalUnderstandingInput;
  material: SentMaterial;
  userId: string;
  viewer: EntitlementViewer | null;
}): Promise<ReadingStart> {
  const started = await writeLearnerChange<ReadingStart>({ userId }, async (tx) => {
    const beingRead = await findDraftBeingRead({ input, material, tx, userId });

    if (beingRead) {
      return unchanged({ draft: beingRead, status: "followed" });
    }

    const usage = viewer ? await claimAssistInWrite({ transaction: tx, viewer }) : null;

    if (usage && usage.status !== "allowed") {
      return unchanged(usage);
    }

    const draft = await tx.onboardingDraft.create({
      data: toDraftData({ input, material, userId }),
    });

    return { draft, status: usage ? "claimed" : "cached" };
  });

  if (started.status === "cached" || started.status === "claimed") {
    revalidateCacheTags([
      ...(started.status === "claimed" ? [getAllowanceCacheTag(userId)] : []),
      getOnboardingDraftsCacheTag(userId),
    ]);
  }

  return started;
}

/**
 * Requires a session, including guests; understands this learner's recent words at once unless they
 * name an exam or come with material, follows the draft still reading the same words and material
 * (a retry after a lost response, a second tab), otherwise claims AI allowance and returns a draft
 * to start. Material that names none of the learner's uploads is refused, with its ids, before any
 * claim.
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

  const uploads = await findOwnSources({
    origin: "upload",
    sourceIds: input.sourceIds ?? [],
    userId: session.user.id,
  });

  if (uploads.unresolved.length > 0) {
    return { sourceIds: uploads.unresolved, status: "materialUnavailable" };
  }

  const material: SentMaterial = {
    materialIntent: uploads.resolved.length > 0 ? (input.materialIntent ?? null) : null,
    sourceIds: uploads.resolved,
  };

  // The words alone don't say what a reading with material found, so it's never reused.
  const cached =
    material.sourceIds.length > 0
      ? null
      : await findCompletableUnderstanding({
          language: input.language,
          normalizedPrompt: normalizeString(input.goal),
          now: new Date(),
          userId: session.user.id,
        });

  const viewer = cached ? null : await getEntitlementViewer();

  if (!cached && !viewer) {
    return { status: "unauthorized" };
  }

  const started = await startReading({ input, material, userId: session.user.id, viewer });

  if (!("draft" in started)) {
    return started;
  }

  if (started.status !== "cached" || !cached) {
    return {
      draft: await toDraftView({ draft: started.draft, goalId: null }),
      status: "understanding",
    };
  }

  const understood = await completeDraft({
    draft: started.draft,
    exams: [],
    understanding: cached,
  });

  return { draft: await toDraftView({ draft: understood, goalId: null }), status: "understood" };
}
