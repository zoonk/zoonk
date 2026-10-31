import "server-only";
import { postAsLearner } from "@/lib/api/learner-api";
import { type PlanLinkStartInput } from "@zoonk/core/plans/link-contract";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { z } from "zod";
import { toGoalStartFailure } from "./goal-limit-reason";

const CREATED = 201;

const goalSchema = z.object({ id: z.string() });

type PlanLinkStart =
  | { goalId: string; status: "created" }
  | { goalId: string; status: "owner" }
  | { reason: GoalLimitReason; status: "limitReached" }
  | { status: "failed" };

/** The API starts a new goal's run before it answers. */
export async function startPlanLinkGoal({
  input,
  planId,
}: {
  input: PlanLinkStartInput;
  planId: string;
}): Promise<PlanLinkStart> {
  const response = await postAsLearner({
    body: input,
    path: `/v1/plan-links/${encodeURIComponent(planId)}/goals`,
  });

  if (!response.ok) {
    return toGoalStartFailure(response.json);
  }

  const goal = goalSchema.safeParse(response.json).data;

  if (!goal) {
    return { status: "failed" };
  }

  return response.status === CREATED
    ? { goalId: goal.id, status: "created" }
    : { goalId: goal.id, status: "owner" };
}
