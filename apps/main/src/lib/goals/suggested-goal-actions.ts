"use server";

import {
  type SuggestedGoalView,
  suggestedGoalAnswerSchema,
} from "@zoonk/core/goals/suggestions/contract";
import { respondToSuggestedGoal } from "@zoonk/core/goals/suggestions/respond";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const answerInputSchema = suggestedGoalAnswerSchema.extend({ suggestionId: z.uuid() });

export async function answerSuggestedGoalAction(input: {
  status: "accepted" | "dismissed";
  suggestionId: string;
}): Promise<SuggestedGoalView | null> {
  const parsed = answerInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(() =>
    respondToSuggestedGoal({
      input: { status: parsed.data.status },
      suggestionId: parsed.data.suggestionId,
    }),
  );

  if (error) {
    logError("[answerSuggestedGoalAction] Failed to answer a suggested goal:", error);
    return null;
  }

  return result.status === "updated" ? result.suggestedGoal : null;
}
