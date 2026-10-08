"use server";

import { suggestedGoalAnswerSchema } from "@zoonk/core/goals/suggestions/contract";
import { respondToSuggestedGoal } from "@zoonk/core/goals/suggestions/respond";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const answerInputSchema = suggestedGoalAnswerSchema.extend({ suggestionId: z.uuid() });

/** Answers a suggested goal on Today: the same core capability as `PATCH /v1/me/suggested-goals/{id}`. */
export async function answerSuggestedGoalAction(input: {
  status: "accepted" | "dismissed";
  suggestionId: string;
}): Promise<boolean> {
  const parsed = answerInputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() =>
    respondToSuggestedGoal({
      input: { status: parsed.data.status },
      suggestionId: parsed.data.suggestionId,
    }),
  );

  if (error) {
    logError("[answerSuggestedGoalAction] Failed to answer a suggested goal:", error);
    return false;
  }

  return result.status === "updated";
}
