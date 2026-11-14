import { type AllowanceLimit } from "@zoonk/core/entitlements/contract";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type GoalLimit } from "@zoonk/learn/onboarding/actions";
import { z } from "zod";

type GoalStartLimit = Pick<AllowanceLimit, "period" | "tier"> & {
  availableAt?: Date | string | null;
  resource: string;
};

export function getGoalLimit(limit: GoalStartLimit): GoalLimit {
  if (limit.tier === "guest") {
    return { reason: "guest" };
  }

  if (limit.resource === "activeGoals") {
    return { reason: "activeGoals" };
  }

  if (limit.period !== "rolling30Days") {
    return { reason: limit.resource === "explanation" ? "dailyExplanations" : "dailyGoals" };
  }

  const { availableAt } = limit;

  return {
    availableAt: availableAt instanceof Date ? availableAt.toISOString() : (availableAt ?? null),
    reason: limit.resource === "explanation" ? "monthlyExplanations" : "monthlyGoals",
  };
}

const goalRefusalErrorSchema = z.object({
  error: z.discriminatedUnion("code", [
    z.object({ code: z.literal(LESSON_PLAYER_ERROR_CODES.signUpRequired) }),
    z.object({ code: z.literal(LESSON_PLAYER_ERROR_CODES.slowDown) }),
    z.object({
      code: z.literal("GOAL_LIMIT_REACHED"),
      details: z.object({
        availableAt: z.string().nullish(),
        period: z.enum(["day", "rolling30Days", "total"]),
        resource: z.string(),
        tier: z.enum(["free", "guest", "plus"]),
      }),
    }),
  ]),
});

function readGoalLimit(json: unknown): GoalLimit | null {
  const error = goalRefusalErrorSchema.safeParse(json).data?.error;

  if (!error) {
    return null;
  }

  if (error.code === "GOAL_LIMIT_REACHED") {
    return getGoalLimit(error.details);
  }

  return {
    reason: error.code === LESSON_PLAYER_ERROR_CODES.signUpRequired ? "signUpRequired" : "slowDown",
  };
}

export function toGoalStartFailure(
  json: unknown,
): ({ status: "limitReached" } & GoalLimit) | { status: "failed" } {
  const limit = readGoalLimit(json);
  return limit ? { ...limit, status: "limitReached" } : { status: "failed" };
}
