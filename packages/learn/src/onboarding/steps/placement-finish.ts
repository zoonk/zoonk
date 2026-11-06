import { type OnboardingActions } from "../onboarding-actions";

/**
 * Rejects when stopping the mock fails, so placement stays open until the mock's answers are graded. A
 * stop that resolves false found the mock already over.
 */
export async function saveFinish({
  actions,
  fromScratch,
  goalId,
  stopMockId,
}: {
  actions: Pick<OnboardingActions, "finishPlacement" | "stopPlacementMock">;
  fromScratch: boolean;
  goalId: string;
  stopMockId: string | null;
}): Promise<boolean> {
  if (stopMockId) {
    await actions.stopPlacementMock(stopMockId);
  }

  return actions.finishPlacement({ fromScratch, goalId });
}
