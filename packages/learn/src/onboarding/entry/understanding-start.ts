import { type AnalyticsGoalKind } from "@zoonk/core/analytics/shared-properties";
import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import {
  type GoalUnderstandingView,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type StartUnderstandingOutcome, type UnderstandingActions } from "../onboarding-actions";

const EXPLANATION_MINUTES = 5;

/**
 * Drafts this tab's own click sent and is still waiting to read, by id, with when it was sent:
 * whichever screen shows the draft once it's read carries that click on (its "Goal Classified",
 * a question's explanation), even after the home page handed it to `/start`. A reload forgets it,
 * so a draft opened later waits for the learner's own tap.
 */
const sentGoals = new Map<string, number>();

/** When this tab's click sent the draft, once: null for a draft it didn't send or already read. */
export function takeSentGoal(draftId: string): number | null {
  const sentAt = sentGoals.get(draftId) ?? null;
  sentGoals.delete(draftId);
  return sentAt;
}

/** A short explanation uses the same goal input from the home box and onboarding. */
export function getExplanationGoalInput({
  draft,
  language,
  question,
}: {
  draft: OnboardingDraftView;
  language: string;
  question: string;
}): GoalCreateInput {
  return {
    dailyMinutes: EXPLANATION_MINUTES,
    goals: [
      {
        details: { onboardingId: draft.id, question: draft.prompt },
        kind: "explain",
        language,
        prompt: draft.prompt,
        title: question,
      },
    ],
    timeZone: getLocalTimeZone(),
  };
}

/** What analytics calls the typed goal once its words have been understood. */
export function getClassifiedKind(
  understanding: GoalUnderstandingView,
): AnalyticsGoalKind | "declined" {
  switch (understanding.status) {
    case "goals":
      return understanding.goals[0]?.draft.kind ?? "learn";
    case "explain":
      return "explain";
    case "instrument":
      return "learn";
    case "unclear":
    case "unsafe":
      return "declined";
    default:
      return "declined";
  }
}

/**
 * Saves a typed goal and starts reading it, remembered as this tab's click (`takeSentGoal`). It
 * doesn't wait for the read: the draft's screen follows its run live and loads it once.
 */
export async function sendGoal({
  goal,
  language,
  signal,
  understanding,
}: {
  goal: string;
  language: string;
  signal?: AbortSignal;
  understanding: Pick<UnderstandingActions, "start">;
}): Promise<StartUnderstandingOutcome> {
  // Home loads its actions lazily; leaving before that finishes must not submit afterward.
  if (signal?.aborted) {
    return { status: "failed" };
  }

  const sentAt = Date.now();
  const { data } = await safeAsync(() => understanding.start({ goal, language }));
  const outcome: StartUnderstandingOutcome = data ?? { status: "failed" };

  if (outcome.status === "started" && !signal?.aborted) {
    sentGoals.set(outcome.draft.id, sentAt);
  }

  return outcome;
}
