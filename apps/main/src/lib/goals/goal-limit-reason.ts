import { type AllowanceLimit } from "@zoonk/core/entitlements/contract";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type GoalLimitReason } from "@zoonk/learn/onboarding/actions";
import { z } from "zod";

export function getGoalLimitReason(
  limit: Pick<AllowanceLimit, "period" | "tier"> & { resource: string },
): GoalLimitReason {
  if (limit.tier === "guest") {
    return "guest";
  }

  if (limit.resource === "activeGoals") {
    return "oneActiveGoal";
  }

  const monthly = limit.period === "month";

  if (limit.resource === "explanation") {
    return monthly ? "monthlyExplanations" : "dailyExplanations";
  }

  return monthly ? "monthlyGoals" : "dailyGoals";
}

const goalRefusalErrorSchema = z.object({
  error: z.discriminatedUnion("code", [
    z.object({ code: z.literal(LESSON_PLAYER_ERROR_CODES.signUpRequired) }),
    z.object({ code: z.literal(LESSON_PLAYER_ERROR_CODES.slowDown) }),
    z.object({
      code: z.literal("GOAL_LIMIT_REACHED"),
      details: z.object({
        period: z.enum(["day", "month", "total"]),
        resource: z.string(),
        tier: z.enum(["free", "guest", "plus"]),
      }),
    }),
  ]),
});

function readGoalLimitReason(json: unknown): GoalLimitReason | null {
  const error = goalRefusalErrorSchema.safeParse(json).data?.error;

  if (!error) {
    return null;
  }

  if (error.code === "GOAL_LIMIT_REACHED") {
    return getGoalLimitReason(error.details);
  }

  return error.code === LESSON_PLAYER_ERROR_CODES.signUpRequired ? "signUpRequired" : "slowDown";
}

export function toGoalStartFailure(
  json: unknown,
): { reason: GoalLimitReason; status: "limitReached" } | { status: "failed" } {
  const reason = readGoalLimitReason(json);
  return reason ? { reason, status: "limitReached" } : { status: "failed" };
}
