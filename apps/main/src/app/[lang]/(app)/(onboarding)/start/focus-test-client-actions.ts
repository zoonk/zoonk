import { type FocusTestActions } from "@zoonk/learn/focus-test/actions";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  answerPlacementAction,
  finishPlacementAction,
  getPlacementAction,
  startPlacementSittingAction,
} from "./onboarding-actions";

export function getFocusTestActions(goalId: string): FocusTestActions {
  return {
    answer: (input) => answerPlacementAction({ ...input, goalId, timeZone: getLocalTimeZone() }),
    finish: () =>
      finishPlacementAction({ fromScratch: false, goalId, timeZone: getLocalTimeZone() }),
    get: () => getPlacementAction({ goalId, timeZone: getLocalTimeZone() }),
    start: () => startPlacementSittingAction({ goalId, timeZone: getLocalTimeZone() }),
  };
}
