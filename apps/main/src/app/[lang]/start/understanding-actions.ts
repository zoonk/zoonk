"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import {
  type OnboardingDraftView,
  goalUnderstandingInputSchema,
  onboardingDraftEditSchema,
} from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { reviseOnboardingDraft } from "@zoonk/core/view-models/onboarding/revise-draft";
import { startGoalUnderstanding } from "@zoonk/core/view-models/onboarding/start-understanding";
import { onboardingDraftViewSchema } from "@zoonk/core/view-models/onboarding/view-schemas";
import { type StartUnderstandingOutcome } from "@zoonk/learn/onboarding/actions";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isUuid } from "@zoonk/utils/uuid";
import { z } from "zod";

/**
 * Reading a typed goal: the draft is saved here through core, then its run starts on the API as
 * the learner, and the answer is awaited so a start that failed is shown with a retry. Every read
 * and fix goes through the same core capabilities as `/v1/goal-understandings`.
 */

const TOO_MANY_REQUESTS = 429;

/** A plan's cap the API refused the run for (`USAGE_LIMIT_REACHED` with `details.limit`). */
const limitSchema = z.object({
  error: z.object({
    details: z.object({
      limit: z.object({
        period: z.enum(["day", "month", "total"]),
        resource: z.string(),
        tier: z.enum(["free", "guest", "plus"]),
      }),
    }),
  }),
});

/** The goal limits only an account lifts, as opposed to the day's small AI calls. */
const GOAL_LIMITS = new Set(["activeGoals", "goal"]);

/**
 * Which cap refused reading the words: a guest's one goal, or the small AI calls of the day or the
 * month.
 */
function toLimitOutcome(limit: {
  period: "day" | "month" | "total";
  resource: string;
  tier: EntitlementTier;
}): StartUnderstandingOutcome {
  return GOAL_LIMITS.has(limit.resource)
    ? { status: "needsAccount" }
    : { period: limit.period, status: "limitReached", tier: limit.tier };
}

/** When the API's slow-down answer can't be read, a minute is what it asks for. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

const slowDownSchema = z.object({
  error: z.object({ details: z.object({ retryAfterSeconds: z.number() }) }),
});

async function startRun(draft: OnboardingDraftView): Promise<StartUnderstandingOutcome> {
  const response = await postAsLearner({
    path: `/v1/goal-understandings/${encodeURIComponent(draft.id)}/generations`,
  });

  if (response.ok) {
    const started = onboardingDraftViewSchema.safeParse(response.json);
    return { draft: started.data ?? draft, status: "started" };
  }

  const limit = limitSchema.safeParse(response.json).data?.error.details.limit;

  if (limit) {
    return toLimitOutcome(limit);
  }

  if (response.status === TOO_MANY_REQUESTS) {
    const retryAfterSeconds =
      slowDownSchema.safeParse(response.json).data?.error.details.retryAfterSeconds ??
      DEFAULT_RETRY_AFTER_SECONDS;

    return { retryAfterSeconds, status: "slowDown" };
  }

  return { draft, status: "startFailed" };
}

export async function startUnderstandingAction(input: unknown): Promise<StartUnderstandingOutcome> {
  const parsed = goalUnderstandingInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(() => startGoalUnderstanding(parsed.data));

  if (error) {
    logError("[startUnderstandingAction] Failed to save a typed goal:", error);
    return { status: "failed" };
  }

  if (result.status === "understanding") {
    return startRun(result.draft);
  }

  if (result.status === "understood") {
    return { draft: result.draft, status: "started" };
  }

  if (result.status === "limitReached") {
    return toLimitOutcome(result.limit);
  }

  return result.status === "slowDown" ? result : { status: "failed" };
}

export async function getUnderstandingAction(draftId: string): Promise<OnboardingDraftView | null> {
  if (!isUuid(draftId)) {
    return null;
  }

  const { data: result, error } = await safeAsync(() => getOnboardingDraft({ draftId }));

  if (error) {
    logError("[getUnderstandingAction] Failed to read a draft:", error);
    return null;
  }

  return result.status === "ready" ? result.draft : null;
}

/** Starts reading a draft again, after its run failed or couldn't start. */
export async function retryUnderstandingAction(
  draftId: string,
): Promise<StartUnderstandingOutcome> {
  const draft = await getUnderstandingAction(draftId);

  if (!draft) {
    return { status: "failed" };
  }

  return draft.status === "understood" ? { draft, status: "started" } : startRun(draft);
}

export async function reviseUnderstandingAction(
  draftId: string,
  edit: unknown,
): Promise<OnboardingDraftView | null> {
  const parsed = onboardingDraftEditSchema.safeParse(edit);

  if (!parsed.success || !isUuid(draftId)) {
    return null;
  }

  const { data: result, error } = await safeAsync(() =>
    reviseOnboardingDraft({ draftId, edit: parsed.data }),
  );

  if (error) {
    logError("[reviseUnderstandingAction] Failed to save a fix:", error);
    return null;
  }

  return result.status === "revised" ? result.draft : null;
}
