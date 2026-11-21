import { decidePlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { type PlacementTestActions } from "@zoonk/learn/placement-test/actions";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  answerPlacementAction,
  finishPlacementPartAction,
  getPlacementAction,
  startPlacementSittingAction,
} from "./onboarding-actions";

export function getPlacementTestActions(goalId: string): PlacementTestActions {
  return {
    answer: (input) => answerPlacementAction({ ...input, goalId, timeZone: getLocalTimeZone() }),
    finish: (input) =>
      finishPlacementPartAction({ ...input, goalId, timeZone: getLocalTimeZone() }),
    get: () => getPlacementAction({ goalId, timeZone: getLocalTimeZone() }),
    start: (length) =>
      startPlacementSittingAction({ goalId, length, timeZone: getLocalTimeZone() }),
    undo: (changeId) => decidePlanChangeAction(goalId, { changeId, status: "undone" }),
  };
}
