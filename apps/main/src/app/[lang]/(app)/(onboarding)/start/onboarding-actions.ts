"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { toGoalStartFailure } from "@/lib/goals/goal-limit-reason";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { finishMock } from "@zoonk/core/exams/mocks/finish";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
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
import { getGoalPlan } from "@zoonk/core/plans/get";
import { onboardingAnswerInputSchema } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import {
  type AnswerOutcome,
  type CreateGoalsOutcome,
  type PlacementMockOutcome,
  type PlacementOutcome,
  type PlanOutcome,
  type WaitlistOutcome,
} from "@zoonk/learn/onboarding/actions";
import { isUuid } from "@zoonk/utils/uuid";
import { z } from "zod";

/** Failures become outcomes the screens can say, never thrown errors. */

const createdGoalsSchema = z.object({
  generations: z.array(z.object({ generationId: z.string(), goalId: z.string() })),
  goals: z.array(z.object({ id: z.string() })),
});

const dayTooShortSchema = z.object({
  error: z.object({
    code: z.literal("DAY_TOO_SHORT"),
    details: z.object({ goals: z.number(), minutes: z.number() }),
  }),
});

const answeredSchema = z.object({ goal: z.object({ id: z.string() }) });

const generationSchema = z.object({ generationId: z.string() });

export async function createOnboardingGoalsAction(input: unknown): Promise<CreateGoalsOutcome> {
  const parsed = goalCreateInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const response = await postAsLearner({ body: parsed.data, path: "/v1/goals" });

  if (!response.ok) {
    return toGoalStartFailure(response.json);
  }

  const created = createdGoalsSchema.safeParse(response.json).data;
  const main = created?.goals[0];

  if (!main) {
    return { status: "failed" };
  }

  const generation = created.generations.find((start) => start.goalId === main.id);

  return { generationId: generation?.generationId ?? null, goalId: main.id, status: "created" };
}

export async function answerOnboardingAction(
  goalId: string,
  input: unknown,
): Promise<AnswerOutcome> {
  const parsed = onboardingAnswerInputSchema.safeParse(input);

  if (!parsed.success || !isUuid(goalId)) {
    return { status: "failed" };
  }

  const response = await postAsLearner({
    body: parsed.data,
    path: `/v1/goals/${encodeURIComponent(goalId)}/onboarding/answers`,
  });

  if (!response.ok) {
    const dayTooShort = dayTooShortSchema.safeParse(response.json).data?.error.details;
    return dayTooShort ? { ...dayTooShort, status: "dayTooShort" } : { status: "failed" };
  }

  // A language goal that moved to its exam goes on as that goal.
  const answered = answeredSchema.safeParse(response.json).data;

  if (!answered) {
    return { status: "failed" };
  }

  const onboarding = await getOnboarding({ goalId: answered.goal.id });

  return onboarding.status === "ready"
    ? { onboarding: onboarding.onboarding, status: "saved" }
    : { status: "failed" };
}

type PlacementState = Extract<
  Awaited<ReturnType<typeof getGoalPlacement>>,
  { status: "ready" }
>["placement"];

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
    dayBudgetSpent: placement.dayBudgetSpent,
    dayBudgetUsed: placement.dayBudgetUsed,
    isCorrect,
    next: placement.next,
    started: placement.started,
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

  return result.status === "ready";
}

export async function getPlanAction(goalId: string): Promise<PlanOutcome> {
  if (!isUuid(goalId)) {
    return { status: "failed" };
  }

  const [result, syllabus] = await Promise.all([getGoalPlan(goalId), getSyllabusView({ goalId })]);

  if (result.status !== "ready") {
    return { status: "failed" };
  }

  return {
    plan: result.plan,
    status: "ready",
    syllabus: syllabus.status === "ready" ? syllabus.syllabus : null,
  };
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

export async function startOverAction(goalIds: unknown): Promise<void> {
  const ids = Array.isArray(goalIds)
    ? goalIds.filter((id): id is string => typeof id === "string" && isUuid(id))
    : [];

  await Promise.all(ids.map((goalId) => updateGoal({ goalId, input: { status: "archived" } })));
}

export async function retryGenerationAction(goalId: string): Promise<string | null> {
  if (!isUuid(goalId)) {
    return null;
  }

  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goalId)}/generations`,
  });

  return generationSchema.safeParse(response.json).data?.generationId ?? null;
}

export async function getPlacementMockAction(goalId: string): Promise<PlacementMockOutcome> {
  const result = isUuid(goalId) ? await getMockOptions({ goalId }) : null;
  const view = result?.status === "ready" ? result.view : null;
  const placement = view?.placement ?? null;
  const shortest = placement?.options[0];
  const longest = placement?.options.at(-1);

  return {
    mock: placement?.mock ?? null,
    offer:
      view && shortest && longest
        ? {
            access: view.access,
            minutes: { longest: longest.estimatedMinutes, shortest: shortest.estimatedMinutes },
          }
        : null,
  };
}

export async function stopPlacementMockAction(mockId: string, timeZone: string): Promise<boolean> {
  const input = mockTimeZoneInputSchema.safeParse({ timeZone });

  if (!isUuid(mockId) || !input.success) {
    return false;
  }

  const result = await finishMock({ blockId: mockId, input: input.data });
  return result.status === "finished";
}
