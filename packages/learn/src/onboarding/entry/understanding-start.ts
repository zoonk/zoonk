import { type AnalyticsGoalKind } from "@zoonk/core/analytics/shared-properties";
import { type GoalCreateInput } from "@zoonk/core/goals/contract";
import {
  type GoalUnderstandingView,
  type OnboardingDraftView,
} from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type StartUnderstandingOutcome, type UnderstandingActions } from "../onboarding-actions";

const READ_INTERVAL_MS = 1000;
const MAX_READ_MS = 300_000;
const EXPLANATION_MINUTES = 5;

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

function waitForRead(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(finish, READ_INTERVAL_MS);

    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }

    signal?.addEventListener("abort", finish, { once: true });
  });
}

/**
 * Only the submitting handler awaits this read. Reloading destroys that task; opening a draft
 * later follows its existing run and waits for Explain it before starting new work.
 */
async function readSubmittedDraft({
  draft,
  signal,
  startedAt,
  understanding,
}: {
  draft: OnboardingDraftView;
  signal?: AbortSignal;
  startedAt: number;
  understanding: Pick<UnderstandingActions, "get">;
}): Promise<OnboardingDraftView> {
  if (
    draft.status !== "understanding" ||
    signal?.aborted ||
    Date.now() - startedAt >= MAX_READ_MS
  ) {
    return draft;
  }

  await waitForRead(signal);

  if (signal?.aborted) {
    return draft;
  }

  const { data: next } = await safeAsync(() => understanding.get(draft.id));
  return next ? readSubmittedDraft({ draft: next, signal, startedAt, understanding }) : draft;
}

/** Saves and reads a typed goal as one click-owned task, without persisted continuation state. */
export async function sendGoal({
  goal,
  language,
  onDraft,
  signal,
  understanding,
}: {
  goal: string;
  language: string;
  onDraft?: (draft: OnboardingDraftView) => void;
  signal?: AbortSignal;
  understanding: Pick<UnderstandingActions, "get" | "start">;
}): Promise<StartUnderstandingOutcome> {
  // Home loads its actions lazily; leaving before that finishes must not submit afterward.
  if (signal?.aborted) {
    return { status: "failed" };
  }

  const startedAt = Date.now();
  const { data } = await safeAsync(() => understanding.start({ goal, language }));
  const outcome: StartUnderstandingOutcome = data ?? { status: "failed" };

  if (outcome.status !== "started" && outcome.status !== "startFailed") {
    return outcome;
  }

  if (!signal?.aborted) {
    onDraft?.(outcome.draft);
  }

  return outcome.status === "started"
    ? {
        ...outcome,
        draft: await readSubmittedDraft({ draft: outcome.draft, signal, startedAt, understanding }),
      }
    : outcome;
}
