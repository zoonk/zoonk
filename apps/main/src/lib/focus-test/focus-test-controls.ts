"use server";

import { updateFocusTest } from "@zoonk/core/learner/placement/controls";
import {
  type FocusTestSummary,
  focusTestControlsInputSchema,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * The learner's switches for an exam goal's Focus test: its questions inside sessions and Today's
 * suggestion. Resolves the test as it stands after the switch, or null when it wasn't saved.
 */
export async function updateFocusTestAction(
  goalId: string,
  input: unknown,
): Promise<FocusTestSummary | null> {
  const parsed = focusTestControlsInputSchema.safeParse(input);

  if (!parsed.success || !isUuid(goalId)) {
    return null;
  }

  const result = await updateFocusTest({ goalId, input: parsed.data });

  return result.status === "ready" ? result.focusTest : null;
}
