"use server";

import { changeGoalPlan } from "@zoonk/core/plans/change";
import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { isUuid } from "@zoonk/utils/uuid";

/** The time question shows the aim with the plan it sizes, so it reads the onboarding again. */
export async function changeOnboardingAimAction(
  goalId: string,
  aim: unknown,
): Promise<OnboardingView | null> {
  const input = planChangeInputSchema.safeParse({ operations: [{ aim, kind: "setAim" }] });

  if (!input.success || !isUuid(goalId)) {
    return null;
  }

  const changed = await changeGoalPlan({ goalId, input: input.data });

  if (changed.status !== "applied") {
    return null;
  }

  const onboarding = await getOnboarding({ goalId });
  return onboarding.status === "ready" ? onboarding.onboarding : null;
}
