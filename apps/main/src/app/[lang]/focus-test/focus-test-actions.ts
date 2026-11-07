"use server";

import { focusTestInputSchema } from "@zoonk/core/plans/focus-test/contract";
import { submitFocusTest } from "@zoonk/core/plans/focus-test/submit";
import { type FocusTestOutcome } from "@zoonk/learn/focus-test";

/** The same test sent again (`requestId`) gets what it recorded. */
export async function submitFocusTestAction(
  goalId: string,
  sent: unknown,
): Promise<FocusTestOutcome | null> {
  const input = focusTestInputSchema.safeParse(sent);

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
    ceremony: outcome.ceremony,
    certificates: outcome.certificates,
    changeId: outcome.changeId,
    reached: outcome.reached,
  };
}
