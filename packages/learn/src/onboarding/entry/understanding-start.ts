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
 * Drafts this tab's click sent, by id. A reload forgets them, so a draft opened later waits for the
 * learner's own tap.
 */
type SentGoal = { pending: boolean; prompt: string; sentAt: number; owner?: symbol };

const sentGoals = new Map<string, SentGoal>();

export function getSentGoal(draftId: string): Omit<SentGoal, "owner"> | null {
  const sent = sentGoals.get(draftId);
  return sent ? { pending: sent.pending, prompt: sent.prompt, sentAt: sent.sentAt } : null;
}

/**
 * A cleanup replay can reclaim it in the same turn; leaving or replacing the draft revokes it
 * before the next task.
 */
export function holdSentGoal(draftId: string): () => void {
  const sent = sentGoals.get(draftId);

  if (!sent) {
    return function releaseUnknownGoal() {
      // A reloaded draft has no click to release.
    };
  }

  const owner = Symbol("sent goal screen");
  sent.owner = owner;

  return () => {
    queueMicrotask(() => {
      if (sentGoals.get(draftId) === sent && sent.owner === owner) {
        forgetSentGoal(draftId);
      }
    });
  };
}

export function forgetSentGoal(draftId: string): void {
  sentGoals.delete(draftId);
}

export function takeSentGoal(draftId: string): number | null {
  const sentAt = sentGoals.get(draftId)?.sentAt ?? null;
  sentGoals.delete(draftId);
  return sentAt;
}

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
    sentGoals.set(outcome.draft.id, {
      pending: outcome.draft.status === "understanding",
      prompt: goal,
      sentAt,
    });
  }

  return outcome;
}
