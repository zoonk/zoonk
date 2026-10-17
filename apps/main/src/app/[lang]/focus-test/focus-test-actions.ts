"use server";

import { focusTestInputSchema } from "@zoonk/core/plans/focus-test/contract";
import { submitFocusTest } from "@zoonk/core/plans/focus-test/submit";
import { type FocusTestOutcome } from "@zoonk/learn/focus-test";

/** Grades the focus test through core, which focuses the plan where the answers show it's needed. */
export async function submitFocusTestAction(
  goalId: string,
  answers: unknown,
): Promise<FocusTestOutcome | null> {
  const input = focusTestInputSchema.safeParse({ answers });

  if (!input.success) {
    return null;
  }

  const result = await submitFocusTest({ goalId, input: input.data });

  if (result.status !== "ready") {
    return null;
  }

  const { outcome } = result;

  return {
    areas: outcome.areas.map((area) => ({
      answers: area.answers,
      chosen: area.chosen,
      label: area.label,
    })),
    changeId: outcome.changeId,
  };
}
