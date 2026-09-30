"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { markUnderMinimumAge } from "@/lib/guest/minimum-age";
import { writeLessonAhead } from "@/lib/session/session-preparation";
import { moveLanguageGoalToExam } from "@zoonk/core/exams/language-goal";
import { goalCreateInputSchema } from "@zoonk/core/goals/contract";
import { updateGoal } from "@zoonk/core/goals/update";
import { instrumentWaitlistJoinSchema } from "@zoonk/core/instrument-waitlist/contract";
import { joinInstrumentWaitlist } from "@zoonk/core/instrument-waitlist/join";
import { answerPlacementQuestion } from "@zoonk/core/learner/placement/answer";
import {
  placementAnswerInputSchema,
  placementCompletionInputSchema,
} from "@zoonk/core/learner/placement/contract";
import { finishGoalPlacement } from "@zoonk/core/learner/placement/finish";
import { getGoalPlacement } from "@zoonk/core/learner/placement/get";
import { guardianInviteSchema } from "@zoonk/core/minors/guardian/contract";
import { inviteGuardian } from "@zoonk/core/minors/guardian/invite";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { answerOnboardingQuestion } from "@zoonk/core/view-models/onboarding/answer";
import { onboardingAnswerInputSchema } from "@zoonk/core/view-models/onboarding/contract";
import { createOnboardingGoals } from "@zoonk/core/view-models/onboarding/create-goals";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import {
  type AnswerOutcome,
  type CreateGoalsOutcome,
  type PlacementOutcome,
  type PlanOutcome,
  type WaitlistOutcome,
} from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";
import { getGoalLimitReason } from "./goal-limit-reason";

/**
 * Onboarding's Server Actions. Each parses its untrusted input with the schema the public API
 * uses, then calls the same core capability as the matching API route; core owns sessions,
 * ownership and limits. Failures become outcomes the screens can say, never thrown errors.
 */

export async function createOnboardingGoalsAction(input: unknown): Promise<CreateGoalsOutcome> {
  const parsed = goalCreateInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const result = await createOnboardingGoals(parsed.data);

  if (result.status === "refused") {
    return { reason: getGoalLimitReason(result.refused[0]?.decision), status: "limitReached" };
  }

  const [main] = result.status === "created" ? result.goals : [];

  if (!main || result.status !== "created") {
    return { status: "failed" };
  }

  const starts = await startGoalWork(result.goals);
  const mainStart = starts.find((start) => start.goalId === main.id);

  return {
    generationStarted: Boolean(mainStart?.generationId),
    goalId: main.id,
    status: "created",
  };
}

export async function answerOnboardingAction(
  goalId: string,
  input: unknown,
): Promise<AnswerOutcome> {
  const parsed = onboardingAnswerInputSchema.safeParse(input);

  if (!parsed.success || !isUuid(goalId)) {
    return { status: "failed" };
  }

  const result = await answerOnboardingQuestion({ goalId, input: parsed.data });

  if (result.status === "accountDeleted") {
    await markUnderMinimumAge();
    return { status: "accountDeleted" };
  }

  // "Pass an exam" inside a language goal: a reason naming a certificate moves it to an exam goal.
  const moved =
    result.status === "saved" && parsed.data.question === "reason"
      ? await moveLanguageGoalToExam(goalId)
      : null;

  if (moved?.status === "moved") {
    await startGoalWork([moved.goal]);
  }

  const currentGoalId = moved?.status === "moved" ? moved.goal.id : goalId;

  const onboarding =
    result.status === "saved" ? await getOnboarding({ goalId: currentGoalId }) : null;

  return onboarding?.status === "ready"
    ? { onboarding: onboarding.onboarding, status: "saved" }
    : { status: "failed" };
}

type PlacementState = Extract<
  Awaited<ReturnType<typeof getGoalPlacement>>,
  { status: "ready" }
>["placement"];

/** The skill map or the questions placement needs next are still being made: ask again soon. */
const NOT_READY = new Set<PlacementState["status"]>(["preparing", "waitingForQuestions"]);

function toPlacementOutcome({
  isCorrect,
  placement,
}: {
  isCorrect: boolean | null;
  placement: PlacementState;
}): PlacementOutcome {
  if (NOT_READY.has(placement.status)) {
    return { status: "notReady" };
  }

  if (placement.status === "failed") {
    return { status: "generationFailed" };
  }

  if (placement.status === "unavailable") {
    return { status: "unavailable" };
  }

  return {
    answered: placement.answered,
    complete: placement.complete,
    dayBudgetUsed: placement.dayBudgetUsed,
    isCorrect,
    next: placement.next,
    status: "ready",
    trueFalseLabels: placement.trueFalseLabels,
  };
}

export async function getPlacementAction({
  goalId,
  timeZone,
}: {
  goalId: string;
  timeZone: string;
}): Promise<PlacementOutcome> {
  if (!isUuid(goalId)) {
    return { status: "failed" };
  }

  const result = await getGoalPlacement({ goalId, timeZone });

  return result.status === "ready"
    ? toPlacementOutcome({ isCorrect: null, placement: result.placement })
    : { status: "failed" };
}

export async function answerPlacementAction({
  goalId,
  ...input
}: {
  answer: unknown;
  durationMs: number;
  goalId: string;
  itemId: string;
  timeZone: string;
}): Promise<PlacementOutcome> {
  const parsed = placementAnswerInputSchema.safeParse(input);

  if (!parsed.success || !isUuid(goalId)) {
    return { status: "failed" };
  }

  const result = await answerPlacementQuestion({ goalId, input: parsed.data });

  return result.status === "ready"
    ? toPlacementOutcome({ isCorrect: result.isCorrect, placement: result.placement })
    : { status: "failed" };
}

export async function finishPlacementAction({
  goalId,
  ...input
}: {
  fromScratch: boolean;
  goalId: string;
  timeZone: string;
}): Promise<boolean> {
  const parsed = placementCompletionInputSchema.safeParse(input);

  if (!parsed.success || !isUuid(goalId)) {
    return false;
  }

  const result = await finishGoalPlacement({ goalId, input: parsed.data });

  if (result.status !== "ready") {
    return false;
  }

  // Day 1 opens the plan's first lesson minutes from now: it's written from here, guests' too.
  if (result.firstLessonId) {
    writeLessonAhead(result.firstLessonId);
  }

  return true;
}

export async function getPlanAction(goalId: string): Promise<PlanOutcome> {
  if (!isUuid(goalId)) {
    return { status: "failed" };
  }

  const result = await getGoalPlan(goalId);
  return result.status === "ready" ? result : { status: "failed" };
}

export async function inviteGuardianAction(email: unknown): Promise<boolean> {
  const parsed = guardianInviteSchema.safeParse({ email });

  if (!parsed.success) {
    return false;
  }

  const result = await inviteGuardian(parsed.data);
  return result.status === "invited";
}

export async function joinWaitlistAction(input: unknown): Promise<WaitlistOutcome> {
  const parsed = instrumentWaitlistJoinSchema.safeParse(input);

  if (!parsed.success) {
    return "failed";
  }

  const result = await joinInstrumentWaitlist(parsed.data);

  if (result.status === "joined" || result.status === "signInRequired") {
    return result.status;
  }

  return "failed";
}

/** "Start over" archives what this onboarding created, so the next goal starts clean. */
export async function startOverAction(goalIds: unknown): Promise<void> {
  const ids = Array.isArray(goalIds)
    ? goalIds.filter((id): id is string => typeof id === "string" && isUuid(id))
    : [];

  await Promise.all(ids.map((goalId) => updateGoal({ goalId, input: { status: "archived" } })));
}

/** The run writing the goal's curriculum, once it started, so the waiting screens follow it. */
export async function getGenerationIdAction(goalId: string): Promise<string | null> {
  if (!isUuid(goalId)) {
    return null;
  }

  const result = await getOnboarding({ goalId });
  return result.status === "ready" ? result.onboarding.generationId : null;
}

/**
 * Starts the goal's curriculum again after its run failed or never started, when the learner
 * taps to try again. Only the learner's own goal counts. The new run's id, or null when it
 * couldn't start, so the screen says so at once.
 */
export async function retryGenerationAction(goalId: string): Promise<string | null> {
  if (!isUuid(goalId)) {
    return null;
  }

  const result = await getOnboarding({ goalId });

  if (result.status !== "ready") {
    return null;
  }

  const [start] = await startGoalWork([result.onboarding.goal]);
  return start?.generationId ?? null;
}
