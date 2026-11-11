import { type FocusTestActions } from "@zoonk/learn/focus-test/actions";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  answerPlacementAction,
  finishPlacementAction,
  getPlacementAction,
  startPlacementSittingAction,
} from "./onboarding-actions";

/** The same test from onboarding's step and from a plan: both read and write the goal's placement. */
export function getFocusTestActions(goalId: string): FocusTestActions {
  return {
    answer: (input) => answerPlacementAction({ ...input, goalId, timeZone: getLocalTimeZone() }),
    finish: () =>
      finishPlacementAction({ fromScratch: false, goalId, timeZone: getLocalTimeZone() }),
    get: () => getPlacementAction({ goalId, timeZone: getLocalTimeZone() }),
    start: () => startPlacementSittingAction({ goalId, timeZone: getLocalTimeZone() }),
  };
}
